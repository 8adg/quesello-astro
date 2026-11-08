import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const MENU_ITEMS = [
  { id: 'dashboard', label: 'Panel de control', mobileTitle: 'Panel', icon: 'monitor', path: '/admin' },
  { id: 'presupuestos', label: 'Presupuestos', mobileTitle: 'Presupuestos', icon: 'receipt', path: '/admin/presupuestos' },
  { id: 'categorias', label: 'Categorías', mobileTitle: 'Categorías', icon: 'layout-grid', path: '/admin/categorias' },
  { id: 'productos', label: 'Productos', mobileTitle: 'Productos', icon: 'stamp', path: '/admin/productos' },
  { id: 'sliders', label: 'Menús sliders', mobileTitle: 'Sliders', icon: 'list', path: '/admin/sliders' },
  { id: 'posts', label: 'Posts', mobileTitle: 'Posts', icon: 'newspaper', path: '/admin/posts', hideOnMobileBottom: true },
  { id: 'franquicias', label: 'Franquicias', mobileTitle: 'Franquicias', icon: 'store', path: '/admin/franquicias' },
  { id: 'config', label: 'Configuración', mobileTitle: 'Configuración', icon: 'settings', path: '/admin/configuracion' },
];

export default function AdminSidebar({ activeId = 'dashboard' }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [userName, setUserName] = useState('Cargando...');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setUserName(session.user.user_metadata?.nombre || 'Administrador');
          setIsSuperAdmin(Number(session.user.user_metadata?.franquicia_id) === 1);
        } else {
          setUserName('Casa Matriz');
          setIsSuperAdmin(true);
        }
      } catch (e) {
        setUserName('Casa Matriz (Offline)');
        setIsSuperAdmin(true);
      }
    };
    checkUser();
  }, []);

  const getIcon = (name, color, size = '24px') => {
    const iconMap = {
      monitor: 'lucide/monitor',
      receipt: 'lucide/receipt',
      'layout-grid': 'lucide/shapes',
      stamp: 'mdi/stamper',
      list: 'lucide/list',
      newspaper: 'lucide/newspaper',
      store: 'lucide/store',
      settings: 'lucide/settings',
    };
    const iconKey = (iconMap[name] || name).replace(':', '/');
    return (
      <img
        src={`https://api.iconify.design/${iconKey}.svg?color=${encodeURIComponent(color)}`}
        style={{ width: size, height: size }}
        alt=""
      />
    );
  };

  const activeItem = MENU_ITEMS.find((i) => i.id === activeId) || MENU_ITEMS[0];
  const visibleItems = MENU_ITEMS.filter((item) => isSuperAdmin || item.id !== 'franquicias');
  const mobileBottomItems = visibleItems.filter((item) => !item.hideOnMobileBottom);

  return (
    <>
      {/* =========================================
          VISTA MOBILE: HEADER SUPERIOR + BARRA INFERIOR
         ========================================= */}
      <div className="admin-mobile-header">
        <a href="/admin/presupuestos" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img src="/iso-color.svg" style={{ width: '40px', height: '40px' }} alt="Queselló" />
        </a>

        <h1 className="admin-mobile-title">{activeItem.mobileTitle || activeItem.label}</h1>

        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menú de usuario y notificaciones"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '14px',
              background: '#F4F1E1',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            }}
          >
            {/* Icono usuario con candado igual a la captura */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5A4A36" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="10" cy="7" r="4" />
              <path d="M10.3 15H7a4 4 0 0 0-4 4v2" />
              <rect x="15" y="15" width="6" height="5" rx="1" fill="#5A4A36" />
              <path d="M16.5 15v-1.5a1.5 1.5 0 0 1 3 0V15" />
            </svg>
          </button>

          {mobileMenuOpen && (
            <>
              <div
                onClick={() => setMobileMenuOpen(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 980 }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '52px',
                  right: 0,
                  background: '#FAF9F5',
                  borderRadius: '20px',
                  padding: '16px',
                  minWidth: '230px',
                  boxShadow: '0 14px 35px rgba(0,0,0,0.14)',
                  border: '1px solid rgba(75,59,40,0.1)',
                  zIndex: 990,
                  fontFamily: 'Inter, sans-serif',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ fontSize: '13px', color: '#735c3f', borderBottom: '1px solid #EAE5D3', paddingBottom: '10px' }}>
                  Hola, <strong style={{ color: '#4b3b28', fontWeight: 800 }}>{userName}</strong>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    window.dispatchEvent(new CustomEvent('open_push_settings'));
                  }}
                  style={{
                    background: '#F4F1E1',
                    color: '#4b3b28',
                    border: 'none',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: 700,
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <img src="https://api.iconify.design/lucide/bell.svg?color=%234b3b28" style={{ width: '16px', height: '16px' }} alt="" />
                  <span>Notificaciones en celular</span>
                </button>

                <a
                  href="/admin/posts"
                  style={{
                    background: 'transparent',
                    color: '#495D56',
                    textDecoration: 'none',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <img src="https://api.iconify.design/lucide/newspaper.svg?color=%23495D56" style={{ width: '16px', height: '16px' }} alt="" />
                  <span>Administrar Posts</span>
                </a>

                <button
                  type="button"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    window.location.reload();
                  }}
                  style={{
                    background: '#FEE2E2',
                    color: '#991B1B',
                    border: 'none',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: 700,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  Cerrar sesión
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <nav className="admin-mobile-bottom-nav" aria-label="Navegación">
        {mobileBottomItems.map((item) => {
          const isActive = activeId === item.id;
          return (
            <a
              key={item.id}
              href={item.path}
              title={item.label}
              className={`admin-mobile-nav-item${isActive ? ' is-active' : ''}`}
            >
              {getIcon(item.icon, '#495D56', '25px')}
            </a>
          );
        })}
      </nav>

      {/* =========================================
          VISTA DESKTOP: SIDEBAR LATERAL
         ========================================= */}
      <aside
        className="admin-desktop-sidebar"
        style={{
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
          cursor: 'pointer',
        }}
      >
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
            cursor: 'pointer',
          }}
        >
          <img src="/iso-color.svg" style={{ width: '40px', height: '40px' }} alt="Isotipo" />
          {!isCollapsed && <img src="/logo.svg" style={{ height: '22px' }} alt="Logotipo" />}
        </div>

        {/* User profile icon */}
        <div
          style={{
            marginBottom: '40px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: isCollapsed ? 'center' : 'flex-start',
            width: '100%',
            padding: isCollapsed ? '0' : '0 40px',
            boxSizing: 'border-box',
          }}
        >
          {!isCollapsed && (
            <div style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.reload();
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  color: '#94A3B8',
                  fontSize: '11px',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontFamily: 'Inter',
                }}
              >
                Cerrar sesión
              </button>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('open_push_settings'))}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  color: '#FF5E5E',
                  fontSize: '11px',
                  fontWeight: 700,
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontFamily: 'Inter',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <img src="https://api.iconify.design/lucide/bell.svg?color=%23FF5E5E" style={{ width: '13px', height: '13px' }} alt="" />
                <span>Push Celular</span>
              </button>
            </div>
          )}
          <div
            onClick={() => isCollapsed && window.dispatchEvent(new CustomEvent('open_push_settings'))}
            style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            <img src="https://api.iconify.design/lucide/user-round-cog.svg?color=%23735c3f" style={{ width: '24px' }} alt="" />
            {!isCollapsed && (
              <span style={{ fontSize: '15px', fontFamily: 'Inter', whiteSpace: 'nowrap' }}>
                <span style={{ color: '#735c3f', fontWeight: 500 }}>Hola,</span>{' '}
                <strong style={{ color: '#4b3b28', fontWeight: 900 }}>{userName}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '22px',
            flex: 1,
            width: '100%',
            alignItems: 'center',
          }}
        >
          {visibleItems.map((item) => {
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
                  background: isActive ? '#FF5E5E' : isCollapsed ? 'transparent' : '#F4F1E1',
                  color: isActive ? 'white' : '#495D56',
                  transition: 'all 0.2s ease',
                  padding: isCollapsed ? '0' : '0 20px',
                  boxSizing: 'border-box',
                }}
              >
                {getIcon(item.icon, isActive ? '#FFFFFF' : '#495D56')}
                {!isCollapsed && (
                  <span style={{ fontSize: '15px', fontWeight: 500, fontFamily: 'Inter', flex: 1, textTransform: 'capitalize' }}>
                    {item.label}
                  </span>
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
            transition: 'transform 0.3s ease',
          }}
        >
          <img
            src={`https://api.iconify.design/lucide/chevron-${isCollapsed ? 'right' : 'left'}.svg?color=%2394A3B8`}
            style={{ width: '24px' }}
            alt="Toggle"
          />
        </div>
      </aside>

      <style>{`
        .admin-mobile-header {
          display: none;
        }
        .admin-mobile-bottom-nav {
          display: none;
        }
        @media (max-width: 768px) {
          .admin-desktop-sidebar {
            display: none !important;
          }
          .admin-mobile-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 16px 12px 16px;
            background: #EAE5D3;
            font-family: 'Inter', sans-serif;
          }
          .admin-mobile-title {
            margin: 0;
            font-size: 26px;
            font-weight: 800;
            color: #C84343;
            letter-spacing: -0.02em;
          }
          .admin-mobile-bottom-nav {
            display: flex;
            align-items: center;
            justify-content: space-around;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 74px;
            background: #FAF9F5;
            border-radius: 26px 26px 0 0;
            box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.06);
            padding: 0 8px;
            z-index: 950;
          }
          .admin-mobile-nav-item {
            width: 48px;
            height: 48px;
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-decoration: none;
            transition: background 0.2s ease;
          }
          .admin-mobile-nav-item.is-active {
            background: #EAE5D3;
          }
        }
      `}</style>
    </>
  );
}
