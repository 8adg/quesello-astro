import React, { useState, useEffect } from 'react';
import BudgetRow from './BudgetRow';
import BudgetEditor from './BudgetEditor';
import { supabase } from '../../lib/supabase';
import PrintModal from './PrintModal';

export default function BudgetManager() {
  const [view, setView] = useState('list'); // 'list' | 'editor'
  const [orders, setOrders] = useState([]);
  const [editingOrder, setEditingOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [printingOrder, setPrintingOrder] = useState(null);
  
  // Estados para Modal de Borrado y Avisos
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState(null);

  const FRANQUICIA_ID = 1;

  useEffect(() => {
    loadOrders();
    const channel = supabase
      .channel('realtime_budgets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'presupuestos' }, () => loadOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    const { data } = await supabase.from('presupuestos').select('*').eq('franquicia_id', FRANQUICIA_ID).order('id', { ascending: false });
    if (data) setOrders(data);
    setLoading(false);
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setLoading(true);
    try {
        await supabase.from('presupuesto_items').delete().eq('presupuesto_id', deletingId);
        await supabase.from('presupuestos').delete().eq('id', deletingId);
        showToast("Pedido eliminado correctamente");
        loadOrders();
    } catch (e) {
        showToast("Error al eliminar pedido");
    } finally {
        setDeletingId(null);
        setLoading(false);
    }
  };

  const handleSave = () => {
    setView('list');
    showToast("Pedido guardado con éxito");
    loadOrders();
  };

  const filteredOrders = orders.filter(o => {
    const term = searchTerm.toLowerCase();
    return o.cliente?.toLowerCase().includes(term) || o.numero?.toString().includes(term);
  });

  if (view === 'editor') {
    return (
      <div style={{ height: '100%', overflow: 'hidden' }}>
        <BudgetEditor 
          editingOrder={editingOrder} 
          onSave={handleSave} 
          onCancel={() => setView('list')} 
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'Inter', position: 'relative' }}>
      
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h1 style={{ fontSize: '28px', color: '#FF5E5E', fontWeight: 800, margin: 0 }}>Presupuestos</h1>
        <button onClick={() => { setEditingOrder(null); setView('editor'); }} style={{ background: '#FF5E5E', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '18px', fontWeight: 500, cursor: 'pointer' }}>+ Nuevo pedido</button>
      </header>

      <hr style={{ border: 'none', height: '2px', background: '#aba9a4', opacity: 0.2, margin: '24px 0' }} />

      <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
        <input type="text" placeholder="Buscar presupuesto..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ flex: 1, padding: '14px 20px', borderRadius: '18px', border: '2px solid #EDF2F7', background: 'white', fontSize: '15px', outline: 'none' }} />
        <div style={{ background: '#F4F1E1', padding: '14px 25px', borderRadius: '18px', color: '#4b3b28', fontWeight: 800, fontSize: '16px', display: 'flex', alignItems: 'center' }}>
          TOTAL VENTAS: $ {filteredOrders.reduce((acc, o) => acc + (o.total || 0), 0).toLocaleString('es-AR')}
        </div>
      </div>

      {/* Lista de Pedidos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '30px' }}>
        {filteredOrders.map(order => (
          <BudgetRow 
            key={order.id}
            id_db={order.id}
            numero={order.numero}
            cliente={order.cliente}
            retiro={order.retiro_sugerido}
            total={order.total}
            pagado={order.pagado}
            estado={order.estado}
            onEdit={() => { setEditingOrder(order); setView('editor'); }}
            onRefresh={loadOrders}
            onPrint={() => setPrintingOrder(order)}
            onDelete={() => setDeletingId(order.id)}
          />
        ))}
      </div>

      {/* MODAL DE CONFIRMACIÓN DE BORRADO */}
      {deletingId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '35px', borderRadius: '30px', width: '320px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
            <div style={{ background: '#FEE2E2', color: '#DC2626', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', fontSize: '24px' }}>🗑️</div>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '20px', fontWeight: 800 }}>¿Borrar pedido?</h3>
            <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '25px', lineHeight: '1.5' }}>Esta acción no se puede deshacer y el pedido desaparecerá.</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setDeletingId(null)} style={{ flex: 1, padding: '12px', borderRadius: '15px', border: '1px solid #E2E8F0', background: 'white', fontWeight: 700, cursor: 'pointer' }}>NO</button>
              <button onClick={handleDelete} style={{ flex: 1, padding: '12px', borderRadius: '15px', border: 'none', background: '#DC2626', color: 'white', fontWeight: 700, cursor: 'pointer' }}>SÍ, BORRAR</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST DE FEEDBACK */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', background: '#111', color: 'white', padding: '12px 30px', borderRadius: '50px', fontSize: '14px', fontWeight: 600, boxShadow: '0 10px 30px rgba(0,0,0,0.2)', zIndex: 1100, animation: 'slideUp 0.3s ease' }}>
          {toast}
        </div>
      )}

      {printingOrder && <PrintModal order={printingOrder} onClose={() => setPrintingOrder(null)} />}

      <style>{`
        @keyframes slideUp { from { transform: translate(-50%, 20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
      `}</style>
    </div>
  );
}
