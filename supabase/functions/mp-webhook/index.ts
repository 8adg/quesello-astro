import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {
    // 1. Validar Token Secreto (por query parameter para simplificar y asegurar compatibilidad)
    const urlObj = new URL(req.url);
    const secret = urlObj.searchParams.get("secret");
    const systemSecret = Deno.env.get("WEBHOOK_SECRET");

    if (!systemSecret || secret !== systemSecret) {
      console.warn("Intento de acceso no autorizado o WEBHOOK_SECRET no configurado.");
      return new Response("No autorizado", { status: 401 });
    }

    // Solo procesar peticiones POST
    if (req.method !== "POST") {
      return new Response("Método no permitido", { status: 405 });
    }

    const body = await req.json();
    console.log("Notificación recibida de Mercado Pago:", JSON.stringify(body));

    // Verificar que sea un evento de pago
    // Mercado Pago envía notificaciones de test o eventos con diferentes estructuras.
    // Ej: { "type": "payment", "data": { "id": "12345678" } }
    if (body.type !== "payment" || !body.data?.id) {
      console.log("Ignorando evento que no es de pago tipo 'payment'");
      return new Response("OK", { status: 200 });
    }

    const paymentId = body.data.id;
    const mpAccessToken = Deno.env.get("MP_ACCESS_TOKEN");

    if (!mpAccessToken) {
      console.error("Falta la variable de entorno MP_ACCESS_TOKEN.");
      return new Response("Configuración incompleta", { status: 500 });
    }

    // 2. Consultar detalles del pago a la API de Mercado Pago
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        "Authorization": `Bearer ${mpAccessToken}`
      }
    });

    if (!mpResponse.ok) {
      console.error(`Error al consultar pago ${paymentId} en MP:`, await mpResponse.text());
      return new Response("Error al consultar Mercado Pago", { status: 502 });
    }

    const paymentDetails = await mpResponse.json();
    console.log("Detalles del pago obtenidos:", JSON.stringify(paymentDetails));

    // Extraer campos del pago
    const monto = paymentDetails.transaction_amount;
    const status = paymentDetails.status;
    const fechaAcreditacion = paymentDetails.date_approved || paymentDetails.date_created || new Date().toISOString();

    // Obtener nombre del pagador con fallbacks
    let payerName = "Transferencia Recibida";
    if (paymentDetails.payer) {
      const parts = [];
      if (paymentDetails.payer.first_name) parts.push(paymentDetails.payer.first_name);
      if (paymentDetails.payer.last_name) parts.push(paymentDetails.payer.last_name);
      if (parts.length > 0) {
        payerName = parts.join(" ").toUpperCase();
      } else if (paymentDetails.payer.email) {
        payerName = paymentDetails.payer.email;
      }
    }

    // Si viene información de transferencia en transaction_details
    if (payerName === "TRANSFERENCIA RECIBIDA" && paymentDetails.transaction_details?.financial_institution) {
      payerName = `TRANSF: ${paymentDetails.transaction_details.financial_institution}`.toUpperCase();
    }

    const payerDocument = paymentDetails.payer?.identification?.number || null;
    
    // Concepto o descripción
    const concepto = (paymentDetails.description || paymentDetails.statement_descriptor || "").toUpperCase();

    // Conectar a la base de datos Supabase usando credenciales internas de la Edge Function
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let presupuestoId = null;

    // 3. Algoritmo de Auto-Aprobación e identificación
    // Buscar patrones de presupuesto: 00194-01 o W12345
    const matchStandard = concepto.match(/(\d{5}-\d{2})/);
    const matchWeb = concepto.match(/(W\d{5})/i);
    const numeroIdentificado = matchStandard ? matchStandard[1] : (matchWeb ? matchWeb[1].toUpperCase() : null);

    if (numeroIdentificado && status === "approved") {
      console.log(`Buscando presupuesto con número identificado: ${numeroIdentificado}`);
      
      // Consultar si existe presupuesto impago con ese número
      const { data: budget, error: budgetError } = await supabase
        .from("presupuestos")
        .select("id, total, pagado")
        .eq("numero", numeroIdentificado)
        .eq("pagado", false)
        .maybeSingle();

      if (budgetError) {
        console.error("Error al consultar presupuestos:", budgetError);
      } else if (budget) {
        // Verificar si coincide el monto (con tolerancia a centavos/redondeos)
        const diff = Math.abs(Number(budget.total) - Number(monto));
        if (diff < 1.00) {
          console.log(`Coincidencia perfecta! Vinculando pago al presupuesto ID ${budget.id}`);
          presupuestoId = budget.id;

          // Actualizar el presupuesto a pagado y mover estado a EN PROCESO
          const { error: updateError } = await supabase
            .from("presupuestos")
            .update({ 
              pagado: true,
              estado: "EN PROCESO"
            })
            .eq("id", budget.id);

          if (updateError) {
            console.error("Error al marcar presupuesto como pagado:", updateError);
          }
        } else {
          console.log(`Se identificó el presupuesto ${numeroIdentificado} pero el total ($${budget.total}) difiere del monto transferido ($${monto}). Requiere conciliación manual.`);
        }
      } else {
        console.log(`No se encontró ningún presupuesto impago con el número: ${numeroIdentificado}`);
      }
    }

    // 4. Guardar/Actualizar en la tabla de pagos recibidos
    const { error: upsertError } = await supabase
      .from("pagos_recibidos_mp")
      .upsert({
        mp_payment_id: String(paymentId),
        monto: monto,
        payer_name: payerName,
        payer_document: payerDocument,
        concepto: concepto,
        fecha_acreditacion: fechaAcreditacion,
        presupuesto_id: presupuestoId
      }, { onConflict: "mp_payment_id" });

    if (upsertError) {
      console.error("Error al insertar en pagos_recibidos_mp:", upsertError);
      return new Response("Error al guardar en base de datos", { status: 500 });
    }

    return new Response("Procesado correctamente", { status: 200 });
  } catch (err) {
    console.error("Error crítico en webhook:", err);
    return new Response("Error interno del servidor", { status: 500 });
  }
});
