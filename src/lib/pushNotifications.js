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

export async function ensureServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    let reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    if (reg.installing || reg.waiting) {
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((resolve) => setTimeout(resolve, 4000)),
      ]);
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
    return { supported: false, subscribed: false, permission: 'default' };
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

export async function subscribeAdminDevice() {
  if (isIosRequiresInstall()) {
    throw new Error(
      'En iPhone/iPad primero tocá el botón Compartir de Safari y elegí "Agregar a pantalla de inicio". Luego abrí Queselló Admin desde tu pantalla de inicio.'
    );
  }

  if (!window.isSecureContext) {
    throw new Error('Las notificaciones Push requieren entrar con HTTPS (https://quesello.com.ar).');
  }

  if (!('Notification' in window)) {
    throw new Error('Tu navegador no permite notificaciones web. Si estás en iPhone, agregá la web a Pantalla de Inicio primero.');
  }

  // 1. Pedir permiso inmediatamente dentro del gesto de usuario
  let perm = Notification.permission;
  if (perm !== 'granted') {
    perm = await Notification.requestPermission();
  }
  if (perm !== 'granted') {
    throw new Error(
      'Permiso de notificaciones bloqueado en el navegador. Tocá el candado/ajustes al lado de la URL en tu navegador y activá "Notificaciones: Permitir".'
    );
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Tu navegador no soporta PushManager en segundo plano.');
  }

  // 2. Asegurar Service Worker activo
  const reg = await ensureServiceWorker();
  if (!reg || !reg.pushManager) {
    throw new Error('No se pudo inicializar el Service Worker. Recargá la página e intentá de nuevo.');
  }

  // 3. Suscribir a Web Push con la llave VAPID (si había una suscripción vieja incompatible, la renovamos)
  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    try {
      await sub.unsubscribe();
    } catch (_) {}
  }

  sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  const subJson = sub.toJSON();

  // 4. Guardar en Supabase -> tabla config (clave: admin_push_subscriptions)
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
