// src/components/admin/PricingToolsModal.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  quoteCustomDimension,
  auditCatalogAnomalies,
  roundCommercial,
} from '../../lib/pricingEngine';
import { generatePriceListPDF } from '../../lib/priceListPdfGenerator';

const LinearIcon = ({ name, color = '#495D56', size = 18 }) => (
  <img
    src={`https://api.iconify.design/lucide/${name}.svg?color=${encodeURIComponent(color)}`}
    style={{ width: `${size}px`, height: `${size}px`, flexShrink: 0, display: 'block' }}
    alt=""
  />
);

export default function PricingToolsModal({
  products = [],
  onProductsUpdated,
  tableName = 'productos',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('quoter'); // 'quoter' | 'audit' | 'bulk'
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  // Estado Pestaña 1: Cotizador L+A + Comparador CABA
  const [widthCm, setWidthCm] = useState(9);
  const [heightCm, setHeightCm] = useState(6);
  const [qty, setQty] = useState(1);
  const [addKnob, setAddKnob] = useState(false);
  const [addStarter, setAddStarter] = useState(false);
  const [manualUnitOverride, setManualUnitOverride] = useState('');
  const [cabaFreight, setCabaFreight] = useState(9000);
  const [oldBudgetTotal, setOldBudgetTotal] = useState('');
  const [customProductCode, setCustomProductCode] = useState('');
  const [customProductDesc, setCustomProductDesc] = useState('');
  const [savingCustomProduct, setSavingCustomProduct] = useState(false);

  // Estado Pestaña 2: Edición manual de precios sugeridos en Curva
  const [curveEdits, setCurveEdits] = useState({});
  const [curveSelected, setCurveSelected] = useState({});

  // Estado Pestaña 3: Ajuste Masivo con edición manual por fila
  const [bulkPct, setBulkPct] = useState(10);
  const [bulkCategory, setBulkCategory] = useState('TODAS');
  const [roundStep, setRoundStep] = useState(50);
  const [bulkOverrides, setBulkOverrides] = useState({});

  // Estado Pestaña 4: Exportar Lista Completa en PDF (Oficial / Reventa con Descuento)
  const [pdfDiscountPct, setPdfDiscountPct] = useState(0);
  const [pdfRoundStep, setPdfRoundStep] = useState(50);
  const [pdfShowComparison, setPdfShowComparison] = useState(true);
  const [pdfIncludeEsp, setPdfIncludeEsp] = useState(false);
  const [pdfCustomTitle, setPdfCustomTitle] = useState('');
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  // Auditoría automática de la curva actual en Supabase
  const audit = useMemo(() => auditCatalogAnomalies(products), [products]);

  // Sincronizar valores sugeridos editables cuando cambia la auditoría
  useEffect(() => {
    const nextEdits = {};
    const nextSel = {};
    audit.anomalies.forEach((a) => {
      nextEdits[a.code] = a.suggestedPrice;
      nextSel[a.code] = true;
    });
    setCurveEdits(nextEdits);
    setCurveSelected(nextSel);
  }, [audit.anomalies]);

  // Limpiar overrides manuales de ajuste masivo cuando cambian % / categoría / redondeo
  useEffect(() => {
    setBulkOverrides({});
  }, [bulkPct, bulkCategory, roundStep]);

  // Resetear override manual del cotizador cuando cambian las medidas
  useEffect(() => {
    setManualUnitOverride('');
  }, [widthCm, heightCm]);

  // Sugerir próximo código especial ESP-001, ESP-002... para diferenciar de QS-xxx
  const suggestedCustomCode = useMemo(() => {
    const espNums = products
      .map((p) => String(p.codigo || p.code || '').toUpperCase())
      .filter((c) => c.startsWith('ESP-'))
      .map((c) => parseInt(c.replace('ESP-', ''), 10))
      .filter((n) => !isNaN(n));
    const nextNum = espNums.length > 0 ? Math.max(...espNums) + 1 : 1;
    return `ESP-${String(nextNum).padStart(3, '0')}`;
  }, [products]);

  const suggestedCustomDesc = useMemo(() => {
    const w = Number(widthCm) || 0;
    const h = Number(heightCm) || 0;
    const extras = [
      addKnob ? '+ PERILLA' : '',
      addStarter ? '+ COMBO STARTER' : '',
    ]
      .filter(Boolean)
      .join(' ');
    return `SELLO A MEDIDA ${w}X${h}CM${extras ? ' ' + extras : ''}`;
  }, [widthCm, heightCm, addKnob, addStarter]);

  useEffect(() => {
    setCustomProductCode(suggestedCustomCode);
  }, [suggestedCustomCode]);

  useEffect(() => {
    setCustomProductDesc(suggestedCustomDesc);
  }, [suggestedCustomDesc]);

  // Lista de productos especiales (ESP-*) activos en el catálogo para encontrarlos y eliminarlos rápido
  const customCatalogProducts = useMemo(() => {
    return products.filter((p) =>
      String(p.codigo || p.code || '')
        .toUpperCase()
        .startsWith('ESP-')
    );
  }, [products]);

  // Precios de adicionales leídos desde el catálogo real (con fallback)
  const knobCatalogPrice = useMemo(() => {
    const found = products.find((p) => (p.codigo || p.code) === 'QS-025');
    return Number(found?.precio ?? found?.price ?? 2000);
  }, [products]);

  const starterCatalogPrice = useMemo(() => {
    const found = products.find((p) => (p.codigo || p.code) === 'QS-016');
    return Number(found?.precio ?? found?.price ?? 6000);
  }, [products]);

  // Cálculo en vivo del Cotizador L+A
  const quoteResult = useMemo(() => {
    const base = quoteCustomDimension(widthCm, heightCm, products);
    const effectiveBaseUnit =
      manualUnitOverride !== '' && !isNaN(Number(manualUnitOverride))
        ? Number(manualUnitOverride)
        : base.unitPrice;
    const knobCost = addKnob ? knobCatalogPrice : 0;
    const starterCost = addStarter ? starterCatalogPrice : 0;
    const unitTotal = effectiveBaseUnit + knobCost + starterCost;
    const finalTotal = unitTotal * Math.max(1, Number(qty) || 1);

    const oldVal = Number(oldBudgetTotal) || 0;
    const requoteDelta = oldVal > 0 ? finalTotal - oldVal : 0;
    const requotePct = oldVal > 0 ? ((requoteDelta / oldVal) * 100).toFixed(1) : 0;

    return {
      ...base,
      effectiveBaseUnit,
      isManualOverride: manualUnitOverride !== '' && Number(manualUnitOverride) !== base.unitPrice,
      knobCost,
      starterCost,
      unitTotal,
      finalTotal,
      requoteDelta,
      requotePct,
    };
  }, [
    widthCm,
    heightCm,
    qty,
    addKnob,
    addStarter,
    manualUnitOverride,
    oldBudgetTotal,
    products,
    knobCatalogPrice,
    starterCatalogPrice,
  ]);

  // Categorías únicas reales de la tabla `productos`
  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.categoria || p.category).filter(Boolean));
    return ['TODAS', ...Array.from(set)];
  }, [products]);

  // Productos filtrados para la vista previa editable del Ajuste Masivo
  const targetBulkProducts = useMemo(() => {
    return products
      .filter((p) => {
        const cat = p.categoria || p.category || '';
        return bulkCategory === 'TODAS' || cat === bulkCategory;
      })
      .map((p) => {
        const code = p.codigo || p.code;
        const name = p.descripcion || p.name || p.nombre;
        const oldPrice = Number(p.precio ?? p.price ?? 0);
        const calculatedPrice = roundCommercial(
          oldPrice * (1 + Number(bulkPct || 0) / 100),
          roundStep
        );
        const finalNewPrice =
          bulkOverrides[code] !== undefined && bulkOverrides[code] !== ''
            ? Number(bulkOverrides[code])
            : calculatedPrice;
        return {
          ...p,
          code,
          name,
          oldPrice,
          calculatedPrice,
          finalNewPrice,
        };
      });
  }, [products, bulkCategory, bulkPct, roundStep, bulkOverrides]);

  // Acción 1: Actualizar en Supabase únicamente los ítems seleccionados de la curva con el monto manual elegido
  const handleFixCurveAnomalies = async () => {
    const toUpdate = audit.anomalies.filter((a) => curveSelected[a.code]);
    if (toUpdate.length === 0) {
      setStatusMsg({ type: 'error', text: 'Seleccioná al menos un producto para actualizar.' });
      return;
    }

    setLoading(true);
    setStatusMsg(null);
    try {
      const sample = products[0] || {};
      const priceField = 'precio' in sample ? 'precio' : 'price';
      const codeField = 'codigo' in sample ? 'codigo' : 'code';

      for (const item of toUpdate) {
        const chosenPrice = Number(curveEdits[item.code] ?? item.suggestedPrice);
        if (isNaN(chosenPrice) || chosenPrice < 0) continue;

        const { error } = await supabase
          .from(tableName)
          .update({ [priceField]: chosenPrice })
          .eq(codeField, item.code);

        if (error) throw error;
      }

      setStatusMsg({
        type: 'success',
        text: `Se actualizaron ${toUpdate.length} producto(s) en el catálogo correctamente.`,
      });
      if (onProductsUpdated) await onProductsUpdated();
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Error al actualizar en Supabase: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  // Acción 2: Aplicar ajuste porcentual masivo (respetando ediciones manuales individuales)
  const handleApplyBulkAdjustment = async () => {
    if (targetBulkProducts.length === 0) return;
    if (
      !window.confirm(
        `¿Confirmás actualizar ${targetBulkProducts.length} productos de "${bulkCategory}" en el catálogo?`
      )
    ) {
      return;
    }
    setLoading(true);
    setStatusMsg(null);
    try {
      const sample = products[0] || {};
      const priceKey = 'precio' in sample ? 'precio' : 'price';
      const idKey = 'id' in sample ? 'id' : 'codigo' in sample ? 'codigo' : 'code';

      for (const prod of targetBulkProducts) {
        const { error } = await supabase
          .from(tableName)
          .update({ [priceKey]: prod.finalNewPrice })
          .eq(idKey, prod[idKey]);

        if (error) throw error;
      }

      setStatusMsg({
        type: 'success',
        text: `Se actualizaron ${targetBulkProducts.length} productos correctamente.`,
      });
      if (onProductsUpdated) await onProductsUpdated();
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Error aplicando ajuste masivo: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  // Acción 3: Guardar la cotización actual como un Producto Nuevo en el catálogo (código diferenciado ESP-xxx)
  const handleCreateCustomProduct = async () => {
    const code = String(customProductCode || suggestedCustomCode).trim().toUpperCase();
    const desc = String(customProductDesc || suggestedCustomDesc).trim().toUpperCase();
    const unitPrice = Number(quoteResult.unitTotal || 0);

    if (!code || !desc) {
      setStatusMsg({ type: 'error', text: 'Completá el código y la descripción del producto.' });
      return;
    }
    if (unitPrice <= 0) {
      setStatusMsg({ type: 'error', text: 'El precio unitario debe ser mayor a 0.' });
      return;
    }

    setSavingCustomProduct(true);
    setStatusMsg(null);
    try {
      // Buscar categoría de Sellos existente o usar 'Sellos'
      const defaultCat =
        products.find((p) => /sello/i.test(p.categoria || ''))?.categoria || 'Sellos';

      const payload = {
        codigo: code,
        descripcion: desc,
        precio: unitPrice,
        categoria: defaultCat,
        data: `${Number(widthCm) || 0}x${Number(heightCm) || 0}cm`,
        img: '',
        activo: 1,
        franquicia_id: 1,
      };

      const { error } = await supabase.from(tableName).insert(payload);
      if (error) throw error;

      setStatusMsg({
        type: 'success',
        text: `Producto "${code} — ${desc}" ($${unitPrice.toLocaleString('es-AR')}) guardado en el catálogo.`,
      });
      if (onProductsUpdated) await onProductsUpdated();
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text: `Error al guardar producto a medida: ${err.message}`,
      });
    } finally {
      setSavingCustomProduct(false);
    }
  };

  // Acción 4: Eliminar rápido un producto a medida (ESP-*) desde el mismo cotizador
  const handleDeleteCustomProduct = async (prod) => {
    const code = prod.codigo || prod.code;
    const desc = prod.descripcion || prod.name;
    if (!window.confirm(`¿Eliminar el producto a medida "${code} — ${desc}" del catálogo?`)) {
      return;
    }
    setSavingCustomProduct(true);
    setStatusMsg(null);
    try {
      const { error } = await supabase.from(tableName).delete().eq('id', prod.id);
      if (error) throw error;
      setStatusMsg({
        type: 'success',
        text: `Producto a medida "${code}" eliminado del catálogo.`,
      });
      if (onProductsUpdated) await onProductsUpdated();
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text: `Error al eliminar producto: ${err.message}`,
      });
    } finally {
      setSavingCustomProduct(false);
    }
  };

  return (
    <>
      {/* Botones de barra superior integrados con la estética de ProductManager */}
      <div style={styles.toolbar}>
        <button
          type="button"
          onClick={() => {
            setStatusMsg(null);
            setActiveTab('quoter');
            setIsOpen(true);
          }}
          style={styles.btnSecondary}
        >
          <LinearIcon name="ruler" color="#495D56" size={18} />
          <span>Cotizador L+A</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusMsg(null);
            setActiveTab(audit.anomalies.length > 0 ? 'audit' : 'bulk');
            setIsOpen(true);
          }}
          style={styles.btnSecondary}
        >
          <LinearIcon name="sliders-horizontal" color="#495D56" size={18} />
          <span>Precios y Curva</span>
          {audit.anomalies.length > 0 && (
            <span style={styles.badgeAlert}>{audit.anomalies.length}</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusMsg(null);
            setActiveTab('pdf');
            setIsOpen(true);
          }}
          style={styles.btnSecondary}
        >
          <LinearIcon name="file-text" color="#495D56" size={18} />
          <span>Lista PDF / Reventa</span>
        </button>

        <a
          href="/catalogo"
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...styles.btnSecondary, textDecoration: 'none' }}
          title="Abrir página pública del catálogo con filtros por empaque"
        >
          <LinearIcon name="external-link" color="#495D56" size={17} />
          <span>Catálogo Web</span>
        </a>
      </div>

      {isOpen && (
        <div style={styles.backdrop} onClick={() => setIsOpen(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            {/* Cabecera Minimalista */}
            <div style={styles.header}>
              <div>
                <h2 style={styles.title}>Herramientas de Precios</h2>
                <p style={styles.subtitle}>
                  Cotización rectangular (L+A), revisión de curva y ajuste de catálogo
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={styles.closeBtn}
                title="Cerrar"
              >
                <LinearIcon name="x" color="#495D56" size={20} />
              </button>
            </div>

            {/* Pestañas Estilo Pill Queselló */}
            <div style={styles.tabs}>
              <button
                type="button"
                onClick={() => {
                  setStatusMsg(null);
                  setActiveTab('quoter');
                }}
                style={activeTab === 'quoter' ? styles.tabActive : styles.tab}
              >
                <LinearIcon
                  name="ruler"
                  color={activeTab === 'quoter' ? '#FFFFFF' : '#495D56'}
                  size={16}
                />
                <span>Cotizador L+A</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusMsg(null);
                  setActiveTab('audit');
                }}
                style={activeTab === 'audit' ? styles.tabActive : styles.tab}
              >
                <LinearIcon
                  name="activity"
                  color={activeTab === 'audit' ? '#FFFFFF' : '#495D56'}
                  size={16}
                />
                <span>Curva ({audit.anomalies.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusMsg(null);
                  setActiveTab('bulk');
                }}
                style={activeTab === 'bulk' ? styles.tabActive : styles.tab}
              >
                <LinearIcon
                  name="sliders-horizontal"
                  color={activeTab === 'bulk' ? '#FFFFFF' : '#495D56'}
                  size={16}
                />
                <span>Ajuste Masivo</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusMsg(null);
                  setActiveTab('pdf');
                }}
                style={activeTab === 'pdf' ? styles.tabActive : styles.tab}
              >
                <LinearIcon
                  name="file-text"
                  color={activeTab === 'pdf' ? '#FFFFFF' : '#495D56'}
                  size={16}
                />
                <span>Lista PDF / Reventa</span>
              </button>
            </div>

            {statusMsg && (
              <div
                style={{
                  ...styles.statusBanner,
                  background: statusMsg.type === 'error' ? '#FEE2E2' : '#DCFCE7',
                  color: statusMsg.type === 'error' ? '#991B1B' : '#166534',
                }}
              >
                <LinearIcon
                  name={statusMsg.type === 'error' ? 'alert-circle' : 'check'}
                  color={statusMsg.type === 'error' ? '#991B1B' : '#166534'}
                  size={16}
                />
                <span>{statusMsg.text}</span>
              </div>
            )}

            {/* PESTAÑA 1: COTIZADOR L+A Y RECOTIZADOR RÁPIDO */}
            {activeTab === 'quoter' && (
              <div>
                <div style={styles.grid3}>
                  <div>
                    <label style={styles.label}>ANCHO (CM)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      value={widthCm}
                      onChange={(e) => setWidthCm(e.target.value)}
                      style={styles.input}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>ALTO (CM)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value)}
                      style={styles.input}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>CANTIDAD</label>
                    <input
                      type="number"
                      min="1"
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      style={styles.input}
                    />
                  </div>
                </div>

                <div style={styles.checksRow}>
                  <label style={styles.checkLabel}>
                    <input
                      type="checkbox"
                      checked={addKnob}
                      onChange={(e) => setAddKnob(e.target.checked)}
                    />
                    <span>Adicional perilla (+${knobCatalogPrice.toLocaleString('es-AR')})</span>
                  </label>
                  <label style={styles.checkLabel}>
                    <input
                      type="checkbox"
                      checked={addStarter}
                      onChange={(e) => setAddStarter(e.target.checked)}
                    />
                    <span>Combo Starter (+${starterCatalogPrice.toLocaleString('es-AR')})</span>
                  </label>
                </div>

                {/* Edición manual opcional del precio unitario y comparador con presupuesto anterior */}
                <div style={{ ...styles.grid2, marginTop: '14px' }}>
                  <div>
                    <label style={styles.label}>PRECIO BASE SELLO (EDITABLE $)</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="number"
                        step="50"
                        placeholder={String(quoteResult.unitPrice)}
                        value={
                          manualUnitOverride !== '' ? manualUnitOverride : quoteResult.unitPrice
                        }
                        onChange={(e) => setManualUnitOverride(e.target.value)}
                        style={styles.input}
                      />
                      {quoteResult.isManualOverride && (
                        <button
                          type="button"
                          onClick={() => setManualUnitOverride('')}
                          title="Restaurar precio sugerido por fórmula"
                          style={styles.iconActionBtn}
                        >
                          <LinearIcon name="rotate-ccw" color="#495D56" size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label style={styles.label}>PRESUPUESTO ANTERIOR (OPCIONAL $)</label>
                    <input
                      type="number"
                      placeholder="Ej: 17500"
                      value={oldBudgetTotal}
                      onChange={(e) => setOldBudgetTotal(e.target.value)}
                      style={styles.input}
                    />
                  </div>
                </div>

                {/* Tarjeta Resultado */}
                <div style={styles.resultCard}>
                  <div style={styles.resultMeta}>
                    <span style={styles.pillCode}>{quoteResult.code}</span>
                    <span>
                      Superficie: <strong>{quoteResult.areaCm2} cm²</strong> · Suma L+A:{' '}
                      <strong>{quoteResult.sumSides} cm</strong> (${quoteResult.pricePerCm2}/cm²)
                    </span>
                  </div>
                  <div style={styles.ruleSub}>
                    {quoteResult.isManualOverride
                      ? `Precio ajustado manualmente (Sugerido L+A: $${quoteResult.unitPrice.toLocaleString('es-AR')})`
                      : quoteResult.ruleApplied}
                  </div>

                  <div style={styles.bigPrice}>
                    <span style={{ fontSize: '18px', marginRight: '4px' }}>$</span>
                    {quoteResult.finalTotal.toLocaleString('es-AR')}
                  </div>

                  {Number(oldBudgetTotal) > 0 && (
                    <div style={styles.requoteBadge}>
                      Diferencia vs. presupuesto anterior:{' '}
                      {quoteResult.requoteDelta >= 0 ? '+' : ''}$
                      {quoteResult.requoteDelta.toLocaleString('es-AR')} (
                      {quoteResult.requoteDelta >= 0 ? '+' : ''}
                      {quoteResult.requotePct}%)
                    </div>
                  )}

                  {/* Comparador Flete CABA -> Mar del Plata */}
                  <div style={styles.freightBox}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        color: '#495D56',
                      }}
                    >
                      <LinearIcon name="truck" color="#998E55" size={16} />
                      <span>
                        Flete promedio CABA a Mar del Plata:{' '}
                        <strong>${Number(cabaFreight).toLocaleString('es-AR')}</strong>
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="15000"
                      step="500"
                      value={cabaFreight}
                      onChange={(e) => setCabaFreight(Number(e.target.value))}
                      style={{ width: '100%', marginTop: '8px', accentColor: '#495D56' }}
                    />
                  </div>
                </div>

                {/* Bloque: Guardar cotización como Producto a Medida con código diferenciado (ESP-xxx) */}
                <div
                  style={{
                    marginTop: '18px',
                    background: '#FFFFFF',
                    border: '1px solid #DFDED9',
                    borderRadius: '22px',
                    padding: '20px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '14px',
                      gap: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <LinearIcon name="package-plus" color="#495D56" size={18} />
                      <span style={{ fontSize: '14px', fontWeight: 800, color: '#495D56' }}>
                        Guardar cotización como Producto a Medida
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#998E55',
                        fontWeight: 700,
                        background: '#F4F1E1',
                        padding: '4px 10px',
                        borderRadius: '999px',
                      }}
                    >
                      Prefijo ESP- para buscarlo y eliminarlo fácil
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '150px 1fr',
                      gap: '12px',
                      marginBottom: '14px',
                    }}
                  >
                    <div>
                      <label style={styles.label}>CÓDIGO DIFERENCIADO</label>
                      <input
                        type="text"
                        value={customProductCode}
                        onChange={(e) => setCustomProductCode(e.target.value.toUpperCase())}
                        placeholder="ESP-001"
                        style={{ ...styles.input, fontWeight: 700 }}
                      />
                    </div>
                    <div>
                      <label style={styles.label}>DESCRIPCIÓN DEL TRABAJO A MEDIDA</label>
                      <input
                        type="text"
                        value={customProductDesc}
                        onChange={(e) => setCustomProductDesc(e.target.value.toUpperCase())}
                        placeholder="SELLO A MEDIDA 9X6CM"
                        style={styles.input}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={savingCustomProduct}
                    onClick={handleCreateCustomProduct}
                    style={{
                      ...styles.btnPrimary,
                      width: '100%',
                      opacity: savingCustomProduct ? 0.7 : 1,
                    }}
                  >
                    <LinearIcon name="plus-circle" color="#FFFFFF" size={18} />
                    <span>
                      {savingCustomProduct
                        ? 'Guardando en catálogo...'
                        : `Guardar como Producto a Medida (${customProductCode || suggestedCustomCode} — $${quoteResult.unitTotal.toLocaleString('es-AR')})`}
                    </span>
                  </button>

                  {/* Lista rápida de productos ESP-* existentes para eliminarlos con 1 clic (sin scroll interno) */}
                  {customCatalogProducts.length > 0 && (
                    <div
                      style={{
                        marginTop: '16px',
                        paddingTop: '14px',
                        borderTop: '1px solid #EFECE6',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          color: '#998E55',
                          letterSpacing: '0.04em',
                          marginBottom: '10px',
                          textTransform: 'uppercase',
                        }}
                      >
                        Trabajos a medida activos en catálogo ({customCatalogProducts.length})
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        {customCatalogProducts.map((cp) => (
                          <div
                            key={cp.id || cp.codigo}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px',
                              background: '#FAF9F6',
                              padding: '10px 14px',
                              borderRadius: '14px',
                              border: '1px solid #E5E0D0',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                minWidth: 0,
                                flex: 1,
                              }}
                            >
                              <span
                                style={{
                                  background: '#495D56',
                                  color: '#FFFFFF',
                                  padding: '4px 10px',
                                  borderRadius: '8px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  flexShrink: 0,
                                }}
                              >
                                {cp.codigo || cp.code}
                              </span>
                              <span
                                style={{
                                  fontSize: '13px',
                                  fontWeight: 700,
                                  color: '#495D56',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {cp.descripcion || cp.name}
                              </span>
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                flexShrink: 0,
                              }}
                            >
                              <span style={{ fontSize: '13px', fontWeight: 800, color: '#8E1F52' }}>
                                ${Number(cp.precio ?? cp.price ?? 0).toLocaleString('es-AR')}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteCustomProduct(cp)}
                                title="Eliminar trabajo a medida del catálogo"
                                style={styles.btnDangerPill}
                              >
                                <LinearIcon name="trash-2" color="#991B1B" size={14} />
                                <span>Eliminar</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PESTAÑA 2: AUDITORÍA DE ANOMALÍAS EN CURVA (CON EDICIÓN MANUAL) */}
            {activeTab === 'audit' && (
              <div>
                <p style={{ fontSize: '13px', color: '#495D56', margin: '0 0 14px 0' }}>
                  Revisión de escalones por superficie (cm²). Podés editar manualmente cada precio
                  sugerido o destildar el que no quieras modificar antes de guardar:
                </p>

                {audit.anomalies.length === 0 ? (
                  <div style={styles.okBox}>
                    <LinearIcon name="check-circle-2" color="#166534" size={20} />
                    <span>
                      La curva de precios está alineada. Ningún sello de mayor superficie tiene un
                      precio inferior a uno más chico.
                    </span>
                  </div>
                ) : (
                  <div style={styles.anomalyList}>
                    {audit.anomalies.map((a) => (
                      <div key={a.code} style={styles.anomalyItem}>
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            flex: 1,
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={!!curveSelected[a.code]}
                            onChange={(e) =>
                              setCurveSelected((prev) => ({
                                ...prev,
                                [a.code]: e.target.checked,
                              }))
                            }
                            style={{ marginTop: '4px' }}
                          />
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#5E7358' }}>
                              {a.code} — {a.name}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                              {a.reason}
                            </div>
                          </div>
                        </label>

                        <div style={{ width: '135px', flexShrink: 0 }}>
                          <label style={{ ...styles.label, marginBottom: '4px' }}>
                            NUEVO PRECIO ($)
                          </label>
                          <input
                            type="number"
                            step="50"
                            value={curveEdits[a.code] ?? a.suggestedPrice}
                            onChange={(e) =>
                              setCurveEdits((prev) => ({
                                ...prev,
                                [a.code]: e.target.value,
                              }))
                            }
                            style={{
                              ...styles.input,
                              padding: '8px 10px',
                              fontWeight: 700,
                              color: '#8E1F52',
                              textAlign: 'right',
                            }}
                          />
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleFixCurveAnomalies}
                      style={{ ...styles.btnPrimary, width: '100%', marginTop: '10px' }}
                    >
                      <LinearIcon name="check" color="#FFFFFF" size={18} />
                      <span>
                        {loading
                          ? 'Guardando cambios...'
                          : 'Guardar Precios Seleccionados en Catálogo'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* PESTAÑA 3: AJUSTE MASIVO PORCENTUAL (CON EDICIÓN MANUAL POR PRODUCTO) */}
            {activeTab === 'bulk' && (
              <div>
                <div style={styles.grid3}>
                  <div>
                    <label style={styles.label}>PORCENTAJE (%)</label>
                    <input
                      type="number"
                      step="1"
                      value={bulkPct}
                      onChange={(e) => setBulkPct(e.target.value)}
                      style={styles.input}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>CATEGORÍA</label>
                    <select
                      value={bulkCategory}
                      onChange={(e) => setBulkCategory(e.target.value)}
                      style={styles.input}
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={styles.label}>REDONDEO ($)</label>
                    <select
                      value={roundStep}
                      onChange={(e) => setRoundStep(Number(e.target.value))}
                      style={styles.input}
                    >
                      <option value={1}>Sin redondeo ($1)</option>
                      <option value={50}>$ 50 ARS</option>
                      <option value={100}>$ 100 ARS</option>
                      <option value={500}>$ 500 ARS</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={loading}
                  onClick={handleApplyBulkAdjustment}
                  style={{ ...styles.btnPrimary, width: '100%', marginTop: '16px' }}
                >
                  <LinearIcon name="check" color="#FFFFFF" size={18} />
                  <span>
                    {loading
                      ? 'Actualizando catálogo...'
                      : `Aplicar Nuevos Precios (${targetBulkProducts.length} productos)`}
                  </span>
                </button>

                {/* Lista completa editable antes de impactar en base de datos (sin doble scroll interno) */}
                <div style={styles.previewBox}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '10px',
                      flexWrap: 'wrap',
                      gap: '6px',
                    }}
                  >
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#998E55' }}>
                      PREVISUALIZACIÓN EDITABLE ({targetBulkProducts.length} PRODUCTOS)
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>
                      Podés retocar cualquier monto manualmente antes de aplicar
                    </span>
                  </div>

                  <div>
                    {targetBulkProducts.map((p) => (
                      <div key={p.code} style={styles.previewRow}>
                        <div style={{ flex: 1, paddingRight: '8px' }}>
                          <span style={{ fontWeight: 700, color: '#5E7358', marginRight: '6px' }}>
                            {p.code}
                          </span>
                          <span style={{ color: '#495D56' }}>{p.name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                            ${p.oldPrice.toLocaleString('es-AR')}
                          </span>
                          <LinearIcon name="arrow-right" color="#998E55" size={14} />
                          <input
                            type="number"
                            step={roundStep}
                            value={p.finalNewPrice}
                            onChange={(e) =>
                              setBulkOverrides((prev) => ({
                                ...prev,
                                [p.code]: e.target.value,
                              }))
                            }
                            style={{
                              width: '110px',
                              padding: '6px 10px',
                              borderRadius: '10px',
                              border: '1px solid #DFDED9',
                              fontWeight: 700,
                              fontSize: '13px',
                              color: '#8E1F52',
                              textAlign: 'right',
                              fontFamily: 'Inter',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* PESTAÑA 4: EXPORTAR LISTA COMPLETA EN PDF (PÚBLICO O REVENTA CON DESCUENTO) */}
            {activeTab === 'pdf' && (
              <div>
                <p style={{ fontSize: '13px', color: '#495D56', margin: '0 0 16px 0' }}>
                  Generá un PDF A4 listo para enviar por WhatsApp o imprimir, con precios al público
                  o aplicando un descuento comercial para librerías / revendedores:
                </p>

                {/* Botones rápidos de % de descuento */}
                <div
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '20px',
                    padding: '18px',
                    border: '1px solid #DFDED9',
                  }}
                >
                  <div style={{ marginBottom: '16px' }}>
                    <label style={styles.label}>SELECCIONAR TIPO DE LISTA / DESCUENTO</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {[
                        { label: '0% (Lista Público)', val: 0 },
                        { label: '-15% Reventa', val: 15 },
                        { label: '-20% Reventa', val: 20 },
                        { label: '-25% Reventa', val: 25 },
                        { label: '-30% Mayorista', val: 30 },
                      ].map((preset) => {
                        const active = Number(pdfDiscountPct) === preset.val;
                        return (
                          <button
                            key={preset.val}
                            type="button"
                            onClick={() => setPdfDiscountPct(preset.val)}
                            style={{
                              background: active ? '#495D56' : '#F4F1E1',
                              color: active ? '#FFFFFF' : '#495D56',
                              border: active ? '2px solid #495D56' : '2px solid transparent',
                              borderRadius: '14px',
                              padding: '9px 15px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              fontFamily: 'Inter',
                            }}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={styles.grid2}>
                    <div>
                      <label style={styles.label}>DESCUENTO MANUAL (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="80"
                        step="1"
                        value={pdfDiscountPct}
                        onChange={(e) => setPdfDiscountPct(e.target.value)}
                        style={styles.input}
                      />
                    </div>
                    <div>
                      <label style={styles.label}>REDONDEO DE PRECIOS ($)</label>
                      <select
                        value={pdfRoundStep}
                        onChange={(e) => setPdfRoundStep(Number(e.target.value))}
                        style={styles.input}
                      >
                        <option value={1}>Exacto ($1)</option>
                        <option value={50}>$ 50 ARS</option>
                        <option value={100}>$ 100 ARS</option>
                        <option value={500}>$ 500 ARS</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginTop: '12px' }}>
                    <label style={styles.label}>TÍTULO DEL ENCABEZADO EN EL PDF (OPCIONAL)</label>
                    <input
                      type="text"
                      value={pdfCustomTitle}
                      onChange={(e) => setPdfCustomTitle(e.target.value)}
                      placeholder={
                        Number(pdfDiscountPct) > 0
                          ? `LISTA DE PRECIOS REVENTA (-${pdfDiscountPct}% OFF)`
                          : 'LISTA DE PRECIOS OFICIAL'
                      }
                      style={styles.input}
                    />
                  </div>

                  <div style={{ ...styles.checksRow, marginTop: '14px' }}>
                    {Number(pdfDiscountPct) > 0 && (
                      <label style={styles.checkLabel}>
                        <input
                          type="checkbox"
                          checked={pdfShowComparison}
                          onChange={(e) => setPdfShowComparison(e.target.checked)}
                        />
                        <span>Mostrar columna Precio Público junto al de Reventa</span>
                      </label>
                    )}
                    <label style={styles.checkLabel}>
                      <input
                        type="checkbox"
                        checked={pdfIncludeEsp}
                        onChange={(e) => setPdfIncludeEsp(e.target.checked)}
                      />
                      <span>Incluir trabajos a medida (códigos ESP-*)</span>
                    </label>
                  </div>

                  {/* Botón principal de descarga bien visible y destacado */}
                  <button
                    type="button"
                    onClick={() => {
                      generatePriceListPDF(products, {
                        discountPct: Number(pdfDiscountPct) || 0,
                        roundStep: pdfRoundStep,
                        onlyActive: true,
                        includeCustomEsp: pdfIncludeEsp,
                        showPublicComparison: pdfShowComparison,
                        customTitle: pdfCustomTitle,
                      });
                      setStatusMsg({
                        type: 'success',
                        text:
                          Number(pdfDiscountPct) > 0
                            ? `PDF de Lista Reventa (-${pdfDiscountPct}%) descargado correctamente.`
                            : 'PDF de Lista Oficial descargado correctamente.',
                      });
                    }}
                    style={{ ...styles.btnPrimary, width: '100%', marginTop: '18px' }}
                  >
                    <LinearIcon name="download" color="#FFFFFF" size={18} />
                    <span>
                      {Number(pdfDiscountPct) > 0
                        ? `Descargar PDF Lista Reventa (-${pdfDiscountPct}% OFF)`
                        : 'Descargar PDF Lista Oficial Completa'}
                    </span>
                  </button>
                </div>

                {/* Botón para desplegar/ocultar Vista Previa sin generar doble barra de scroll */}
                <div style={{ marginTop: '14px' }}>
                  <button
                    type="button"
                    onClick={() => setShowPdfPreview((v) => !v)}
                    style={{
                      ...styles.btnSecondary,
                      width: '100%',
                      justifyContent: 'space-between',
                      padding: '12px 18px',
                      borderRadius: '16px',
                      border: '1px solid #DFDED9',
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: '12px', color: '#495D56' }}>
                      {showPdfPreview
                        ? 'Ocultar vista previa de precios en pantalla'
                        : `Ver vista previa de precios en pantalla (${
                            Number(pdfDiscountPct) > 0
                              ? `con -${pdfDiscountPct}% aplicado`
                              : 'Lista Público'
                          })`}
                    </span>
                    <LinearIcon
                      name={showPdfPreview ? 'chevron-up' : 'chevron-down'}
                      color="#495D56"
                      size={16}
                    />
                  </button>

                  {showPdfPreview && (
                    <div style={styles.previewBox}>
                      {products
                        .filter((p) => {
                          const code = String(p.codigo || p.code || '').toUpperCase();
                          if (Number(p.activo ?? 1) === 0) return false;
                          if (!pdfIncludeEsp && code.startsWith('ESP-')) return false;
                          return true;
                        })
                        .map((p) => {
                          const code = p.codigo || p.code;
                          const name = p.descripcion || p.name;
                          const pubPrice = Number(p.precio ?? p.price ?? 0);
                          const pct = Math.max(0, Number(pdfDiscountPct) || 0);
                          const rawResale = pubPrice * (1 - pct / 100);
                          const resalePrice =
                            pct > 0
                              ? pdfRoundStep > 1
                                ? roundCommercial(rawResale, pdfRoundStep)
                                : Math.round(rawResale)
                              : pubPrice;

                          return (
                            <div key={code} style={styles.previewRow}>
                              <div style={{ flex: 1, paddingRight: '8px' }}>
                                <span
                                  style={{ fontWeight: 700, color: '#5E7358', marginRight: '6px' }}
                                >
                                  {code}
                                </span>
                                <span style={{ color: '#495D56' }}>{name}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {pct > 0 && (
                                  <span
                                    style={{
                                      fontSize: '12px',
                                      color: '#94A3B8',
                                      textDecoration: 'line-through',
                                    }}
                                  >
                                    ${pubPrice.toLocaleString('es-AR')}
                                  </span>
                                )}
                                <span
                                  style={{ fontWeight: 700, fontSize: '13px', color: '#8E1F52' }}
                                >
                                  ${resalePrice.toLocaleString('es-AR')}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  toolbar: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  btnPrimary: {
    background: '#FF5E5E',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '16px',
    padding: '14px 22px',
    fontWeight: 700,
    fontSize: '14px',
    fontFamily: 'Inter, sans-serif',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    boxShadow: '0 4px 14px rgba(255, 94, 94, 0.25)',
  },
  btnSecondary: {
    background: '#F4F1E1',
    color: '#495D56',
    border: 'none',
    borderRadius: '20px',
    padding: '12px 20px',
    fontWeight: 600,
    fontSize: '14px',
    fontFamily: 'Inter, sans-serif',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
  },
  btnDangerPill: {
    background: '#FEE2E2',
    color: '#991B1B',
    border: '1px solid #FECACA',
    borderRadius: '10px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 700,
    fontFamily: 'Inter, sans-serif',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  iconActionBtn: {
    background: '#F4F1E1',
    border: 'none',
    borderRadius: '12px',
    padding: '0 12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeAlert: {
    background: '#FF5E5E',
    color: '#FFFFFF',
    borderRadius: '999px',
    padding: '2px 7px',
    fontSize: '11px',
    fontWeight: 700,
  },
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(75, 59, 40, 0.45)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '32px 16px',
    overflowY: 'auto',
  },
  modal: {
    background: '#FAF9F6',
    borderRadius: '28px',
    maxWidth: '680px',
    width: '100%',
    padding: '28px',
    boxShadow: '0 20px 50px rgba(0,0,0,0.16)',
    border: '1px solid #E5E0D0',
    fontFamily: 'Inter, sans-serif',
    margin: 'auto 0',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '18px',
  },
  title: {
    margin: 0,
    color: '#FF5E5E',
    fontSize: '22px',
    fontWeight: 800,
  },
  subtitle: {
    margin: '4px 0 0 0',
    color: '#998E55',
    fontSize: '13px',
    fontWeight: 400,
  },
  closeBtn: {
    background: '#F4F1E1',
    border: 'none',
    width: '36px',
    height: '36px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  tabs: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '6px',
    marginBottom: '20px',
    background: '#F4F1E1',
    padding: '5px',
    borderRadius: '18px',
  },
  tab: {
    background: 'transparent',
    border: 'none',
    padding: '10px 8px',
    borderRadius: '14px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#495D56',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontFamily: 'Inter, sans-serif',
    whiteSpace: 'nowrap',
  },
  tabActive: {
    background: '#FF5E5E',
    border: 'none',
    padding: '10px 8px',
    borderRadius: '14px',
    fontSize: '12px',
    fontWeight: 700,
    color: '#FFFFFF',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontFamily: 'Inter, sans-serif',
    whiteSpace: 'nowrap',
    boxShadow: '0 2px 8px rgba(255, 94, 94, 0.25)',
  },
  statusBanner: {
    padding: '12px 16px',
    borderRadius: '16px',
    marginBottom: '16px',
    fontSize: '13px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  grid3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
  },
  label: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 700,
    color: '#998E55',
    marginBottom: '6px',
    letterSpacing: '0.02em',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid #DFDED9',
    background: '#FFFFFF',
    fontSize: '14px',
    color: '#495D56',
    boxSizing: 'border-box',
    outline: 'none',
    fontFamily: 'Inter, sans-serif',
  },
  checksRow: {
    display: 'flex',
    gap: '16px',
    marginTop: '12px',
    flexWrap: 'wrap',
  },
  checkLabel: {
    fontSize: '13px',
    color: '#495D56',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  resultCard: {
    background: '#FFFFFF',
    borderRadius: '24px',
    padding: '20px',
    marginTop: '16px',
    textAlign: 'center',
    border: '1px solid #DFDED9',
    boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
  },
  resultMeta: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#495D56',
    flexWrap: 'wrap',
  },
  pillCode: {
    background: '#F4F1E1',
    color: '#998E55',
    padding: '4px 12px',
    borderRadius: '20px',
    fontWeight: 700,
    fontSize: '11px',
  },
  ruleSub: {
    fontSize: '12px',
    color: '#998E55',
    marginTop: '6px',
  },
  bigPrice: {
    fontSize: '30px',
    fontWeight: 600,
    color: '#8E1F52',
    margin: '10px 0',
  },
  requoteBadge: {
    background: '#FEE2E2',
    color: '#991B1B',
    padding: '8px 14px',
    borderRadius: '14px',
    fontSize: '12px',
    fontWeight: 700,
    marginTop: '8px',
    display: 'inline-block',
  },
  freightBox: {
    marginTop: '14px',
    paddingTop: '12px',
    borderTop: '1px solid #F0F0F0',
  },
  okBox: {
    background: '#DCFCE7',
    padding: '16px 20px',
    borderRadius: '20px',
    color: '#166534',
    fontWeight: 600,
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  anomalyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  anomalyItem: {
    background: '#FFFFFF',
    padding: '14px 18px',
    borderRadius: '20px',
    border: '1px solid #DFDED9',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
  },
  previewBox: {
    background: '#FFFFFF',
    borderRadius: '20px',
    padding: '16px',
    marginTop: '12px',
    border: '1px solid #DFDED9',
  },
  previewRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '13px',
    padding: '9px 0',
    borderBottom: '1px solid #F8F7F3',
  },
};

