import React from 'react';
import Icon from './Icon';

export default function StampCategoryModal({ isOpen, onClose, onSelectCategory, currentCategory }) {
  if (!isOpen) return null;

  const options = [
    {
      id: 'profesional',
      icon: 'briefcase',
      title: 'Sello profesional',
      desc: 'Médicos, abogados, matrículas y comercios. De 1 a 4 líneas centradas.'
    },
    {
      id: 'escolar',
      icon: 'backpack',
      title: 'Sello escolar',
      desc: 'Para útiles y ropa. Ícono a la izquierda y tipografías infantiles.'
    }
  ];

  return (
    <div className="qc-backdrop" onClick={currentCategory ? onClose : undefined}>
      <div className="qc-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="qc-handle" />
        <div className="qc-sheet-head">
          <div>
            <h3 className="qc-sheet-title">¿Qué sello vas a crear?</h3>
            <p className="qc-sheet-sub">Elegí una categoría para cargar la plantilla adecuada.</p>
          </div>
          {currentCategory && (
            <button type="button" className="qc-close" onClick={onClose} aria-label="Cerrar">
              <Icon name="x" size={18} />
            </button>
          )}
        </div>

        <div className="qc-kinds">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`qc-kind-card ${currentCategory === o.id ? 'is-on' : ''}`}
              onClick={() => onSelectCategory(o.id)}
            >
              <span className="qc-kind-ico"><Icon name={o.icon} size={26} color="#FF5555" /></span>
              <span style={{ flex: 1 }}>
                <strong>{o.title}</strong>
                <span className="d">{o.desc}</span>
              </span>
              <Icon name="chevron-right" size={20} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
