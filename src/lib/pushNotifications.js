import { supabase } from './supabase';

export const VAPID_PUBLIC_KEY =
  'BBrG7_aDODM3rSzx9_Xfpe3yKEIsCPA20T9LqAyVeMD59nnkWqXcGCkH3vKIyAO8U1OGg7wtckjw8ZBUi5OuRSA';

const PUSH_FUNCTION_URL =
  'https://yihizwspxnxlfowvitoe.supabase.co/functions/v1/push-notify';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function logPushDebug(info) {
  try {
    await supabase.from('config').upsert({
      clave: 'admin_push_debug',
      valor: JSON.stringify({
        ...info,
        ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        url: typeof window !== 'undefined' ? window.location.href : '',
        at: new Date().toISOString(),
      }),
    });
  } catch (_) {}
}

export async function ensureServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    let reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

    const worker = reg.installing || reg.waiting || reg.active;
    if (worker && worker.state !== 'activated') {
      await new Promise((resolve) => {
        const onState = () => {
          if (worker.state === 'activated' || worker.state === 'redundant') {
            worker.removeEventListener('statechange', onState);
            resolve();
          }
        };
        worker.addEventListener('statechange', onState);
        setTimeout(resolve, 5000);
      });
    }

    const readyReg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve) => setTimeout(() => resolve(reg), 4000)),
    ]);
    return readyReg || reg;
  } catch (err) {
    console.warn('Error registrando Service Worker:', err);
    return null;
  }
}

export function isIosRequiresInstall() {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  return isIos && !isStandalone;
}

export async function getAdminPushStatus() {
  if (typeof window === 'undefined') {
    return { supported: false, subscribed: false, permission: 'default' };
  }
  if (isIosRequiresInstall()) {
    return {
      supported: false,
      iosNeedsInstall: true,
      subscribed: false,
      permission: 'default',
    };
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return {
      supported: false,
      subscribed: false,
      permission: 'Notification' in window ? Notification.permission : 'unsupported',
    };
  }

  const permission = Notification.permission;
  if (permission !== 'granted') {
    return { supported: true, subscribed: false, permission };
  }

  try {
    const reg = await ensureServiceWorker();
    if (!reg || !reg.pushManager) return { supported: true, subscribed: false, permission };
    const sub = await reg.pushManager.getSubscription();
    return {
      supported: true,
      subscribed: Boolean(sub),
      permission,
      endpoint: sub?.endpoint || null,
    };
  } catch (e) {
    return { supported: true, subscribed: false, permission };
  }
}

