import { jsPDF } from 'jspdf';
import 'svg2pdf.js/dist/svg2pdf.es.min.js';
import { STAMP_WIDTH_MM, STAMP_HEIGHT_MM, FACTOR_PT_A_MM } from '../components/creador/constants';

export async function generateStampPDF({
  mode = 'profesional',
  lines = [],
  schoolIcon = null,
  schoolData = null,
  clientName = 'Cliente',
  canvasRef = null
}) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [STAMP_WIDTH_MM, STAMP_HEIGHT_MM]
  });

  let cleanSvg = null;
  let vectorRenderSuccess = false;

  // 1. Exportación 100% vectorial directa desde el SVG limpio del canvas
  if (canvasRef?.current?.getCleanVectorSVG) {
    try {
      const res = await canvasRef.current.getCleanVectorSVG();
      if (res?.element) {
        cleanSvg = res.svgString;
        // Renderizado vectorial puro en jsPDF (convierte paths, curvas y textos a vectores nativos PDF sin rasterizar)
        await doc.svg(res.element, {
          x: 0,
          y: 0,
          width: STAMP_WIDTH_MM,
          height: STAMP_HEIGHT_MM
        });
        vectorRenderSuccess = true;
      }
    } catch (e) {
      console.warn('Error renderizando SVG vectorial en PDF con svg2pdf:', e);
    }
  }

  // 2. Fallback vectorial nativo (SOLO si falló svg2pdf o no hay canvasRef, NUNCA BITMAP, NUNCA MARCO NEGRO)
  if (!vectorRenderSuccess) {
    const totalHeight = lines.reduce((acc, l) => acc + (Number(l.size) * FACTOR_PT_A_MM), 0);
    const startY = Math.max(1.5, (STAMP_HEIGHT_MM - totalHeight) / 2);
    let currentY = startY;

    const iconSize = mode === 'escolar' ? (Number(schoolData?.iconSize) || 11.5) : 11.5;
    const iconOffsetX = mode === 'escolar' ? (Number(schoolData?.iconOffsetX) || 0) : 0;
    const iconOffsetY = mode === 'escolar' ? (Number(schoolData?.iconOffsetY) || 0) : 0;
    const iconX = 1.0 + iconOffsetX;

    const textColStart = mode === 'escolar' ? (iconX + iconSize + 0.4) : 0.5;
    const textColEnd = STAMP_WIDTH_MM - 0.5;
    const schoolTextCenter = (textColStart + textColEnd) / 2;

    doc.setTextColor(0, 0, 0);
    lines.forEach((line) => {
      if (!line.texto) return;
      const lineHeight = Number(line.size) * FACTOR_PT_A_MM;
      const yPos = currentY + (Number(line.offset_y) || 0) + (lineHeight * 0.8);
      currentY += lineHeight;

      doc.setFontSize(Number(line.size) * 0.95);
      const basePosX = mode === 'escolar' ? schoolTextCenter : 18;
      const posX = basePosX + (Number(line.offset_x) || 0);
      doc.text(line.texto, posX, yPos, { align: 'center' });
    });
  }

  const cleanName = (clientName || 'Sello').replace(/\s+/g, '_');
  const filename = `${cleanName}_${Date.now()}.pdf`;
  const blobOutput = doc.output('blob');

  return {
    doc,
    filename,
    blob: blobOutput,
    dataUrl: doc.output('datauristring'),
    cleanSvg
  };
}

export function downloadBlob(blob, filename = 'sello_personalizado.pdf') {
  if (typeof window === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

