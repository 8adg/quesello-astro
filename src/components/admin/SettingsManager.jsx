import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function SettingsManager() {
  const [pin, setPin] = useState("1234");
  const [pdfPath, setPdfPath] = useState("C:/Quesello/Presupuestos");
  const [mpToken, setMpToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('config')
        .select('clave, valor')
        .in('clave', ['pin_validacion', 'ruta_pdf', 'mp_access_token']);
      
      if (data) {
        const pinRow = data.find(r => r.clave === 'pin_validacion');
        const pathRow = data.find(r => r.clave === 'ruta_pdf');
        const mpRow = data.find(r => r.clave === 'mp_access_token');
        if (pinRow?.valor) setPin(pinRow.valor);
        if (pathRow?.valor) setPdfPath(pathRow.valor);
        if (mpRow?.valor) setMpToken(mpRow.valor);
      }
    } catch (error) {
      console.error("Error cargando ajustes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      await supabase.from('config').upsert({ clave: 'pin_validacion', valor: pin });
      await supabase.from('config').upsert({ clave: 'ruta_pdf', valor: pdfPath });
      if (mpToken.trim()) {
        await supabase.from('config').upsert({
          clave: 'mp_access_token',
          valor: mpToken.trim().replace(/^["']|["']$/g, '')
        });
      }

      setMessage({ type: 'success', text: '¡Configuración guardada correctamente!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al guardar: ' + error.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontFamily: 'Inter' }}>Cargando configuración...</div>;

  return (
    <div style={{ maxWidth: '600px', fontFamily: 'Inter' }}>
      <header style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', color: '#FF5E5E', fontWeight: 800, margin: 0 }}>Configuración</h1>
        <p style={{ color: '#64748B', fontSize: '14px', marginTop: '5px' }}>Gestioná los parámetros globales del sistema.</p>
      </header>

      <form onSubmit={handleSave} style={{ background: 'white', padding: '28px', borderRadius: '30px', boxShadow: '0 4px 25px rgba(0,0,0,0.03)', border: '1px solid #f0f0f0' }}>
        
        {/* PIN DE VALIDACIÓN */}
        <div style={{ marginBottom: '26px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#998E55', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
            Clave de Validación (4 dígitos)
          </label>
          <input 
            type="text" 
            maxLength="4"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="1234"
            style={{
              width: '100%', padding: '16px', borderRadius: '18px', border: '2px solid #F1F5F9',
              fontSize: '24px', textAlign: 'center', fontWeight: 800, color: '#1E293B',
              letterSpacing: '15px', outline: 'none', background: '#F8FAFC', boxSizing: 'border-box'
            }}
          />
          <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '8px', lineHeight: 1.4 }}>
            Esta clave se solicitará en la página de Seguimiento para confirmar la entrega del pedido.
          </p>
        </div>

        <hr style={{ border: 'none', height: '1px', background: '#F1F5F9', margin: '24px 0' }} />

        {/* MERCADO PAGO ACCESS TOKEN */}
        <div style={{ marginBottom: '26px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#998E55', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
            Access Token de Producción — Mercado Pago
          </label>
          <input 
            type="text" 
            value={mpToken}
            onChange={(e) => setMpToken(e.target.value)}
            placeholder="APP_USR-..."
            style={{
              width: '100%', padding: '14px 16px', borderRadius: '15px', border: '1px solid #E2E8F0',
              fontSize: '13px', fontFamily: 'monospace', color: '#1E293B', outline: 'none', background: '#F8FAFC', boxSizing: 'border-box'
            }}
          />
          <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '8px', lineHeight: 1.4 }}>
            Obtenelo en Mercado Pago Developers → Tus integraciones → Credenciales de producción → Access Token. Se usa tanto para crear links de pago como para la conciliación de transferencias.
          </p>
        </div>

        <hr style={{ border: 'none', height: '1px', background: '#F1F5F9', margin: '24px 0' }} />

        {/* RUTA PDF (LEGACY) */}
        <div style={{ marginBottom: '30px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#94A3B8', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
            Ruta Local de PDF (Referencia Desktop)
          </label>
          <input 
            type="text" 
            value={pdfPath}
            onChange={(e) => setPdfPath(e.target.value)}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: '15px', border: '1px solid #E2E8F0',
              fontSize: '14px', color: '#64748B', outline: 'none', background: '#F8FAFC', boxSizing: 'border-box'
            }}
          />
          <p style={{ fontSize: '11px', color: '#CBD5E1', marginTop: '8px' }}>
            Campo informativo para mantener compatibilidad con Queselló Desktop.
          </p>
        </div>

        {message.text && (
          <div style={{ 
            padding: '15px', borderRadius: '15px', marginBottom: '20px', textAlign: 'center',
            background: message.type === 'success' ? '#D1FAE5' : '#FEE2E2',
            color: message.type === 'success' ? '#065F46' : '#991B1B',
            fontSize: '14px', fontWeight: 600
          }}>
            {message.text}
          </div>
        )}

        <button 
          type="submit"
          disabled={saving}
          style={{
            width: '100%', padding: '18px', borderRadius: '20px', background: '#111',
            color: 'white', border: 'none', fontSize: '15px', fontWeight: 800,
            cursor: 'pointer', opacity: saving ? 0.7 : 1, transition: 'all 0.2s'
          }}
        >
          {saving ? 'GUARDANDO...' : 'GUARDAR CONFIGURACIÓN'}
        </button>

      </form>
    </div>
  );
}
