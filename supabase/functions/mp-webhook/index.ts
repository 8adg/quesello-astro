import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Habilitar CORS para llamadas desde el panel de administración
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function extractPaymentFields(paymentDetails: any) {
  const paymentId = paymentDetails.id;
  const monto = paymentDetails.transaction_amount;
  const status = paymentDetails.status;
  const fechaAcreditacion = paymentDetails.date_approved || paymentDetails.date_created || new Date().toISOString();

  // Extraer nombre del pagador desde todas las ubicaciones posibles de MP (Checkout + Transferencias CVU/Coelsa)
  let payerName = "Transferencia Recibida";
  const bankPayer = paymentDetails.point_of_interaction?.transaction_data?.bank_info?.payer;

  if (paymentDetails.payer?.first_name || paymentDetails.payer?.last_name) {
    const parts = [paymentDetails.payer.first_name, paymentDetails.payer.last_name].filter(Boolean);
    payerName = parts.join(" ").toUpperCase();
  } else if (bankPayer?.long_name || bankPayer?.account_holder_name) {
    payerName = (bankPayer.long_name || bankPayer.account_holder_name).toUpperCase();
  } else if (paymentDetails.additional_info?.payer?.first_name || paymentDetails.additional_info?.payer?.last_name) {
    const parts = [paymentDetails.additional_info.payer.first_name, paymentDetails.additional_info.payer.last_name].filter(Boolean);
    payerName = parts.join(" ").toUpperCase();
  } else if (paymentDetails.payer?.email) {
    payerName = paymentDetails.payer.email;
  }

  if (payerName === "Transferencia Recibida" && paymentDetails.transaction_details?.financial_institution) {
    payerName = `TRANSF: ${paymentDetails.transaction_details.financial_institution}`.toUpperCase();
  }

  const payerDocument =
    paymentDetails.payer?.identification?.number ||
    bankPayer?.identification?.number ||
    bankPayer?.id ||
    null;

  const rawConceptParts = [
    paymentDetails.external_reference,
    paymentDetails.description,
    paymentDetails.statement_descriptor,
    paymentDetails.point_of_interaction?.transaction_data?.bank_info?.origin_wallet_id
  ].filter(Boolean);
  const concepto = rawConceptParts.join(" | ").toUpperCase();

  return { paymentId, monto, status, fechaAcreditacion, payerName, payerDocument, concepto };
}

