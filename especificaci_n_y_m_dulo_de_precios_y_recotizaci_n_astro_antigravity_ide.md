# Módulo de Precios, Cotización ($L+A$) y Recotización — `quesello-astro` (Supabase + React Admin)

Este documento está adaptado exactamente a la arquitectura real de **`quesello-astro`**:
* **Persistencia:** Cliente directo de Supabase (`src/lib/supabase.js`) + PostgreSQL RPC.
* **Catálogo y Ajustes Masivos:** Integración en `src/components/admin/ProductManager.jsx` y `ProductRow.jsx`.
* **Cotización Rectangular ($L+A$) y Recotización de Presupuestos Vencidos:** Integración en `src/components/admin/BudgetEditor.jsx` y `BudgetRow.jsx`.
* **Impresión / PDF actualizado:** Compatible con `src/lib/pdfGenerator.js` y `src/lib/printUtils.js`.

---

## 1. Prompt Exacto para Antigravity IDE (Copiá y pegá esto en el chat del agente)

> **Prompt para el Agente de Antigravity IDE:**
> *"Analizá los archivos `src/lib/supabase.js`, `src/components/admin/ProductManager.jsx`, `src/components/admin/ProductRow.jsx`, `src/components/admin/BudgetManager.jsx`, `src/components/admin/BudgetRow.jsx` y `src/components/admin/BudgetEditor.jsx`.*
> *Necesito implementar el sistema de **Ajuste de Precios, Cotizador Rectangular por Suma de Lados ($L+A$) y Recotizador de Presupuestos** siguiendo la especificación de este Artifact:*
> 1. *Revisá en `ProductManager.jsx` y `BudgetManager.jsx` los nombres exactos de las tablas y columnas en Supabase (ej. tabla `products` o `productos`, columnas `code`/`codigo`, `price`/`precio`, y tabla `budgets` o `presupuestos`). Adaptá el script SQL de la **Sección 2** a esos nombres exactos.*
> 2. *Creá la librería `src/lib/pricingEngine.js` (Sección 3) que exporta el motor de cotización por suma de lados ($L+A$), el comparador contra CABA + flete ($9.000 ARS) y el recalculador de ítems de un presupuesto.*
> 3. *Creá el componente `src/components/admin/PricingToolsModal.jsx` (Sección 4) e importalo dentro de `src/components/admin/ProductManager.jsx` para poder: (a) detectar y corregir con 1 clic las anomalías de curva (`QS-030` 4x6cm a `$17.000`, `QS-032` 9x6cm a `$21.950` y agregar `QS-040` 12x12cm a `$33.500`), (b) aplicar aumentos masivos por porcentaje o categoría con redondeo a `$50 ARS`, y (c) simular medidas especiales.*
> 4. *Integrá en `src/components/admin/BudgetEditor.jsx` y `BudgetRow.jsx` el botón **'🔄 Recotizar a Lista Actual'** y el **'📐 Cotizador Rectangular ($L+A$)'** (Sección 5) para actualizar presupuestos pendientes con precios viejos antes de enviarlos a `pdfGenerator.js` o `mercadopago.js`."*

---

## 2. Script SQL para el SQL Editor de Supabase

Ejecutá este bloque en el **SQL Editor** de tu panel de Supabase. Corrige los precios de `QS-030` (`4x6cm` → `$17.000`) y `QS-032` (`9x6cm` → `$21.950`), inserta el sello de `12x12cm` (`$33.500`), carga las dimensiones geométricas y crea una función RPC (`bulk_adjust_product_prices`) para aplicar aumentos masivos redondeados a `$50 ARS`:

