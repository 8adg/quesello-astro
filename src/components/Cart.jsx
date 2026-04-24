import React, { useRef, useEffect, useState } from "react";
import { useStore } from '@nanostores/react';
import { 
  $cartItems, $isCartOpen, $customerName, $isSaving, 
  $cartTotal, $cartCount, addToCart, removeFromCart, 
  updateQuantity, processOrder 
} from "../store/cart";

/* ── ÍCONO FLOTANTE (isla de React) ── */
export function CartIcon({ franchise }) {
  const itemCount = useStore($cartCount);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (franchise) {
       import('../store/cart').then(m => {
          m.$currentFranchise.set({
              id: franchise.id,
              nombre: franchise.nombre,
              whatsapp: franchise.whatsapp
          });
       });
    }
  }, [franchise]);

  return (
    <div className="cart-icon-wrapper" onClick={() => $isCartOpen.set(true)}>
      <span className="cart-icon-badge">{mounted ? itemCount : 0}</span>
      <img src="/icono-cart.svg" alt="Mi pedido" width={38} height={30} />
    </div>
  );
}

/* ── DRAWER (bottom sheet island) ── */
export function CartDrawer() {
  const items = useStore($cartItems);
  const isCartOpen = useStore($isCartOpen);
  const total = useStore($cartTotal);
  const customerName = useStore($customerName);
  const isSaving = useStore($isSaving);

  const [errorMsg, setErrorMsg] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastName, setToastName] = useState('');

  const drawerRef = useRef(null);
  const dragState = useRef({ startY: 0, dragging: false, currentDelta: 0 });

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isCartOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.overscrollBehavior = "none";
    } else {
      document.body.style.overflow = "";
      document.body.style.overscrollBehavior = "";
    }
  }, [isCartOpen]);

  // Gestos touch: swipe down para cerrar
  function onTouchStart(e) {
    dragState.current.startY = e.touches[0].clientY;
    dragState.current.dragging = true;
    dragState.current.currentDelta = 0;
    if (drawerRef.current) drawerRef.current.style.transition = 'none';
  }

  function onTouchMove(e) {
    if (!dragState.current.dragging) return;
    const deltaY = e.touches[0].clientY - dragState.current.startY;
    if (deltaY < 0) return;
    dragState.current.currentDelta = deltaY;
    if (drawerRef.current) {
      drawerRef.current.style.transform = `translateY(${deltaY}px)`;
    }
  }

  function onTouchEnd() {
    if (!dragState.current.dragging) return;
    dragState.current.dragging = false;
    const delta = dragState.current.currentDelta;

    if (drawerRef.current) {
      drawerRef.current.style.transition = 'bottom 0.4s cubic-bezier(0.17, 0.84, 0.44, 1), transform 0.3s cubic-bezier(0.17, 0.84, 0.44, 1)';
    }

    if (delta > 80) {
      if (drawerRef.current) {
        drawerRef.current.style.transform = 'translateY(100%)';
      }
      setTimeout(() => {
        $isCartOpen.set(false);
        if (drawerRef.current) drawerRef.current.style.transform = '';
      }, 300);
    } else {
      if (drawerRef.current) drawerRef.current.style.transform = 'translateY(0)';
    }
  }

  const handleProcessOrder = async () => {
    if (!customerName) {
      setErrorMsg("POR FAVOR COMPLETAR");
      return;
    }
    const currentName = customerName;
    await processOrder();
    setToastName(currentName);
    setShowToast(true);
  };

  return (
    <>
      <div
        className={`cart-overlay${isCartOpen ? ' cart-overlay--open' : ''}`}
        onClick={() => $isCartOpen.set(false)}
      />

      <div
        ref={drawerRef}
        className={`cart-drawer${isCartOpen ? ' cart-drawer--open' : ''}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="drawer-handle" />

        <div className="cart-drawer-header">
          <h4 style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '22px', margin: 0 }}>Mi pedido</h4>
          <button className="cart-close-btn" onClick={() => $isCartOpen.set(false)}>×</button>
        </div>

        <div className="cart-item-list">
          {!mounted ? null : (
            items.length === 0 ? (
              <p style={{ opacity: 0.5, marginTop: '40px', textAlign: 'center' }}>No hay productos en tu pedido.</p>
            ) : (
              items.map((item) => (
                <div key={item.id} className="cart-item-row">
                  <span className="cart-item-qty">{item.quantity}</span>
                  <span className="cart-item-name">{item.descripcion}</span>
                  <span className="cart-item-price">$ {(item.precio * item.quantity).toLocaleString()}</span>
                  <button className="cart-item-remove" onClick={() => removeFromCart(item.id)}>×</button>
                </div>
              ))
            )
          )}
        </div>

        {mounted && items.length > 0 && (
          <div style={{ padding: '0 20px 15px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, opacity: 0.6, display: 'block', marginBottom: '4px', color: errorMsg ? '#E53E3E' : 'inherit' }}>
                {errorMsg ? '⚠️ POR FAVOR, INGRESÁ TU NOMBRE' : 'TU NOMBRE Y APELLIDO'}
              </label>
              <input 
                type="text" 
                placeholder="Ej: Juan Pérez" 
                value={customerName}
                onChange={(e) => {
                  $customerName.set(e.target.value);
                  if (e.target.value) setErrorMsg('');
                }}
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  borderRadius: '10px', 
                  border: errorMsg ? '2px solid #E53E3E' : '1px solid #eee', 
                  fontSize: '14px', 
                  background: '#f9f9f9',
                  transition: 'all 0.2s'
                }}
              />
            </div>
          </div>
        )}

        {mounted && items.length > 0 && (
          <div className="cart-footer">
            <div className="cart-total-row">
              <span>total</span>
              <strong>$ {total.toLocaleString()}</strong>
            </div>

            <button className="btn-whatsapp" onClick={handleProcessOrder} disabled={isSaving}>
              {isSaving ? "Guardando pedido..." : "Enviar pedido"}
            </button>

            <p className="cart-disclaimer">
              Este sitio no genera ningún tipo de cobro online. El pedido se confirma vía WhatsApp.
            </p>
          </div>
        )}
      </div>
      
      {showToast && <SuccessToast name={toastName} onClose={() => setShowToast(false)} />}
    </>
  );
}

/* ── REPLICANDO ANIMACIÓN DEL TOAST ── */
function SuccessToast({ name, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="success-toast">
      <style>{`
        .success-toast {
          position: fixed;
          bottom: 40px;
          left: 5vw;
          width: 90vw;
          height: 56px;
          background: #E6D4D4; 
          border-radius: 12px;
          display: grid;
          grid-template-columns: 56px 1fr 30px;
          align-items: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          z-index: 10000;
          animation: toastSlideUp 0.4s ease-out;
          color: #5D4D4D;
          overflow: hidden;
        }
        @keyframes toastSlideUp {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        #path50 {
          animation: kf_v5_path50_333 0.5s ease-in-out 0.4s infinite alternate both;
          transform-origin: center; transform-box: fill-box;
        }
        #path51 {
          animation: kf_v5_path51_914 0.5s ease-in-out 0.0s 1 normal both;
          transform-origin: center; transform-box: fill-box;
        }
        @keyframes kf_v5_path50_333 {
          0%, 100% { fill: #FF5555; d: path('m 12,3.4355469 a 0.61621499,0.61621499 0 0 0 -0.617187,0.6171875 v 0.074219 A 0.61621499,0.61621499 0 0 0 12,4.7441406 0.61621499,0.61621499 0 0 0 12.617188,4.1269531 V 4.0527344 A 0.61621499,0.61621499 0 0 0 12,3.4355469 Z m 0,0.6166644 v 0.075553 M 12,19.197266 A 0.61621499,0.61621499 0 0 0 11.382813,19.8125 v 0.257812 A 0.61621499,0.61621499 0 0 0 12,20.685547 0.61621499,0.61621499 0 0 0 12.617188,20.070312 V 19.8125 A 0.61621499,0.61621499 0 0 0 12,19.197266 Z m 0,0.616002 V 20.07 m 5.341797,-3.277031 a 0.61621499,0.61621499 0 0 0 -0.435547,0.179687 0.61621499,0.61621499 0 0 0 0,0.871094 l 0.02539,0.02734 a 0.61621499,0.61621499 0 0 0 0.871093,0 0.61621499,0.61621499 0 0 0 0,-0.871094 l -0.02539,-0.02734 a 0.61621499,0.61621499 0 0 0 -0.435547,-0.179687 z m 0.02592,0.642229 -0.02632,-0.02632 M 6.4042969,5.8261719 A 0.61621499,0.61621499 0 0 0 5.9667969,6.0019531 0.61621499,0.61621499 0 0 0 5.9570312,6.875 l 0.082031,0.082031 a 0.61621499,0.61621499 0 0 0 0.8710937,0.00977 0.61621499,0.61621499 0 0 0 0.00977,-0.8730469 L 6.8378906,6.0117187 A 0.61621499,0.61621499 0 0 0 6.4042969,5.8261719 Z M 6.4794028,6.526038 6.3975634,6.442583 m -2.3467822,4.910933 a 0.61621499,0.61621499 0 0 0 -0.6152343,0.617187 0.61621499,0.61621499 0 0 0 0.6152343,0.615235 H 4.1582031 A 0.61621499,0.61621499 0 0 0 4.7734375,11.970703 0.61621499,0.61621499 0 0 0 4.1582031,11.353516 Z m 9.406e-4,0.617 H 4.157248 m 15.684549,-0.617 a 0.61621499,0.61621499 0 0 0 -0.615235,0.617187 0.61621499,0.61621499 0 0 0 0.615235,0.615235 h 0.02344 a 0.61621499,0.61621499 0 0 0 0.615235,-0.615235 0.61621499,0.61621499 0 0 0 -0.615235,-0.617187 z m 9.55e-4,0.617 h 0.02182 M 6.5800781,16.775391 a 0.61621499,0.61621499 0 0 0 -0.4355469,0.179687 l -0.1171875,0.117188 a 0.61621499,0.61621499 0 0 0 0,0.871093 0.61621499,0.61621499 0 0 0 0.8710938,0 L 7.015625,17.826172 a 0.61621499,0.61621499 0 0 0 0,-0.871094 0.61621499,0.61621499 0 0 0 -0.4355469,-0.179687 z M 6.463383,17.507133 6.579427,17.391089 M 17.490234,5.8925781 a 0.61621499,0.61621499 0 0 0 -0.4375,0.1757813 l -0.02148,0.021484 a 0.61621499,0.61621499 0 0 0 -0.0098,0.8710938 0.61621499,0.61621499 0 0 0 0.873047,0.00781 l 0.02148,-0.021484 a 0.61621499,0.61621499 0 0 0 0.0078,-0.8710937 0.61621499,0.61621499 0 0 0 -0.433594,-0.1835938 z m -0.02796,0.6365167 0.02134,-0.020925'); }
          50% { fill: #FF5555; d: path('m 12,1.1523437 a 0.61621499,0.61621499 0 0 0 -0.617187,0.6171875 v 2.2832032 0.074219 A 0.61621499,0.61621499 0 0 0 12,4.7441406 0.61621499,0.61621499 0 0 0 12.617188,4.1269531 V 4.0527344 1.7695312 A 0.61621499,0.61621499 0 0 0 12,1.1523437 Z m 0,0.6166983 v 2.2831693 0.075553 M 12,19.197266 A 0.61621499,0.61621499 0 0 0 11.382813,19.8125 v 0.257812 2.101563 A 0.61621499,0.61621499 0 0 0 12,22.789062 0.61621499,0.61621499 0 0 0 12.617188,22.171875 V 20.070312 19.8125 A 0.61621499,0.61621499 0 0 0 12,19.197266 Z m 0,0.616002 V 20.07 22.17199 m 5.341797,-5.379021 a 0.61621499,0.61621499 0 0 0 -0.435547,0.179687 0.61621499,0.61621499 0 0 0 0,0.871094 l 0.02539,0.02734 0.83789,0.83789 a 0.61621499,0.61621499 0 0 0 0.871094,0 0.61621499,0.61621499 0 0 0 0,-0.871093 L 17.802734,17 17.777344,16.97266 a 0.61621499,0.61621499 0 0 0 -0.435547,-0.179687 z m 0.863912,1.480224 -0.837995,-0.837995 -0.02632,-0.02632 M 5.7382812,5.1484375 a 0.61621499,0.61621499 0 0 0 -0.4375,0.1757812 0.61621499,0.61621499 0 0 0 -0.00781,0.8710938 L 5.9570312,6.875 6.0390622,6.957031 a 0.61621499,0.61621499 0 0 0 0.8710937,0.00977 0.61621499,0.61621499 0 0 0 0.00977,-0.8730469 L 6.8378906,6.0117187 6.1738281,5.3339844 A 0.61621499,0.61621499 0 0 0 5.7382812,5.1484375 Z M 6.4794028,6.526038 6.3975634,6.442583 5.7329071,5.764806 m -3.934079,5.58871 a 0.61621499,0.61621499 0 0 0 -0.6171875,0.617187 0.61621499,0.61621499 0 0 0 0.6171875,0.615235 H 4.0507812 4.1582031 A 0.61621499,0.61621499 0 0 0 4.7734375,11.970703 0.61621499,0.61621499 0 0 0 4.1582031,11.353516 H 4.0507812 Z m -3.021e-4,0.617 H 4.0517218 4.157248 m 15.684549,-0.617 a 0.61621499,0.61621499 0 0 0 -0.615235,0.617187 0.61621499,0.61621499 0 0 0 0.615235,0.615235 h 0.02344 2.335938 a 0.61621499,0.61621499 0 0 0 0.617187,-0.615235 0.61621499,0.61621499 0 0 0 -0.617187,-0.617187 h -2.335938 z m 9.55e-4,0.617 h 0.02182 2.336899 M 6.5800781,16.775391 a 0.61621499,0.61621499 0 0 0 -0.4355469,0.179687 l -0.1171875,0.117188 -0.7480468,0.748046 a 0.61621499,0.61621499 0 0 0 0,0.871094 0.61621499,0.61621499 0 0 0 0.8710937,0 L 6.8984375,17.943359 7.015625,17.826172 a 0.61621499,0.61621499 0 0 0 0,-0.871094 0.61621499,0.61621499 0 0 0 -0.4355469,-0.179687 z M 5.7151145,18.255401 6.463383,17.507133 6.579427,17.391089 M 18.230469,5.1660156 a 0.61621499,0.61621499 0 0 0 -0.4375,0.1757813 l -0.740235,0.7265625 -0.02148,0.021484 a 0.61621499,0.61621499 0 0 0 -0.0098,0.8710938 0.61621499,0.61621499 0 0 0 0.873047,0.00781 l 0.02148,-0.021484 0.738281,-0.7246094 a 0.61621499,0.61621499 0 0 0 0.0098,-0.8710937 0.61621499,0.61621499 0 0 0 -0.433593,-0.1855469 z m -0.768199,1.3630792 0.02134,-0.020925 0.739894,-0.7255707'); }
        @keyframes kf_v5_path51_914 {
          0% { transform: translate(0.0px, 0.0px) scale(1.0, 1.0) rotate(0.0deg); }
          100% { transform: translate(-3.6e-5px, -2.4e-5px) scale(182.5, 182.3) rotate(0.0deg); }
        }
      `}</style>
      
      <div className="toast-heart">
        <svg viewBox="0 0 24 24" style={{width:'28px', height:'28px'}} preserveAspectRatio="xMidYMid meet">
          <path id="path51" d="m 12.027386,12.492108 c 0,0.01393 -0.01101,0.02135 -0.01907,0.02799 -0.0028,0.0023 -0.0056,0.0046 -0.0083,0.0046 -0.0027,0 -0.0055,-0.0022 -0.0083,-0.0046 -0.0081,-0.0066 -0.01907,-0.01406 -0.01907,-0.02799 0,-0.01392 0.01506,-0.0238 0.02739,-0.01041 0.01232,-0.01339 0.02739,-0.0035 0.02739,0.01041 z" fill="#FF5555" />
          <path id="path50" d="m 12,3.4355469 a 0.61621499,0.61621499 0 0 0 -0.617187,0.6171875 v 0.074219 A 0.61621499,0.61621499 0 0 0 12,4.7441406 0.61621499,0.61621499 0 0 0 12.617188,4.1269531 V 4.0527344 A 0.61621499,0.61621499 0 0 0 12,3.4355469 Z m 0,0.6166644 v 0.075553 M 12,19.197266 A 0.61621499,0.61621499 0 0 0 11.382813,19.8125 v 0.257812 A 0.61621499,0.61621499 0 0 0 12,20.685547 0.61621499,0.61621499 0 0 0 12.617188,20.070312 V 19.8125 A 0.61621499,0.61621499 0 0 0 12,19.197266 Z m 0,0.616002 V 20.07 m 5.341797,-3.277031 a 0.61621499,0.61621499 0 0 0 -0.435547,0.179687 0.61621499,0.61621499 0 0 0 0,0.871094 l 0.02539,0.02734 a 0.61621499,0.61621499 0 0 0 0.871093,0 0.61621499,0.61621499 0 0 0 0,-0.871094 l -0.02539,-0.02734 a 0.61621499,0.61621499 0 0 0 -0.435547,-0.179687 z m 0.02592,0.642229 -0.02632,-0.02632 M 6.4042969,5.8261719 A 0.61621499,0.61621499 0 0 0 5.9667969,6.0019531 0.61621499,0.61621499 0 0 0 5.9570312,6.875 l 0.082031,0.082031 a 0.61621499,0.61621499 0 0 0 0.8710937,0.00977 0.61621499,0.61621499 0 0 0 0.00977,-0.8730469 L 6.8378906,6.0117187 A 0.61621499,0.61621499 0 0 0 6.4042969,5.8261719 Z M 6.4794028,6.526038 6.3975634,6.442583 m -2.3467822,4.910933 a 0.61621499,0.61621499 0 0 0 -0.6152343,0.617187 0.61621499,0.61621499 0 0 0 0.6152343,0.615235 H 4.1582031 A 0.61621499,0.61621499 0 0 0 4.7734375,11.970703 0.61621499,0.61621499 0 0 0 4.1582031,11.353516 Z m 9.406e-4,0.617 H 4.157248 m 15.684549,-0.617 a 0.61621499,0.61621499 0 0 0 -0.615235,0.617187 0.61621499,0.61621499 0 0 0 0.615235,0.615235 h 0.02344 a 0.61621499,0.61621499 0 0 0 0.615235,-0.615235 0.61621499,0.61621499 0 0 0 -0.615235,-0.617187 z m 9.55e-4,0.617 h 0.02182 M 6.5800781,16.775391 a 0.61621499,0.61621499 0 0 0 -0.4355469,0.179687 l -0.1171875,0.117188 a 0.61621499,0.61621499 0 0 0 0,0.871093 0.61621499,0.61621499 0 0 0 0.8710938,0 L 7.015625,17.826172 a 0.61621499,0.61621499 0 0 0 0,-0.871094 0.61621499,0.61621499 0 0 0 -0.4355469,-0.179687 z M 6.463383,17.507133 6.579427,17.391089 M 17.490234,5.8925781 a 0.61621499,0.61621499 0 0 0 -0.4375,0.1757813 l -0.02148,0.021484 a 0.61621499,0.61621499 0 0 0 -0.0098,0.8710938 0.61621499,0.61621499 0 0 0 0.873047,0.00781 l 0.02148,-0.021484 a 0.61621499,0.61621499 0 0 0 0.0078,-0.8710937 0.61621499,0.61621499 0 0 0 -0.433594,-0.1835938 z m -0.02796,0.6365167 0.02134,-0.020925" fill="#FF5555" />
        </svg>
      </div>

      <div className="toast-text">
        Gracias <strong>{name}</strong>! tu pedido fue enviado
      </div>

      <button className="toast-close" onClick={onClose}>×</button>
    </div>
  );
}
