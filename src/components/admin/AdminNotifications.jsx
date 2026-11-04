import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  getAdminPushStatus,
  subscribeAdminDevice,
  notifyNewWebOrder,
  ensureServiceWorker,
} from '../../lib/pushNotifications';

const AdminNotifications = () => {
  const [pushState, setPushState] = useState({
    loading: true,
    supported: true,
    subscribed: false,
    iosNeedsInstall: false,
    permission: 'default',
  });
  const [subscribing, setSubscribing] = useState(false);
  const [stepText, setStepText] = useState('');
  const [testingPush, setTestingPush] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [dismissedBanner, setDismissedBanner] = useState(false);

  const NOTIFICATION_SOUND =
    'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

  const checkStatus = async () => {
    const st = await getAdminPushStatus();
    setPushState({ loading: false, ...st });
  };

  useEffect(() => {
    checkStatus();

    const onOpenModal = () => {
      checkStatus();
      setShowSettingsModal(true);
    };
    window.addEventListener('open_push_settings', onOpenModal);

    const channel = supabase
      .channel('admin_notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'presupuestos' },
        (payload) => {
          handleNewOrder(payload.new);
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('open_push_settings', onOpenModal);
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSubscribe = async () => {
    setShowSettingsModal(true);
    setSubscribing(true);
    setStepText('Iniciando vinculación...');
    setAttemptCount((c) => c + 1);
    try {
      await subscribeAdminDevice((step) => setStepText(step));
      await checkStatus();
      setStatusMsg({
        type: 'ok',
        text: '✅ ¡Listo! Este celular quedó vinculado. Tocá "Enviar notificación de prueba" abajo para probarlo.',
      });
    } catch (err) {
      await checkStatus();
      setStatusMsg({
        type: 'error',
        text: err?.message || 'No se pudo activar la notificación.',
      });
    } finally {
      setSubscribing(false);
      setStepText('');
    }
  };

  const handleTestPush = async () => {
    setTestingPush(true);
    setStatusMsg(null);
    try {
      const res = await notifyNewWebOrder({
        orderNumber: 'PRUEBA',
        clientName: 'PRUEBA QUESELLÓ',
        total: 13500,
        summary: 'Notificación de prueba en celular',
      });
      setStatusMsg({
        type: 'ok',
        text: `📲 Notificación de prueba enviada (${res?.sent || 1} disp.). Debería sonar en tu celular ahora mismo.`,
      });
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text: 'Error al enviar prueba: ' + (err?.message || ''),
      });
    } finally {
      setTestingPush(false);
    }
  };

  const handleNewOrder = async (order) => {
    try {
      const audio = new Audio(NOTIFICATION_SOUND);
      audio.play().catch(() => {});
    } catch (_) {}

    setToast(order);
    setTimeout(() => setToast(null), 8000);

    window.dispatchEvent(new CustomEvent('new_order_received', { detail: order }));

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const title = '📦 ¡Nuevo Pedido!';
      const options = {
        body: `Cliente: ${order.cliente || 'Desconocido'}\nTotal: $${(order.total || 0).toLocaleString('es-AR')}`,
        icon: '/iconos/192.png',
        badge: '/iconos/92.png',
        vibrate: [200, 100, 200],
        tag: `order-live-${order.id || Date.now()}`,
      };

      try {
        const reg = await ensureServiceWorker();
        if (reg && reg.showNotification) {
          await reg.showNotification(title, options);
        } else {
          new Notification(title, options);
        }
      } catch (_) {
        try {
          new Notification(title, options);
        } catch (__) {}
      }
    }
  };

  return (
    <div>
      {/* BANNER FLOTANTE SI AÚN NO VINCULÓ EL DISPOSITIVO A WEB PUSH */}
      {!pushState.loading && !pushState.subscribed && !dismissedBanner && (
        <div className="admin-push-banner">
          <button
            type="button"
            onClick={() => {
              setStatusMsg(null);
              setShowSettingsModal(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flex: 1,
              cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 800,
              fontSize: '13px',
              textAlign: 'left',
              padding: 0,
            }}
          >
            <span style={{ fontSize: '18px' }}>🔔</span>
            <span>
              {pushState.iosNeedsInstall
                ? 'INSTALAR APP PARA NOTIFICACIONES'
                : 'ACTIVAR NOTIFICACIONES EN ESTE CELULAR'}
            </span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDismissedBanner(true);
            }}
            aria-label="Cerrar aviso"
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              cursor: 'pointer',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '15px',
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* MODAL DE CONFIGURACIÓN / PRUEBA DE NOTIFICACIONES PUSH */}
      {showSettingsModal && (
        <div
          onClick={() => setShowSettingsModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 10050,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#FAF9F5',
              borderRadius: '28px',
              padding: '28px 24px',
              width: '100%',
              maxWidth: '380px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
              color: '#4b3b28',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#C84343' }}>
                🔔 Avisos en tu Celular
              </h3>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                style={{
                  border: 'none',
                  background: '#EAE5D3',
                  color: '#4b3b28',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            <p style={{ fontSize: '13.5px', color: '#5E7358', lineHeight: 1.45, margin: '0 0 16px 0' }}>
              Recibí una alerta inmediata en tu celular cada vez que alguien envíe un pedido desde la web, <strong>aunque no te escriba por WhatsApp</strong> y tengas el navegador cerrado.
            </p>

            {pushState.iosNeedsInstall ? (
              <div
                style={{
                  background: '#FEF3C7',
                  color: '#92400E',
                  padding: '14px',
                  borderRadius: '16px',
                  fontSize: '13px',
                  lineHeight: 1.45,
                  marginBottom: '16px',
                }}
              >
                <strong>📱 Estás en iPhone/iPad:</strong>
                <ol style={{ margin: '8px 0 0 18px', padding: 0 }}>
                  <li>Tocá el ícono <strong>Compartir</strong> en la barra de Safari.</li>
                  <li>Elegí <strong>&ldquo;Agregar a pantalla de inicio&rdquo;</strong>.</li>
                  <li>Abrí <strong>Queselló Admin</strong> desde tu pantalla de inicio y activá las notificaciones aquí.</li>
                </ol>
              </div>
            ) : (
              <div
                style={{
                  background: pushState.subscribed ? '#D1FAE5' : '#FEE2E2',
                  color: pushState.subscribed ? '#065F46' : '#991B1B',
                  padding: '12px 16px',
                  borderRadius: '16px',
                  fontSize: '13px',
                  fontWeight: 700,
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <span>{pushState.subscribed ? '✅' : '⚠️'}</span>
                <span>
                  {pushState.subscribed
                    ? 'Este dispositivo ya recibe notificaciones Push'
                    : `Estado actual: Desactivado (Permiso navegador: ${pushState.permission || 'default'})`}
                </span>
              </div>
            )}

            {subscribing && stepText && (
              <div
                style={{
                  background: '#EFF6FF',
                  color: '#1D4ED8',
                  border: '1px solid #93C5FD',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: 700,
                  marginBottom: '14px',
                }}
              >
                ⏳ {stepText}
              </div>
            )}

            {statusMsg && (
              <div
                style={{
                  background: statusMsg.type === 'ok' ? '#ECFDF5' : '#1E293B',
                  color: statusMsg.type === 'ok' ? '#065F46' : '#F8FAFC',
                  border: `2px solid ${statusMsg.type === 'ok' ? '#10B981' : '#FF5E5E'}`,
                  padding: '12px 14px',
                  borderRadius: '14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  marginBottom: '14px',
                  lineHeight: 1.45,
                }}
              >
                {attemptCount > 1 && statusMsg.type === 'error' && (
                  <div style={{ fontSize: '11px', color: '#FCA5A5', fontWeight: 800, marginBottom: '4px' }}>
                    INTENTO #{attemptCount}:
                  </div>
                )}
                {statusMsg.text}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {!pushState.iosNeedsInstall && (
                <button
                  type="button"
                  onClick={handleSubscribe}
                  disabled={subscribing}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '16px',
                    border: 'none',
                    background: '#FF5E5E',
                    color: 'white',
                    fontWeight: 800,
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  {subscribing
                    ? '⏳ Vinculando celular...'
                    : pushState.subscribed
                    ? '🔄 Re-sincronizar este dispositivo'
                    : '🔔 Activar notificaciones ahora'}
                </button>
              )}

              {pushState.subscribed && (
                <button
                  type="button"
                  onClick={handleTestPush}
                  disabled={testingPush}
                  style={{
                    width: '100%',
                    padding: '13px',
                    borderRadius: '16px',
                    border: '1.5px solid #495D56',
                    background: 'white',
                    color: '#495D56',
                    fontWeight: 800,
                    fontSize: '13.5px',
                    cursor: 'pointer',
                  }}
                >
                  {testingPush ? 'Enviando prueba...' : '📲 Enviar notificación de prueba'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TOAST DE NUEVO PEDIDO EN VIVO */}
      {toast && (
        <div
          onClick={() => {
            window.location.href = '/admin/presupuestos';
          }}
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10000,
            background: '#1E293B',
            color: 'white',
            padding: '18px 24px',
            borderRadius: '24px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            width: '90%',
            maxWidth: '380px',
            cursor: 'pointer',
            animation: 'slideIn 0.5s cubic-bezier(0.17, 0.84, 0.44, 1)',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <div style={{ fontSize: '30px' }}>📦</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', opacity: 0.7, fontWeight: 700, letterSpacing: '0.05em' }}>
              ¡NUEVO PEDIDO WEB RECIBIDO!
            </div>
            <div style={{ fontSize: '17px', fontWeight: 800 }}>{toast.cliente}</div>
            <div style={{ fontSize: '15px', color: '#FF5E5E', fontWeight: 900 }}>
              Total: ${toast.total?.toLocaleString('es-AR')}
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setToast(null);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              opacity: 0.5,
              cursor: 'pointer',
              fontSize: '20px',
            }}
          >
            ×
          </button>
        </div>
      )}

      <style>{`
        .admin-push-banner {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 9999;
          background: #FF5E5E;
          color: white;
          padding: 12px 18px;
          border-radius: 16px;
          box-shadow: 0 10px 25px rgba(255, 94, 94, 0.4);
          display: flex;
          align-items: center;
          gap: 12px;
          font-family: 'Inter', sans-serif;
          font-weight: 800;
          font-size: 13px;
        }
        @media (max-width: 768px) {
          .admin-push-banner {
            bottom: 84px;
            left: 14px;
            right: 14px;
            justify-content: space-between;
            border-radius: 18px;
            padding: 13px 16px;
          }
        }
        @keyframes slideIn {
          from { transform: translate(-50%, -100px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default AdminNotifications;
