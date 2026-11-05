import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Habilitar CORS para llamadas desde el panel de administración
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function parseBudgetDate(fechaStr: string): Date | null {
  if (!fechaStr) return null;
  const parts = fechaStr.split('/');
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]), 12, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(fechaStr);
  return isNaN(d.getTime()) ? null : d;
}

function extractPaymentFields(paymentDetails: any, ownerCollectorId: string) {
  const paymentId = paymentDetails.id;
  const monto = paymentDetails.transaction_amount;
  const status = paymentDetails.status;
  const fechaAcreditacion = paymentDetails.date_approved || paymentDetails.date_created || new Date().toISOString();

  // En transferencias CVU (account_fund), MP pone los datos del propio titular receptor en paymentDetails.payer
  const isSelfPayerInMp =
    ownerCollectorId &&
    String(paymentDetails.payer?.id || "") === String(ownerCollectorId);

  const bankPayer = paymentDetails.point_of_interaction?.transaction_data?.bank_info?.payer;
  const e2eId = paymentDetails.point_of_interaction?.transaction_data?.e2e_id || null;

  let payerName = "TRANSFERENCIA CVU / BANCARIA";
  let payerDocument: string | null = null;

  if (!isSelfPayerInMp && (paymentDetails.payer?.first_name || paymentDetails.payer?.last_name)) {
    const parts = [paymentDetails.payer.first_name, paymentDetails.payer.last_name].filter(Boolean);
    payerName = parts.join(" ").toUpperCase();
  } else if (bankPayer?.long_name || bankPayer?.account_holder_name) {
    payerName = (bankPayer.long_name || bankPayer.account_holder_name).toUpperCase();
  } else if (!isSelfPayerInMp && (paymentDetails.additional_info?.payer?.first_name || paymentDetails.additional_info?.payer?.last_name)) {
    const parts = [paymentDetails.additional_info.payer.first_name, paymentDetails.additional_info.payer.last_name].filter(Boolean);
    payerName = parts.join(" ").toUpperCase();
  } else if (!isSelfPayerInMp && paymentDetails.payer?.email) {
    payerName = paymentDetails.payer.email;
  } else if (paymentDetails.payment_method_id === "cvu") {
    payerName = "TRANSFERENCIA CVU RECIBIDA";
  } else if (paymentDetails.payment_method_id === "account_money") {
    payerName = "TRANSFERENCIA MERCADO PAGO";
  }

  if (!isSelfPayerInMp && paymentDetails.payer?.identification?.number) {
    payerDocument = `${paymentDetails.payer.identification.type || 'DOC'}: ${paymentDetails.payer.identification.number}`;
  } else if (bankPayer?.identification?.number || bankPayer?.id) {
    payerDocument = String(bankPayer.identification?.number || bankPayer.id);
  } else if (e2eId) {
    payerDocument = `COELSA: ${e2eId}`;
  }

  const rawDesc = paymentDetails.description && paymentDetails.description !== "Bank Transfer"
    ? paymentDetails.description
    : null;

  const rawConceptParts = [
    paymentDetails.external_reference,
     paymentDetails.point_of_interaction?.forward_data?.concept,
    rawDesc,
    paymentDetails.statement_descriptor,
    paymentDetails.point_of_interaction?.transaction_data?.bank_info?.origin_wallet_id
  ].filter(Boolean);

  const concepto = rawConceptParts.length > 0
    ? rawConceptParts.join(" | ").toUpperCase()
    : (paymentDetails.payment_method_id === "cvu" ? "INGRESO POR TRANSFERENCIA CVU" : "TRANSFERENCIA MP");

  return { paymentId, monto, status, fechaAcreditacion, payerName, payerDocument, concepto };
}

