import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const MENU_ITEMS = [
  { id: 'dashboard', label: 'Panel de control', icon: 'monitor', path: '/admin' },
  { id: 'presupuestos', label: 'Presupuestos', icon: 'receipt', path: '/admin/presupuestos' },
  { id: 'categorias', label: 'Categorías', icon: 'layout-grid', path: '/admin/categorias' },
  { id: 'productos', label: 'Productos', icon: 'stamp', path: '/admin/productos' },
  { id: 'sliders', label: 'Menús sliders', icon: 'list', path: '/admin/sliders' },
  { id: 'franquicias', label: 'Franquicias', icon: 'store', path: '/admin/franquicias' },
  { id: 'config', label: 'Configuración', icon: 'settings', path: '/admin/configuracion' },
];

export default function AdminSidebar({ activeId = 'dashboard' }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [userName, setUserName] = useState("Cargando...");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setUserName(session.user.user_metadata?.nombre || "Administrador");
          setIsSuperAdmin(session.user.user_metadata?.franquicia_id === 1);
        } else {
          // Si no hay sesión (dev mode), asumimos que es Casa Matriz para no romper el flujo
          setUserName("Casa Matriz");
          setIsSuperAdmin(true);
        }
      } catch (e) {
        setUserName("Casa Matriz (Offline)");
        setIsSuperAdmin(true);
      }
    };
    checkUser();
  }, []);
  
  const getIcon = (name, color, size = '24px') => {
    const iconMap = {
      'monitor': 'lucide:monitor',
      'receipt': 'lucide:receipt',
      'layout-grid': 'lucide:shapes',
      'stamp': 'mdi:stamper',
      'list': 'lucide:list',
      'store': 'lucide:store',
      'settings': 'lucide:settings',
    };
    return <img src={`https://api.iconify.design/${iconMap[name] || name}.svg?color=${encodeURIComponent(color)}`} style={{ width: size, height: size }} alt="" />;
  };

  return (
    <aside style={{
      width: isCollapsed ? '90px' : '280px',
      height: 'calc(100vh - 40px)',
      background: 'white',
      borderRadius: '40px',
      padding: '40px 0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      boxSizing: 'border-box',
      overflow: 'hidden',
      cursor: 'pointer' // El Sidebar mismo puede ser el toggle o el header
    }}>
      
      {/* Header / Brand */}
      <div 
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{ 
          marginBottom: '50px', 
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          width: '100%',
          padding: isCollapsed ? '0' : '0 40px',
          boxSizing: 'border-box',
          cursor: 'pointer'
        }}
      >
        <img src="/iso-color.svg" style={{ width: '40px', height: '40px' }} alt="Isotipo" />
        {!isCollapsed && (
          <img src="/logo.svg" style={{ height: '22px' }} alt="Logotipo" />
        )}
      </div>

      {/* User profile icon (Solo icono en colapsado) */}
      <div style={{ marginBottom: '50px', display: 'flex', flexDirection: 'column', alignItems: isCollapsed ? 'center' : 'flex-start', width: '100%', padding: isCollapsed ? '0' : '0 40px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
             <img src="https://api.iconify.design/lucide:user-round-cog.svg?color=%23735c3f" style={{ width: '24px' }} alt="" />
             {!isCollapsed && <span style={{ fontSize: '16px', color: '#735c3f', fontWeight: 500, fontFamily: 'Inter' }}>Hola</span>}
        </div>
        {!isCollapsed && <div style={{ fontSize: '20px', fontWeight: 900, color: '#4b3b28', fontFamily: 'Inter', marginTop: '5px' }}>{userName}</div>}
      </div>

      {/* Navigation */}
      <nav style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '30px', 
        flex: 1,
        width: '100%',
        alignItems: 'center'
      }}>
        {MENU_ITEMS.filter(item => isSuperAdmin || item.id !== 'franquicias').map((item) => {
          const isActive = activeId === item.id;
          return (
            <a 
              key={item.id}
              href={item.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '15px',
                width: isCollapsed ? '50px' : 'calc(100% - 40px)',
                height: '50px',
                borderRadius: '20px',
                textDecoration: 'none',
                background: isActive ? '#FF5E5E' : (isCollapsed ? 'transparent' : '#F4F1E1'),
                color: isActive ? 'white' : '#495D56',
                transition: 'all 0.2s ease',
                padding: isCollapsed ? '0' : '0 20px',
                boxSizing: 'border-box'
              }}
            >
              {getIcon(item.icon, isActive ? '#FFFFFF' : '#495D56')}
              {!isCollapsed && (
                <span style={{ fontSize: '15px', fontWeight: 500, fontFamily: 'Inter', flex: 1, textTransform: 'capitalize' }}>{item.label}</span>
              )}
            </a>
          );
        })}
      </nav>

      {/* Bottom Toggle Arrow */}
      <div 
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{
          marginTop: 'auto',
          padding: '20px',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          color: '#94A3B8',
          opacity: 0.6,
          transition: 'transform 0.3s ease'
        }}
      >
        <img 
          src={`https://api.iconify.design/lucide:chevron-${isCollapsed ? 'right' : 'left'}.svg?color=%2394A3B8`} 
          style={{ width: '24px' }} 
          alt="Toggle" 
        />
      </div>

    </aside>
  );
}
