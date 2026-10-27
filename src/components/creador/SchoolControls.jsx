import React, { useState } from 'react';
import { SCHOOL_FONTS, SCHOOL_ICONS } from './constants';
import SchoolIconPickerModal from './SchoolIconPickerModal';
import LineEditorTabs from './LineEditorTabs';
import Icon from './Icon';

export const SCHOOL_LINE_LABELS = ['Nombre', 'Apellido / Grado', 'Línea adicional'];
const LABELS = SCHOOL_LINE_LABELS;
const PLACEHOLDERS = ['Ej: SANTINO', 'Ej: PEREZ BAEZ', 'Ej: HOJA: ____'];

export default function SchoolControls({ schoolData, onChangeSchoolData, activeLine, onActiveLineChange }) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const selectedIcon = SCHOOL_ICONS.find((i) => i.id === schoolData.iconId) || SCHOOL_ICONS[0];

  const iconSize = Number(schoolData.iconSize) || 11.5;
  const iconOffsetX = Number(schoolData.iconOffsetX) || 0.0;
  const iconOffsetY = Number(schoolData.iconOffsetY) || 0.0;
  const isCustomized = iconSize !== 11.5 || iconOffsetX !== 0 || iconOffsetY !== 0;

  const updateIconSize = (delta) => {
    const cur = Number(schoolData.iconSize) || 11.5;
    const next = Math.max(6.0, Math.min(14.5, parseFloat((cur + delta).toFixed(1))));
    onChangeSchoolData({ ...schoolData, iconSize: next });
  };

  const updateIconOffsetY = (delta) => {
    const cur = Number(schoolData.iconOffsetY) || 0.0;
    const next = Math.max(-6.0, Math.min(6.0, parseFloat((cur + delta).toFixed(1))));
    onChangeSchoolData({ ...schoolData, iconOffsetY: next });
  };

  const updateIconOffsetX = (delta) => {
    const cur = Number(schoolData.iconOffsetX) || 0.0;
    const next = Math.max(-4.0, Math.min(10.0, parseFloat((cur + delta).toFixed(1))));
    onChangeSchoolData({ ...schoolData, iconOffsetX: next });
  };

  const resetIconAdjustments = () => {
    onChangeSchoolData({
      ...schoolData,
      iconSize: 11.5,
      iconOffsetX: 0.0,
      iconOffsetY: 0.0
    });
  };

  const isSync = schoolData.escalarIgual !== false;

  const updateLine = (index, field, value) => {
    if (isSync && (index === 0 || index === 1) && schoolData.lineas.length >= 2) {
      if (field === 'size' || field === 'fuente') {
        onChangeSchoolData({
          ...schoolData,
          lineas: schoolData.lineas.map((l, i) => (i === 0 || i === 1 ? { ...l, [field]: value } : l))
        });
        return;
      }
    }
    onChangeSchoolData({
      ...schoolData,
      lineas: schoolData.lineas.map((l, i) => (i === index ? { ...l, [field]: value } : l))
    });
  };

  const toggleSyncSizes = (checked) => {
    const nextLineas = [...schoolData.lineas];
    if (checked && nextLineas.length >= 2) {
      nextLineas[1] = {
        ...nextLineas[1],
        size: nextLineas[0].size,
        fuente: nextLineas[0].fuente
      };
    }
    onChangeSchoolData({
      ...schoolData,
      escalarIgual: checked,
      lineas: nextLineas
    });
  };

  const toggleThirdLine = () => {
    if (schoolData.lineas.length >= 3) {
      onChangeSchoolData({ ...schoolData, lineas: schoolData.lineas.slice(0, 2) });
      if (activeLine >= 2) onActiveLineChange(1);
    } else {
      onChangeSchoolData({
        ...schoolData,
        lineas: [
          ...schoolData.lineas,
          { texto: 'HOJA: ____', fuente: 'Quicksand', size: 9, offset_y: 0.0, offset_x: 0.0 }
        ]
      });
      onActiveLineChange(2);
    }
  };

  const hasThird = schoolData.lineas.length >= 3;

  return (
    <div className="qc-stack">
      <div className="qc-card">
        <div className="qc-icon-row">
          <div className="qc-icon-thumb">
            <img src={selectedIcon.file} alt={selectedIcon.name} />
          </div>
          <div className="qc-icon-info">
            <span>Ícono #{selectedIcon.id}</span>
            <strong>{selectedIcon.name}</strong>
            <span>{iconSize.toFixed(1)} mm · {iconOffsetX === 0 && iconOffsetY === 0 ? 'Centrado' : 'Ajustado'}</span>
          </div>
          <button type="button" className="qc-ghost" onClick={() => setIsPickerOpen(true)}>
            Cambiar
          </button>
        </div>

        <div className="qc-icon-divider" />
        <div className="qc-icon-tools-title">Ajuste de tamaño y posición</div>

        <div className="qc-pair">
          <div className="qc-field">
            <div className="qc-card-head" style={{ marginBottom: 4 }}>
              <span className="qc-label">Tamaño</span>
              <span className="qc-label">{iconSize.toFixed(1)} mm</span>
            </div>
            <div className="qc-stepper">
              <button
                type="button"
                aria-label="Reducir tamaño del ícono"
                disabled={iconSize <= 6.0}
                onClick={() => updateIconSize(-0.5)}
              >
                <Icon name="minus" size={18} />
              </button>
              <span className="qc-stepper-value">{iconSize.toFixed(1)}</span>
              <button
                type="button"
                aria-label="Aumentar tamaño del ícono"
                disabled={iconSize >= 14.5}
                onClick={() => updateIconSize(0.5)}
              >
                <Icon name="plus" size={18} />
              </button>
            </div>
          </div>

          <div className="qc-field">
            <div className="qc-card-head" style={{ marginBottom: 4 }}>
              <span className="qc-label">Ajuste vertical</span>
              {iconOffsetY !== 0 && (
                <span className="qc-label">{iconOffsetY > 0 ? `+${iconOffsetY.toFixed(1)}` : iconOffsetY.toFixed(1)} mm</span>
              )}
            </div>
            <div className="qc-nudge">
              <button
                type="button"
                aria-label="Subir ícono"
                onClick={() => updateIconOffsetY(-0.5)}
              >
                <Icon name="arrow-up" size={18} />
              </button>
              <button
                type="button"
                aria-label="Bajar ícono"
                onClick={() => updateIconOffsetY(0.5)}
              >
                <Icon name="arrow-down" size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="qc-pair">
          <div className="qc-field">
            <div className="qc-card-head" style={{ marginBottom: 4 }}>
              <span className="qc-label">Ajuste horizontal</span>
              {iconOffsetX !== 0 && (
                <span className="qc-label">{iconOffsetX > 0 ? `+${iconOffsetX.toFixed(1)}` : iconOffsetX.toFixed(1)} mm</span>
              )}
            </div>
            <div className="qc-nudge">
              <button
                type="button"
                aria-label="Mover ícono a la izquierda"
                onClick={() => updateIconOffsetX(-0.5)}
              >
                <Icon name="arrow-left" size={18} />
              </button>
              <button
                type="button"
                aria-label="Mover ícono a la derecha"
                onClick={() => updateIconOffsetX(0.5)}
              >
                <Icon name="arrow-right" size={18} />
              </button>
            </div>
          </div>

          <div className="qc-field" style={{ justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="qc-reset-btn"
              disabled={!isCustomized}
              onClick={resetIconAdjustments}
              title="Restablecer tamaño y posición original del ícono"
            >
              <Icon name="rotate-ccw" size={15} />
              Restablecer
            </button>
          </div>
        </div>
      </div>

      <LineEditorTabs
        lines={schoolData.lineas}
        fonts={SCHOOL_FONTS}
        labels={LABELS}
        placeholders={PLACEHOLDERS}
        sizeMin={7}
        sizeMax={24}
        active={activeLine}
        onActiveChange={onActiveLineChange}
        onUpdate={updateLine}
        syncSizes={isSync}
        onToggleSyncSizes={toggleSyncSizes}
        showSyncOption={true}
        onRemoveThirdLine={toggleThirdLine}
      />

      {!hasThird && (
        <button type="button" className="qc-dashed" onClick={toggleThirdLine}>
          <Icon name="plus" size={16} />
          Agregar línea adicional
        </button>
      )}

      <SchoolIconPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        selectedId={schoolData.iconId}
        onSelectIcon={(iconId) => onChangeSchoolData({ ...schoolData, iconId })}
      />
    </div>
  );
}