async function processAndSavePayment(
  supabase: any,
  paymentDetails: any,
  ownerCollectorId: string,
  allBudgets: any[],
  linkedBudgetIds: Set<number>
) {
  // Ignorar compras salientes (donde collector_id no es nuestra cuenta) o ingresos propios por Debin
  if (ownerCollectorId && String(paymentDetails.collector_id || "") !== String(ownerCollectorId)) {
    return { saved: false, skipped: true };
  }
  if (paymentDetails.payment_method_id === "debin_transfer") {
    return { saved: false, skipped: true };
  }

  const { paymentId, monto, status, fechaAcreditacion, payerName, payerDocument, concepto } =
    extractPaymentFields(paymentDetails, ownerCollectorId);

  if (status !== "approved") {
    return { saved: false, skipped: true };
  }

  // Verificar si este pago ya estaba vinculado a un presupuesto o descartado manualmente
  const { data: existingPayment } = await supabase
    .from("pagos_recibidos_mp")
    .select("presupuesto_id, concepto")
    .eq("mp_payment_id", String(paymentId))
    .maybeSingle();

  if (existingPayment?.concepto?.startsWith("[DESCARTADO]")) {
    return { saved: false, skipped: true };
  }

  let presupuestoId = existingPayment?.presupuesto_id || null;
  let autoLinked = false;
  let budgetNumero = null;

  if (!presupuestoId) {
    // 1. Buscar por número explícito en concepto o external_reference (00194-01 o W00175)
    const matchStandard = concepto.match(/(\d{5}-\d{2})/);
    const matchWeb = concepto.match(/(W\d{5})/i);
    const numeroIdentificado = matchStandard ? matchStandard[1] : (matchWeb ? matchWeb[1].toUpperCase() : null);

    if (numeroIdentificado) {
      const budget = allBudgets.find(b => String(b.numero).toUpperCase() === numeroIdentificado);
      if (budget && Math.abs(Number(budget.total) - Number(monto)) < 1.00) {
        presupuestoId = budget.id;
        budgetNumero = budget.numero;
        linkedBudgetIds.add(budget.id);
        if (!budget.pagado) {
          autoLinked = true;
          budget.pagado = true;
          await supabase
            .from("presupuestos")
            .update({ pagado: true, estado: "EN PROCESO" })
            .eq("id", budget.id);
        }
      }
    }

    // 2. Si no tenía número en concepto, verificar si coincide con un presupuesto que YA había sido marcado como PAGADO manualmente en fechas cercanas
    if (!presupuestoId) {
      const payDate = new Date(fechaAcreditacion);
      const historicalMatch = allBudgets.find(b => {
        if (!b.pagado || linkedBudgetIds.has(b.id)) return false;
        if (Math.abs(Number(b.total) - Number(monto)) >= 1.00) return false;
        const bDate = parseBudgetDate(b.fecha);
        if (!bDate || isNaN(payDate.getTime())) return false;
        const diffDays = Math.abs(payDate.getTime() - bDate.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays <= 8;
      });

      if (historicalMatch) {
        presupuestoId = historicalMatch.id;
        budgetNumero = historicalMatch.numero;
        linkedBudgetIds.add(historicalMatch.id);
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const urlObj = new URL(req.url);
    const secret = urlObj.searchParams.get("secret");
    const systemSecret = Deno.env.get("WEBHOOK_SECRET");

    if (!systemSecret || secret !== systemSecret) {
      return new Response("No autorizado", { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      return new Response(
        JSON.stringify({
          error: "Falta configurar el Access Token de Mercado Pago.",
          code: "MP_TOKEN_MISSING"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extraer el user_id (collector_id) del sufijo del Access Token (APP_USR-...-79275219)
    const tokenParts = mpAccessToken.split("-");
    const lastPart = tokenParts[tokenParts.length - 1];
    const ownerCollectorId = /^\d+$/.test(lastPart) ? lastPart : "";

    // Obtener presupuestos y vínculos existentes para emparejar con precisión
    const [{ data: budgetsData }, { data: existingLinksData }] = await Promise.all([
      supabase.from("presupuestos").select("id, numero, cliente, total, fecha, pagado, estado").order("id", { ascending: false }),
      supabase.from("pagos_recibidos_mp").select("presupuesto_id").not("presupuesto_id", "is", null)
    ]);

    const allBudgets = budgetsData || [];
    const linkedBudgetIds = new Set<number>(
      (existingLinksData || []).map((r: any) => Number(r.presupuesto_id)).filter(Boolean)
    );

    // ==========================================
    // MODO GET: SINCRONIZACIÓN MANUAL
    // ==========================================
    if (req.method === "GET") {
      const collectorParam = ownerCollectorId ? `&collector.id=${ownerCollectorId}` : "";
      const mpSearchUrl = `https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=40${collectorParam}`;
      const mpResponse = await fetch(mpSearchUrl, {
        headers: { "Authorization": `Bearer ${mpAccessToken}` }
      });

      if (!mpResponse.ok) {
        const errBody = await mpResponse.text();
        let parsedErr: any = null;
        try { parsedErr = JSON.parse(errBody); } catch (_) {}

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

      let syncCount = 0;
      let autoLinkedCount = 0;

      for (const paymentDetails of paymentsList) {
        const res = await processAndSavePayment(
          supabase,
          paymentDetails,
          ownerCollectorId,
          allBudgets,
          linkedBudgetIds
        );
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
        return new Response("Error al consultar MP", { status: 502, headers: corsHeaders });
      }

      const paymentDetails = await mpResponse.json();
      const result = await processAndSavePayment(
        supabase,
        paymentDetails,
        ownerCollectorId,
        allBudgets,
        linkedBudgetIds
      );

      if (result.error) {
        return new Response("Error de base de datos", { status: 500, headers: corsHeaders });
      }

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