export async function subscribeAdminDevice(onStep) {
  const report = (msg) => {
    if (typeof onStep === 'function') onStep(msg);
  };

  try {
    report('Verificando compatibilidad del navegador...');

    if (isIosRequiresInstall()) {
      throw new Error(
        'En iPhone/iPad primero tocá el botón Compartir de Safari y elegí "Agregar a pantalla de inicio". Luego abrí Queselló Admin desde tu pantalla de inicio.'
      );
    }

    if (!window.isSecureContext) {
      throw new Error('Las notificaciones Push requieren entrar con HTTPS (https://quesello.com.ar).');
    }

    if (!('Notification' in window)) {
      throw new Error(
        'Tu navegador no permite notificaciones web. Si estás en iPhone, agregá la web a Pantalla de Inicio primero.'
      );
    }

    // 1. Intentar pedir permiso dentro del gesto de usuario (sin bloquear si Notification.permission quedó cacheado en 'denied')
    let perm = Notification.permission;
    if (perm !== 'granted') {
      report('Solicitando permiso de notificaciones...');
      try {
        perm = await Notification.requestPermission();
      } catch (_) {}
    }

    let permApiState = perm;
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const pStatus = await navigator.permissions.query({ name: 'notifications' });
        permApiState = pStatus.state;
      } catch (_) {}
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('Tu navegador no soporta PushManager en segundo plano.');
    }

    // 2. Asegurar Service Worker activo
    report('Activando Service Worker...');
    const reg = await ensureServiceWorker();
    if (!reg || !reg.pushManager) {
      throw new Error('No se pudo inicializar el Service Worker. Recargá la página e intentá de nuevo.');
    }

    // 3. Suscribir a Web Push con la llave VAPID
    report('Conectando con el servicio Push del celular...');
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      } catch (subErr) {
        const oldSub = await reg.pushManager.getSubscription();
        if (oldSub) {
          await oldSub.unsubscribe().catch(() => {});
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });
        } else {
          if (perm === 'denied' || permApiState === 'denied' || subErr?.name === 'NotAllowedError') {
            throw new Error(
              'Android está bloqueando las notificaciones de Chrome a nivel sistema. En tu celular andá a: Ajustes de Android → Aplicaciones → Chrome → Notificaciones → activá "Permitir notificaciones" (y abajo del todo en "Sitios", verificá que quesello.com.ar esté activado). Luego recargá esta página.'
            );
          }
          throw subErr;
        }
      }
    }

    const subJson = sub.toJSON();

    // 4. Guardar en Supabase -> tabla config (clave: admin_push_subscriptions)
    report('Guardando vinculación en la base de datos...');
    const { data: existingRow } = await supabase
      .from('config')
      .select('valor')
      .eq('clave', 'admin_push_subscriptions')
      .maybeSingle();

    let list = [];
    if (existingRow?.valor) {
      try {
        list = JSON.parse(existingRow.valor);
        if (!Array.isArray(list)) list = [];
      } catch (_) {
        list = [];
      }
    }

    const filtered = list.filter((item) => item?.endpoint && item.endpoint !== subJson.endpoint);
    filtered.push({
      endpoint: subJson.endpoint,
      keys: subJson.keys,
      userAgent: navigator.userAgent.slice(0, 120),
      updatedAt: new Date().toISOString(),
    });

    const { error } = await supabase.from('config').upsert({
      clave: 'admin_push_subscriptions',
      valor: JSON.stringify(filtered),
    });

    if (error) throw error;

    await logPushDebug({
      status: 'SUCCESS',
      endpoint: subJson.endpoint?.slice(0, 60),
      permission: Notification.permission,
    });

    // 5. Mostrar notificación local inmediata para confirmar que el celular suena/vibra
    try {
      if (reg.showNotification) {
        await reg.showNotification('✅ ¡Celular vinculado a Queselló!', {
          body: 'Ya vas a recibir notificaciones aquí cuando entre un pedido web.',
          icon: '/iconos/192.png',
          badge: '/iconos/92.png',
          vibrate: [200, 100, 200],
          tag: 'quesello-welcome-push',
        });
      }
    } catch (_) {}

    return subJson;
  } catch (err) {
    await logPushDebug({
      status: 'ERROR',
      errorName: err?.name || 'Error',
      errorMessage: err?.message || String(err),
      permission: typeof Notification !== 'undefined' ? Notification.permission : 'no-notification-api',
      isSecure: typeof window !== 'undefined' ? window.isSecureContext : false,
      hasSW: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
      hasPush: typeof window !== 'undefined' && 'PushManager' in window,
    });
    throw err;
  }
}

export async function notifyNewWebOrder({
  orderNumber = '',
  clientName = 'Cliente Web',
  total = 0,
  summary = '',
  phone = '',
}) {
  const formattedTotal = Number(total || 0).toLocaleString('es-AR');
  const lines = [
    `Cliente: ${clientName}`,
    `Total: $${formattedTotal}`,
    summary ? `Detalle: ${summary}` : null,
    phone ? `Tel: ${phone}` : null,
  ].filter(Boolean);

  const response = await fetch(PUSH_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `📦 ¡Nuevo Pedido Web ${orderNumber ? '#' + orderNumber : ''}!`,
      message: lines.join(' • '),
      url: '/admin/presupuestos',
      orderNumber,
      tag: `quesello-order-${orderNumber || Date.now()}`,
    }),
  });

  return response.json().catch(() => ({}));
}
