// src/lib/priceListPdfGenerator.js
import { jsPDF } from 'jspdf';
import { roundCommercial, parseDimensionsFromText } from './pricingEngine';

/**
 * Genera un PDF A4 con la lista completa de precios de Queselló agrupada por categorías,
 * permitiendo aplicar un porcentaje de descuento para Reventa / Mayorista.
 */
export function generatePriceListPDF(
  products = [],
  {
    discountPct = 0,
    roundStep = 50,
    onlyActive = true,
    includeCustomEsp = false,
    showPublicComparison = true,
    customTitle = '',
  } = {}
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pct = Math.max(0, Math.min(90, Number(discountPct) || 0));
  const isResale = pct > 0;

  // 1. Filtrar productos
  const filtered = products.filter((p) => {
    const code = String(p.codigo || p.code || '').toUpperCase();
    if (onlyActive && Number(p.activo ?? 1) === 0) return false;
    if (!includeCustomEsp && code.startsWith('ESP-')) return false;
    return true;
  });

  // 2. Agrupar por categoría y ordenar (sellos por área de menor a mayor, luego resto)
  const grouped = {};
  filtered.forEach((p) => {
    const cat = p.categoria || p.category || 'Otros';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  });

  const categoryOrder = ['Sellos', 'Tintas', 'Servicios'];
  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const idxA = categoryOrder.findIndex((c) => c.toLowerCase() === a.toLowerCase());
    const idxB = categoryOrder.findIndex((c) => c.toLowerCase() === b.toLowerCase());
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  sortedCategories.forEach((cat) => {
    grouped[cat].sort((a, b) => {
      const dimA = parseDimensionsFromText(a.descripcion || a.name || '');
      const dimB = parseDimensionsFromText(b.descripcion || b.name || '');
      if (dimA && dimB) return dimA.area - dimB.area;
      if (dimA) return -1;
      if (dimB) return 1;
      return Number(a.precio || 0) - Number(b.precio || 0);
    });
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;
  let y = 16;
  let pageNumber = 1;

  const todayStr = new Date().toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const drawHeader = (isFirstPage = false) => {
    // Fondo cabecera estilo Queselló (#F4F1E1)
    doc.setFillColor(244, 241, 225);
    doc.roundedRect(marginX, y, contentWidth, isFirstPage ? 26 : 16, 4, 4, 'F');

    // Marca Queselló
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isFirstPage ? 18 : 13);
    doc.setTextColor(73, 93, 86); // #495D56
    doc.text('Queselló!', marginX + 6, y + (isFirstPage ? 10 : 10.5));

    // Subtítulo marca
    if (isFirstPage) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(153, 142, 85); // #998E55
      doc.text('SELLOS ARTESANALES · TIENDA TALLER', marginX + 6, y + 16);
      doc.text('quesello.com.ar · WhatsApp: 223 520-3360', marginX + 6, y + 21);
    }

    // Título derecho (Lista Oficial vs Lista Reventa)
    const headerTitle =
      customTitle.trim() ||
      (isResale ? `LISTA REVENTA / MAYORISTA (-${pct}%)` : 'LISTA DE PRECIOS OFICIAL');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isFirstPage ? 11 : 9.5);
    doc.setTextColor(255, 94, 94); // #FF5E5E
    doc.text(headerTitle.toUpperCase(), pageWidth - marginX - 6, y + (isFirstPage ? 10 : 10.5), {
      align: 'right',
    });

    if (isFirstPage) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(73, 93, 86);
      doc.text(`Vigencia / Emisión: ${todayStr}`, pageWidth - marginX - 6, y + 16, {
        align: 'right',
      });
      if (isResale) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(142, 31, 82); // #8E1F52
        doc.text(
          `Descuento comercial aplicado: ${pct}% OFF`,
          pageWidth - marginX - 6,
          y + 21,
          { align: 'right' }
        );
      }
    }

    y += isFirstPage ? 32 : 21;
  };

  const drawFooter = (pageNum) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Queselló! Sellos Artesanales · Precios expresados en pesos argentinos ($) · Página ${pageNum}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  };

  const checkPageBreak = (neededHeight = 12) => {
    if (y + neededHeight > pageHeight - 15) {
      drawFooter(pageNumber);
      doc.addPage();
      pageNumber += 1;
      y = 14;
      drawHeader(false);
    }
  };

  drawHeader(true);

  sortedCategories.forEach((cat) => {
    const items = grouped[cat] || [];
    if (items.length === 0) return;

    checkPageBreak(18);

    // Cabecera de Categoría
    doc.setFillColor(73, 93, 86); // #495D56
    doc.roundedRect(marginX, y, contentWidth, 8, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(cat.toUpperCase(), marginX + 4, y + 5.5);
    y += 10;

    // Cabecera de Columnas
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(153, 142, 85); // #998E55
    doc.text('CÓDIGO', marginX + 3, y + 4);
    doc.text('PRODUCTO / DESCRIPCIÓN', marginX + 24, y + 4);
    doc.text('USO / DETALLE', marginX + 92, y + 4);

    if (isResale && showPublicComparison) {
      doc.text('PÚBLICO', pageWidth - marginX - 32, y + 4, { align: 'right' });
      doc.text(`REVENTA (-${pct}%)`, pageWidth - marginX - 3, y + 4, { align: 'right' });
    } else {
      doc.text(
        isResale ? `PRECIO REVENTA (-${pct}%)` : 'PRECIO',
        pageWidth - marginX - 3,
        y + 4,
        { align: 'right' }
      );
    }

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(marginX, y + 6, pageWidth - marginX, y + 6);
    y += 8;

    items.forEach((item, idx) => {
      checkPageBreak(9);

      const code = String(item.codigo || item.code || '').toUpperCase();
      const name = String(item.descripcion || item.name || '').toUpperCase();
      const detail = String(item.data || '')
        .replace(/\s+/g, ' ')
        .trim();
      const publicPrice = Number(item.precio ?? item.price ?? 0);
      const rawDiscounted = publicPrice * (1 - pct / 100);
      const finalPrice = isResale
        ? roundStep > 1
          ? roundCommercial(rawDiscounted, roundStep)
          : Math.round(rawDiscounted)
        : publicPrice;

      if (idx % 2 === 0) {
        doc.setFillColor(250, 249, 246); // #FAF9F6
        doc.rect(marginX, y - 1, contentWidth, 7.5, 'F');
      }

      // Código
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(73, 93, 86);
      doc.text(code.slice(0, 10), marginX + 3, y + 4);

      // Nombre
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      const maxNameChars = 36;
      const truncatedName =
        name.length > maxNameChars ? name.slice(0, maxNameChars - 1) + '…' : name;
      doc.text(truncatedName, marginX + 24, y + 4);

      // Detalle / uso
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      const maxDetailChars = isResale && showPublicComparison ? 32 : 44;
      const truncatedDetail =
        detail.length > maxDetailChars ? detail.slice(0, maxDetailChars - 1) + '…' : detail;
      doc.text(truncatedDetail || '-', marginX + 92, y + 4);

      // Precios
      if (isResale && showPublicComparison) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`$${publicPrice.toLocaleString('es-AR')}`, pageWidth - marginX - 32, y + 4, {
          align: 'right',
        });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(142, 31, 82); // #8E1F52
        doc.text(`$${finalPrice.toLocaleString('es-AR')}`, pageWidth - marginX - 3, y + 4, {
          align: 'right',
        });
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(142, 31, 82); // #8E1F52
        doc.text(`$${finalPrice.toLocaleString('es-AR')}`, pageWidth - marginX - 3, y + 4, {
          align: 'right',
        });
      }

      y += 7.5;
    });

    y += 5;
  });

  drawFooter(pageNumber);

  const suffix = isResale ? `Reventa_${pct}OFF` : 'Oficial';
  const dateFile = new Date().toISOString().slice(0, 10);
  doc.save(`Lista_Precios_Quesello_${suffix}_${dateFile}.pdf`);
}

