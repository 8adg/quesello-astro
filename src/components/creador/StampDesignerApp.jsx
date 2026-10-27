import React, { useState, useRef, useEffect } from 'react';
import {
  INITIAL_PROFESSIONAL_DATA,
  INITIAL_SCHOOL_DATA,
  STAMP_HEIGHT_MM,
  STAMP_WIDTH_MM,
  FACTOR_PT_A_MM,
  SCHOOL_ICONS
} from './constants';
import { useStore } from '@nanostores/react';
import { $cartCount, $isCartOpen } from '../../store/cart';
import StampCanvasPreview from './StampCanvasPreview';
import ProfessionalControls from './ProfessionalControls';
import SchoolControls, { SCHOOL_LINE_LABELS } from './SchoolControls';
import { LineTabs } from './LineEditorTabs';
import StampCategoryModal from './StampCategoryModal';
import OrderConfirmationModal from './OrderConfirmationModal';
import Icon from './Icon';
import useStampProducts, { formatPrice } from './useStampProducts';
import './creador.css';

// Unificación total de checkout escolar y profesional con redirección a /gracias
let currentScrollAnimation = null;

function smoothScrollTo(targetY, duration = 450) {
  if (currentScrollAnimation) {
    currentScrollAnimation();
    currentScrollAnimation = null;
  }

  const startY = window.scrollY || window.pageYOffset;
  const diff = targetY - startY;
  if (Math.abs(diff) < 2) return;

  const startTime = performance.now();
  let cancelled = false;
  let rafId = null;

  const cancel = () => {
    cancelled = true;
    if (rafId) cancelAnimationFrame(rafId);
    window.removeEventListener('wheel', cancel);
    window.removeEventListener('touchstart', cancel);
  };

  currentScrollAnimation = cancel;
  window.addEventListener('wheel', cancel, { passive: true, once: true });
  window.addEventListener('touchstart', cancel, { passive: true, once: true });

  function step(currentTime) {
    if (cancelled) return;
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    window.scrollTo(0, startY + diff * ease);

    if (progress < 1) {
      rafId = requestAnimationFrame(step);
    } else {
      cancel();
      currentScrollAnimation = null;
    }
  }

  rafId = requestAnimationFrame(step);
}

