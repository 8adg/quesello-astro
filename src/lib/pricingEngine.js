// src/lib/pricingEngine.js

/**
 * Redondea al escalón comercial más cercano (por defecto $50 ARS)
 */
export function roundCommercial(value, step = 50) {
  const num = Number(value) || 0;
  if (!step || step <= 0) return Math.round(num);
  return Math.round(num / step) * step;
}

/**
 * Extrae dimensiones (Ancho x Alto en cm) desde las propiedades del producto o su descripción.
 * Soporta formatos como "SELLO 9X6CM", "SELLO 4X1,5CM", "Sello 6x6" (sin CM).
 * Excluye accesorios o kits como "ALMOHADILLA 15X15CM", "PACK", "KIT", "BONIF:".
 */
export function parseStampDimensions(product) {
  if (product?.width_cm && product?.height_cm) {
    return {
      width: Number(product.width_cm),
      height: Number(product.height_cm),
    };
  }

  const rawDesc = String(
    product?.descripcion || product?.name || product?.nombre || product?.description || ''
  )
    .trim()
    .toUpperCase();

  if (!rawDesc) return null;

  // Excluir productos que tienen medidas pero NO son sellos individuales de goma/madera
  if (
    rawDesc.startsWith('ALMOHADILLA') ||
    rawDesc.startsWith('PACK') ||
    rawDesc.startsWith('KIT') ||
    rawDesc.startsWith('TINTA') ||
    rawDesc.startsWith('BONIF') ||
    rawDesc.startsWith('ADICIONAL')
  ) {
    return null;
  }

  // 1. Coincidencia explícita con "CM" (ej: "SELLO 9X6CM", "SELLO 4X1,5CM", "SELLO CERAMICA 2X3CM")
  const matchWithCm = rawDesc.match(/(\d+(?:[.,]\d+)?)\s*X\s*(\d+(?:[.,]\d+)?)\s*CM/i);
  if (matchWithCm) {
    const width = parseFloat(matchWithCm[1].replace(',', '.'));
    const height = parseFloat(matchWithCm[2].replace(',', '.'));
    if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
      return { width, height };
    }
  }

  // 2. Coincidencia para sellos cuya descripción omitió "CM" (ej: "Sello 6x6" en QS-007)
  if (rawDesc.includes('SELLO')) {
    const matchNoCm = rawDesc.match(/SELLO(?:[^\d]+)?(\d+(?:[.,]\d+)?)\s*X\s*(\d+(?:[.,]\d+)?)(?!\s*MM)\b/i);
    if (matchNoCm) {
      const width = parseFloat(matchNoCm[1].replace(',', '.'));
      const height = parseFloat(matchNoCm[2].replace(',', '.'));
      if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
        return { width, height };
      }
    }
  }

  return null;
}

/**
 * Cotiza cualquier medida de sello (Ancho x Alto en cm) usando los productos cargados desde Supabase.
 * Regla: Suma de Lados (L + A) interpolada entre los cuadrados oficiales de Queselló!
 */
