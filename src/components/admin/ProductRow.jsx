import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function ProductRow({ product, onEdit, onRefresh, onDelete, onDragStart, onDragOver, onDrop }) {
  const [updating, setUpdating] = useState(false);
  const [imgError, setImgError] = useState(false);

  const hasImage = product.img && product.img.trim() !== '' && product.img !== 'null' && !imgError;

  const toggleStatus = async () => {
    setUpdating(true);
    const newStatus = product.activo === 1 ? 0 : 1;
    const { error } = await supabase
      .from('productos')
      .update({ activo: newStatus })
      .eq('id', product.id);

    if (error) {
      alert("Error al actualizar: " + error.message);
    } else {
      onRefresh(); // Recarga silenciosa desde el parent
    }
    setUpdating(false);
  };

  return (
    <div 
      draggable="true"
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        background: 'white',
        borderRadius: '30px',
        padding: '15px 30px',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.01)',
        border: '1px solid #f0f0f0',
        fontFamily: 'Inter',
        marginBottom: '12px',
        opacity: updating ? 0.6 : 1, 
        pointerEvents: updating ? 'none' : 'auto',
        transition: 'all 0.2s',
        cursor: 'move'
    }}>
      {/* 0. DRAG HANDLE */}
      <div style={{ color: '#aba9a4', cursor: 'move', userSelect: 'none' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
      </div>

      {/* 1. IMG */}
      <div style={{
        width: '56px', height: '56px', borderRadius: '16px', background: '#F8F7F3',
        overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid #f0eee4', flexShrink: 0
      }}>
        {hasImage ? (
          <img 
            src={product.img} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            alt="" 
            onError={() => setImgError(true)} 
            loading="lazy"
          />
        ) : (
          <img src="https://api.iconify.design/lucide:package.svg?color=%23aba9a4" style={{ width: '24px' }} alt="" />
        )}
      </div>

      {/* 2. CÓDIGO */}
      <div style={{ width: '100px', fontSize: '15px', fontWeight: 700, color: '#5E7358' }}>
        {product.codigo}
      </div>

      {/* 3. DESCRIPCIÓN */}
      <div style={{ flex: 1, fontSize: '15px', fontWeight: 500, color: '#5E7358', letterSpacing: '-0.01em' }}>
        {product.descripcion.toUpperCase()}
      </div>

      {/* 4. CATEGORÍA (Badge) */}
      <div style={{ width: '140px', textAlign: 'center' }}>
        <span style={{
          display: 'inline-block',
          background: '#F4F1E1',
          color: '#998E55',
          padding: '6px 14px',
          borderRadius: '20px',
          fontSize: '11px',
          fontWeight: 700,
          textTransform: 'uppercase'
        }}>
          {product.categoria || 'GENERAL'}
        </span>
      </div>

      {/* 5. PRECIO */}
      <div style={{ width: '120px', textAlign: 'right' }}>
        <div style={{ fontSize: '20px', fontWeight: 500, color: '#8E1F52' }}>
          <span style={{ fontSize: '14px', marginRight: '4px' }}>$</span>
          {product.precio?.toLocaleString('es-AR')}
        </div>
      </div>

      {/* 6. STATUS - Clonado de BudgetRow */}
      <div style={{ width: '100px', textAlign: 'center' }}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            toggleStatus();
          }}
          disabled={updating}
          style={{
            padding: '8px 16px',
            borderRadius: '20px',
            background: product.activo === 1 ? '#dcfce7' : '#fee2e2',
            color: product.activo === 1 ? '#166534' : '#991b1b',
            border: 'none',
            fontSize: '10px',
            fontWeight: 800,
            cursor: 'pointer',
            minWidth: '85px'
          }}
        >
          {product.activo === 1 ? 'ACTIVO' : 'OCULTO'}
        </button>
      </div>

      {/* 7. ACCIONES */}
      <div style={{ display: 'flex', gap: '20px', width: '90px', justifyContent: 'flex-end' }}>
        <button type="button" onClick={onEdit} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
          <img src="https://api.iconify.design/lucide:edit-3.svg?color=%231a202c" style={{ width: '22px' }} alt="Edit" />
        </button>
        <button type="button" onClick={onDelete} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
          <img src="https://api.iconify.design/lucide:trash-2.svg?color=%231a202c" style={{ width: '22px' }} alt="Delete" />
        </button>
      </div>

    </div>
  );
}
