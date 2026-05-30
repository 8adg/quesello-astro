import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Habilitar CORS para llamadas desde el panel de administración
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  // Manejo de peticiones preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Validar Token Secreto
    const urlObj = new URL(req.url);
    const secret = urlObj.searchParams.get("secret");
    const systemSecret = Deno.env.get("WEBHOOK_SECRET");

    if (!systemSecret || secret !== systemSecret) {
      console.warn("Intento de acceso no autorizado.");
      return new Response("No autorizado", { status: 401, headers: corsHeaders });
    }

    const mpAccessToken = Deno.env.get("MP_ACCESS_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!mpAccessToken) {
      console.error("Falta la variable de entorno MP_ACCESS_TOKEN.");
      return new Response("Configuración incompleta", { status: 500, headers: corsHeaders });
    }

    // ==========================================
    // MODO GET: SINCRONIZACIÓN MANUAL
    // ==========================================
    if (req.method === "GET") {
      console.log("Iniciando sincronización manual de pagos...");
      
      // Consultar últimos 30 pagos recibidos en Mercado Pago
      const mpSearchUrl = `https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=30`;
      const mpResponse = await fetch(mpSearchUrl, {
        headers: { "Authorization": `Bearer ${mpAccessToken}` }
      });

      if (!mpResponse.ok) {
        console.error("Error al consultar API de búsqueda de MP:", await mpResponse.text());
        return new Response("Error al conectar con Mercado Pago", { status: 502, headers: corsHeaders });
      }

      const searchResults = await mpResponse.json();
      const paymentsList = searchResults.results || [];
      console.log(`Se recuperaron ${paymentsList.length} transacciones de Mercado Pago.`);

      let syncCount = 0;

      for (const paymentDetails of paymentsList) {
        const paymentId = paymentDetails.id;
        const monto = paymentDetails.transaction_amount;
        const status = paymentDetails.status;
        const fechaAcreditacion = paymentDetails.date_approved || paymentDetails.date_created || new Date().toISOString();

        // Extraer nombre del pagador
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

        if (payerName === "TRANSFERENCIA RECIBIDA" && paymentDetails.transaction_details?.financial_institution) {
          payerName = `TRANSF: ${paymentDetails.transaction_details.financial_institution}`.toUpperCase();
        }

        const payerDocument = paymentDetails.payer?.identification?.number || null;
        const concepto = (paymentDetails.description || paymentDetails.statement_descriptor || "").toUpperCase();

        let presupuestoId = null;

        // Algoritmo de Auto-Aprobación
        const matchStandard = concepto.match(/(\d{5}-\d{2})/);
        const matchWeb = concepto.match(/(W\d{5})/i);
        const numeroIdentificado = matchStandard ? matchStandard[1] : (matchWeb ? matchWeb[1].toUpperCase() : null);

        if (numeroIdentificado && status === "approved") {
          const { data: budget } = await supabase
            .from("presupuestos")
            .select("id, total, pagado")
            .eq("numero", numeroIdentificado)
            .eq("pagado", false)
            .maybeSingle();

          if (budget) {
            const diff = Math.abs(Number(budget.total) - Number(monto));
            if (diff < 1.00) {
              presupuestoId = budget.id;
              await supabase
                .from("presupuestos")
                .update({ pagado: true, estado: "EN PROCESO" })
                .eq("id", budget.id);
            }
          }
        }

        // Guardar/actualizar en DB
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

        if (!upsertError) syncCount++;
      }

      return new Response(JSON.stringify({ success: true, count: syncCount }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ==========================================
    // MODO POST: WEBHOOK TRADICIONAL
    // ==========================================
    if (req.method === "POST") {
      const body = await req.json();
      console.log("Notificación Webhook recibida:", JSON.stringify(body));

      if (body.type !== "payment" || !body.data?.id) {
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      const paymentId = body.data.id;
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { "Authorization": `Bearer ${mpAccessToken}` }
      });

      if (!mpResponse.ok) {
        console.error(`Error al consultar pago ${paymentId}:`, await mpResponse.text());
        return new Response("Error al consultar MP", { status: 502, headers: corsHeaders });
      }

      const paymentDetails = await mpResponse.json();
      const monto = paymentDetails.transaction_amount;
      const status = paymentDetails.status;
      const fechaAcreditacion = paymentDetails.date_approved || paymentDetails.date_created || new Date().toISOString();

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

      if (payerName === "TRANSFERENCIA RECIBIDA" && paymentDetails.transaction_details?.financial_institution) {
        payerName = `TRANSF: ${paymentDetails.transaction_details.financial_institution}`.toUpperCase();
      }

      const payerDocument = paymentDetails.payer?.identification?.number || null;
      const concepto = (paymentDetails.description || paymentDetails.statement_descriptor || "").toUpperCase();

      let presupuestoId = null;

      const matchStandard = concepto.match(/(\d{5}-\d{2})/);
      const matchWeb = concepto.match(/(W\d{5})/i);
      const numeroIdentificado = matchStandard ? matchStandard[1] : (matchWeb ? matchWeb[1].toUpperCase() : null);

      if (numeroIdentificado && status === "approved") {
        const { data: budget } = await supabase
          .from("presupuestos")
          .select("id, total, pagado")
          .eq("numero", numeroIdentificado)
          .eq("pagado", false)
          .maybeSingle();

        if (budget) {
          const diff = Math.abs(Number(budget.total) - Number(monto));
          if (diff < 1.00) {
            presupuestoId = budget.id;
            await supabase
              .from("presupuestos")
              .update({ pagado: true, estado: "EN PROCESO" })
              .eq("id", budget.id);
          }
        }
      }

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
        console.error("Error en webhook upsert:", upsertError);
        return new Response("Error de base de datos", { status: 500, headers: corsHeaders });
      }

      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    return new Response("Método no permitido", { status: 405, headers: corsHeaders });
  } catch (err) {
    console.error("Error crítico:", err);
    return new Response("Error interno", { status: 500, headers: corsHeaders });
  }
});
