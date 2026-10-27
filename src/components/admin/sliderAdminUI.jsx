import React, { useRef } from 'react';

/**
 * Piezas de UI compartidas por los módulos de Sliders del admin
 * (Carruseles de catálogo y Slides de portada). Cualquier ajuste visual
 * se hace acá y se refleja en ambos.
 */

export const iconEdit = <img src="https://api.iconify.design/lucide/edit-3.svg?color=%231a202c" style={{ width: '22px' }} alt="Editar" />;
export const iconDelete = <img src="https://api.iconify.design/lucide/trash-2.svg?color=%231a202c" style={{ width: '22px' }} alt="Eliminar" />;
export const iconDrag = <img src="https://api.iconify.design/lucide/grip-vertical.svg?color=%23CBD5E1" style={{ width: '20px' }} alt="" />;

export const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 700, color: '#998E55', marginBottom: '8px' };
export const inputStyle = { width: '100%', padding: '16px', borderRadius: '14px', border: '2px solid #F1F5F9', outline: 'none', background: 'white', fontSize: '14px' };

/** Reordenamiento por drag & drop de una lista. Devuelve props para cada fila. */
export function useDragReorder(items, onReorder) {
  const from = useRef(null);
  const over = useRef(null);
  const reset = () => { from.current = null; over.current = null; };
  return (idx) => ({
    draggable: true,
    onDragStart: () => { from.current = idx; },
    onDragEnter: () => { over.current = idx; },
    onDragOver: (e) => e.preventDefault(),
    onDragEnd: () => {
      const a = from.current;
      const b = over.current;
      reset();
      if (a === null || b === null || a === b) return;
      const next = [...items];
      const [dragged] = next.splice(a, 1);
      next.splice(b, 0, dragged);
      onReorder(next);
    }
  });
}

export function AddButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ background: '#111', color: 'white', border: 'none', padding: '14px 28px', borderRadius: '18px', fontWeight: 700, cursor: 'pointer' }}
    >
      {children}
    </button>
  );
}

export function FormCard({ children, onSubmit }) {
  return (
    <div style={{ background: 'white', padding: '35px', borderRadius: '35px', marginBottom: '40px', boxShadow: '0 20px 50px rgba(0,0,0,0.08)', border: '1px solid #f0f0f0' }}>
      <form onSubmit={onSubmit}>{children}</form>
    </div>
  );
}

export function FormField({ label, hint, children, marginBottom = '20px' }) {
  return (
    <div style={{ marginBottom }}>
      <label style={labelStyle}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '6px' }}>{hint}</div>}
    </div>
  );
}

export function FormActions({ onCancel, saving, saveLabel }) {
  return (
    <div style={{ display: 'flex', gap: '15px' }}>
      <button type="button" onClick={onCancel} style={{ flex: 1, padding: '18px', borderRadius: '18px', border: 'none', background: '#F1F5F9', color: '#64748B', fontWeight: 700, cursor: 'pointer' }}>DESCARTAR</button>
      <button type="submit" disabled={saving} style={{ flex: 2, padding: '18px', borderRadius: '18px', border: 'none', background: '#FF5E5E', color: 'white', fontWeight: 800, cursor: 'pointer' }}>{saving ? 'PROCESANDO...' : saveLabel}</button>
    </div>
  );
}

/** Caja "COMPORTAMIENTO SWIPER": autoplay, pausar al tocar, delay y (opcional) efecto. */
export function SwiperBehaviorPanel({ config, onChange, showEffect = false }) {
  const set = (patch) => onChange({ ...config, ...patch });
  const checkLabel = { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' };
  return (
    <div style={{ background: '#F8FAFC', padding: '20px', borderRadius: '24px', border: '1px solid #E2E8F0', marginBottom: '25px' }}>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 900, color: '#64748B', marginBottom: '15px' }}>COMPORTAMIENTO SWIPER</label>
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={checkLabel}>
          <input type="checkbox" checked={!!config?.autoplay} onChange={(e) => set({ autoplay: e.target.checked })} />
          Autoplay
        </label>
        <label style={checkLabel}>
          <input type="checkbox" checked={!!config?.disableOnInteraction} onChange={(e) => set({ disableOnInteraction: e.target.checked })} />
          Pausar al Tocar
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#64748B' }}>Delay:</span>
          <input
            type="number"
            step="100"
            style={{ width: '80px', padding: '8px', borderRadius: '8px', border: '1px solid #E2E8F0' }}
            value={config?.delay ?? ''}
            onChange={(e) => set({ delay: parseInt(e.target.value, 10) || 0 })}
          />
        </div>
        {showEffect && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#64748B' }}>Efecto:</span>
            <select
              value={config?.effect || 'slide'}
              onChange={(e) => set({ effect: e.target.value })}
              style={{ padding: '8px', borderRadius: '8px', border: '1px solid #E2E8F0', background: 'white', fontSize: '13px' }}
            >
              <option value="slide">Slide (Deslizamiento)</option>
              <option value="fade">Fade (Desvanecimiento)</option>
              <option value="coverflow">Coverflow (3D)</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

export const badgeStyle = { fontSize: '10px', background: '#F1F5F9', padding: '3px 8px', borderRadius: '5px' };
export const badgeOnStyle = { fontSize: '10px', background: '#ECFDF5', color: '#059669', padding: '3px 8px', borderRadius: '5px' };

/** Fila de listado con drag handle, texto, badges y acciones editar/eliminar. */
export function SliderListRow({ dragProps, thumb, title, subtitle, badges, onEdit, onDelete }) {
  return (
    <div
      {...dragProps}
      style={{ display: 'flex', alignItems: 'center', background: 'white', padding: '22px 30px', borderRadius: '28px', border: '1px solid #f8f8f8', cursor: 'move' }}
    >
      <div style={{ marginRight: '20px', color: '#E2E8F0' }}>{iconDrag}</div>
      {thumb && (
        <div style={{ width: '60px', height: '60px', borderRadius: '14px', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: '20px', flexShrink: 0 }}>
          <img src={thumb} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </div>
      )}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '18px', fontWeight: 800, color: '#1E293B' }}>{title}</div>
        {subtitle && <div style={{ fontSize: '13px', color: '#94A3B8' }}>{subtitle}</div>}
        {badges && <div style={{ marginTop: '5px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>{badges}</div>}
      </div>
      <div style={{ display: 'flex', gap: '4px' }}>
        <button type="button" onClick={onEdit} title="Editar" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '5px' }}>{iconEdit}</button>
        <button type="button" onClick={onDelete} title="Eliminar" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '5px' }}>{iconDelete}</button>
      </div>
    </div>
  );
}
