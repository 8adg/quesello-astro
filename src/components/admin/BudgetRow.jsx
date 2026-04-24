import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function BudgetRow({ id_db, numero, cliente, retiro, total, pagado, estado, onEdit, onRefresh, onPrint, onDelete }) {
  const [updating, setUpdating] = useState(false);

  const togglePago = async () => {
    setUpdating(true);
    await supabase.from('presupuestos').update({ pagado: !pagado }).eq('id', id_db);
    onRefresh();
    setUpdating(false);
  };

  const updateEstado = async (nuevoEstado) => {
    setUpdating(true);
    await supabase.from('presupuestos').update({ estado: nuevoEstado }).eq('id', id_db);
    onRefresh();
    setUpdating(false);
  };

  const getStatusStyle = (est) => {
    if (est === 'ENTREGADO') return { bg: '#D1FAE5', color: '#065F46' };
    if (est === 'EN PROCESO') return { bg: '#F4F1E1', color: '#8B1E1E' };
    if (est === 'PAUSADO') return { bg: '#f1f5f9', color: '#475569' };
    if (est === 'PENDIENTE') return { bg: '#FEF3C7', color: '#92400E' }; // Warm amber for pre-pedidos
    return { bg: '#F4F1E1', color: '#8B1E1E' };
  };

  const currentStatus = getStatusStyle(estado);

  return (
    <div style={{
      background: 'white', borderRadius: '24px', padding: '20px 30px', display: 'flex', alignItems: 'center', gap: '20px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.01)', opacity: updating ? 0.6 : 1, pointerEvents: updating ? 'none' : 'auto', fontFamily: 'Inter'
    }}>
      {/* Folio */}
      <div style={{ width: '110px', fontSize: '18px', fontWeight: 700, color: '#4b3b28' }}>{numero}</div>

      {/* Info Cliente */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '17px', fontWeight: 500, color: '#5E7358' }}>{cliente?.toUpperCase() || "SIN NOMBRE"}</div>
        <div style={{ fontSize: '11px', color: 'rgb(100, 116, 139)', fontWeight: 400, marginTop: '4px' }}>
          Retiro: {(() => {
            if (!retiro) return 'Sin fecha';
            const d = new Date(retiro);
            if (isNaN(d.getTime())) return retiro;
            return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');
          })()}
        </div>
      </div>

      {/* Monto Total */}
      <div style={{ width: '120px', fontSize: '20px', fontWeight: 500, color: '#8E1F52', textAlign: 'center' }}>
        ${total?.toLocaleString('es-AR')}
      </div>

      {/* Estado Pago */}
      <div style={{ width: '110px', display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={togglePago}
          style={{
            width: '95px', height: '36px', borderRadius: '15px', border: 'none', cursor: 'pointer',
            background: pagado ? '#D1FAE5' : '#FEE2E2', color: pagado ? '#065F46' : '#8B1E1E',
            fontSize: '11px', fontWeight: 900, textTransform: 'uppercase'
          }}
        >
          {pagado ? 'PAGADO' : 'IMPAGO'}
        </button>
      </div>

      {/* Dropdown Estado */}
      <div className="select-wrapper" style={{ width: '155px' }}>
        <select
          value={estado}
          onChange={(e) => updateEstado(e.target.value)}
          style={{
            width: '100%', height: '38px', borderRadius: '15px', border: 'none', fontWeight: 900, fontSize: '11px',
            background: currentStatus.bg, color: currentStatus.color, cursor: 'pointer', outline: 'none',
            textAlign: 'center', textTransform: 'uppercase'
          }}
        >
          <option value="PAUSADO">BORRADOR</option>
          <option value="PENDIENTE">PRE-PEDIDO</option>
          <option value="EN PROCESO">EN PROCESO</option>
          <option value="EN PUNTO DE ENTREGA">PUNTO ENTREGA</option>
          <option value="ENTREGADO">ENTREGADO</option>
        </select>
      </div>

      {/* Acciones */}
      <div style={{ display: 'flex', gap: '8px', width: '130px', justifyContent: 'center' }}>
        <button onClick={onEdit} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '5px' }}>
          <img src="https://api.iconify.design/lucide:edit-3.svg?color=%231a202c" style={{ width: '22px' }} alt="Edit" />
        </button>
        <button onClick={() => onPrint()} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '5px' }}>
          <img src="https://api.iconify.design/lucide:printer.svg?color=%234b3b28" style={{ width: '22px' }} alt="Print" />
        </button>
        <button onClick={onDelete} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '5px' }}>
          <img src="https://api.iconify.design/lucide:trash-2.svg?color=%231a202c" style={{ width: '22px' }} alt="Delete" />
        </button>
      </div>
    </div>
  );
}
