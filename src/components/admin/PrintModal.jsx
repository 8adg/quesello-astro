import React, { useState } from 'react';
import { handleDirectMeowPrint, handleClientSidePDF } from '../../lib/printUtils';

export default function PrintModal({ order, onClose }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  if (!order) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(75, 59, 40, 0.4)', // Marrón marca con transparencia
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: '#FAF9F6', // Fondo off-white premium
        borderRadius: '32px',
        width: '100%',
        maxWidth: '420px',
        padding: '40px',
        textAlign: 'center',
        position: 'relative',
        fontFamily: 'Inter',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        {/* Cabecera */}
        <div>
          <h2 style={{ fontSize: '24px', color: '#FF5E5E', fontWeight: 700, margin: '0 0 8px 0' }}>Opciones de Impresion</h2>
          <p style={{ color: '#998E55', fontSize: '14px', margin: 0 }}>Pedido N° {order.numero} - {order.cliente}</p>
        </div>

        <hr style={{ border: 'none', height: '1px', background: '#aba9a4', opacity: 0.1, margin: '0' }} />

        {/* Botones de Accion */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={() => handleDirectMeowPrint(order, setMsg, setLoading)}
            disabled={loading}
            style={{
              padding: '18px',
              borderRadius: '20px',
              background: '#FF5E5E',
              color: 'white',
              border: 'none',
              fontWeight: 500,
              fontSize: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              transition: 'opacity 0.2s',
              opacity: loading ? 0.6 : 1
            }}
          >
            <img src="https://api.iconify.design/lucide:printer.svg?color=white" style={{ width: '20px' }} alt="" />
            Imprimir en Meow (Bluetooth)
          </button>

          <button
            onClick={() => handleClientSidePDF(order, setMsg, setLoading)}
            disabled={loading}
            style={{
              padding: '18px',
              borderRadius: '20px',
              background: 'white',
              color: '#FF5E5E',
              border: '2px solid #FF5E5E',
              fontWeight: 500,
              fontSize: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              transition: 'background 0.2s',
              opacity: loading ? 0.6 : 1
            }}
          >
            <img src="https://api.iconify.design/lucide:file-text.svg?color=%23FF5E5E" style={{ width: '20px' }} alt="" />
            Descargar PDF Termico
          </button>
        </div>

        {/* Feedback de Estado */}
        {msg && (
          <div style={{
            padding: '12px',
            borderRadius: '12px',
            background: msg.type === 'error' ? '#fee2e2' : '#f0fdf4',
            color: msg.type === 'error' ? '#991b1b' : '#166534',
            fontSize: '13px',
            fontWeight: 500
          }}>
            {msg.text}
          </div>
        )}

        {/* Boton Cerrar */}
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#A0AEC0',
            fontSize: '14px',
            textDecoration: 'underline',
            cursor: 'pointer',
            marginTop: '10px'
          }}
        >
          Cerrar ventana
        </button>
      </div>
    </div>
  );
}