export default function StampDesignerApp() {
  const [category, setCategory] = useState('profesional'); // 'profesional' | 'escolar'
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [showGuides, setShowGuides] = useState(true);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [activeLine, setActiveLine] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const cartCount = useStore($cartCount);

  const [professionalLines, setProfessionalLines] = useState(INITIAL_PROFESSIONAL_DATA);
  const [schoolData, setSchoolData] = useState(INITIAL_SCHOOL_DATA);

  const canvasRef = useRef(null);
  const previewRef = useRef(null);
  const products = useStampProducts();
  const product = products[category];
  const price = product?.precio;
  const priceReady = typeof price === 'number';

  const [metrics, setMetrics] = useState(null);
  const activeLines = category === 'profesional' ? professionalLines : schoolData.lineas;
  const usedHeightMm = metrics?.usedHeightMm ?? activeLines.reduce((acc, l) => acc + Number(l.size) * FACTOR_PT_A_MM, 0);
  const isValidVertical = metrics?.isValidVertical ?? (STAMP_HEIGHT_MM - usedHeightMm >= -0.6);
  const hasOverflowWidth = metrics?.hasOverflowWidth ?? false;
  const isValid = isValidVertical && !hasOverflowWidth;

  const isSchool = category === 'escolar';
  const kindLabel = isSchool ? 'Sello escolar' : 'Sello profesional';
  const linesLabel = `${activeLines.length} ${activeLines.length === 1 ? 'línea' : 'líneas'}${isSchool ? ' + ícono' : ''}`;

  const canOrder = isValid && priceReady;
  const tabLabels = isSchool
    ? activeLines.map((_, i) => SCHOOL_LINE_LABELS[i] || `Línea ${i + 1}`)
    : activeLines.map((_, i) => `Línea ${i + 1}`);
  const safeActiveLine = Math.min(activeLine, activeLines.length - 1);

  const handleTabClick = (index) => {
    setActiveLine(index);
    const editorEl = document.getElementById('qc-line-editor') || document.querySelector('.qc-track');
    const previewEl = previewRef.current || document.querySelector('.qc-preview');
    if (editorEl) {
      const previewHeight = previewEl ? previewEl.offsetHeight : 280;
      const editorRect = editorEl.getBoundingClientRect();
      const currentScrollY = window.scrollY || window.pageYOffset;
      const editorAbsoluteTop = editorRect.top + currentScrollY;
      // Desplazar suavemente hasta que la card del editor de líneas quede justo debajo de la vista previa pegajosa (Captura 2)
      const targetY = Math.max(0, editorAbsoluteTop - previewHeight - 16);
      smoothScrollTo(targetY, 450);
    }
  };

  return (
    <div className="qc-root">
      {/* Barra superior */}
      <header className="qc-topbar">
        <a href="/" className="qc-back" aria-label="Volver al inicio">
          <Icon name="arrow-left" size={24} color="#FF5555" />
        </a>
        <a href="/" className="qc-logo" aria-label="Queselló">
          <img src="/logo.svg" alt="Queselló" />
        </a>
        <button type="button" className="qc-cart" aria-label="Abrir mi pedido" onClick={() => $isCartOpen.set(true)}>
          <span className="cart-icon-badge">{mounted ? cartCount : 0}</span>
          <img src="/icono-cart.svg" alt="" width={38} height={30} />
        </button>
      </header>

      <div className="qc-kind">
        <span className="qc-kind-label">
          <Icon name={isSchool ? 'backpack' : 'briefcase'} size={18} color="#495D56" />
          {kindLabel}
        </span>
        <button type="button" className="qc-link" onClick={() => setIsCategoryModalOpen(true)}>
          Cambiar tipo
        </button>
      </div>

      <h1 className="qc-title">Crea tu sello</h1>
      <p className="qc-intro">Personalizá cada línea y mirá cómo queda tu sello en tiempo real.</p>

      <div className="qc-meta">
        <span className="qc-meta-size">
          <Icon name="ruler" size={18} />
          {STAMP_WIDTH_MM} × {STAMP_HEIGHT_MM} mm
        </span>
        <span className="qc-price">{formatPrice(price)}</span>
      </div>

      {/* Vista previa fija mientras se edita */}
      <section ref={previewRef} className="qc-preview" aria-label="Vista previa del sello">
        <div className="qc-preview-head">
          <span className="qc-card-title">Vista previa</span>
          <span className="qc-switch-row">
            Guías
            <button
              type="button"
              role="switch"
              aria-checked={showGuides}
              aria-label="Mostrar guías"
              className={`qc-switch ${showGuides ? 'qc-switch--on' : ''}`}
              onClick={() => setShowGuides((v) => !v)}
            />
          </span>
        </div>

        <div className="qc-stage">
          <StampCanvasPreview
            ref={canvasRef}
            mode={category}
            professionalLines={professionalLines}
            schoolData={schoolData}
            showGuides={showGuides}
            onMetricsChange={setMetrics}
          />
        </div>

        <div className="qc-preview-foot">
          <span className={`qc-metric ${isValid ? '' : 'qc-metric--bad'}`}>
            <Icon name="scan" size={16} color={isValid ? '#1E9E5A' : '#DC2626'} />
            {usedHeightMm.toFixed(1)} mm / {STAMP_HEIGHT_MM} mm
          </span>
          <div className="qc-preview-foot-actions">
            <button type="button" className="qc-link" onClick={() => setIsCategoryModalOpen(true)}>
              Cambiar
            </button>
          </div>
        </div>
        <p className="qc-hint">Vista ampliada · Tamaño óptimo para grabado.</p>

        {!isValidVertical && (
          <div className="qc-alert">
            El texto excede la altura del sello ({STAMP_HEIGHT_MM} mm). Reducí el tamaño de las fuentes.
          </div>
        )}

        {hasOverflowWidth && isValidVertical && (
          <div className="qc-alert">
            El texto sobrepasa los bordes del sello ({STAMP_WIDTH_MM} mm). Reducí el tamaño o acortá el texto.
          </div>
        )}

        <LineTabs labels={tabLabels} active={safeActiveLine} onChange={handleTabClick} />
      </section>

      <div className="qc-section">
        <h2 className="qc-section-title">Configuración de líneas</h2>
        <p className="qc-section-sub">Ajustá el texto, la tipografía y la posición.</p>
      </div>

      {category === 'profesional' ? (
        <ProfessionalControls lines={professionalLines} onChangeLines={setProfessionalLines} activeLine={safeActiveLine} onActiveLineChange={setActiveLine} />
      ) : (
        <SchoolControls schoolData={schoolData} onChangeSchoolData={setSchoolData} activeLine={safeActiveLine} onActiveLineChange={setActiveLine} />
      )}

      <p className="qc-note">
        <Icon name="circle-check" size={18} />
        <span>Revisá los nombres y la matrícula antes de agregar tu sello al pedido.</span>
      </p>

      <div className="qc-card">
        <div className="qc-summary-row">
          <div>
            <div className="qc-summary-name">{kindLabel}</div>
            <div className="qc-summary-sub">{STAMP_WIDTH_MM} × {STAMP_HEIGHT_MM} mm · {linesLabel}</div>
          </div>
          <div className="qc-summary-price">
            <strong>{formatPrice(price)}</strong>
            <span>Precio final</span>
          </div>
        </div>
        <button
          type="button"
          className="btn qc-cta"
          disabled={!canOrder}
          onClick={() => setIsConfirmationOpen(true)}
        >
          {!priceReady
            ? products.status === 'error' ? 'Precio no disponible' : 'Cargando precio…'
            : !isValidVertical ? 'Exceso de altura'
            : hasOverflowWidth ? 'Exceso de ancho'
            : 'Agregar a mi pedido'}
          {canOrder && <Icon name="plus" size={20} color="#FFFFFF" />}
        </button>
      </div>

      <StampCategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSelectCategory={(c) => { setCategory(c); setActiveLine(0); setIsCategoryModalOpen(false); }}
        currentCategory={category}
      />

      <OrderConfirmationModal
        isOpen={isConfirmationOpen}
        onClose={() => setIsConfirmationOpen(false)}
        mode={category}
        price={price}
        product={product}
        professionalLines={professionalLines}
        schoolData={schoolData}
        canvasRef={canvasRef}
      />
    </div>
  );
}
