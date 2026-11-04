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
    let reg = await navigator.serviceWorker.getRegistration('/');
    if (!reg) {
      reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    }
    await navigator.serviceWorker.ready;
    return reg;
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
    if (!reg) return { supported: true, subscribed: false, permission };
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
      'En iPhone/iPad primero tocá el botón Compartir de Safari y elegí "Agregar a pantalla de inicio". Luego abrí la App desde tu inicio para activar las notificaciones.'
    );
  }

  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Tu navegador no soporta notificaciones Web Push nativas.');
  }

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    throw new Error('Debés permitir las notificaciones en el navegador para recibir alertas.');
  }

  const reg = await ensureServiceWorker();
  if (!reg) {
    throw new Error('No se pudo inicializar el Service Worker.');
  }

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const subJson = sub.toJSON();

  // Guardar en Supabase -> tabla config (clave: admin_push_subscriptions)
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

  return subJson;
}

export async function notifyNewWebOrder({
  orderNumber = '',
  clientName = 'Cliente Web',
  total = 0,
  summary = '',
  phone = '',
}) {
  try {
    const formattedTotal = Number(total || 0).toLocaleString('es-AR');
    const lines = [
      `Cliente: ${clientName}`,
      `Total: $${formattedTotal}`,
      summary ? `Detalle: ${summary}` : null,
      phone ? `Tel: ${phone}` : null,
    ].filter(Boolean);

    await fetch(PUSH_FUNCTION_URL, {
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
  } catch (err) {
    console.warn('No se pudo disparar la notificación push remota:', err);
  }
}

