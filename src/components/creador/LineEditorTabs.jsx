import React, { useRef, useEffect } from 'react';
import Icon from './Icon';

const GAP = 12;

/** Barra de tabs (se renderiza dentro del bloque fijo, siempre visible). */
export function LineTabs({ labels, active, onChange }) {
  return (
    <div className="qc-tabs" role="tablist" aria-label="Líneas del sello">
      {labels.map((label, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={i === active}
          className={`qc-tab ${i === active ? 'is-on' : ''}`}
          onClick={() => onChange(i)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * Carrusel deslizable (scroll-snap) con una card de edición por línea.
 * Controlado: `active` / `onActiveChange` lo sincronizan con las tabs.
 */
export default function LineEditorTabs({
  lines,
  fonts,
  labels,
  placeholders = [],
  sizeMin = 7,
  sizeMax = 26,
  active,
  onActiveChange,
  onUpdate,
  syncSizes = false,
  onToggleSyncSizes = null,
  showSyncOption = false,
  onRemoveThirdLine = null
}) {
  const trackRef = useRef(null);
  const safeActive = Math.min(active, Math.max(lines.length - 1, 0));

  const indexFromScroll = () => {
    const el = trackRef.current;
    return el ? Math.round(el.scrollLeft / (el.clientWidth + GAP)) : 0;
  };

  // Tab tocada → desplazar el carrusel
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    if (indexFromScroll() !== safeActive) {
      el.scrollTo({ left: safeActive * (el.clientWidth + GAP), behavior: 'smooth' });
    }
  }, [safeActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Si se quitan líneas, volver a una válida
  useEffect(() => {
    if (active > lines.length - 1) onActiveChange(Math.max(lines.length - 1, 0));
  }, [lines.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Deslizar → actualizar tab activa
  const handleScroll = () => {
    const idx = indexFromScroll();
    if (idx !== active && idx >= 0 && idx < lines.length) onActiveChange(idx);
  };

  const adjustOffset = (i, delta) => {
    const cur = Number(lines[i].offset_y) || 0;
    onUpdate(i, 'offset_y', Math.max(-10, Math.min(10, parseFloat((cur + delta).toFixed(1)))));
  };
  const adjustOffsetX = (i, delta) => {
    const cur = Number(lines[i].offset_x) || 0;
    onUpdate(i, 'offset_x', Math.max(-15, Math.min(15, parseFloat((cur + delta).toFixed(1)))));
  };
  const adjustSize = (i, delta) => {
    const cur = Number(lines[i].size) || 9;
    onUpdate(i, 'size', Math.max(sizeMin, Math.min(sizeMax, cur + delta)));
  };

  return (
    <div className="qc-stack" id="qc-line-editor">
      <div className="qc-track" ref={trackRef} onScroll={handleScroll}>
        {lines.map((line, i) => {
          const offsetX = Number(line.offset_x) || 0;
          const offsetY = Number(line.offset_y) || 0;
          const hasLineOffset = offsetX !== 0 || offsetY !== 0;
          return (
            <div className="qc-slide" key={i}>
              <div className="qc-card">
                <div className="qc-card-head" style={{ alignItems: 'center' }}>
                  <span className="qc-card-title">{labels[i] || `Línea ${i + 1}`}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {hasLineOffset && (
                      <span className="qc-label">
                        Ajuste {offsetX !== 0 ? `X:${offsetX > 0 ? `+${offsetX.toFixed(1)}` : offsetX.toFixed(1)} ` : ''}
                        {offsetY !== 0 ? `Y:${offsetY > 0 ? `+${offsetY.toFixed(1)}` : offsetY.toFixed(1)}` : ''} mm
                      </span>
                    )}
                    {i === 2 && onRemoveThirdLine && (
                      <button
                        type="button"
                        className="qc-card-remove"
                        onClick={onRemoveThirdLine}
                        title="Quitar línea adicional"
                      >
                        QUITAR
                      </button>
                    )}
                  </div>
                </div>

                <div className="qc-field">
                  <label className="qc-label" htmlFor={`qc-text-${i}`}>Texto</label>
                  <input
                    id={`qc-text-${i}`}
                    className="qc-input"
                    type="text"
                    value={line.texto}
                    placeholder={placeholders[i] || `Texto de la línea ${i + 1}`}
                    onChange={(e) => onUpdate(i, 'texto', e.target.value)}
                  />
                </div>

                <div className="qc-field">
                  <label className="qc-label" htmlFor={`qc-font-${i}`}>Tipografía</label>
                  <select
                    id={`qc-font-${i}`}
                    className="qc-select"
                    value={line.fuente}
                    onChange={(e) => onUpdate(i, 'fuente', e.target.value)}
                  >
                    {fonts.map((f) => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                  </select>
                </div>

                <div className="qc-pair">
                  <div className="qc-field">
                    <div className="qc-card-head" style={{ marginBottom: 4 }}>
                      <span className="qc-label">Tamaño (pt)</span>
                      {showSyncOption && (i === 0 || i === 1) && onToggleSyncSizes && (
                        <label className="qc-check-row" title="Mantiene nombre y apellido escalados de manera igual">
                          <input
                            type="checkbox"
                            className="qc-check-input"
                            checked={syncSizes}
                            onChange={(e) => onToggleSyncSizes(e.target.checked)}
                          />
                          <span className="qc-check-text">Escalar igual</span>
                        </label>
                      )}
                    </div>
                    <div className="qc-stepper">
                      <button type="button" aria-label="Reducir tamaño" disabled={line.size <= sizeMin} onClick={() => adjustSize(i, -1)}>
                        <Icon name="minus" size={18} />
                      </button>
                      <span className="qc-stepper-value">{line.size}</span>
                      <button type="button" aria-label="Aumentar tamaño" disabled={line.size >= sizeMax} onClick={() => adjustSize(i, 1)}>
                        <Icon name="plus" size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="qc-field">
                    <div className="qc-card-head" style={{ marginBottom: 4 }}>
                      <span className="qc-label">Ajuste vertical</span>
                      {offsetY !== 0 && (
                        <span className="qc-label">{offsetY > 0 ? `+${offsetY.toFixed(1)}` : offsetY.toFixed(1)} mm</span>
                      )}
                    </div>
                    <div className="qc-nudge">
                      <button type="button" aria-label="Subir línea" onClick={() => adjustOffset(i, -0.5)}>
                        <Icon name="arrow-up" size={18} />
                      </button>
                      <button type="button" aria-label="Bajar línea" onClick={() => adjustOffset(i, 0.5)}>
                        <Icon name="arrow-down" size={18} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="qc-pair">
                  <div className="qc-field">
                    <div className="qc-card-head" style={{ marginBottom: 4 }}>
                      <span className="qc-label">Ajuste horizontal</span>
                      {offsetX !== 0 && (
                        <span className="qc-label">{offsetX > 0 ? `+${offsetX.toFixed(1)}` : offsetX.toFixed(1)} mm</span>
                      )}
                    </div>
                    <div className="qc-nudge">
                      <button type="button" aria-label="Mover texto a la izquierda" onClick={() => adjustOffsetX(i, -0.5)}>
                        <Icon name="arrow-left" size={18} />
                      </button>
                      <button type="button" aria-label="Mover texto a la derecha" onClick={() => adjustOffsetX(i, 0.5)}>
                        <Icon name="arrow-right" size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="qc-field" style={{ justifyContent: 'flex-end' }}>
                    {hasLineOffset && (
                      <button
                        type="button"
                        className="qc-reset-btn"
                        onClick={() => {
                          onUpdate(i, 'offset_y', 0);
                          onUpdate(i, 'offset_x', 0);
                        }}
                        title="Restablecer posición de esta línea"
                      >
                        <Icon name="rotate-ccw" size={15} />
                        Centrar línea
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {lines.length > 1 && (
        <div className="qc-dots" aria-hidden="true">
          {lines.map((_, i) => (
            <span key={i} className={`qc-dot ${i === safeActive ? 'is-on' : ''}`} />
          ))}
        </div>
      )}
    </div>
  );
}
