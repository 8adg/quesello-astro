import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_VAPID = {
  publicKey: "BBrG7_aDODM3rSzx9_Xfpe3yKEIsCPA20T9LqAyVeMD59nnkWqXcGCkH3vKIyAO8U1OGg7wtckjw8ZBUi5OuRSA",
  privateKey: "98Kis0wtv_9U7UDxFcnKL-Hsg4-AFMyBeMMvWRncd4E",
  subject: "mailto:hola@quesello.com.ar",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const {
      title = "📦 ¡Nuevo Pedido Web!",
      message = "Recibiste un nuevo pedido en Queselló",
      url = "/admin/presupuestos",
      orderNumber = "",
      tag = `quesello-order-${orderNumber || Date.now()}`,
    } = body;

    // 1. Obtener llaves VAPID de config (o usar default)
    let vapid = DEFAULT_VAPID;
    const { data: vapidRow } = await supabase
      .from("config")
      .select("valor")
      .eq("clave", "vapid_keys")
      .maybeSingle();

    if (vapidRow?.valor) {
      try {
        vapid = { ...DEFAULT_VAPID, ...JSON.parse(vapidRow.valor) };
      } catch (_) {}
    }

    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

    // 2. Obtener suscripciones de dispositivos Admin
    const { data: subsRow } = await supabase
      .from("config")
      .select("valor")
      .eq("clave", "admin_push_subscriptions")
      .maybeSingle();

    let subscriptions: any[] = [];
    if (subsRow?.valor) {
      try {
        subscriptions = JSON.parse(subsRow.valor);
      } catch (_) {
        subscriptions = [];
      }
    }

    if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, info: "Sin dispositivos suscriptos" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = JSON.stringify({
      title,
      body: message,
      url,
      orderNumber,
      tag,
    });

    const validSubscriptions: any[] = [];
    let sentCount = 0;

    for (const sub of subscriptions) {
      if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) continue;
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys.p256dh,
              auth: sub.keys.auth,
            },
          },
          payload
        );
        validSubscriptions.push(sub);
        sentCount++;
      } catch (err: any) {
        const statusCode = err?.statusCode || 0;
        // Si la suscripción expiró o fue revocada (404 / 410), la descartamos
        if (statusCode !== 404 && statusCode !== 410) {
          validSubscriptions.push(sub);
        }
        console.warn("Error enviando push a dispositivo:", statusCode, err?.message);
      }
    }

    // Actualizar suscripciones si alguna expiró
    if (validSubscriptions.length !== subscriptions.length) {
      await supabase.from("config").upsert({
        clave: "admin_push_subscriptions",
        valor: JSON.stringify(validSubscriptions),
      });
    }

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, total: validSubscriptions.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Error en push-notify:", err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || "Error interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

