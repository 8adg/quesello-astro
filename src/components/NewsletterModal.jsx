import React, { useState, useEffect } from 'react';

export default function NewsletterModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle, loading, success, error

  // ¡REEMPLAZAR ESTA URL CON LA DE TU GOOGLE APPS SCRIPT!
  const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwN4ffY7pM5pMP0esTkW6Si9CvOmiTtArI4FK608ddkys4t6luwXSHCoFrs_ZntiSIxIQ/exec";

  useEffect(() => {
    // Verificar si ya vio la modal
    const hasSeenModal = localStorage.getItem('quesello_newsletter_seen');

    if (!hasSeenModal) {
      // Mostrar después de 3 segundos para no ser invasivo apenas entra
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  const closeModal = () => {
    setIsOpen(false);
    // Guardar en localstorage para que no vuelva a aparecer
    localStorage.setItem('quesello_newsletter_seen', 'true');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;

    setStatus('loading');

    try {
      // Usamos no-cors porque Google Apps Script bloquea peticiones POST complejas desde el navegador
      // O bien enviamos como FormData. FormData es más amigable con Google Scripts.
      const formData = new FormData();
      formData.append('email', email);
      formData.append('fecha', new Date().toISOString());

      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: formData,
        mode: 'no-cors' // Fundamental para evitar errores de CORS con Google Scripts
      });

      // Como usamos no-cors, la respuesta siempre es opaca, asumimos éxito si la red no falla
      setStatus('success');
      setTimeout(() => {
        closeModal();
      }, 2500);

    } catch (error) {
      console.error("Error guardando email:", error);
      setStatus('error');
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '20px',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div style={{
        backgroundColor: '#FCFCFB',
        borderRadius: '24px',
        padding: '40px',
        width: '100%',
        maxWidth: '450px',
        position: 'relative',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        textAlign: 'center'
      }}>
        <button
          onClick={closeModal}
          style={{
            position: 'absolute',
            top: '15px',
            right: '20px',
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#94A3B8'
          }}
        >
          ×
        </button>

        <div style={{ fontSize: '40px', marginBottom: '10px' }}>💌</div>

        <h2 style={{
          fontFamily: 'Outfit, sans-serif',
          fontSize: '28px',
          color: '#1E293B',
          margin: '0 0 10px 0',
          lineHeight: 1.2
        }}>
          ¿Querés aprender sobre diseño e impresión?
        </h2>

        <p style={{ color: '#64748B', marginBottom: '25px', fontSize: '16px' }}>
          Suscribite a nuestro newsletter para recibir tips, novedades y secretos del Scrapbook directamente en tu correo.
        </p>

        {status === 'success' ? (
          <div style={{
            backgroundColor: '#D1FAE5',
            color: '#065F46',
            padding: '15px',
            borderRadius: '12px',
            fontWeight: 600
          }}>
            ¡Gracias por suscribirte! 🎉
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                padding: '16px',
                borderRadius: '16px',
                border: '2px solid #E2E8F0',
                fontSize: '16px',
                outline: 'none',
                fontFamily: 'Inter, sans-serif',
                width: '100%',
                boxSizing: 'border-box'
              }}
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              style={{
                backgroundColor: '#FF5E5E',
                color: 'white',
                border: 'none',
                padding: '16px',
                borderRadius: '16px',
                fontSize: '16px',
                fontWeight: 700,
                cursor: status === 'loading' ? 'wait' : 'pointer',
                fontFamily: 'Inter, sans-serif',
                opacity: status === 'loading' ? 0.7 : 1,
                transition: 'transform 0.1s'
              }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              {status === 'loading' ? 'Guardando...' : '¡Suscribirme!'}
            </button>

            {status === 'error' && (
              <span style={{ color: '#FF5E5E', fontSize: '13px' }}>Hubo un error. Intentá de nuevo.</span>
            )}
          </form>
        )}

        <button
          onClick={closeModal}
          style={{
            background: 'none',
            border: 'none',
            color: '#94A3B8',
            fontSize: '13px',
            marginTop: '20px',
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
        >
          No, gracias. Solo quiero ver la tienda.
        </button>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
