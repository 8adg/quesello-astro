import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import {
  renderShippingLabelToCanvas,
  handlePrintShippingLabelMeow,
  handleShippingLabelPDF,
} from '../../lib/printUtils';

export default function SettingsManager() {
  const [pin, setPin] = useState('1234');
  const [pdfPath, setPdfPath] = useState('C:/Quesello/Presupuestos');
  const [mpToken, setMpToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Estado del Creador de Etiquetas para Envíos (Meow 100mm)
  const [labelData, setLabelData] = useState({
    envioNro: '',
    remitente: 'MATIAS OCHOA - MAR DEL PLATA',
    destinatario: 'MÓNICA ADRIANA GARCÍA',
    direccion: 'DOS DE ABRIL 346 - GENERAL PINTO- BS AS',
    telefono: '+54 9 2355 55-7496',
    destino: 'TERMINAL LINCOLN',
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [printingLabel, setPrintingLabel] = useState(false);
  const [labelMsg, setLabelMsg] = useState(null);
  const previewCanvasRef = useRef(null);
  const logoImgRef = useRef(null);

  useEffect(() => {
    loadSettings();
    loadRecentOrders();

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = '/header-logo-hd.png';
    img.onload = () => {
      logoImgRef.current = img;
      if (previewCanvasRef.current) {
        renderShippingLabelToCanvas(previewCanvasRef.current, labelData, img);
      }
    };
  }, []);

  useEffect(() => {
    if (previewCanvasRef.current) {
      renderShippingLabelToCanvas(previewCanvasRef.current, labelData, logoImgRef.current);
    }
  }, [labelData]);

  const loadRecentOrders = async () => {
    try {
      const { data } = await supabase
        .from('presupuestos')
        .select('id, numero, cliente')
        .order('id', { ascending: false })
        .limit(40);
      if (data) setRecentOrders(data);
    } catch (e) {
      console.error('Error cargando pedidos recientes:', e);
    }
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('config')
        .select('clave, valor')
        .in('clave', ['pin_validacion', 'ruta_pdf', 'mp_access_token']);

      if (data) {
        const pinRow = data.find((r) => r.clave === 'pin_validacion');
        const pathRow = data.find((r) => r.clave === 'ruta_pdf');
        const mpRow = data.find((r) => r.clave === 'mp_access_token');
        if (pinRow?.valor) setPin(pinRow.valor);
        if (pathRow?.valor) setPdfPath(pathRow.valor);
        if (mpRow?.valor) setMpToken(mpRow.valor);
      }
    } catch (error) {
      console.error('Error cargando ajustes:', error);
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
          valor: mpToken.trim().replace(/^["']|["']$/g, ''),
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

  if (loading)
    return (
      <div
        style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontFamily: 'Inter' }}
      >
        Cargando configuración...
      </div>
    );

  const labelStyle = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 700,
    color: '#998E55',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '14px',
    border: '1px solid #DFDED9',
    fontSize: '14px',
    color: '#1E293B',
    fontWeight: 600,
    outline: 'none',
    background: '#FFFFFF',
    boxSizing: 'border-box',
    fontFamily: 'Inter, sans-serif',
  };

  return (
    <div style={{ maxWidth: '1180px', fontFamily: 'Inter, sans-serif', paddingBottom: '50px' }}>
      <header style={{ marginBottom: '26px' }}>
        <h1 style={{ fontSize: '28px', color: '#FF5E5E', fontWeight: 800, margin: 0 }}>
          Configuración y Herramientas
        </h1>
        <p style={{ color: '#64748B', fontSize: '14px', marginTop: '5px' }}>
          Creador de etiquetas térmicas para envíos (100mm) y parámetros globales del sistema.
        </p>
      </header>

      {/* ══════════════════════════════════════════════════════════════════════════
          BLOQUE 1: CREADOR DE ETIQUETAS PARA ENVÍOS (MEOW PRINTER — 100MM X ANCHO PRINTER)
         ══════════════════════════════════════════════════════════════════════════ */}
      <section
        style={{
          background: '#FAF9F6',
          padding: '28px',
          borderRadius: '30px',
          boxShadow: '0 4px 25px rgba(0,0,0,0.04)',
          border: '1px solid #E5E0D0',
          marginBottom: '32px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '20px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img
                src="https://api.iconify.design/lucide/package.svg?color=%23FF5E5E"
                style={{ width: '22px', height: '22px' }}
                alt=""
              />
              <h2 style={{ fontSize: '20px', color: '#495D56', fontWeight: 800, margin: 0 }}>
                Creador de Etiquetas para Envíos (Meow Printer)
              </h2>
            </div>
            <p style={{ fontSize: '13px', color: '#998E55', margin: '4px 0 0 0' }}>
              Formato exacto: <strong>100 mm de largo</strong> ×{' '}
              <strong>ancho del cabezal térmico (384 px / 57 mm)</strong>
            </p>
          </div>

          {recentOrders.length > 0 && (
            <div style={{ minWidth: '240px' }}>
              <label style={{ ...labelStyle, marginBottom: '4px' }}>
                AUTOCOMPLETAR DESDE PEDIDO (OPCIONAL)
              </label>
              <select
                defaultValue=""
                onChange={(e) => {
                  const found = recentOrders.find((o) => String(o.id) === e.target.value);
                  if (found) {
                    setLabelData((prev) => ({
                      ...prev,
                      envioNro: found.numero || '',
                      destinatario: (found.cliente || '').toUpperCase(),
                    }));
                  }
                }}
                style={{ ...inputStyle, padding: '9px 12px', fontSize: '12px' }}
              >
                <option value="">Seleccionar presupuesto reciente...</option>
                {recentOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    #{o.numero} — {o.cliente}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Formulario de campos de la etiqueta */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '14px',
            marginBottom: '16px',
          }}
        >
          <div>
            <label style={labelStyle}>DESTINATARIO</label>
            <input
              type="text"
              value={labelData.destinatario}
              onChange={(e) =>
                setLabelData({ ...labelData, destinatario: e.target.value.toUpperCase() })
              }
              placeholder="EJ: MÓNICA ADRIANA GARCÍA"
              style={{ ...inputStyle, fontWeight: 800 }}
            />
          </div>

          <div>
            <label style={labelStyle}>DIRECCIÓN COMPLETA</label>
            <input
              type="text"
              value={labelData.direccion}
              onChange={(e) =>
                setLabelData({ ...labelData, direccion: e.target.value.toUpperCase() })
              }
              placeholder="EJ: DOS DE ABRIL 346 - GENERAL PINTO- BS AS"
              style={inputStyle}
            />
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '14px',
            marginBottom: '14px',
            alignItems: 'end',
          }}
        >
          <div>
            <label style={labelStyle}>TELÉFONO</label>
            <input
              type="text"
              value={labelData.telefono}
              onChange={(e) =>
                setLabelData({ ...labelData, telefono: e.target.value.toUpperCase() })
              }
              placeholder="EJ: +54 9 2355 55-7496"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>DESTINO</label>
            <input
              type="text"
              value={labelData.destino}
              onChange={(e) =>
                setLabelData({ ...labelData, destino: e.target.value.toUpperCase() })
              }
              placeholder="Terminal / sucursal (ej: TERMINAL LINCOLN)"
              style={inputStyle}
            />
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(140px, 1fr) minmax(240px, 3fr)',
            gap: '14px',
            marginBottom: '22px',
            alignItems: 'end',
          }}
        >
          <div>
            <label style={labelStyle}>ENVÍO N°</label>
            <input
              type="text"
              value={labelData.envioNro}
              onChange={(e) =>
                setLabelData({ ...labelData, envioNro: e.target.value.toUpperCase() })
              }
              placeholder="Opcional (ej: 00842)"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>REMITENTE</label>
            <input
              type="text"
              value={labelData.remitente}
              onChange={(e) =>
                setLabelData({ ...labelData, remitente: e.target.value.toUpperCase() })
              }
              placeholder="Cabecera derecha (ej: MATIAS OCHOA - MAR DEL PLATA)"
              style={inputStyle}
            />
          </div>
        </div>

        {/* VISTA PREVIA EN VIVO DEL TICKET (RECUADRO ROJO = LÍMITE DE 100MM X ANCHO PRINTER) */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            padding: '20px',
            border: '1px solid #DFDED9',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#998E55' }}>
              VISTA PREVIA EN VIVO (EL BORDE ROJO INDICA EL CORTE EXACTO DE 100 MM × ANCHO MEOW)
            </span>
            <button
              type="button"
              onClick={() =>
                setLabelData({
                  envioNro: '',
                  remitente: 'MATIAS OCHOA - MAR DEL PLATA',
                  destinatario: '',
                  direccion: '',
                  telefono: '+54 9 ',
                  destino: '',
                })
              }
              style={{
                background: '#F4F1E1',
                color: '#495D56',
                border: 'none',
                borderRadius: '10px',
                padding: '5px 12px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Limpiar campos
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div
              style={{
                border: '2px solid #EF4444',
                width: '100%',
                maxWidth: '820px',
                background: '#FFFFFF',
                boxShadow: '0 6px 20px rgba(0,0,0,0.06)',
              }}
            >
              <canvas
                ref={previewCanvasRef}
                width={800}
                height={384}
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </div>
          </div>
        </div>

        {labelMsg && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '14px',
              marginBottom: '16px',
              background: labelMsg.type === 'error' ? '#FEE2E2' : '#DCFCE7',
              color: labelMsg.type === 'error' ? '#991B1B' : '#166534',
              fontSize: '13px',
              fontWeight: 700,
              textAlign: 'center',
            }}
          >
            {labelMsg.text}
          </div>
        )}

        {/* Botones de Impresión Bluetooth Meow + Descarga PDF */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={printingLabel}
            onClick={() => handlePrintShippingLabelMeow(labelData, setLabelMsg, setPrintingLabel)}
            style={{
              flex: 2,
              minWidth: '240px',
              padding: '16px 22px',
              borderRadius: '18px',
              background: '#FF5E5E',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '15px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: '0 4px 14px rgba(255, 94, 94, 0.25)',
              opacity: printingLabel ? 0.65 : 1,
            }}
          >
            <img
              src="https://api.iconify.design/lucide/printer.svg?color=white"
              style={{ width: '20px', height: '20px' }}
              alt=""
            />
            <span>
              {printingLabel
                ? 'IMPRIMIENDO EN MEOW...'
                : 'Imprimir Etiqueta en Meow (Bluetooth — 100mm)'}
            </span>
          </button>

          <button
            type="button"
            disabled={printingLabel}
            onClick={() => handleShippingLabelPDF(labelData, setLabelMsg, setPrintingLabel)}
            style={{
              flex: 1,
              minWidth: '200px',
              padding: '16px 20px',
              borderRadius: '18px',
              background: '#FFFFFF',
              color: '#495D56',
              border: '2px solid #495D56',
              fontSize: '14px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              opacity: printingLabel ? 0.65 : 1,
            }}
          >
            <img
              src="https://api.iconify.design/lucide/download.svg?color=%23495D56"
              style={{ width: '18px', height: '18px' }}
              alt=""
            />
            <span>Descargar PDF (100mm)</span>
          </button>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════════
          BLOQUE 2: PARÁMETROS GENERALES DE CONFIGURACIÓN
         ══════════════════════════════════════════════════════════════════════════ */}
      <form
        onSubmit={handleSave}
        style={{
          background: 'white',
          padding: '28px',
          borderRadius: '30px',
          boxShadow: '0 4px 25px rgba(0,0,0,0.03)',
          border: '1px solid #f0f0f0',
        }}
      >
        <h2 style={{ fontSize: '18px', color: '#495D56', fontWeight: 800, margin: '0 0 20px 0' }}>
          Parámetros del Sistema
        </h2>

        {/* PIN DE VALIDACIÓN */}
        <div style={{ marginBottom: '26px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 700,
              color: '#998E55',
              marginBottom: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
            }}
          >
            Clave de Validación (4 dígitos)
          </label>
          <input
            type="text"
            maxLength="4"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="1234"
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '18px',
              border: '2px solid #F1F5F9',
              fontSize: '24px',
              textAlign: 'center',
              fontWeight: 800,
              color: '#1E293B',
              letterSpacing: '15px',
              outline: 'none',
              background: '#F8FAFC',
              boxSizing: 'border-box',
            }}
          />
          <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '8px', lineHeight: 1.4 }}>
            Esta clave se solicitará en la página de Seguimiento para confirmar la entrega del
            pedido.
          </p>
        </div>

        <hr style={{ border: 'none', height: '1px', background: '#F1F5F9', margin: '24px 0' }} />

        {/* MERCADO PAGO ACCESS TOKEN */}
        <div style={{ marginBottom: '26px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 700,
              color: '#998E55',
              marginBottom: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
            }}
          >
            Access Token de Producción — Mercado Pago
          </label>
          <input
            type="text"
            value={mpToken}
            onChange={(e) => setMpToken(e.target.value)}
            placeholder="APP_USR-..."
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: '15px',
              border: '1px solid #E2E8F0',
              fontSize: '13px',
              fontFamily: 'monospace',
              color: '#1E293B',
              outline: 'none',
              background: '#F8FAFC',
              boxSizing: 'border-box',
            }}
          />
          <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '8px', lineHeight: 1.4 }}>
            Obtenelo en Mercado Pago Developers → Tus integraciones → Credenciales de producción →
            Access Token. Se usa tanto para crear links de pago como para la conciliación de
            transferencias.
          </p>
        </div>

        <hr style={{ border: 'none', height: '1px', background: '#F1F5F9', margin: '24px 0' }} />

        {/* RUTA PDF (LEGACY) */}
        <div style={{ marginBottom: '30px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 700,
              color: '#94A3B8',
              marginBottom: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
            }}
          >
            Ruta Local de PDF (Referencia Desktop)
          </label>
          <input
            type="text"
            value={pdfPath}
            onChange={(e) => setPdfPath(e.target.value)}
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: '15px',
              border: '1px solid #E2E8F0',
              fontSize: '14px',
              color: '#64748B',
              outline: 'none',
              background: '#F8FAFC',
              boxSizing: 'border-box',
            }}
          />
          <p style={{ fontSize: '11px', color: '#CBD5E1', marginTop: '8px' }}>
            Campo informativo para mantener compatibilidad con Queselló Desktop.
          </p>
        </div>

        {message.text && (
          <div
            style={{
              padding: '15px',
              borderRadius: '15px',
              marginBottom: '20px',
              textAlign: 'center',
              background: message.type === 'success' ? '#D1FAE5' : '#FEE2E2',
              color: message.type === 'success' ? '#065F46' : '#991B1B',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          style={{
            width: '100%',
            padding: '18px',
            borderRadius: '20px',
            background: '#111',
            color: 'white',
            border: 'none',
            fontSize: '15px',
            fontWeight: 800,
            cursor: 'pointer',
            opacity: saving ? 0.7 : 1,
            transition: 'all 0.2s',
          }}
        >
          {saving ? 'GUARDANDO...' : 'GUARDAR CONFIGURACIÓN'}
        </button>
      </form>
    </div>
  );
}
