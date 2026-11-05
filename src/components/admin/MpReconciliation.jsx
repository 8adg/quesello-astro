import React, { useState, useEffect } from 'react';
import { supabaseAdmin as supabase } from '../../lib/supabase';

const WEBHOOK_SECRET = "M@timan1976/*";
const WEBHOOK_URL = `https://yihizwspxnxlfowvitoe.supabase.co/functions/v1/mp-webhook?secret=${encodeURIComponent(WEBHOOK_SECRET)}`;

export default function MpReconciliation({ onBack }) {
  const [allPayments, setAllPayments] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('unlinked'); // 'unlinked' | 'history'
  const [searchTerm, setSearchTerm] = useState("");
  
  // Diagnóstico y configuración de Token de MP
  const [syncError, setSyncError] = useState(null);
  const [showTokenConfig, setShowTokenConfig] = useState(false);
  const [mpTokenInput, setMpTokenInput] = useState("");
  const [savingToken, setSavingToken] = useState(false);

  // Para búsquedas manuales en cada tarjeta de pago
  const [manualSearchQuery, setManualSearchQuery] = useState({});
  const [showManualSearch, setShowManualSearch] = useState({});
  
  const [toast, setToast] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadData();
    handleSync(true);
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleSync = async (silent = false) => {
    setSyncing(true);
    if (!silent) setLoading(true);
    try {
      const response = await fetch(WEBHOOK_URL);
      const text = await response.text();
      let res = null;
      try { res = JSON.parse(text); } catch (_) {}

      if (!response.ok) {
        setSyncError(
          res || {
            error: text || "Error al conectar con Mercado Pago",
            mpStatus: response.status
          }
        );
        if (!silent) {
          showToast(res?.mpMessage ? `MP Error (${res.mpStatus}): ${res.mpMessage}` : "Error al sincronizar con Mercado Pago");
        }
        return;
      }

      setSyncError(null);
      if (res?.success) {
        if (!silent || res.count > 0) {
          showToast(
            res.autoLinkedCount > 0
              ? `Sincronizados ${res.count} pagos (${res.autoLinkedCount} conciliados automáticamente).`
              : `Sincronización completada (${res.count} pagos verificados).`
          );
        }
      }
    } catch (err) {
      console.error(err);
      setSyncError({ error: err.message });
      if (!silent) showToast("Error de red al sincronizar con Mercado Pago");
    } finally {
      setSyncing(false);
      loadData();
    }
  };

  const handleSaveTokenAndSync = async (e) => {
    e.preventDefault();
    const cleaned = mpTokenInput.trim().replace(/^["']|["']$/g, "");
    if (!cleaned) {
      showToast("Ingresá un Access Token válido (APP_USR-...)");
      return;
    }
    setSavingToken(true);
    try {
      const { error } = await supabase
        .from('config')
        .upsert({ clave: 'mp_access_token', valor: cleaned });
      if (error) throw error;
      showToast("Token guardado. Probando conexión con Mercado Pago...");
      setShowTokenConfig(false);
      await handleSync(false);
    } catch (err) {
      console.error(err);
      showToast("Error al guardar el token: " + err.message);
    } finally {
      setSavingToken(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(WEBHOOK_URL);
    showToast("URL de Webhook copiada al portapapeles");
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Obtener todos los pagos recibidos usando supabaseAdmin (evita bloqueo RLS de sesión autenticada)
      const { data: payData, error: payErr } = await supabase
        .from('pagos_recibidos_mp')
        .select('*')
        .order('fecha_acreditacion', { ascending: false });
      if (payErr) throw payErr;
      setAllPayments(payData || []);

      // 2. Obtener presupuestos para sugerencias e historial
      const { data: budData, error: budErr } = await supabase
        .from('presupuestos')
        .select('id, numero, cliente, total, fecha, pagado, estado')
        .order('id', { ascending: false });
      if (budErr) throw budErr;
      setBudgets(budData || []);

      // 3. Cargar token actual si existe en config
      const { data: tokenRow } = await supabase
        .from('config')
        .select('valor')
        .eq('clave', 'mp_access_token')
        .maybeSingle();
      if (tokenRow?.valor && !mpTokenInput) {
        setMpTokenInput(tokenRow.valor);
      }

    } catch (e) {
      console.error(e);
      showToast("Error al cargar los datos");
    } finally {
      setLoading(false);
    }
  };

  // Algoritmo de puntuación para emparejamiento
  const getSuggestions = (pago) => {
    const pAmount = Number(pago.monto);
    const pName = (pago.payer_name || "").toLowerCase();
    
    // Convertir fecha de acreditación
    const pDate = new Date(pago.fecha_acreditacion);

    const candidates = budgets
      .filter(b => !b.pagado) // Solo sugerir presupuestos impagos
      .map(b => {
        let score = 0;
        
        // 1. Coincidencia de monto
        const bAmount = Number(b.total);
        if (Math.abs(bAmount - pAmount) < 1.0) {
          score += 55; // Mayor peso al monto
        }

        // 2. Coincidencia de nombre (similitud por palabras)
        const bName = (b.cliente || "").toLowerCase();
        if (bName && pName) {
          const pWords = pName.split(/\s+/).filter(Boolean);
          const bWords = bName.split(/\s+/).filter(Boolean);
          let matchCount = 0;
          for (const bw of bWords) {
            if (pWords.some(pw => pw.includes(bw) || bw.includes(pw))) {
              matchCount++;
            }
          }
          if (matchCount > 0) {
            score += Math.min(30, (matchCount / Math.max(pWords.length, bWords.length)) * 30);
          }
        }

        // 3. Proximidad de fecha
        if (b.fecha) {
          // Parsear formato es-AR dd/mm/yyyy
          const parts = b.fecha.split('/');
          let bDate = null;
          if (parts.length === 3) {
            bDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
          } else {
            bDate = new Date(b.fecha);
          }

          if (bDate && !isNaN(bDate.getTime()) && !isNaN(pDate.getTime())) {
            const diffTime = Math.abs(pDate - bDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays <= 3) {
              score += 15; // Muy cercano (3 días)
            } else if (diffDays <= 7) {
              score += 8;  // Cercano (1 semana)
            }
          }
        }

        // 4. Coincidencia de número de presupuesto en el concepto
        const conceptoStr = (pago.concepto || "").toLowerCase();
        const bNumStr = (b.numero || "").toLowerCase();
        if (bNumStr && conceptoStr.includes(bNumStr)) {
          score += 80; // Altísima prioridad si lo incluyó en el concepto
        }

        return { budget: b, score: Math.round(score) };
      });

    // Filtrar candidatos con puntuación mínima y ordenar
    return candidates
      .filter(c => c.score > 20)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  };

  // Acción: Vincular un pago a un presupuesto
  const handleLink = async (pagoId, presupuestoId, bNumero) => {
    setActionLoading(true);
    try {
      // 1. Actualizar el presupuesto a PAGADO y cambiar estado a EN PROCESO
      const { error: budErr } = await supabase
        .from('presupuestos')
        .update({ pagado: true, estado: 'EN PROCESO' })
        .eq('id', presupuestoId);
      
      if (budErr) throw budErr;

      // 2. Asociar el pago en pagos_recibidos_mp
      const { error: payErr } = await supabase
        .from('pagos_recibidos_mp')
        .update({ presupuesto_id: presupuestoId })
        .eq('id', pagoId);

      if (payErr) throw payErr;

      showToast(`Presupuesto ${bNumero} marcado como PAGADO`);
      loadData();
    } catch (e) {
      console.error(e);
      showToast("Error al vincular pago");
    } finally {
      setActionLoading(false);
    }
  };

  // Acción: Descartar un movimiento que no corresponde a ningún pedido
  const handleDiscard = async (pago) => {
    setActionLoading(true);
    try {
      const newConcept = `[DESCARTADO] ${pago.concepto || ''}`.trim();
      const { error } = await supabase
        .from('pagos_recibidos_mp')
        .update({ concepto: newConcept })
        .eq('id', pago.id);
      if (error) throw error;
      showToast("Transferencia descartada de pendientes");
      loadData();
    } catch (e) {
      console.error(e);
      showToast("Error al descartar transferencia");
    } finally {
      setActionLoading(false);
    }
  };

  // Acción: Desvincular un pago (para corregir errores)
  const handleUnlink = async (pagoId, presupuestoId, bNumero) => {
    setActionLoading(true);
    try {
      // 1. Regresar el presupuesto a IMPAGO
      const { error: budErr } = await supabase
        .from('presupuestos')
        .update({ pagado: false })
        .eq('id', presupuestoId);
      
      if (budErr) throw budErr;

      // 2. Romper la asociación en pagos_recibidos_mp
      const { error: payErr } = await supabase
        .from('pagos_recibidos_mp')
        .update({ presupuesto_id: null })
        .eq('id', pagoId);

      if (payErr) throw payErr;

      showToast(`Se desvinculó el presupuesto ${bNumero}`);
      loadData();
    } catch (e) {
      console.error(e);
      showToast("Error al desvincular pago");
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(',', '');
  };

  const unlinkedPayments = allPayments.filter(
    p => p.presupuesto_id == null && !String(p.concepto || '').startsWith('[DESCARTADO]')
  );
  const historyPayments = allPayments.filter(p => p.presupuesto_id != null);
  const payments = activeTab === 'unlinked' ? unlinkedPayments : historyPayments;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'Inter', position: 'relative' }}>
      
      {/* CABECERA */}
      <header className="mp-reconcil-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={onBack} 
            style={{ 
              border: 'none', 
              cursor: 'pointer', 
              padding: '8px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              borderRadius: '50%',
              backgroundColor: 'rgba(74, 85, 104, 0.08)',
              flexShrink: 0
            }}
          >
            <img src="https://api.iconify.design/lucide/arrow-left.svg?color=%23FF5E5E" style={{ width: '22px', height: '22px' }} alt="Volver" />
          </button>
          <h1 className="mp-reconcil-title">Conciliación Mercado Pago</h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowTokenConfig(v => !v)}
            style={{
              border: '1px solid #E2E8F0',
              background: showTokenConfig ? '#1E293B' : 'white',
              color: showTokenConfig ? 'white' : '#475569',
              padding: '8px 14px',
              borderRadius: '14px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            ⚙️ Credenciales MP
          </button>

          {/* TABS */}
          <div style={{ display: 'flex', background: '#F4F1E1', padding: '5px', borderRadius: '16px' }}>
            <button 
              onClick={() => setActiveTab('unlinked')} 
              style={{
                border: 'none',
                padding: '7px 14px',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '12px',
                cursor: 'pointer',
                background: activeTab === 'unlinked' ? '#FF5E5E' : 'transparent',
                color: activeTab === 'unlinked' ? 'white' : '#8B1E1E',
                transition: 'all 0.2s'
              }}
            >
              PENDIENTES ({unlinkedPayments.length})
            </button>
            <button 
              onClick={() => setActiveTab('history')} 
              style={{
                border: 'none',
                padding: '7px 14px',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '12px',
                cursor: 'pointer',
                background: activeTab === 'history' ? '#FF5E5E' : 'transparent',
                color: activeTab === 'history' ? 'white' : '#8B1E1E',
                transition: 'all 0.2s'
              }}
            >
              CONCILIADOS ({historyPayments.length})
            </button>
          </div>
        </div>
      </header>

      <hr style={{ border: 'none', height: '2px', background: '#aba9a4', opacity: 0.2, margin: '16px 0' }} />

      {/* ALERTA DE DIAGNÓSTICO SI FALLA LA CONEXIÓN CON MERCADO PAGO */}
      {(syncError || showTokenConfig) && (
        <div style={{
          background: syncError ? '#FFF5F5' : '#F8FAFC',
          border: syncError ? '2px solid #FEB2B2' : '2px solid #E2E8F0',
          borderRadius: '20px',
          padding: '18px 20px',
          marginBottom: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {syncError && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9B1C1C', fontWeight: 800, fontSize: '14px' }}>
                <span>⚠️ Mercado Pago rechazó la conexión ({syncError.mpStatus || 'Error'})</span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#7F1D1D', lineHeight: 1.5 }}>
                <strong>Respuesta de Mercado Pago:</strong> <code>{syncError.mpMessage || syncError.error}</code>
                {syncError.tokenPrefix && <span> (Token en uso: <code>{syncError.tokenPrefix}</code>)</span>}
              </p>
              {String(syncError.mpMessage || '').includes('Unauthorized use of live credentials') && (
                <div style={{ marginTop: '8px', background: 'white', padding: '10px 14px', borderRadius: '12px', fontSize: '12px', color: '#475569', lineHeight: 1.5, border: '1px solid #FECACA' }}>
                  <strong>¿Por qué ocurre este error en Mercado Pago?</strong><br />
                  El mensaje <code>Unauthorized use of live credentials</code> aparece cuando el Access Token configurado pertenece a la pestaña <strong>"Credenciales de prueba"</strong> (que también empiezan con <code>APP_USR-...</code>) o cuando la aplicación en Mercado Pago Developers todavía no tiene activadas las <strong>"Credenciales de producción"</strong>.<br />
                  👉 Entrá a <a href="https://www.mercadopago.com.ar/developers/panel/app" target="_blank" rel="noreferrer" style={{ color: '#8B1E1E', fontWeight: 800 }}>Mercado Pago Developers → Tus integraciones</a>, seleccioná tu app, andá a <strong>Producción → Credenciales de producción</strong>, copiá el <strong>Access Token</strong> y pegalo acá abajo:
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSaveTokenAndSync} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
              Access Token de Producción de Mercado Pago (APP_USR-...)
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Pegá acá tu Access Token de Producción (APP_USR-...)"
                value={mpTokenInput}
                onChange={(e) => setMpTokenInput(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: '220px',
                  padding: '11px 14px',
                  borderRadius: '12px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  background: 'white'
                }}
              />
              <button
                type="submit"
                disabled={savingToken}
                style={{
                  background: '#1E293B',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '11px 18px',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                {savingToken ? 'Guardando...' : 'Guardar Token y Sincronizar'}
              </button>
            </div>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', paddingTop: '6px', borderTop: '1px dashed #CBD5E1', fontSize: '11px', color: '#64748B' }}>
            <span>URL para configurar en <strong>Webhooks</strong> de Mercado Pago (evento: <em>Pagos / payment</em>):</span>
            <button
              type="button"
              onClick={copyWebhookUrl}
              style={{
                background: 'white',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                color: '#1E293B'
              }}
            >
              📋 Copiar URL Webhook
            </button>
          </div>
        </div>
      )}

      {/* FILTRO DE BÚSQUEDA */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
        <input 
          type="text" 
          placeholder="Buscar por pagador, concepto o monto..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
          style={{ flex: 1, padding: '13px 16px', borderRadius: '16px', border: '2px solid #EDF2F7', background: 'white', fontSize: '14px', outline: 'none' }} 
        />
        <button 
          onClick={() => handleSync(false)}
          disabled={syncing}
          style={{ 
            background: '#F4F1E1', 
            border: 'none', 
            borderRadius: '16px', 
            padding: '13px 16px', 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontWeight: 800,
            fontSize: '13px',
            color: '#4b3b28',
            flexShrink: 0
          }}
        >
          <img
            src="https://api.iconify.design/lucide/refresh-cw.svg?color=%234b3b28"
            style={{ width: '18px', height: '18px', animation: syncing ? 'spin 1s linear infinite' : 'none' }}
            alt="Sincronizar"
          />
          <span className="mp-sync-btn-label">{syncing ? 'Sincronizando...' : 'Sincronizar MP'}</span>
        </button>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px', fontSize: '16px', color: '#64748B', fontWeight: 600 }}>Cargando transferencias...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '50px' }}>
          
          {payments.length === 0 && (
            <div style={{ 
              background: 'white', borderRadius: '24px', padding: '40px 20px', textAlign: 'center', 
              boxShadow: '0 4px 20px rgba(0,0,0,0.01)', border: '1px solid #F1F5F9', color: '#64748B', fontWeight: 500
            }}>
              {activeTab === 'unlinked' ? 'No hay transferencias pendientes de conciliación.' : 'No hay transferencias conciliadas en el historial.'}
            </div>
          )}

          {payments
            .filter(p => {
              const term = searchTerm.toLowerCase();
              return (p.payer_name || "").toLowerCase().includes(term) || 
                     (p.concepto || "").toLowerCase().includes(term) || 
                     (p.monto || "").toString().includes(term) ||
                     (p.mp_payment_id || "").includes(term);
            })
            .map(pago => {
              // Obtener sugerencias automáticas
              const suggestions = activeTab === 'unlinked' ? getSuggestions(pago) : [];
              
              // Buscar presupuesto asociado (si es pestaña de historial)
              const associatedBudget = activeTab === 'history' ? budgets.find(b => b.id === pago.presupuesto_id) : null;

              return (
                <div 
                  key={pago.id}
                  style={{
                    background: 'white', borderRadius: '22px', padding: '20px', 
                    boxShadow: '0 4px 20px rgba(0,0,0,0.02)', border: '1px solid #F1F5F9',
                    display: 'flex', flexDirection: 'column', gap: '15px',
                    opacity: actionLoading ? 0.6 : 1, pointerEvents: actionLoading ? 'none' : 'auto'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    {/* Info Transferencia */}
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '17px', fontWeight: 800, color: '#4b3b28' }}>{pago.payer_name || "Desconocido"}</span>
                        {pago.payer_document && (
                          <span style={{ background: '#F1F5F9', padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, color: '#64748B' }}>
                            {pago.payer_document}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '5px' }}>
                        Acreditado: {formatDate(pago.fecha_acreditacion)} | ID: {pago.mp_payment_id}
                      </div>
                      {pago.concepto && (
                        <div style={{ 
                          marginTop: '8px', background: '#F4F1E1', padding: '6px 12px', borderRadius: '10px', 
                          fontSize: '11px', fontWeight: 600, color: '#8B1E1E', display: 'inline-block' 
                        }}>
                          CONCEPTO: "{pago.concepto}"
                        </div>
                      )}
                    </div>

                    {/* Monto Pago */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                      <div style={{ fontSize: '22px', fontWeight: 800, color: '#8E1F52' }}>
                        ${Number(pago.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '10px', fontWeight: 900, color: '#00B67A', marginTop: '4px', textTransform: 'uppercase' }}>
                        TRANSFERENCIA MP
                      </div>
                    </div>
                  </div>

                  {/* SECCIÓN DE VINCULACIÓN (PENDIENTES) */}
                  {activeTab === 'unlinked' && (
                    <div style={{ borderTop: '1px dashed #E2E8F0', paddingTop: '15px', marginTop: '5px' }}>
                      
                      {/* Sugerencias Encontradas */}
                      {suggestions.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 900, color: '#998E55', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            Sugerencias de emparejamiento:
                          </span>
                          
                          {suggestions.map(({ budget: b, score }) => (
                            <div 
                              key={b.id}
                              style={{ 
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px',
                                background: score >= 75 ? '#F0FDF4' : '#F8FAFC', 
                                padding: '12px 16px', borderRadius: '16px', border: score >= 75 ? '1px solid #BBF7D0' : '1px solid #E2E8F0'
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: 800, fontSize: '14px', color: '#1e293b' }}>
                                    {b.numero} - {b.cliente}
                                  </span>
                                  <span style={{ 
                                    fontSize: '10px', fontWeight: 900, padding: '2px 6px', borderRadius: '8px',
                                    background: score >= 75 ? '#D1FAE5' : '#FEF3C7',
                                    color: score >= 75 ? '#065F46' : '#92400E'
                                  }}>
                                    {score}% de coincidencia
                                  </span>
                                </div>
                                <span style={{ fontSize: '11px', color: '#64748B' }}>
                                  Fecha pedido: {b.fecha} | Total: ${b.total?.toLocaleString('es-AR')}
                                </span>
                              </div>

                              <button 
                                onClick={() => handleLink(pago.id, b.id, b.numero)}
                                style={{ 
                                  background: '#FF5E5E', color: 'white', border: 'none', 
                                  padding: '8px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: 700, 
                                  cursor: 'pointer', transition: 'all 0.2s'
                                }}
                              >
                                Vincular
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: '12px', color: '#64748B', fontStyle: 'italic', marginBottom: '10px' }}>
                          No se encontraron sugerencias automáticas claras para este pago.
                        </div>
                      )}

                      {/* Búsqueda Manual y Descarte */}
                      <div style={{ marginTop: '10px' }}>
                        {!showManualSearch[pago.id] ? (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                            <button 
                              onClick={() => setShowManualSearch(prev => ({ ...prev, [pago.id]: true }))}
                              style={{ 
                                background: 'none', border: 'none', color: '#FF5E5E', fontSize: '12px', 
                                fontWeight: 800, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '5px' 
                              }}
                            >
                              <img src="https://api.iconify.design/lucide/link.svg?color=%23FF5E5E" style={{ width: '14px', height: '14px' }} alt="" />
                              Vincular manualmente un presupuesto
                            </button>

                            <button
                              onClick={() => handleDiscard(pago)}
                              style={{
                                background: 'none', border: 'none', color: '#94A3B8', fontSize: '11px',
                                fontWeight: 700, cursor: 'pointer', padding: 0
                              }}
                            >
                              ✕ Descartar (no es pedido)
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#F8FAFC', padding: '15px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '11px', fontWeight: 900, color: '#475569' }}>BÚSQUEDA MANUAL DE PRESUPUESTO</span>
                              <button 
                                onClick={() => setShowManualSearch(prev => ({ ...prev, [pago.id]: false }))}
                                style={{ border: 'none', background: 'none', color: '#64748B', fontWeight: 900, cursor: 'pointer', fontSize: '14px' }}
                              >
                                ×
                              </button>
                            </div>

                            <input 
                              type="text" 
                              placeholder="Buscar por nro., cliente o monto (ej: 00238, Rocio, 15950)..."
                              value={manualSearchQuery[pago.id] || ""}
                              onChange={(e) => setManualSearchQuery(prev => ({ ...prev, [pago.id]: e.target.value }))}
                              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                            />

                            {/* Resultados de búsqueda manual */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                              {budgets
                                .filter(b => {
                                  const query = (manualSearchQuery[pago.id] || "").toLowerCase();
                                  if (!query) return false;
                                  return (b.cliente || "").toLowerCase().includes(query) || 
                                         (b.numero || "").toLowerCase().includes(query) ||
                                         String(b.total || "").includes(query);
                                })
                                .slice(0, 6)
                                .map(b => (
                                  <div 
                                    key={b.id}
                                    style={{ 
                                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
                                      padding: '8px 12px', background: 'white', borderRadius: '10px', border: '1px solid #E2E8F0'
                                    }}
                                  >
                                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                                      {b.numero} - {b.cliente} (${Number(b.total).toLocaleString('es-AR')}) {b.pagado ? '· [PAGADO]' : '· [IMPAGO]'}
                                    </span>
                                    <button 
                                      onClick={() => handleLink(pago.id, b.id, b.numero)}
                                      style={{ 
                                        background: '#495D56', color: 'white', border: 'none', 
                                        padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, 
                                        cursor: 'pointer', flexShrink: 0
                                      }}
                                    >
                                      Vincular
                                    </button>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                  {/* INFORMACIÓN DEL VÍNCULO (HISTORIAL) */}
                  {activeTab === 'history' && (
                    <div style={{ borderTop: '1px dashed #E2E8F0', paddingTop: '15px', marginTop: '5px' }}>
                      <div style={{ 
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px',
                        background: '#F0FDF4', padding: '12px 16px', borderRadius: '16px', border: '1px solid #BBF7D0'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 900, color: '#065F46', textTransform: 'uppercase' }}>
                              VINCULADO CORRECTAMENTE A:
                            </span>
                          </div>
                          {associatedBudget ? (
                            <span style={{ fontWeight: 800, fontSize: '14px', color: '#1e293b' }}>
                              {associatedBudget.numero} - {associatedBudget.cliente} (Total: ${associatedBudget.total?.toLocaleString('es-AR')})
                            </span>
                          ) : (
                            <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>
                              Presupuesto ID: {pago.presupuesto_id} (No cargado en lista actual)
                            </span>
                          )}
                        </div>

                        <button 
                          onClick={() => handleUnlink(pago.id, pago.presupuesto_id, associatedBudget?.numero || pago.presupuesto_id)}
                          style={{ 
                            background: 'white', color: '#DC2626', border: '1px solid #FEE2E2', 
                            padding: '8px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: 800, 
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.02)'
                          }}
                        >
                          <img src="https://api.iconify.design/lucide/unlink.svg?color=%23DC2626" style={{ width: '14px', height: '14px' }} alt="" />
                          Desvincular
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
        </div>
      )}

      {/* TOAST DE FEEDBACK */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', background: '#111', color: 'white', padding: '12px 24px', borderRadius: '50px', fontSize: '13px', fontWeight: 600, boxShadow: '0 10px 30px rgba(0,0,0,0.2)', zIndex: 1100, animation: 'slideUp 0.3s ease', whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}

      <style>{`
        @keyframes slideUp { from { transform: translate(-50%, 20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .mp-reconcil-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 4px;
        }
        .mp-reconcil-title {
          font-size: 26px;
          color: #FF5E5E;
          font-weight: 800;
          margin: 0;
        }
        @media (max-width: 768px) {
          .mp-reconcil-title {
            font-size: 19px;
          }
          .mp-sync-btn-label {
            display: none;
          }
        }
      `}</style>

    </div>
  );
}