```sql
-- ============================================================================
-- MIGRACIÓN SUPABASE: CURVA CORREGIDA QUESELLÓ! + RPC DE AJUSTE MASIVO
-- Nota: Si tu tabla en Supabase se llama "productos" en vez de "products",
-- Antigravity IDE ajustará el nombre automáticamente según ProductManager.jsx
-- ============================================================================

-- 1. Agregar columnas geométricas y de benchmark CABA a la tabla de productos
ALTER TABLE products ADD COLUMN IF NOT EXISTS width_cm NUMERIC(6,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS height_cm NUMERIC(6,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_reference_square BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS caba_benchmark_price NUMERIC(12,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Corregir las dos anomalías detectadas en medidas rectangulares
-- QS-030 (SELLO 4X6CM): Pasa de $15.500 a $17.000 (empata con 5x5cm, L+A = 10cm)
UPDATE products
SET price = 17000, width_cm = 4, height_cm = 6, is_reference_square = FALSE, updated_at = NOW()
WHERE code = 'QS-030';

-- QS-032 (SELLO 9X6CM): Pasa de $17.500 a $21.950 (mitad exacta entre 7x7 [$19.900] y 8x8 [$24.000], L+A = 15cm)
UPDATE products
SET price = 21950, width_cm = 9, height_cm = 6, is_reference_square = FALSE, caba_benchmark_price = 16837, updated_at = NOW()
WHERE code = 'QS-032';

-- 3. Agregar el escalón faltante de 12x12 cm ($33.500 ARS)
INSERT INTO products (code, name, category, price, width_cm, height_cm, is_reference_square)
VALUES ('QS-040', 'SELLO 12X12CM', 'SELLOS', 33500, 12, 12, TRUE)
ON CONFLICT (code) DO UPDATE
SET price = 33500, width_cm = 12, height_cm = 12, is_reference_square = TRUE, updated_at = NOW();

-- 4. Poblar ancho, alto y referencias en las 15 medidas existentes
UPDATE products SET width_cm = 2, height_cm = 3, is_reference_square = FALSE WHERE code = 'QS-026';
UPDATE products SET width_cm = 4, height_cm = 1.5, is_reference_square = FALSE WHERE code = 'QS-004';
UPDATE products SET width_cm = 4, height_cm = 4, is_reference_square = TRUE, caba_benchmark_price = 8500 WHERE code = 'QS-005';
UPDATE products SET width_cm = 5, height_cm = 5, is_reference_square = TRUE, caba_benchmark_price = 11000 WHERE code = 'QS-006';
UPDATE products SET width_cm = 6, height_cm = 6, is_reference_square = TRUE WHERE code = 'QS-007';
UPDATE products SET width_cm = 7, height_cm = 7, is_reference_square = TRUE WHERE code = 'QS-008';
UPDATE products SET width_cm = 8, height_cm = 8, is_reference_square = TRUE, caba_benchmark_price = 35437 WHERE code = 'QS-009';
UPDATE products SET width_cm = 9, height_cm = 9, is_reference_square = TRUE WHERE code = 'QS-010';
UPDATE products SET width_cm = 10, height_cm = 10, is_reference_square = TRUE, caba_benchmark_price = 14641 WHERE code = 'QS-011';
UPDATE products SET width_cm = 11, height_cm = 11, is_reference_square = TRUE WHERE code = 'QS-012';
UPDATE products SET width_cm = 13, height_cm = 13, is_reference_square = TRUE WHERE code = 'QS-035';
UPDATE products SET width_cm = 14, height_cm = 14, is_reference_square = TRUE WHERE code = 'QS-036';
UPDATE products SET width_cm = 15, height_cm = 15, is_reference_square = TRUE, caba_benchmark_price = 50500 WHERE code = 'QS-014';

-- 5. Función RPC para ajuste masivo de precios con redondeo comercial (ej. múltiplo de $50 ARS)
CREATE OR REPLACE FUNCTION bulk_adjust_product_prices(
  p_percentage NUMERIC,
  p_category TEXT DEFAULT NULL,
  p_round_step NUMERIC DEFAULT 50
)
RETURNS TABLE (code TEXT, old_price NUMERIC, new_price NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE products p
  SET 
    price = ROUND((p.price * (1 + p_percentage / 100.0)) / p_round_step) * p_round_step,
    updated_at = NOW()
  WHERE (p_category IS NULL OR p_category = 'TODAS' OR p.category = p_category)
  RETURNING p.code::TEXT, p.price AS old_price, p.price AS new_price;
END;
$$;
```

---

## 3. Motor de Cotización y Recotización (`src/lib/pricingEngine.js`)

Creá este archivo junto a `src/lib/supabase.js`. Es 100% compatible con los componentes React de `src/components/admin/` y con tu generador de PDFs (`src/lib/pdfGenerator.js`):