export function quoteCustomDimension(widthCm, heightCm, products = [], options = {}) {
  const w = Number(widthCm) || 0;
  const h = Number(heightCm) || 0;
  const minSide = Math.min(w, h);
  const maxSide = Math.max(w, h);
  const sumSides = Number((w + h).toFixed(2));
  const areaCm2 = Number((w * h).toFixed(2));
  const step = options.roundStep || 50;
  const ignoreCodes = new Set(options.ignoreCodes || []);

  // Mapear catálogo con dimensiones
  const parsedStamps = products
    .map((p) => {
      const dims = parseStampDimensions(p);
      if (!dims) return null;
      const code = p.codigo || p.code;
      if (ignoreCodes.has(code)) return null;
      const name = p.descripcion || p.name || p.nombre;
      const price = Number(p.precio ?? p.price ?? 0);
      return {
        ...p,
        code,
        codigo: code,
        name,
        descripcion: name,
        price,
        precio: price,
        width: dims.width,
        height: dims.height,
        sumSides: Number((dims.width + dims.height).toFixed(2)),
        area: Number((dims.width * dims.height).toFixed(2)),
        isSquare: dims.width === dims.height && dims.width >= 4,
      };
    })
    .filter(Boolean);

  // 1. Coincidencia exacta en catálogo (salvo que estemos auditando la curva)
  if (!options.ignoreExactMatch) {
    const exact = parsedStamps.find(
      (s) => Math.min(s.width, s.height) === minSide && Math.max(s.width, s.height) === maxSide
    );
    if (exact) {
      return {
        id: exact.id,
        code: exact.code,
        name: exact.name,
        widthCm: w,
        heightCm: h,
        areaCm2,
        sumSides,
        unitPrice: exact.price,
        pricePerCm2: areaCm2 > 0 ? Number((exact.price / areaCm2).toFixed(2)) : 0,
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
      code: 'QS-ESP',
      name: `SELLO ${w}X${h}CM`,
      widthCm: w,
      heightCm: h,
      areaCm2,
      sumSides,
      unitPrice: 17000,
      pricePerCm2: areaCm2 > 0 ? Number((17000 / areaCm2).toFixed(2)) : 0,
      ruleApplied: 'Referencia base sin cuadrados cargados',
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
      name: `SELLO ${w}X${h}CM`,
      widthCm: w,
      heightCm: h,
      areaCm2,
      sumSides,
      unitPrice: smallRef.price,
      pricePerCm2: areaCm2 > 0 ? Number((smallRef.price / areaCm2).toFixed(2)) : 0,
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
        name: `SELLO ${w}X${h}CM`,
        widthCm: w,
        heightCm: h,
        areaCm2,
        sumSides,
        unitPrice: sq.price,
        pricePerCm2: areaCm2 > 0 ? Number((sq.price / areaCm2).toFixed(2)) : 0,
        ruleApplied: `Suma de lados L+A = ${sumSides}cm equivalente a ${sq.code} (${sq.width}x${sq.height}cm)`,
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
          pricePerCm2: areaCm2 > 0 ? Number((interpolated / areaCm2).toFixed(2)) : 0,
          ruleApplied: `Interpolación L+A = ${sumSides}cm entre ${sq.code} ($${sq.price.toLocaleString('es-AR')}) y ${nextSq.code} ($${nextSq.price.toLocaleString('es-AR')})`,
          isCustom: true,
        };
      }
    }
  }

  // 5. Extrapolación para medidas mayores al máximo cuadrado cargado (ej. > 15x15 cm)
  const maxSq = squares[squares.length - 1];
  const cm2Floor = maxSq.price / maxSq.area;
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
    pricePerCm2: areaCm2 > 0 ? Number((finalPrice / areaCm2).toFixed(2)) : 0,
    ruleApplied: `Gran formato ($${cm2Floor.toFixed(0)}/cm²)`,
    isCustom: true,
  };
}

/**
 * Audita la curva de precios de sellos en Supabase:
 * 1. Detecta sellos rectangulares desfasados que cuestan menos que un sello de menor superficie (ej. QS-030 4x6cm y QS-032 9x6cm).
 * 2. Verifica la alineación del escalón existente de 12x12cm (QS-013) entre 11x11cm (QS-012) y 13x13cm (QS-035) sin duplicar productos.
 */
