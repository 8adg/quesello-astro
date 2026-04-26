import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const AdminNotifications = () => {
    const [permission, setPermission] = useState('default');
    const [toast, setToast] = useState(null);
    const NOTIFICATION_SOUND = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3"; 

    useEffect(() => {
        if ('Notification' in window) {
            setPermission(Notification.permission);
        }

        const channel = supabase
            .channel('admin_notifications')
            .on('postgres_changes', 
                { event: 'INSERT', schema: 'public', table: 'presupuestos' }, 
                (payload) => {
                    handleNewOrder(payload.new);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const requestPermission = () => {
        if (!('Notification' in window)) return;
        Notification.requestPermission().then((res) => {
            setPermission(res);
        });
    };

    const handleNewOrder = (order) => {
        const audio = new Audio(NOTIFICATION_SOUND);
        audio.play().catch(e => console.log("Error al reproducir sonido:", e));

        setToast(order);
        setTimeout(() => setToast(null), 8000);

        if (Notification.permission === 'granted') {
            new Notification("📦 ¡Nuevo Pedido!", {
                body: `Cliente: ${order.cliente || 'Desconocido'}\nTotal: $${order.total || 0}`,
                icon: '/favicon.svg'
            });
        }
    };

    return (
        <>
            {/* BOTÓN DE PERMISO */}
            {permission !== 'granted' && (
                <div style={{
                    position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999,
                    background: '#FF5E5E', color: 'white', padding: '12px 20px',
                    borderRadius: '15px', boxShadow: '0 10px 25px rgba(255, 94, 94, 0.4)',
                    display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer',
                    fontFamily: 'Inter', fontWeight: 700, fontSize: '14px'
                }} onClick={requestPermission}>
                    <span style={{ fontSize: '20px' }}>🔔</span>
                    ACTIVAR NOTIFICACIONES
                </div>
            )}

            {/* TOAST DE NUEVO PEDIDO */}
            {toast && (
                <div style={{
                    position: 'fixed', top: '30px', left: '50%', transform: 'translateX(-50%)',
                    zIndex: 10000, background: '#1E293B', color: 'white', padding: '20px 30px',
                    borderRadius: '25px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                    display: 'flex', alignItems: 'center', gap: '20px', width: '90%', maxWidth: '400px',
                    animation: 'slideIn 0.5s cubic-bezier(0.17, 0.84, 0.44, 1)'
                }}>
                    <div style={{ fontSize: '32px' }}>📦</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', opacity: 0.6, fontWeight: 700, letterSpacing: '0.05em' }}>¡NUEVO PEDIDO RECIBIDO!</div>
                        <div style={{ fontSize: '18px', fontWeight: 800 }}>{toast.cliente}</div>
                        <div style={{ fontSize: '16px', color: '#FF5E5E', fontWeight: 900 }}>Total: ${toast.total?.toLocaleString('es-AR')}</div>
                    </div>
                    <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', color: 'white', opacity: 0.5, cursor: 'pointer', fontSize: '20px' }}>×</button>
                </div>
            )}

            <style>{`
                @keyframes slideIn {
                    from { transform: translate(-50%, -100px); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
            `}</style>
        </>
    );
};

export default AdminNotifications;
