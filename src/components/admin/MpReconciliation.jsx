import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function MpReconciliation({ onBack }) {
  const [payments, setPayments] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('unlinked'); // 'unlinked' | 'history'
  const [searchTerm, setSearchTerm] = useState("");
  
  // Para búsquedas manuales en cada tarjeta de pago
  const [manualSearchQuery, setManualSearchQuery] = useState({});
  const [showManualSearch, setShowManualSearch] = useState({});
  
  const [toast, setToast] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Obtener pagos de Mercado Pago según la pestaña activa
      let payQuery = supabase.from('pagos_recibidos_mp').select('*');
      if (activeTab === 'unlinked') {
        payQuery = payQuery.is('presupuesto_id', null);
      } else {
        payQuery = payQuery.not('presupuesto_id', 'is', null);
      }
      const { data: payData, error: payErr } = await payQuery.order('fecha_acreditacion', { ascending: false });
      if (payErr) throw payErr;
      setPayments(payData || []);

      // 2. Obtener presupuestos impagos para el algoritmo de sugerencias (o todos si es la pestaña de historial)
      const { data: budData, error: budErr } = await supabase
        .from('presupuestos')
        .select('id, numero, cliente, total, fecha, pagado, estado')
        .order('id', { ascending: false });
      if (budErr) throw budErr;
      setBudgets(budData || []);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'Inter', position: 'relative' }}>
      
      {/* CABECERA */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button 
            onClick={onBack} 
            style={{ 
              border: 'none', 
              background: 'none', 
              cursor: 'pointer', 
              padding: '8px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              borderRadius: '50%',
              backgroundColor: 'rgba(74, 85, 104, 0.05)'
            }}
          >
            <img src="https://api.iconify.design/lucide:arrow-left.svg?color=%23FF5E5E" style={{ width: '22px', height: '22px' }} alt="Volver" />
          </button>
          <h1 style={{ fontSize: '28px', color: '#FF5E5E', fontWeight: 800, margin: 0 }}>Conciliación Mercado Pago</h1>
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', background: '#F4F1E1', padding: '6px', borderRadius: '18px' }}>
          <button 
            onClick={() => setActiveTab('unlinked')} 
            style={{
              border: 'none',
              padding: '8px 20px',
              borderRadius: '14px',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              background: activeTab === 'unlinked' ? '#FF5E5E' : 'transparent',
              color: activeTab === 'unlinked' ? 'white' : '#8B1E1E',
              transition: 'all 0.2s'
            }}
          >
            PENDIENTES
          </button>
          <button 
            onClick={() => setActiveTab('history')} 
            style={{
              border: 'none',
              padding: '8px 20px',
              borderRadius: '14px',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              background: activeTab === 'history' ? '#FF5E5E' : 'transparent',
              color: activeTab === 'history' ? 'white' : '#8B1E1E',
              transition: 'all 0.2s'
            }}
          >
            CONCILIADOS
          </button>
        </div>
      </header>

      <hr style={{ border: 'none', height: '2px', background: '#aba9a4', opacity: 0.2, margin: '20px 0' }} />

      {/* FILTRO DE BÚSQUEDA */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', alignItems: 'center' }}>
        <input 
          type="text" 
          placeholder="Buscar por pagador, concepto o monto..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
          style={{ flex: 1, padding: '14px 20px', borderRadius: '18px', border: '2px solid #EDF2F7', background: 'white', fontSize: '15px', outline: 'none' }} 
        />
        <button 
          onClick={loadData} 
          style={{ 
            background: '#F4F1E1', 
            border: 'none', 
            borderRadius: '18px', 
            padding: '14px 20px', 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <img src="https://api.iconify.design/lucide:refresh-cw.svg?color=%234b3b28" style={{ width: '18px', height: '18px' }} alt="Recargar" />
        </button>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px', fontSize: '16px', color: '#64748B', fontWeight: 600 }}>Cargando transferencias...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '50px' }}>
          
          {payments.length === 0 && (
            <div style={{ 
              background: 'white', borderRadius: '24px', padding: '40px', textAlign: 'center', 
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
              const hasPerfectSuggestion = suggestions.length > 0 && suggestions[0].score >= 80;
              
              // Buscar presupuesto asociado (si es pestaña de historial)
              const associatedBudget = activeTab === 'history' ? budgets.find(b => b.id === pago.presupuesto_id) : null;

              return (
                <div 
                  key={pago.id}
                  style={{
                    background: 'white', borderRadius: '24px', padding: '24px 30px', 
                    boxShadow: '0 4px 20px rgba(0,0,0,0.01)', border: '1px solid #F1F5F9',
                    display: 'flex', flexDirection: 'column', gap: '15px',
                    opacity: actionLoading ? 0.6 : 1, pointerEvents: actionLoading ? 'none' : 'auto'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
                    {/* Info Transferencia */}
                    <div style={{ flex: 1, minWidth: '250px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '18px', fontWeight: 800, color: '#4b3b28' }}>{pago.payer_name || "Desconocido"}</span>
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
                      <div style={{ fontSize: '24px', fontWeight: 800, color: '#8E1F52' }}>
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
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                                background: score >= 75 ? '#F0FDF4' : '#F8FAFC', 
                                padding: '12px 20px', borderRadius: '16px', border: score >= 75 ? '1px solid #BBF7D0' : '1px solid #E2E8F0'
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

                      {/* Búsqueda Manual */}
                      <div style={{ marginTop: '10px' }}>
                        {!showManualSearch[pago.id] ? (
                          <button 
                            onClick={() => setShowManualSearch(prev => ({ ...prev, [pago.id]: true }))}
                            style={{ 
                              background: 'none', border: 'none', color: '#FF5E5E', fontSize: '12px', 
                              fontWeight: 800, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '5px' 
                            }}
                          >
                            <img src="https://api.iconify.design/lucide:link.svg?color=%23FF5E5E" style={{ width: '14px', height: '14px' }} alt="" />
                            Vincular manualmente un presupuesto
                          </button>
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
                              placeholder="Buscar por nro. presupuesto (ej: 00194-01) o cliente..."
                              value={manualSearchQuery[pago.id] || ""}
                              onChange={(e) => setManualSearchQuery(prev => ({ ...prev, [pago.id]: e.target.value }))}
                              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                            />

                            {/* Resultados de búsqueda manual */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto' }}>
                              {budgets
                                .filter(b => !b.pagado)
                                .filter(b => {
                                  const query = (manualSearchQuery[pago.id] || "").toLowerCase();
                                  if (!query) return false;
                                  return (b.cliente || "").toLowerCase().includes(query) || 
                                         (b.numero || "").toLowerCase().includes(query);
                                })
                                .slice(0, 5)
                                .map(b => (
                                  <div 
                                    key={b.id}
                                    style={{ 
                                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                                      padding: '8px 12px', background: 'white', borderRadius: '10px', border: '1px solid #E2E8F0'
                                    }}
                                  >
                                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                                      {b.numero} - {b.cliente} (${b.total})
                                    </span>
                                    <button 
                                      onClick={() => handleLink(pago.id, b.id, b.numero)}
                                      style={{ 
                                        background: '#495D56', color: 'white', border: 'none', 
                                        padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, 
                                        cursor: 'pointer' 
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
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: '#F0FDF4', padding: '12px 20px', borderRadius: '16px', border: '1px solid #BBF7D0'
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
                          <img src="https://api.iconify.design/lucide:unlink.svg?color=%23DC2626" style={{ width: '14px', height: '14px' }} alt="" />
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
        <div style={{ position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', background: '#111', color: 'white', padding: '12px 30px', borderRadius: '50px', fontSize: '14px', fontWeight: 600, boxShadow: '0 10px 30px rgba(0,0,0,0.2)', zIndex: 1100, animation: 'slideUp 0.3s ease' }}>
          {toast}
        </div>
      )}

      <style>{`
        @keyframes slideUp { from { transform: translate(-50%, 20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
      `}</style>

    </div>
  );
}