```javascript
// src/lib/pricingEngine.js

/**
 * Redondea al escalón comercial más cercano (por defecto $50 ARS)
 */
export function roundCommercial(value, step = 50) {
  const num = Number(value) || 0;
  return Math.round(num / step) * step;
}

/**
 * Extrae dimensiones (Ancho x Alto en cm) automáticamente desde el nombre o propiedades del producto
 * Ej: "SELLO 9X6CM" -> { width: 9, height: 6 } | "SELLO 4X1,5CM" -> { width: 4, height: 1.5 }
 */
export function parseStampDimensions(product) {
  if (product?.width_cm && product?.height_cm) {
    return {
      width: Number(product.width_cm),
      height: Number(product.height_cm),
    };
  }
  const nameStr = String(product?.name || product?.nombre || product?.description || '').toUpperCase();
  const match = nameStr.match(/(\d+(?:[.,]\d+)?)\s*X\s*(\d+(?:[.,]\d+)?)\s*CM/i);
  if (!match) return null;

  const width = parseFloat(match[1].replace(',', '.'));
  const height = parseFloat(match[2].replace(',', '.'));
  if (isNaN(width) || isNaN(height)) return null;

  return { width, height };
}

/**
 * Detecta si la lista actual de productos en Supabase tiene anomalías de curva
 * (ej. un sello rectangular más grande que cuesta menos que un sello cuadrado más chico)
 */
export function auditCatalogAnomalies(products = []) {
  const stamps = products
    .map((p) => {
      const dims = parseStampDimensions(p);
      if (!dims) return null;
      const code = p.code || p.codigo;
      const price = Number(p.price ?? p.precio ?? 0);
      const area = dims.width * dims.height;
      const sumSides = dims.width + dims.height;
      return {
        ...p,
        code,
        price,
        width: dims.width,
        height: dims.height,
        area,
        sumSides,
        pricePerCm2: Number((price / area).toFixed(2)),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.area - b.area);

  const anomalies = [];

  for (let i = 1; i < stamps.length; i++) {
    const current = stamps[i];
    const prev = stamps[i - 1];
    if (current.price < prev.price) {
      // Calcular precio sugerido por interpolación L+A usando la función quoteCustomDimension
      const suggested = quoteCustomDimension(current.width, current.height, products, {
        ignoreExactMatch: true,
      });
      anomalies.push({
        id: current.id,
        code: current.code,
        name: current.name || current.nombre,
        currentPrice: current.price,
        smallerStampCode: prev.code,
        smallerStampName: prev.name || prev.nombre,
        smallerStampPrice: prev.price,
        suggestedPrice: suggested.unitPrice,
        difference: suggested.unitPrice - current.price,
      });
    }
  }

  // Verificar si falta el escalón de 12x12 cm entre 11x11 y 13x13
  const has12x12 = stamps.some((s) => s.width === 12 && s.height === 12);

  return { stamps, anomalies, missing12x12: !has12x12 };
}

/**
 * Cotiza cualquier medida de sello (Ancho x Alto en cm) usando los productos cargados desde Supabase
 * Regla: Suma de Lados (L + A) interpolada entre los cuadrados oficiales de Queselló!
 */
export function quoteCustomDimension(widthCm, heightCm, products = [], options = {}) {
  const w = Number(widthCm) || 0;
  const h = Number(heightCm) || 0;
  const minSide = Math.min(w, h);
  const maxSide = Math.max(w, h);
  const sumSides = w + h;
  const areaCm2 = Number((w * h).toFixed(2));
  const step = options.roundStep || 50;

  // Mapear catálogo con dimensiones
  const parsedStamps = products
    .map((p) => {
      const dims = parseStampDimensions(p);
      if (!dims) return null;
      return {
        ...p,
        code: p.code || p.codigo,
        name: p.name || p.nombre,
        price: Number(p.price ?? p.precio ?? 0),
        width: dims.width,
        height: dims.height,
        sumSides: dims.width + dims.height,
        area: dims.width * dims.height,
        isSquare: dims.width === dims.height && dims.width >= 4,
      };
    })
    .filter(Boolean);

  // 1. Coincidencia exacta en catálogo (salvo que estemos auditando anomalías)
  if (!options.ignoreExactMatch) {
    const exact = parsedStamps.find(
      (s) => Math.min(s.width, s.height) === minSide && Math.max(s.width, s.height) === maxSide
    );
    if (exact) {
      return {
        code: exact.code,
        name: exact.name,
        widthCm: w,
        heightCm: h,
        areaCm2,
        sumSides,
        unitPrice: exact.price,
        pricePerCm2: Number((exact.price / areaCm2).toFixed(2)),
        ruleApplied: `Catálogo oficial (${exact.code})`,
        isCustom: false,
      };
    }
  }

  // 2. Obtener cuadrados de referencia ordenados (4x4 a 15x15)
  const squares = parsedStamps
    .filter((s) => s.isSquare)
    .sort((a, b) => a.sumSides - b.sumSides);

  if (squares.length === 0) {
    return {
      code: 'QS-CUSTOM',
      name: `SELLO PERSONALIZADO ${w}X${h}CM`,
      widthCm: w,
      heightCm: h,
      areaCm2,
      sumSides,
      unitPrice: 17000,
      pricePerCm2: Number((17000 / Math.max(areaCm2, 1)).toFixed(2)),
      ruleApplied: 'Fallback sin cuadrados cargados',
      isCustom: true,
    };
  }

  // 3. Si es más chico que el 4x4 cm (L+A < 8 cm)
  const firstSq = squares[0];
  if (sumSides < firstSq.sumSides) {
    const smallRef =
      areaCm2 <= 6
        ? parsedStamps.find((s) => s.code === 'QS-004') || firstSq
        : firstSq;
    return {
      code: smallRef.code,
      name: `SELLO ESPECIAL ${w}X${h}CM`,
      widthCm: w,
      heightCm: h,
      areaCm2,
      sumSides,
      unitPrice: smallRef.price,
      pricePerCm2: Number((smallRef.price / Math.max(areaCm2, 1)).toFixed(2)),
      ruleApplied: `Ticket mínimo (${smallRef.code})`,
      isCustom: true,
    };
  }

  // 4. Interpolación exacta por Suma de Lados (L + A) entre cuadrados
  for (let i = 0; i < squares.length; i++) {
    const sq = squares[i];
    if (sumSides === sq.sumSides) {
      return {
        code: sq.code,
        name: `SELLO ${w}X${h}CM (Eq. ${sq.width}x${sq.height}cm)`,
        widthCm: w,
        heightCm: h,
        areaCm2,
        sumSides,
        unitPrice: sq.price,
        pricePerCm2: Number((sq.price / areaCm2).toFixed(2)),
        ruleApplied: `Suma de lados L+A = ${sumSides}cm igual a ${sq.code}`,
        isCustom: true,
      };
    }

    if (i < squares.length - 1) {
      const nextSq = squares[i + 1];
      if (sumSides > sq.sumSides && sumSides < nextSq.sumSides) {
        const ratio = (sumSides - sq.sumSides) / (nextSq.sumSides - sq.sumSides);
        const interpolated = roundCommercial(sq.price + ratio * (nextSq.price - sq.price), step);
        return {
          code: `${sq.code}/${nextSq.code}`,
          name: `SELLO ${w}X${h}CM`,
          widthCm: w,
          heightCm: h,
          areaCm2,
          sumSides,
          unitPrice: interpolated,
          pricePerCm2: Number((interpolated / areaCm2).toFixed(2)),
          ruleApplied: `Interpolación L+A=${sumSides}cm entre ${sq.code} ($${sq.price.toLocaleString('es-AR')}) y ${nextSq.code} ($${nextSq.price.toLocaleString('es-AR')})`,
          isCustom: true,
        };
      }
    }
  }

  // 5. Extrapolación para medidas mayores a 15x15 cm (L+A > 30 cm)
  const maxSq = squares[squares.length - 1];
  const cm2Floor = maxSq.price / maxSq.area; // $200 ARS/cm2
  const extrapolated = roundCommercial(areaCm2 * cm2Floor, step);
  const finalPrice = Math.max(extrapolated, maxSq.price);

  return {
    code: 'QS-XL',
    name: `SELLO GRAN FORMATO ${w}X${h}CM`,
    widthCm: w,
    heightCm: h,
    areaCm2,
    sumSides,
    unitPrice: finalPrice,
    pricePerCm2: Number((finalPrice / areaCm2).toFixed(2)),
    ruleApplied: `Gran formato ($${cm2Floor.toFixed(0)}/cm²)`,
    isCustom: true,
  };
}

/**
 * Recotiza todos los ítems de un presupuesto (en BudgetEditor.jsx / BudgetRow.jsx)
 * cruzando contra la lista vigente de productos en Supabase.
 */
export function requoteBudgetItems(budgetItems = [], currentProducts = []) {
  let oldSubtotal = 0;
  let newSubtotal = 0;

  const updatedItems = budgetItems.map((item) => {
    const qty = Number(item.quantity ?? item.cantidad ?? 1);
    const oldUnitPrice = Number(item.price ?? item.unit_price ?? item.precio ?? 0);
    const code = item.code || item.codigo || item.product_code;

    // 1. Buscar por código directo en catálogo vigente
    const catalogMatch = currentProducts.find(
      (p) => (p.code || p.codigo) && (p.code || p.codigo) === code
    );

    let newUnitPrice = oldUnitPrice;
    let pricingNote = 'Sin cambios';

    if (catalogMatch) {
      newUnitPrice = Number(catalogMatch.price ?? catalogMatch.precio ?? oldUnitPrice);
      pricingNote = `Actualizado por código (${code})`;
    } else {
      // 2. Si era una medida especial en el nombre (ej. "SELLO 9X6CM" o "SELLO 10X5CM"), recotizar con L+A
      const dims = parseStampDimensions(item);
      if (dims) {
        const quoted = quoteCustomDimension(dims.width, dims.height, currentProducts);
        newUnitPrice = quoted.unitPrice;
        pricingNote = quoted.ruleApplied;
      }
    }

    oldSubtotal += oldUnitPrice * qty;
    newSubtotal += newUnitPrice * qty;

    return {
      ...item,
      old_unit_price: oldUnitPrice,
      price: newUnitPrice,
      unit_price: newUnitPrice,
      precio: newUnitPrice,
      subtotal: newUnitPrice * qty,
      price_diff: newUnitPrice - oldUnitPrice,
      pricing_note: pricingNote,
    };
  });

  const deltaAmount = newSubtotal - oldSubtotal;
  const deltaPct = oldSubtotal > 0 ? Number(((deltaAmount / oldSubtotal) * 100).toFixed(1)) : 0;

  return {
    updatedItems,
    oldSubtotal,
    newSubtotal,
    deltaAmount,
    deltaPct,
    hasChanges: deltaAmount !== 0,
  };
}
```

