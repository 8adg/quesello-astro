import React, { useState } from 'react';
import { SCHOOL_ICONS } from './constants';
import Icon from './Icon';

export default function SchoolIconPickerModal({ isOpen, onClose, selectedId, onSelectIcon }) {
  const [searchTerm, setSearchTerm] = useState('');
  if (!isOpen) return null;

  const filtered = SCHOOL_ICONS.filter(
    (icon) =>
      icon.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(icon.id).includes(searchTerm)
  );

  return (
    <div className="qc-backdrop" onClick={onClose}>
      <div className="qc-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="qc-handle" />
        <div className="qc-sheet-head">
          <div>
            <h3 className="qc-sheet-title">Elegí un ícono</h3>
            <p className="qc-sheet-sub">{SCHOOL_ICONS.length} diseños para útiles y ropa</p>
          </div>
          <button type="button" className="qc-close" onClick={onClose} aria-label="Cerrar">
            <Icon name="x" size={18} />
          </button>
        </div>

        <input
          className="qc-input"
          type="text"
          placeholder="Buscar: Messi, AFA, Estrella…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <div className="qc-icons-grid">
          {filtered.map((icon) => (
            <button
              key={icon.id}
              type="button"
              className={`qc-icon-cell ${icon.id === selectedId ? 'is-on' : ''}`}
              onClick={() => { onSelectIcon(icon.id); onClose(); }}
            >
              <img src={icon.file} alt={icon.name} loading="lazy" />
              <span>{icon.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