async function processAndSavePayment(supabase: any, paymentDetails: any) {
  const { paymentId, monto, status, fechaAcreditacion, payerName, payerDocument, concepto } =
    extractPaymentFields(paymentDetails);

  // Solo guardar pagos aprobados o acreditados
  if (status && status !== "approved" && status !== "authorized") {
    return { saved: false, autoLinked: false, budgetNumero: null };
  }

  // Verificar si este pago ya estaba vinculado a un presupuesto para no pisar vinculaciones manuales
  const { data: existingPayment } = await supabase
    .from("pagos_recibidos_mp")
    .select("presupuesto_id")
    .eq("mp_payment_id", String(paymentId))
    .maybeSingle();

  let presupuestoId = existingPayment?.presupuesto_id || null;
  let autoLinked = false;
  let budgetNumero = null;

  if (!presupuestoId && status === "approved") {
    // 1. Buscar por número en concepto o external_reference (00194-01 o W00175)
    const matchStandard = concepto.match(/(\d{5}-\d{2})/);
    const matchWeb = concepto.match(/(W\d{5})/i);
    const numeroIdentificado = matchStandard ? matchStandard[1] : (matchWeb ? matchWeb[1].toUpperCase() : null);

    if (numeroIdentificado) {
      const { data: budget } = await supabase
        .from("presupuestos")
        .select("id, numero, total, pagado")
        .eq("numero", numeroIdentificado)
        .eq("pagado", false)
        .maybeSingle();

      if (budget) {
        const diff = Math.abs(Number(budget.total) - Number(monto));
        if (diff < 1.00) {
          presupuestoId = budget.id;
          budgetNumero = budget.numero;
          autoLinked = true;
          await supabase
            .from("presupuestos")
            .update({ pagado: true, estado: "EN PROCESO" })
            .eq("id", budget.id);
        }
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

  return {
    saved: !upsertError,
    error: upsertError,
    autoLinked,
    budgetNumero,
    payerName,
    monto
  };
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Permitir leer mp_access_token desde tabla config (editable desde Admin) con fallback a env var
    const { data: configTokenRow } = await supabase
      .from("config")
      .select("valor")
      .eq("clave", "mp_access_token")
      .maybeSingle();

    const envToken = Deno.env.get("MP_ACCESS_TOKEN") || "";
    const tokenSource = configTokenRow?.valor?.trim() ? "config_table" : (envToken ? "env_secret" : "none");
    const rawToken = configTokenRow?.valor?.trim() || envToken;
    const mpAccessToken = rawToken.trim().replace(/^["']|["']$/g, "");

    if (!mpAccessToken) {
      console.error("Falta configurar MP_ACCESS_TOKEN.");
      return new Response(
        JSON.stringify({
          error: "Falta configurar el Access Token de Mercado Pago.",
          code: "MP_TOKEN_MISSING"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==========================================
    // MODO GET: SINCRONIZACIÓN MANUAL
    // ==========================================
    if (req.method === "GET") {
      console.log("Iniciando sincronización manual de pagos...");

      const mpSearchUrl = `https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=30`;
      const mpResponse = await fetch(mpSearchUrl, {
        headers: { "Authorization": `Bearer ${mpAccessToken}` }
      });

      if (!mpResponse.ok) {
        const errBody = await mpResponse.text();
        let parsedErr: any = null;
        try { parsedErr = JSON.parse(errBody); } catch (_) {}

        console.error("Error al consultar API de búsqueda de MP:", mpResponse.status, errBody);
        return new Response(
          JSON.stringify({
            error: "Error al conectar con Mercado Pago",
            mpStatus: mpResponse.status,
            mpMessage: parsedErr?.message || errBody,
            mpCause: parsedErr?.cause || null,
            tokenSource,
            tokenPrefix: mpAccessToken.slice(0, 12) + "..."
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const searchResults = await mpResponse.json();
      const paymentsList = searchResults.results || [];
      console.log(`Se recuperaron ${paymentsList.length} transacciones de Mercado Pago.`);

      let syncCount = 0;
      let autoLinkedCount = 0;

      for (const paymentDetails of paymentsList) {
        const res = await processAndSavePayment(supabase, paymentDetails);
        if (res.saved) syncCount++;
        if (res.autoLinked) autoLinkedCount++;
      }

      return new Response(
        JSON.stringify({
          success: true,
          count: syncCount,
          totalFound: paymentsList.length,
          autoLinkedCount,
          tokenSource
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // ==========================================
    // MODO POST: WEBHOOK / IPN DE MERCADO PAGO
    // ==========================================
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      console.log("Notificación Webhook recibida:", JSON.stringify(body));

      // Soportar tanto formato Webhook v1 (body.type === 'payment', body.data.id) como IPN query params (topic=payment&id=...)
      const topic = body.type || body.topic || urlObj.searchParams.get("type") || urlObj.searchParams.get("topic");
      const paymentId =
        body.data?.id ||
        urlObj.searchParams.get("data.id") ||
        urlObj.searchParams.get("id") ||
        (typeof body.resource === "string" && /^\d+$/.test(body.resource) ? body.resource : null);

      if (topic !== "payment" || !paymentId) {
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { "Authorization": `Bearer ${mpAccessToken}` }
      });

      if (!mpResponse.ok) {
        console.error(`Error al consultar pago ${paymentId}:`, await mpResponse.text());
        return new Response("Error al consultar MP", { status: 502, headers: corsHeaders });
      }

      const paymentDetails = await mpResponse.json();
      const result = await processAndSavePayment(supabase, paymentDetails);

      if (result.error) {
        console.error("Error en webhook upsert:", result.error);
        return new Response("Error de base de datos", { status: 500, headers: corsHeaders });
      }

      // Enviar notificación Push al celular del Admin cuando entra un pago
      if (result.saved) {
        try {
          const pushTitle = result.autoLinked
            ? `💸 ¡Pago Acreditado (${result.budgetNumero})!`
            : `💸 Transferencia MP Recibida`;
          const pushMsg = result.autoLinked
            ? `${result.payerName} pagó $${Number(result.monto).toLocaleString("es-AR")} — Presupuesto ${result.budgetNumero} marcado PAGADO.`
            : `${result.payerName} transfirió $${Number(result.monto).toLocaleString("es-AR")} (pendiente de conciliar).`;

          await fetch(`${supabaseUrl}/functions/v1/push-notify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: pushTitle,
              message: pushMsg,
              url: "/admin/presupuestos",
              tag: `mp-payment-${paymentId}`
            })
          });
        } catch (pushErr) {
          console.warn("No se pudo enviar push de pago MP:", pushErr);
        }
      }

      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    return new Response("Método no permitido", { status: 405, headers: corsHeaders });
  } catch (err) {
    console.error("Error crítico:", err);
    return new Response("Error interno", { status: 500, headers: corsHeaders });
  }
});
