import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { getOrderSvgUrl, getOrderDjUrl, cleanObservacionesText, mergeObservacionesWithSvg, downloadSvgDirect, downloadPdfDirect } from './svgOrderUtils';
import { requoteBudgetItems, quoteCustomDimension } from '../../lib/pricingEngine';

const BudgetEditor = ({ editingOrder, onSave, onCancel }) => {
  const [catalogo, setCatalogo] = useState([]);
  const [busquedaProd, setBusquedaProd] = useState("");
  const [carrito, setCarrito] = useState([]);
  
  const [cliente, setCliente] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [svgUrl, setSvgUrl] = useState(null);
  const [djUrl, setDjUrl] = useState(null);
  const [fecha, setFecha] = useState("");
  const [retiro, setRetiro] = useState("");
  const [estado, setEstado] = useState("PENDIENTE");
  const [pagado, setPagado] = useState(false);

  const [descLabel, setDescLabel] = useState("");
  const [descValor, setDescValor] = useState("");
  const [descTipo, setDescTipo] = useState("$");

  // Estados para Recotización y Cotizador Rectangular (L+A)
  const [requoteSummary, setRequoteSummary] = useState(null);
  const [showCustomQuoter, setShowCustomQuoter] = useState(false);
  const [customWidth, setCustomWidth] = useState(9);
  const [customHeight, setCustomHeight] = useState(6);
  const [customPriceOverride, setCustomPriceOverride] = useState("");
  
  const [loading, setLoading] = useState(false);
  const FRANQUICIA_ID = 1;

  useEffect(() => {
    loadCatalogo();
    if (editingOrder) {
      setCliente(editingOrder.cliente || "");
      const rawObs = editingOrder.observaciones || "";
      setSvgUrl(getOrderSvgUrl(editingOrder));
      setDjUrl(getOrderDjUrl(editingOrder));
      setObservaciones(cleanObservacionesText(rawObs));
      setFecha(editingOrder.fecha || "");
      setRetiro(editingOrder.retiro_sugerido || "");
      setEstado(editingOrder.estado || "PENDIENTE");
      setPagado(!!editingOrder.pagado);
      loadItems(editingOrder.id);
    } else {
      setSvgUrl(null);
      setDjUrl(null);
      setFecha(new Date().toLocaleDateString('es-AR'));
    }
  }, [editingOrder]);

  const loadCatalogo = async () => {
    const { data } = await supabase.from("productos").select("*").eq("franquicia_id", FRANQUICIA_ID).order("descripcion");
    setCatalogo(data || []);
  };

  const loadItems = async (pid) => {
    const { data } = await supabase.from("presupuesto_items").select("*").eq("presupuesto_id", pid);
    if (data) setCarrito(data.map(it => ({ 
      descripcion: it.descripcion, 
      cantidad: it.cantidad, 
      precio_unitario: it.precio_unitario, 
      total: it.total 
    })));
  };

  const agregarAlCarrito = (p) => {
    const ex = carrito.find(it => it.descripcion === p.descripcion.toUpperCase());
    if (ex) {
      setCarrito(carrito.map(it => it.descripcion === p.descripcion.toUpperCase() ? { ...it, cantidad: it.cantidad + 1, total: (it.cantidad + 1) * it.precio_unitario } : it));
    } else {
      setCarrito([...carrito, { descripcion: p.descripcion.toUpperCase(), cantidad: 1, precio_unitario: p.precio, total: p.precio }]);
    }
  };

  const aplicarDescuento = () => {
    const v = parseFloat(descValor); if (isNaN(v)) return;
    const subtotal = carrito.reduce((acc, it) => acc + it.total, 0);
    let t = descTipo === "$" ? -v : -(subtotal * (v / 100));
    setCarrito([...carrito, { 
      descripcion: `BONIF: ${descLabel || (descTipo === "%" ? v + "%" : "$" + v)}`.toUpperCase(), 
      cantidad: 1, 
      precio_unitario: t, 
      total: t 
    }]);
    setDescValor(""); setDescLabel("");
  };

  const quitarDelCarrito = (idx) => {
    const newC = [...carrito]; newC.splice(idx, 1); setCarrito(newC);
  };

  const actualizarItemCarrito = (idx, field, value) => {
    const newC = [...carrito];
    const current = { ...newC[idx] };
    if (field === 'cantidad') {
      const q = Math.max(1, parseInt(value, 10) || 1);
      current.cantidad = q;
      current.total = q * Number(current.precio_unitario || 0);
    } else if (field === 'precio_unitario') {
      const p = parseFloat(value);
      const unitP = isNaN(p) ? 0 : p;
      current.precio_unitario = unitP;
      current.total = Number(current.cantidad || 1) * unitP;
    }
    newC[idx] = current;
    setCarrito(newC);
  };

  const customQuotePreview = useMemo(() => {
    return quoteCustomDimension(customWidth, customHeight, catalogo);
  }, [customWidth, customHeight, catalogo]);

  useEffect(() => {
    setCustomPriceOverride("");
  }, [customWidth, customHeight]);

  const handleAgregarMedidaEspecial = () => {
    const finalUnitPrice =
      customPriceOverride !== "" && !isNaN(Number(customPriceOverride))
        ? Number(customPriceOverride)
        : customQuotePreview.unitPrice;
    agregarAlCarrito({
      descripcion: `SELLO ${customWidth}X${customHeight}CM`,
      precio: finalUnitPrice,
    });
    setShowCustomQuoter(false);
    setCustomPriceOverride("");
  };

  const handleRequoteToCurrentCatalog = () => {
    if (carrito.length === 0) return;
    const result = requoteBudgetItems(carrito, catalogo);
    setRequoteSummary(result);
    if (!result.hasChanges) {
      alert("Este presupuesto ya tiene los precios vigentes de la lista actual.");
      return;
    }
    setCarrito(result.updatedItems);
  };

  const total = carrito.reduce((a, b) => a + b.total, 0);

  const handleGuardar = async () => {
    if (!cliente) return alert("Falta el Cliente");
    setLoading(true);
    try {
      let finalNro = editingOrder?.numero || "";
      if (!editingOrder || (finalNro && finalNro.toString().startsWith("W"))) {
        const { data: lastOne } = await supabase.from('presupuestos').select('numero').not('numero', 'ilike', 'W%').eq('franquicia_id', FRANQUICIA_ID).order('id', { ascending: false }).limit(1);
        let nextNum = 1;
        if (lastOne && lastOne[0]?.numero) { nextNum = parseInt(lastOne[0].numero.split('-')[0]) + 1; }
        finalNro = `${nextNum.toString().padStart(5, '0')}-01`;
      }

      const budgetData = {
        cliente: cliente.toUpperCase(),
        observaciones: mergeObservacionesWithSvg(observaciones, svgUrl, djUrl),
        fecha,
        retiro_sugerido: retiro,
        pagado,
        estado,
        ...(estado === 'ENTREGADO'
          ? { entregado_at: editingOrder?.entregado_at || new Date().toISOString() }
          : {}),
        total,
        franquicia_id: FRANQUICIA_ID,
        numero: finalNro,
        token: editingOrder?.token || Math.random().toString(36).substring(2, 10).toUpperCase()
      };

      const { data: res, error: bError } = await supabase.from('presupuestos').upsert(editingOrder ? { id: editingOrder.id, ...budgetData } : budgetData).select().single();
      if (bError) throw bError;
      if (editingOrder) await supabase.from("presupuesto_items").delete().eq("presupuesto_id", res.id);
      
      const itemsToInsert = carrito.map(it => ({ 
        presupuesto_id: res.id, 
        descripcion: it.descripcion.toUpperCase(), 
        cantidad: it.cantidad, 
        precio_unitario: it.precio_unitario, 
        total: it.total 
      }));
      await supabase.from("presupuesto_items").insert(itemsToInsert);
      onSave();
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  };

  const inputStyle = { width: '100%', padding: '12px 14px', borderRadius: '12px', border: '2px solid #F1F5F9', marginBottom: '10px', fontSize: '14px', fontFamily: 'Inter', background: 'white', boxSizing: 'border-box', outline: 'none' };

  return (
    <div className="be-container">
      
      {/* COLUMNA IZQUIERDA: CATÁLOGO */}
      <div className="be-col-catalogo">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 900, color: '#998E55', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Inter' }}>Catálogo</h3>
          <button
            type="button"
            onClick={() => setShowCustomQuoter((v) => !v)}
            style={{
              background: showCustomQuoter ? '#FF5E5E' : '#F4F1E1',
              color: showCustomQuoter ? '#FFFFFF' : '#495D56',
              border: 'none',
              borderRadius: '14px',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 600,
              fontFamily: 'Inter',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <img
              src={`https://api.iconify.design/lucide/ruler.svg?color=${encodeURIComponent(showCustomQuoter ? '#FFFFFF' : '#495D56')}`}
              style={{ width: '14px', height: '14px' }}
              alt=""
            />
            <span>Medida Especial (L+A)</span>
          </button>
        </div>

        {showCustomQuoter && (
          <div
            style={{
              background: '#FAF9F6',
              border: '1px solid #DFDED9',
              borderRadius: '16px',
              padding: '12px',
              marginBottom: '10px',
              fontFamily: 'Inter',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '8px', marginBottom: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#998E55', marginBottom: '4px' }}>ANCHO (CM)</label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(e.target.value)}
                  style={{ ...inputStyle, marginBottom: 0, padding: '8px 10px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#998E55', marginBottom: '4px' }}>ALTO (CM)</label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  value={customHeight}
                  onChange={(e) => setCustomHeight(e.target.value)}
                  style={{ ...inputStyle, marginBottom: 0, padding: '8px 10px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#998E55', marginBottom: '4px' }}>PRECIO EDITABLE ($)</label>
                <input
                  type="number"
                  step="50"
                  value={customPriceOverride !== "" ? customPriceOverride : customQuotePreview.unitPrice}
                  onChange={(e) => setCustomPriceOverride(e.target.value)}
                  style={{ ...inputStyle, marginBottom: 0, padding: '8px 10px', fontWeight: 700, color: '#8E1F52' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: '#495D56' }}>
                {customQuotePreview.ruleApplied}
              </span>
              <button
                type="button"
                onClick={handleAgregarMedidaEspecial}
                style={{
                  background: '#FF5E5E',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'Inter',
                  flexShrink: 0,
                }}
              >
                + Agregar al pedido
              </button>
            </div>
          </div>
        )}

        <input type="text" placeholder="BUSCAR PRODUCTO..." value={busquedaProd} onChange={e => setBusquedaProd(e.target.value)} style={inputStyle} />
        <div className="be-catalogo-scroll">
          {catalogo.filter(p => p.descripcion.toLowerCase().includes(busquedaProd.toLowerCase())).map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#5E7358' }}>{p.descripcion.toUpperCase()}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontWeight: 700, color: '#8E1F52' }}>${p.precio?.toLocaleString('es-AR')}</span>
                <button onClick={() => agregarAlCarrito(p)} style={{ background: '#FF5E5E', color: 'white', border: 'none', borderRadius: '10px', padding: '5px 14px', cursor: 'pointer', fontWeight: 800, fontFamily: 'Inter' }}>+</button>
              </div>
            </div>
          ))}
          <button onClick={() => {
            const val = prompt("Precio para manual:", "0");
            if(val) agregarAlCarrito({descripcion: busquedaProd || "VARIO", precio: parseFloat(val)});
          }} style={{ width: '100%', padding: '10px', marginTop: '10px', background: '#F4F1E1', color: '#495D56', border: 'none', borderRadius: '12px', fontWeight: 800, fontFamily: 'Inter', cursor: 'pointer' }}>+ PRODUCTO VARIO</button>
        </div>
      </div>

      {/* COLUMNA DERECHA: PEDIDO */}
      <div className="be-col-pedido">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <input type="text" placeholder="CLIENTE" value={cliente} onChange={e => setCliente(e.target.value)} style={{ ...inputStyle, fontWeight: 'bold' }} />
          <input type="text" placeholder="FECHA" value={fecha} onChange={e => setFecha(e.target.value)} style={inputStyle} />
        </div>
        <textarea placeholder="OBSERVACIONES" value={observaciones} onChange={e => setObservaciones(e.target.value)} style={{ ...inputStyle, height: '60px' }} />
        {svgUrl && (
          <div style={{ marginBottom: '10px' }}>
            <button
              type="button"
              onClick={() => downloadSvgDirect(svgUrl, `sello_${editingOrder?.numero || 'vector'}.svg`)}
              style={{
                width: '100%',
                padding: '11px 16px',
                borderRadius: '12px',
                border: '1.5px solid #FCA5A5',
                background: '#FEF2F2',
                color: '#DC2626',
                fontWeight: 800,
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(220, 38, 38, 0.08)',
                fontFamily: 'Inter'
              }}
            >
              <img src="https://api.iconify.design/lucide/download.svg?color=%23DC2626" style={{ width: '16px', height: '16px' }} alt="Descargar" />
              <span>DESCARGAR ARCHIVO SVG (INKSCAPE / LÁSER)</span>
            </button>
          </div>
        )}
        {djUrl && (
          <div style={{ marginBottom: '10px' }}>
            <button
              type="button"
              onClick={() => downloadPdfDirect(djUrl, `declaracion_jurada_${editingOrder?.numero || 'doc'}.pdf`)}
              style={{
                width: '100%',
                padding: '11px 16px',
                borderRadius: '12px',
                border: '1.5px solid #93C5FD',
                background: '#EFF6FF',
                color: '#1D4ED8',
                fontWeight: 800,
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(29, 78, 216, 0.08)',
                fontFamily: 'Inter'
              }}
            >
              <img src="https://api.iconify.design/lucide/file-text.svg?color=%231D4ED8" style={{ width: '16px', height: '16px' }} alt="DJ PDF" />
              <span>DESCARGAR DECLARACIÓN JURADA (PDF)</span>
            </button>
          </div>
        )}
        <div style={{ marginBottom: '10px' }}>
          <label style={{ fontSize: '10px', fontWeight: 800 }}>RETIRO SUGERIDO</label>
          <input type="datetime-local" value={retiro} onChange={e => setRetiro(e.target.value)} style={inputStyle} />
        </div>

        {/* BARRA DE RECOTIZACIÓN Y CONTROL DE ÍTEMS */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#998E55', letterSpacing: '0.03em' }}>
            ÍTEMS DEL PRESUPUESTO (PRECIO EDITABLE)
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {requoteSummary?.hasChanges && (
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#8E1F52' }}>
                Anterior: ${requoteSummary.oldSubtotal.toLocaleString('es-AR')} → Nuevo: ${requoteSummary.newSubtotal.toLocaleString('es-AR')} ({requoteSummary.deltaAmount >= 0 ? '+' : ''}{requoteSummary.deltaPct}%)
              </span>
            )}
            <button
              type="button"
              onClick={handleRequoteToCurrentCatalog}
              disabled={carrito.length === 0}
              style={{
                background: '#F4F1E1',
                color: '#495D56',
                border: 'none',
                borderRadius: '14px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 600,
                fontFamily: 'Inter',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: carrito.length === 0 ? 'default' : 'pointer',
                opacity: carrito.length === 0 ? 0.5 : 1,
              }}
            >
              <img
                src="https://api.iconify.design/lucide/refresh-cw.svg?color=%23495D56"
                style={{ width: '13px', height: '13px' }}
                alt=""
              />
              <span>Recotizar a Lista Actual</span>
            </button>
          </div>
        </div>

        {/* LISTADO CARRITO CON EDICIÓN MANUAL DE CANTIDAD Y PRECIO */}
        <div style={{ flex: 1, minHeight: '90px', overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: '12px', padding: '10px', marginBottom: '15px', background: '#f8fafc' }}>
          {carrito.map((c, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '12px', fontWeight: 700, gap: '8px', paddingBottom: '6px', borderBottom: '1px solid #eef2f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                <input
                  type="number"
                  min="1"
                  value={c.cantidad}
                  onChange={(e) => actualizarItemCarrito(i, 'cantidad', e.target.value)}
                  style={{
                    width: '44px',
                    padding: '4px 6px',
                    borderRadius: '8px',
                    border: '1px solid #DFDED9',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#495D56',
                    textAlign: 'center',
                    fontFamily: 'Inter',
                  }}
                />
                <span style={{ color: c.total < 0 ? '#dc2626' : '#495D56', wordBreak: 'break-word' }}>
                  {c.descripcion}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                <input
                  type="number"
                  step="50"
                  value={c.precio_unitario}
                  onChange={(e) => actualizarItemCarrito(i, 'precio_unitario', e.target.value)}
                  title="Editar precio unitario manualmente"
                  style={{
                    width: '86px',
                    padding: '4px 8px',
                    borderRadius: '8px',
                    border: '1px solid #DFDED9',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: c.total < 0 ? '#dc2626' : '#8E1F52',
                    textAlign: 'right',
                    fontFamily: 'Inter',
                  }}
                />
                <span style={{ minWidth: '68px', textAlign: 'right', color: c.total < 0 ? '#dc2626' : '#8E1F52' }}>
                  ${Number(c.total || 0).toLocaleString('es-AR')}
                </span>
                <button
                  type="button"
                  onClick={() => quitarDelCarrito(i)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                  title="Quitar ítem"
                >
                  <img src="https://api.iconify.design/lucide/x.svg?color=%23dc2626" style={{ width: '15px', height: '15px' }} alt="Quitar" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* DESCUENTOS */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '15px', background: '#F4F1E1', padding: '10px', borderRadius: '14px', flexWrap: 'wrap' }}>
          <input type="text" placeholder="MOTIVO DESC." value={descLabel} onChange={e => setDescLabel(e.target.value)} style={{ flex: 1, minWidth: '110px', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
          <input type="number" placeholder="VALOR" value={descValor} onChange={e => setDescValor(e.target.value)} style={{ width: '70px', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
          <select value={descTipo} onChange={e => setDescTipo(e.target.value)} style={{ padding: '8px', borderRadius: '8px' }}><option value="$">$</option><option value="%">%</option></select>
          <button onClick={aplicarDescuento} style={{ background: '#FF5E5E', color: 'white', border: 'none', borderRadius: '10px', padding: '8px 14px', fontWeight: 800, fontFamily: 'Inter', cursor: 'pointer' }}>OK</button>
        </div>

        {/* ESTADOS */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
          <select value={pagado ? "T" : "F"} onChange={e => setPagado(e.target.value === "T")} style={{ ...inputStyle, background: pagado ? '#dcfce7' : '#fee2e2', color: pagado ? '#166534' : '#991b1b', fontWeight: 800 }}>
            <option value="F">IMPAGO</option>
            <option value="T">PAGADO</option>
          </select>
          <select value={estado} onChange={e => setEstado(e.target.value)} style={{ ...inputStyle, color: '#495D56', fontWeight: 800 }}>
            <option value="PAUSADO">BORRADOR</option>
            <option value="PENDIENTE">PRE-PEDIDO</option>
            <option value="EN PROCESO">EN PROCESO</option>
            <option value="EN PUNTO DE ENTREGA">PUNTO ENTREGA</option>
            <option value="ENTREGADO">ENTREGADO</option>
          </select>
        </div>

        <div style={{ background: '#1E293B', padding: '15px', borderRadius: '18px', textAlign: 'center', color: 'white', marginBottom: '15px' }}>
          <div style={{ fontSize: '22px', fontWeight: 900, fontFamily: 'Inter', letterSpacing: '-0.02em' }}>TOTAL: $ {total.toLocaleString()}</div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '12px', borderRadius: '14px', border: 'none', fontWeight: 800, background: '#F4F1E1', color: '#495D56', fontFamily: 'Inter', cursor: 'pointer' }}>CANCELAR</button>
          <button onClick={handleGuardar} disabled={loading} style={{ flex: 2, padding: '12px', background: '#FF5E5E', color: 'white', borderRadius: '14px', border: 'none', fontWeight: 800, fontFamily: 'Inter', cursor: 'pointer' }}>
            {loading ? "..." : (editingOrder?.numero?.startsWith("W") ? "APROBAR WEB" : "GUARDAR")}
          </button>
        </div>
      </div>

      <style>{`
        .be-container {
          display: flex;
          gap: 20px;
          max-width: 1100px;
          margin: 0 auto;
          background: #F4F1E1;
          padding: 20px;
          border-radius: 30px;
          height: 90vh;
        }
        .be-col-catalogo {
          flex: 1;
          background: white;
          border-radius: 22px;
          padding: 18px;
          display: flex;
          flex-direction: column;
          border: 1px solid #F1F5F9;
        }
        .be-catalogo-scroll {
          flex: 1;
          overflow-y: auto;
          padding-right: 5px;
        }
        .be-col-pedido {
          flex: 1.2;
          background: white;
          border-radius: 22px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          border: 1px solid #F1F5F9;
        }
        @media (max-width: 768px) {
          .be-container {
            flex-direction: column-reverse;
            height: auto;
            padding: 12px;
            border-radius: 24px;
            gap: 16px;
          }
          .be-col-catalogo {
            max-height: 320px;
          }
          .be-catalogo-scroll {
            max-height: 220px;
          }
        }
      `}</style>
    </div>
  );
};

export default BudgetEditor;