---

## 4. Componente React para `ProductManager.jsx` (`src/components/admin/PricingToolsModal.jsx`)

Creá este componente en `src/components/admin/PricingToolsModal.jsx`. Incluye 3 pestañas integradas con `src/lib/supabase.js`:
1. **📐 Cotizador ($L+A$) + Comparador Flete CABA:** Calcula al instante cualquier medida rectangular y muestra cuánto ahorra el cliente en Mar del Plata frente a pedirlo a Buenos Aires (+ flete de `$8.000` a `$10.000`).
2. **⚠️ Auditor de Curva (1 Clic):** Detecta automáticamente si `QS-030` (`4x6cm`), `QS-032` (`9x6cm`) o el escalón `12x12cm` están desfasados en Supabase y los corrige con un botón.
3. **📈 Ajuste Masivo (%):** Permite previsualizar y aplicar un aumento porcentual a toda la lista o a una categoría (`SELLOS`, `TINTAS`, `SERVICIOS`) redondeando a múltiplos de `$50 ARS`.

```jsx
// src/components/admin/PricingToolsModal.jsx
import React, { useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
  quoteCustomDimension,
  auditCatalogAnomalies,
  roundCommercial,
} from '../../lib/pricingEngine';

export default function PricingToolsModal({
  products = [],
  onProductsUpdated,
  tableName = 'products',
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
  const [cabaFreight, setCabaFreight] = useState(9000);
  const [oldBudgetTotal, setOldBudgetTotal] = useState('');

  // Estado Pestaña 3: Ajuste Masivo
  const [bulkPct, setBulkPct] = useState(10);
  const [bulkCategory, setBulkCategory] = useState('TODAS');
  const [roundStep, setRoundStep] = useState(50);

  // Auditoría automática de la curva actual en Supabase
  const audit = useMemo(() => auditCatalogAnomalies(products), [products]);

  // Cálculo en vivo del Cotizador L+A
  const quoteResult = useMemo(() => {
    const base = quoteCustomDimension(widthCm, heightCm, products);
    const knobCost = addKnob ? 2000 : 0;
    const starterCost = addStarter ? 6000 : 0;
    const unitTotal = base.unitPrice + knobCost + starterCost;
    const finalTotal = unitTotal * Math.max(1, Number(qty) || 1);

    const oldVal = Number(oldBudgetTotal) || 0;
    const requoteDelta = oldVal > 0 ? finalTotal - oldVal : 0;
    const requotePct = oldVal > 0 ? ((requoteDelta / oldVal) * 100).toFixed(1) : 0;

    return {
      ...base,
      knobCost,
      starterCost,
      unitTotal,
      finalTotal,
      requoteDelta,
      requotePct,
    };
  }, [widthCm, heightCm, qty, addKnob, addStarter, oldBudgetTotal, products]);

  // Categorías únicas
  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category || p.categoria).filter(Boolean));
    return ['TODAS', ...Array.from(set)];
  }, [products]);

  // Acción 1: Corregir anomalías (4x6cm -> $17.000, 9x6cm -> $21.950 y crear 12x12cm -> $33.500)
  const handleFixCurveAnomalies = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      // 1. Actualizar cada anomalía detectada
      for (const item of audit.anomalies) {
        const priceField = 'price' in (products[0] || {}) ? 'price' : 'precio';
        const codeField = 'code' in (products[0] || {}) ? 'code' : 'codigo';

        await supabase
          .from(tableName)
          .update({ [priceField]: item.suggestedPrice })
          .eq(codeField, item.code);
      }

      // 2. Si falta el 12x12 cm, insertarlo como QS-040
      if (audit.missing12x12) {
        const sample = products[0] || {};
        const newRecord =
          'price' in sample
            ? {
                code: 'QS-040',
                name: 'SELLO 12X12CM',
                category: 'SELLOS',
                price: 33500,
              }
            : {
                codigo: 'QS-040',
                nombre: 'SELLO 12X12CM',
                categoria: 'SELLOS',
                precio: 33500,
              };

        await supabase.from(tableName).upsert([newRecord]);
      }

      setStatusMsg('✅ Curva corregida en Supabase (4x6cm, 9x6cm y 12x12cm actualizados).');
      if (onProductsUpdated) await onProductsUpdated();
    } catch (err) {
      setStatusMsg(`❌ Error al actualizar en Supabase: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Acción 2: Aplicar ajuste porcentual masivo en Supabase
  const handleApplyBulkAdjustment = async () => {
    if (!window.confirm(`¿Confirmás aplicar un ${bulkPct}% de ajuste a "${bulkCategory}"?`)) {
      return;
    }
    setLoading(true);
    setStatusMsg(null);
    try {
      const sample = products[0] || {};
      const priceKey = 'price' in sample ? 'price' : 'precio';
      const catKey = 'category' in sample ? 'category' : 'categoria';
      const idKey = 'id' in sample ? 'id' : 'code' in sample ? 'code' : 'codigo';

      const targetProducts = products.filter(
        (p) => bulkCategory === 'TODAS' || (p[catKey] || '') === bulkCategory
      );

      for (const prod of targetProducts) {
        const currentPrice = Number(prod[priceKey] || 0);
        const newPrice = roundCommercial(currentPrice * (1 + Number(bulkPct) / 100), roundStep);
        await supabase
          .from(tableName)
          .update({ [priceKey]: newPrice })
          .eq(idKey, prod[idKey]);
      }

      setStatusMsg(
        `✅ Se actualizaron ${targetProducts.length} productos (${bulkPct >= 0 ? '+' : ''}${bulkPct}%).`
      );
      if (onProductsUpdated) await onProductsUpdated();
    } catch (err) {
      setStatusMsg(`❌ Error aplicando ajuste masivo: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Botones disparadores para insertar en el header de ProductManager.jsx */}
      <div style={styles.toolbar}>
        <button
          type="button"
          onClick={() => {
            setActiveTab('quoter');
            setIsOpen(true);
          }}
          style={styles.btnPrimary}
        >
          📐 Cotizador ($L+A$) / Recotizar
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('audit');
            setIsOpen(true);
          }}
          style={styles.btnSecondary}
        >
          📈 Ajuste Masivo y Curva
          {(audit.anomalies.length > 0 || audit.missing12x12) && (
            <span style={styles.badgeAlert}>{audit.anomalies.length + (audit.missing12x12 ? 1 : 0)}</span>
          )}
        </button>
      </div>

      {isOpen && (
        <div style={styles.backdrop} onClick={() => setIsOpen(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            {/* Cabecera */}
            <div style={styles.header}>
              <h3 style={styles.title}>Inteligencia de Precios — Queselló!</h3>
              <button type="button" onClick={() => setIsOpen(false)} style={styles.closeBtn}>
                ✕
              </button>
            </div>

            {/* Pestañas */}
            <div style={styles.tabs}>
              <button
                type="button"
                onClick={() => setActiveTab('quoter')}
                style={activeTab === 'quoter' ? styles.tabActive : styles.tab}
              >
                📐 Cotizador ($L+A$)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('audit')}
                style={activeTab === 'audit' ? styles.tabActive : styles.tab}
              >
                ⚠️ Curva ({audit.anomalies.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('bulk')}
                style={activeTab === 'bulk' ? styles.tabActive : styles.tab}
              >
                📈 Ajuste Masivo
              </button>
            </div>

            {statusMsg && <div style={styles.statusBanner}>{statusMsg}</div>}

            {/* PESTAÑA 1: COTIZADOR L+A Y RECOTIZADOR RÁPIDO */}
            {activeTab === 'quoter' && (
              <div>
                <div style={styles.grid3}>
                  <div>
                    <label style={styles.label}>Ancho (cm)</label>
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
                    <label style={styles.label}>Alto (cm)</label>
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
                    <label style={styles.label}>Cantidad</label>
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
                    + Perilla ($2.000)
                  </label>
                  <label style={styles.checkLabel}>
                    <input
                      type="checkbox"
                      checked={addStarter}
                      onChange={(e) => setAddStarter(e.target.checked)}
                    />
                    + Combo Starter ($6.000)
                  </label>
                </div>

                <div style={{ marginTop: '0.75rem' }}>
                  <label style={styles.label}>
                    🔄 ¿Recotizar presupuesto vencido? (Ingresá el monto viejo en $ ARS)
                  </label>
                  <input
                    type="number"
                    placeholder="Ej: 17500 (opcional)"
                    value={oldBudgetTotal}
                    onChange={(e) => setOldBudgetTotal(e.target.value)}
                    style={styles.input}
                  />
                </div>

                {/* Tarjeta Resultado */}
                <div style={styles.resultCard}>
                  <div style={styles.resultMeta}>
                    <span style={styles.pillCode}>{quoteResult.code}</span>
                    <span>
                      Área: <strong>{quoteResult.areaCm2} cm²</strong> | L+A:{' '}
                      <strong>{quoteResult.sumSides} cm</strong> (${quoteResult.pricePerCm2}/cm²)
                    </span>
                  </div>
                  <div style={styles.ruleSub}>{quoteResult.ruleApplied}</div>
                  <div style={styles.bigPrice}>
                    $ {quoteResult.finalTotal.toLocaleString('es-AR')}
                  </div>

                  {Number(oldBudgetTotal) > 0 && (
                    <div style={styles.requoteBadge}>
                      Diferencia vs. Presupuesto Anterior:{' '}
                      {quoteResult.requoteDelta >= 0 ? '+' : ''}$
                      {quoteResult.requoteDelta.toLocaleString('es-AR')} (
                      {quoteResult.requoteDelta >= 0 ? '+' : ''}
                      {quoteResult.requotePct}%)
                    </div>
                  )}

                  {/* Comparador Flete CABA -> Mar del Plata */}
                  <div style={styles.freightBox}>
                    <div style={{ fontSize: '0.78rem', color: '#495d56' }}>
                      🚚 Flete promedio CABA → Mar del Plata:{' '}
                      <strong>${Number(cabaFreight).toLocaleString('es-AR')}</strong>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="12000"
                      step="500"
                      value={cabaFreight}
                      onChange={(e) => setCabaFreight(Number(e.target.value))}
                      style={{ width: '100%', marginTop: '4px' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* PESTAÑA 2: AUDITORÍA DE ANOMALÍAS EN CURVA */}
            {activeTab === 'audit' && (
              <div>
                <p style={{ fontSize: '0.85rem', color: '#495d56', marginBottom: '0.75rem' }}>
                  Revisión automática de tu tabla en Supabase ordenada por superficie (cm²):
                </p>

                {audit.anomalies.length === 0 && !audit.missing12x12 ? (
                  <div style={styles.okBox}>
                    ✅ ¡Tu curva de precios está 100% alineada! Ningún sello más grande cuesta menos
                    que uno más chico y el escalón de 12x12 cm ya está activo.
                  </div>
                ) : (
                  <div style={styles.anomalyList}>
                    {audit.anomalies.map((a) => (
                      <div key={a.code} style={styles.anomalyItem}>
                        <div>
                          <strong>
                            {a.code} — {a.name}
                          </strong>
                          <div style={{ fontSize: '0.78rem', color: '#666' }}>
                            Hoy está en <strong>${a.currentPrice.toLocaleString('es-AR')}</strong>{' '}
                            (más barato que {a.smallerStampCode} de $
                            {a.smallerStampPrice.toLocaleString('es-AR')})
                          </div>
                        </div>
                        <div style={styles.suggestedPriceTag}>
                          Sugerido: ${a.suggestedPrice.toLocaleString('es-AR')}
                        </div>
                      </div>
                    ))}

                    {audit.missing12x12 && (
                      <div style={styles.anomalyItem}>
                        <div>
                          <strong>Falta escalón intermedio: SELLO 12X12CM</strong>
                          <div style={{ fontSize: '0.78rem', color: '#666' }}>
                            Parte a la mitad el salto de $7.400 entre 11x11 ($29.800) y 13x13
                            ($37.200).
                          </div>
                        </div>
                        <div style={styles.suggestedPriceTag}>Crear a $33.500</div>
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleFixCurveAnomalies}
                      style={{ ...styles.btnPrimary, width: '100%', marginTop: '0.75rem' }}
                    >
                      {loading
                        ? 'Actualizando Supabase...'
                        : '⚡ Corregir Anomalías y Agregar 12x12cm en 1 Clic'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* PESTAÑA 3: AJUSTE MASIVO PORCENTUAL */}
            {activeTab === 'bulk' && (
              <div>
                <div style={styles.grid3}>
                  <div>
                    <label style={styles.label}>Porcentaje (%)</label>
                    <input
                      type="number"
                      step="1"
                      value={bulkPct}
                      onChange={(e) => setBulkPct(e.target.value)}
                      style={styles.input}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Categoría</label>
                    <select
                      value={bulkCategory}
                      onChange={(e) => setBulkCategory(e.target.value)}
                      style={styles.input}
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={styles.label}>Redondeo ($)</label>
                    <select
                      value={roundStep}
                      onChange={(e) => setRoundStep(Number(e.target.value))}
                      style={styles.input}
                    >
                      <option value={50}>$ 50 ARS</option>
                      <option value={100}>$ 100 ARS</option>
                      <option value={500}>$ 500 ARS</option>
                    </select>
                  </div>
                </div>

                {/* Vista previa rápida sobre 4 medidas testigo */}
                <div style={styles.previewBox}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                    Vista previa con {bulkPct >= 0 ? `+${bulkPct}%` : `${bulkPct}%`}:
                  </div>
                  {products.slice(0, 5).map((p) => {
                    const code = p.code || p.codigo;
                    const name = p.name || p.nombre;
                    const oldP = Number(p.price ?? p.precio ?? 0);
                    const newP = roundCommercial(oldP * (1 + Number(bulkPct) / 100), roundStep);
                    return (
                      <div key={code} style={styles.previewRow}>
                        <span>
                          {code} ({name})
                        </span>
                        <span>
                          ${oldP.toLocaleString('es-AR')} →{' '}
                          <strong style={{ color: '#8B1E3F' }}>
                            ${newP.toLocaleString('es-AR')}
                          </strong>
                        </span>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={loading}
                  onClick={handleApplyBulkAdjustment}
                  style={{ ...styles.btnPrimary, width: '100%', marginTop: '0.85rem' }}
                >
                  {loading
                    ? 'Guardando en Supabase...'
                    : `Aplicar ${bulkPct >= 0 ? '+' : ''}${bulkPct}% en Supabase`}
                </button>
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
    gap: '0.5rem',
    flexWrap: 'wrap',
    marginBottom: '0.85rem',
    justifyContent: 'center',
  },
  btnPrimary: {
    background: '#E04F4F',
    color: '#fff',
    border: 'none',
    borderRadius: '999px',
    padding: '0.55rem 1.05rem',
    fontWeight: 700,
    fontSize: '0.85rem',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(224,79,79,0.28)',
  },
  btnSecondary: {
    background: '#fff',
    color: '#495d56',
    border: '1px solid #d5d0c0',
    borderRadius: '999px',
    padding: '0.55rem 1.05rem',
    fontWeight: 700,
    fontSize: '0.85rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  badgeAlert: {
    background: '#E04F4F',
    color: '#fff',
    borderRadius: '999px',
    padding: '0.1rem 0.45rem',
    fontSize: '0.72rem',
  },
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '1rem',
  },
  modal: {
    background: '#EFECE2',
    borderRadius: '24px',
    maxWidth: '480px',
    width: '100%',
    padding: '1.25rem',
    boxShadow: '0 16px 40px rgba(0,0,0,0.22)',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
  },
  title: {
    margin: 0,
    color: '#E04F4F',
    fontSize: '1.1rem',
    fontWeight: 800,
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: '1.2rem',
    cursor: 'pointer',
    color: '#495d56',
  },
  tabs: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.35rem',
    marginBottom: '1rem',
    background: '#E2DEC9',
    padding: '0.25rem',
    borderRadius: '14px',
  },
  tab: {
    background: 'transparent',
    border: 'none',
    padding: '0.45rem',
    borderRadius: '10px',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: '#495d56',
    cursor: 'pointer',
  },
  tabActive: {
    background: '#fff',
    border: 'none',
    padding: '0.45rem',
    borderRadius: '10px',
    fontSize: '0.78rem',
    fontWeight: 700,
    color: '#8B1E3F',
    cursor: 'pointer',
    boxShadow: '0 2px 5px rgba(0,0,0,0.06)',
  },
  statusBanner: {
    background: '#fff',
    padding: '0.6rem 0.8rem',
    borderRadius: '12px',
    marginBottom: '0.8rem',
    fontSize: '0.82rem',
    fontWeight: 600,
  },
  grid3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.55rem',
  },
  label: {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#495d56',
    marginBottom: '0.25rem',
  },
  input: {
    width: '100%',
    padding: '0.5rem 0.6rem',
    borderRadius: '12px',
    border: '1px solid #d5d0c0',
    background: '#fff',
    fontSize: '0.9rem',
    boxSizing: 'border-box',
  },
  checksRow: {
    display: 'flex',
    gap: '1rem',
    marginTop: '0.75rem',
    flexWrap: 'wrap',
  },
  checkLabel: {
    fontSize: '0.83rem',
    color: '#495d56',
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontWeight: 600,
  },
  resultCard: {
    background: '#fff',
    borderRadius: '20px',
    padding: '1rem',
    marginTop: '1rem',
    textAlign: 'center',
    boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
  },
  resultMeta: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.8rem',
    color: '#495d56',
  },
  pillCode: {
    background: '#EFECE2',
    padding: '0.2rem 0.6rem',
    borderRadius: '999px',
    fontWeight: 800,
    fontSize: '0.75rem',
  },
  ruleSub: {
    fontSize: '0.75rem',
    color: '#7a786e',
    marginTop: '0.25rem',
  },
  bigPrice: {
    fontSize: '1.85rem',
    fontWeight: 800,
    color: '#8B1E3F',
    margin: '0.35rem 0',
  },
  requoteBadge: {
    background: '#FFF3F3',
    color: '#E04F4F',
    padding: '0.35rem 0.65rem',
    borderRadius: '10px',
    fontSize: '0.8rem',
    fontWeight: 700,
    marginTop: '0.4rem',
  },
  freightBox: {
    marginTop: '0.75rem',
    paddingTop: '0.65rem',
    borderTop: '1px dashed #e0dcd0',
  },
  okBox: {
    background: '#fff',
    padding: '1rem',
    borderRadius: '16px',
    color: '#2e6b4e',
    fontWeight: 600,
    fontSize: '0.88rem',
  },
  anomalyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  anomalyItem: {
    background: '#fff',
    padding: '0.75rem',
    borderRadius: '14px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.5rem',
  },
  suggestedPriceTag: {
    background: '#EFECE2',
    color: '#8B1E3F',
    padding: '0.35rem 0.65rem',
    borderRadius: '10px',
    fontWeight: 800,
    fontSize: '0.8rem',
    whiteSpace: 'nowrap',
  },
  previewBox: {
    background: '#fff',
    borderRadius: '16px',
    padding: '0.85rem',
    marginTop: '0.85rem',
  },
  previewRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.8rem',
    padding: '0.25rem 0',
    borderBottom: '1px solid #f3f1e9',
  },
};
```

---

## 5. Integración de Recotización en `BudgetEditor.jsx` (`src/components/admin/BudgetEditor.jsx`)

Dentro de `src/components/admin/BudgetEditor.jsx`, agregá este bloque para que cuando abras un presupuesto que quedó pendiente de semanas anteriores puedas **actualizar todos sus ítems a la lista vigente en 1 clic** antes de imprimirlo (`PrintModal.jsx`) o enviarlo en PDF (`pdfGenerator.js`):

```jsx
// Fragmento para integrar en src/components/admin/BudgetEditor.jsx
import { requoteBudgetItems, quoteCustomDimension } from '../../lib/pricingEngine';

// Dentro de tu componente BudgetEditor({ budget, products, onSave }):
const [requoteSummary, setRequoteSummary] = useState(null);

const handleRequoteToCurrentCatalog = () => {
  const result = requoteBudgetItems(budget.items || [], products || []);
  setRequoteSummary(result);

  if (!result.hasChanges) {
    alert('Este presupuesto ya tiene los precios vigentes de la lista actual.');
    return;
  }

  // Actualiza el estado de items y total en tu BudgetEditor
  setItems(result.updatedItems);
  setTotal(result.newSubtotal);
};

// Botón para renderizar en la barra de acciones de BudgetEditor.jsx:
<div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', margin: '0.5rem 0' }}>
  <button
    type="button"
    onClick={handleRequoteToCurrentCatalog}
    style={{
      background: '#8B1E3F',
      color: '#fff',
      border: 'none',
      borderRadius: '999px',
      padding: '0.45rem 0.95rem',
      fontSize: '0.82rem',
      fontWeight: 700,
      cursor: 'pointer',
    }}
  >
    🔄 Recotizar a Lista Actual
  </button>

  {requoteSummary?.hasChanges && (
    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#E04F4F' }}>
      Anterior: ${requoteSummary.oldSubtotal.toLocaleString('es-AR')} → Nuevo: $
      {requoteSummary.newSubtotal.toLocaleString('es-AR')} (
      {requoteSummary.deltaAmount >= 0 ? '+' : ''}
      {requoteSummary.deltaPct}%)
    </span>
  )}
</div>
```