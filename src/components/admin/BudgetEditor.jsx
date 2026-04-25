import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const BudgetEditor = ({ editingOrder, onSave, onCancel }) => {
  const [catalogo, setCatalogo] = useState([]);
  const [busquedaProd, setBusquedaProd] = useState("");
  const [carrito, setCarrito] = useState([]);
  
  const [cliente, setCliente] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [fecha, setFecha] = useState("");
  const [retiro, setRetiro] = useState("");
  const [estado, setEstado] = useState("PENDIENTE");
  const [pagado, setPagado] = useState(false);

  const [descLabel, setDescLabel] = useState("");
  const [descValor, setDescValor] = useState("");
  const [descTipo, setDescTipo] = useState("$");
  
  const [loading, setLoading] = useState(false);
  const FRANQUICIA_ID = 1;

  useEffect(() => {
    loadCatalogo();
    if (editingOrder) {
      setCliente(editingOrder.cliente || "");
      setObservaciones(editingOrder.observaciones || "");
      setFecha(editingOrder.fecha || "");
      setRetiro(editingOrder.retiro_sugerido || "");
      setEstado(editingOrder.estado || "PENDIENTE");
      setPagado(!!editingOrder.pagado);
      loadItems(editingOrder.id);
    } else {
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
        observaciones: observaciones.toUpperCase(),
        fecha,
        retiro_sugerido: retiro,
        pagado,
        estado,
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
    <div style={{ display: 'flex', gap: '20px', maxWidth: '1100px', margin: '0 auto', background: '#F4F1E1', padding: '20px', borderRadius: '30px', height: '90vh' }}>
      
      {/* COLUMNA IZQUIERDA: CATÁLOGO */}
      <div style={{ flex: 1, background: 'white', borderRadius: '22px', padding: '18px', display: 'flex', flexDirection: 'column', border: '1px solid #F1F5F9' }}>
        <h3 style={{ marginBottom: '10px', fontSize: '13px', fontWeight: 900, color: '#998E55', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Inter' }}>Catálogo</h3>
        <input type="text" placeholder="BUSCAR PRODUCTO..." value={busquedaProd} onChange={e => setBusquedaProd(e.target.value)} style={inputStyle} />
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
          {catalogo.filter(p => p.descripcion.toLowerCase().includes(busquedaProd.toLowerCase())).map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '12px', fontWeight: 700 }}>{p.descripcion.toUpperCase()}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontWeight: 800 }}>${p.precio}</span>
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
      <div style={{ flex: 1.2, background: 'white', borderRadius: '22px', padding: '20px', display: 'flex', flexDirection: 'column', border: '1px solid #F1F5F9' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <input type="text" placeholder="CLIENTE" value={cliente} onChange={e => setCliente(e.target.value)} style={{ ...inputStyle, fontWeight: 'bold' }} />
          <input type="text" placeholder="FECHA" value={fecha} onChange={e => setFecha(e.target.value)} style={inputStyle} />
        </div>
        <textarea placeholder="OBSERVACIONES" value={observaciones} onChange={e => setObservaciones(e.target.value)} style={{ ...inputStyle, height: '50px' }} />
        <div style={{ marginBottom: '10px' }}>
          <label style={{ fontSize: '10px', fontWeight: 800 }}>RETIRO SUGERIDO</label>
          <input type="datetime-local" value={retiro} onChange={e => setRetiro(e.target.value)} style={inputStyle} />
        </div>

        {/* LISTADO CARRITO */}
        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: '12px', padding: '10px', marginBottom: '15px', background: '#f8fafc' }}>
          {carrito.map((c, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', fontWeight: 700 }}>
              <span style={{ color: c.total < 0 ? '#dc2626' : '#1e293b' }}>{c.cantidad}x {c.descripcion}</span>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ color: c.total < 0 ? '#dc2626' : '#0f172a' }}>${c.total.toLocaleString()}</span>
                <button onClick={() => quitarDelCarrito(i)} style={{ border: 'none', background: 'none', color: '#dc2626', fontWeight: 900, cursor: 'pointer' }}>×</button>
              </div>
            </div>
          ))}
        </div>

        {/* DESCUENTOS */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '15px', background: '#F4F1E1', padding: '10px', borderRadius: '14px' }}>
          <input type="text" placeholder="MOTIVO DESC." value={descLabel} onChange={e => setDescLabel(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
          <input type="number" placeholder="VALOR" value={descValor} onChange={e => setDescValor(e.target.value)} style={{ width: '70px', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
          <select value={descTipo} onChange={e => setDescTipo(e.target.value)} style={{ padding: '8px', borderRadius: '8px' }}><option value="$">$</option><option value="%">%</option></select>
          <button onClick={aplicarDescuento} style={{ background: '#FF5E5E', color: 'white', border: 'none', borderRadius: '10px', padding: '0 14px', fontWeight: 800, fontFamily: 'Inter', cursor: 'pointer' }}>OK</button>
        </div>

        {/* ESTADOS */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
          <select value={pagado ? "T" : "F"} onChange={e => setPagado(e.target.value === "T")} style={{ ...inputStyle, background: pagado ? '#dcfce7' : '#fee2e2', fontWeight: 800 }}>
            <option value="F">❌ IMPAGO</option>
            <option value="T">✅ PAGADO</option>
          </select>
          <select value={estado} onChange={e => setEstado(e.target.value)} style={{ ...inputStyle, fontWeight: 800 }}>
            <option value="PAUSADO">⏳ PAUSADO</option>
            <option value="PENDIENTE">📦 PRE-PEDIDO</option>
            <option value="EN PROCESO">🏗️ EN PROCESO</option>
            <option value="EN PUNTO DE ENTREGA">📍 ENTREGA</option>
            <option value="ENTREGADO">✅ ENTREGADO</option>
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
    </div>
  );
};

export default BudgetEditor;