export function auditCatalogAnomalies(products = []) {
  const stamps = products
    .map((p) => {
      const dims = parseStampDimensions(p);
      if (!dims) return null;
      const code = p.codigo || p.code;
      const name = p.descripcion || p.name || p.nombre;
      const price = Number(p.precio ?? p.price ?? 0);
      const area = Number((dims.width * dims.height).toFixed(2));
      const sumSides = Number((dims.width + dims.height).toFixed(2));
      return {
        ...p,
        code,
        name,
        price,
        width: dims.width,
        height: dims.height,
        area,
        sumSides,
        pricePerCm2: area > 0 ? Number((price / area).toFixed(2)) : 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.area - b.area || a.sumSides - b.sumSides);

  const anomalies = [];

  for (let i = 1; i < stamps.length; i++) {
    const current = stamps[i];
    const prev = stamps[i - 1];
    if (current.price < prev.price) {
      const suggested = quoteCustomDimension(current.width, current.height, products, {
        ignoreExactMatch: true,
      });
      anomalies.push({
        id: current.id,
        code: current.code,
        name: current.name,
        width: current.width,
        height: current.height,
        currentPrice: current.price,
        smallerStampCode: prev.code,
        smallerStampName: prev.name,
        smallerStampPrice: prev.price,
        suggestedPrice: suggested.unitPrice,
        difference: suggested.unitPrice - current.price,
        reason: `Hoy está en $${current.price.toLocaleString('es-AR')} (menor que ${prev.code} ${prev.name} de $${prev.price.toLocaleString('es-AR')})`,
      });
    }
  }

  // Verificar escalón 12x12cm existente (QS-013) respecto al punto medio entre 11x11 (QS-012) y 13x13 (QS-035)
  const stamp12x12 = stamps.find((s) => s.width === 12 && s.height === 12);
  const stamp11x11 = stamps.find((s) => s.width === 11 && s.height === 11);
  const stamp13x13 = stamps.find((s) => s.width === 13 && s.height === 13);

  if (stamp12x12 && stamp11x11 && stamp13x13) {
    const midPrice = roundCommercial((stamp11x11.price + stamp13x13.price) / 2, 50);
    if (stamp12x12.price !== midPrice && !anomalies.some((a) => a.code === stamp12x12.code)) {
      anomalies.push({
        id: stamp12x12.id,
        code: stamp12x12.code,
        name: stamp12x12.name,
        width: 12,
        height: 12,
        currentPrice: stamp12x12.price,
        smallerStampCode: stamp11x11.code,
        smallerStampName: stamp11x11.name,
        smallerStampPrice: stamp11x11.price,
        suggestedPrice: midPrice,
        difference: midPrice - stamp12x12.price,
        reason: `Escalón existente (${stamp12x12.code}) hoy en $${stamp12x12.price.toLocaleString('es-AR')}. Punto medio exacto entre 11x11 ($${stamp11x11.price.toLocaleString('es-AR')}) y 13x13 ($${stamp13x13.price.toLocaleString('es-AR')}): $${midPrice.toLocaleString('es-AR')}`,
      });
    }
  }

  return {
    stamps,
    anomalies,
    missing12x12: !stamp12x12,
  };
}

/**
 * Recotiza todos los ítems de un presupuesto (en BudgetEditor.jsx)
 * cruzando contra la lista vigente de `productos` en Supabase.
 * Compatible con la estructura real de `presupuesto_items`: { descripcion, cantidad, precio_unitario, total }.
 */
export function requoteBudgetItems(budgetItems = [], currentProducts = []) {
  let oldSubtotal = 0;
  let newSubtotal = 0;

  const updatedItems = budgetItems.map((item) => {
    const qty = Number(item.cantidad ?? item.quantity ?? 1);
    const oldUnitPrice = Number(item.precio_unitario ?? item.price ?? item.unit_price ?? item.precio ?? 0);
    const rawDesc = String(item.descripcion || item.name || '').trim();
    const normDesc = rawDesc.toUpperCase();
    const code = item.codigo || item.code || item.product_code;

    // Si es una bonificación/descuento (monto negativo o empieza con BONIF:), se preserva tal cual
    if (oldUnitPrice < 0 || normDesc.startsWith('BONIF:')) {
      const lineTotal = oldUnitPrice * qty;
      oldSubtotal += lineTotal;
      newSubtotal += lineTotal;
      return {
        ...item,
        cantidad: qty,
        old_unit_price: oldUnitPrice,
        precio_unitario: oldUnitPrice,
        total: lineTotal,
        price_diff: 0,
        pricing_note: 'Bonificación conservada',
      };
    }

    // 1. Buscar coincidencia directa en catálogo por código o por descripción exacta
    const catalogMatch = currentProducts.find((p) => {
      const pCode = p.codigo || p.code;
      const pDesc = String(p.descripcion || p.name || '').trim().toUpperCase();
      if (code && pCode && pCode.toUpperCase() === String(code).toUpperCase()) return true;
      if (normDesc && pDesc === normDesc) return true;
      return false;
    });

    let newUnitPrice = oldUnitPrice;
    let pricingNote = 'Sin cambios';

    if (catalogMatch) {
      newUnitPrice = Number(catalogMatch.precio ?? catalogMatch.price ?? oldUnitPrice);
      pricingNote = `Catálogo (${catalogMatch.codigo || catalogMatch.descripcion})`;
    } else {
      // 2. Si es un sello con medida en su descripción (ej: "SELLO 10X5CM" o "SELLO 9X6CM"), cotizar por L+A
      const dims = parseStampDimensions({ descripcion: normDesc });
      if (dims) {
        const quoted = quoteCustomDimension(dims.width, dims.height, currentProducts);
        newUnitPrice = quoted.unitPrice;
        pricingNote = quoted.ruleApplied;
      }
    }

    const oldLineTotal = oldUnitPrice * qty;
    const newLineTotal = newUnitPrice * qty;
    oldSubtotal += oldLineTotal;
    newSubtotal += newLineTotal;

    return {
      ...item,
      descripcion: normDesc || rawDesc,
      cantidad: qty,
      old_unit_price: oldUnitPrice,
      precio_unitario: newUnitPrice,
      price: newUnitPrice,
      unit_price: newUnitPrice,
      precio: newUnitPrice,
      total: newLineTotal,
      subtotal: newLineTotal,
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

