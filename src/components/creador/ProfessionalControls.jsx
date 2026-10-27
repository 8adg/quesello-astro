import React from 'react';
import { PROFESSIONAL_FONTS } from './constants';
import LineEditorTabs from './LineEditorTabs';

export default function ProfessionalControls({ lines, onChangeLines, activeLine, onActiveLineChange }) {
  const lineCount = lines.length;

  const handleLineCountChange = (count) => {
    if (count > lines.length) {
      const added = Array.from({ length: count - lines.length }, (_, idx) => ({
        texto: `Línea ${lines.length + idx + 1}`,
        fuente: 'Roboto Medium',
        size: 9,
        offset_y: 0.0
      }));
      onChangeLines([...lines, ...added]);
    } else {
      onChangeLines(lines.slice(0, count));
    }
  };

  const updateLine = (index, field, value) =>
    onChangeLines(lines.map((l, i) => (i === index ? { ...l, [field]: value } : l)));

  return (
    <div className="qc-stack">
      <div className="qc-card">
        <div className="qc-count-head">
          <span className="qc-card-title">Cantidad de líneas</span>
          <span className="qc-count-note">Hasta 4 líneas</span>
        </div>
        <div className="qc-segment" role="group" aria-label="Cantidad de líneas">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              className={lineCount === n ? 'is-on' : ''}
              aria-pressed={lineCount === n}
              onClick={() => handleLineCountChange(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <LineEditorTabs
        lines={lines}
        fonts={PROFESSIONAL_FONTS}
        labels={lines.map((_, i) => `Línea ${i + 1}`)}
        sizeMin={7}
        sizeMax={26}
        active={activeLine}
        onActiveChange={onActiveLineChange}
        onUpdate={updateLine}
      />
    </div>
  );
}
