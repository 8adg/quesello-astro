import React, { useState, useEffect } from 'react';

export default function DesktopGate({ children }) {
  const [isDesktop, setIsDesktop] = useState(null);

  useEffect(() => {
    const checkSize = () => setIsDesktop(window.innerWidth >= 768);
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  // Mientras detectamos, no mostramos nada para evitar el flash
  if (isDesktop === null) return null;

  if (isDesktop) {
    const qrUrl = typeof window !== 'undefined' ? window.location.href : 'https://quesello.com.ar';
    return (
      <div style={{
        minHeight: '100vh',
        background: '#EDE8D3',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '32px',
        fontFamily: 'Inter, sans-serif',
        padding: '40px',
        boxSizing: 'border-box'
      }}>
        <img
          src="/logo.svg"
          alt="Queselló"
          style={{ height: '64px', width: 'auto' }}
        />
        <p style={{
          color: '#495D56',
          fontSize: '20px',
          fontWeight: 600,
          margin: 0,
          letterSpacing: '0.01em',
          textAlign: 'center'
        }}>
          Escaneá con tu teléfono celular:
        </p>
        <div style={{
          background: 'white',
          borderRadius: '24px',
          padding: '24px',
          boxShadow: '0 8px 32px rgba(73, 93, 86, 0.12)',
        }}>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrUrl)}`}
            alt="QR Quselló"
            width={220}
            height={220}
          />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
