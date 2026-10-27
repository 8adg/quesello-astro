import { supabase } from '../../lib/supabase';

/**
 * Utilidades para detección, normalización y descarga directa de archivos SVG de producción en presupuestos/pedidos.
 */

/**
 * Extrae y normaliza la URL del archivo SVG desde el campo observaciones.
 * Resuelve cualquier problema de case-sensitivity (por ejemplo si quedó guardada en mayúsculas en la BD).
 */
export function extractSvgUrl(observaciones) {
  if (!observaciones || typeof observaciones !== 'string') return null;

  // Buscar coincidencia con protocolo https y ruta de sellos .svg
  const match = observaciones.match(/https?:\/\/[^\s|]+sellos[^\s|]+\.svg/i);
  if (!match) return null;

  let rawUrl = match[0].trim();

  // Si la URL viene en mayúsculas (ej: HTTPS://YIHIZWSPXNXLFOWVITOE.SUPABASE.CO/STORAGE/...)
  // Normalizar el origen y los segmentos de ruta a minúsculas respetando el nombre del archivo
  try {
    const parsed = new URL(rawUrl);
    // Protocolo y host siempre en minúsculas
    const origin = parsed.origin.toLowerCase();
    
    // Normalizar la ruta de Supabase Storage
    let pathname = parsed.pathname;
    
    // Si contiene storage/v1/object/public/catalogo/sellos/ en cualquier combinación de mayúsculas
    pathname = pathname.replace(
      /\/storage\/v1\/object\/public\/catalogo\/sellos\//i,
      '/storage/v1/object/public/catalogo/sellos/'
    );

    // Si la extensión está en mayúsculas (.SVG -> .svg)
    pathname = pathname.replace(/\.svg$/i, '.svg');

    return `${origin}${pathname}`;
  } catch (e) {
    // Si no parsea como URL directa, devolver el match limpio
    return rawUrl;
  }
}

/**
 * Resuelve la URL del SVG para un pedido:
 * 1. Desde el texto de observaciones
 * 2. Si no está en observaciones, infiere la ruta estándar de Storage si es un sello
 */
export function getOrderSvgUrl(orderOrObs, fallbackNumero, fallbackCliente) {
  const obs = typeof orderOrObs === 'string' ? orderOrObs : orderOrObs?.observaciones;
  const numero = typeof orderOrObs === 'object' ? orderOrObs?.numero : fallbackNumero;
  const cliente = typeof orderOrObs === 'object' ? orderOrObs?.cliente : fallbackCliente;

  const directUrl = extractSvgUrl(obs);
  if (directUrl) return directUrl;

  // Fallback si no estaba el tag | SVG: pero es un sello creado en la app
  if (numero && cliente && (obs?.includes('36X15') || obs?.includes('SELLO') || obs?.includes('sellos'))) {
    const safeClientFile = cliente.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
    return `https://yihizwspxnxlfowvitoe.supabase.co/storage/v1/object/public/catalogo/sellos/${numero.toLowerCase()}_${safeClientFile}.svg`;
  }

  return null;
}

/**
 * Extrae la URL del PDF de Declaración Jurada desde observaciones
 */
export function extractDjUrl(observaciones) {
  if (!observaciones || typeof observaciones !== 'string') return null;
  const match = observaciones.match(/https?:\/\/[^\s|]+declaraciones[^\s|]+\.pdf/i);
  if (!match) return null;
  return match[0].trim();
}

/**
 * Resuelve la URL del PDF de Declaración Jurada para un pedido
 */
export function getOrderDjUrl(orderOrObs, fallbackNumero, fallbackCliente) {
  const obs = typeof orderOrObs === 'string' ? orderOrObs : orderOrObs?.observaciones;
  const numero = typeof orderOrObs === 'object' ? orderOrObs?.numero : fallbackNumero;
  const cliente = typeof orderOrObs === 'object' ? orderOrObs?.cliente : fallbackCliente;

  const directUrl = extractDjUrl(obs);
  if (directUrl) return directUrl;

  // Fallback si no estaba el tag | DJ: pero fue generado
  if (numero && cliente && (obs?.includes('DJ') || obs?.includes('DNI') || obs?.includes('36X15') || obs?.includes('SELLO'))) {
    const safeClientFile = cliente.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
    return `https://yihizwspxnxlfowvitoe.supabase.co/storage/v1/object/public/catalogo/declaraciones/${numero.toLowerCase()}_${safeClientFile}.pdf`;
  }

  return null;
}

/**
 * Limpia el texto de observaciones para mostrar al operador humano
 * retirando URLs técnicas "| SVG: https://..." y "| DJ: https://..."
 * y cualquier descripción técnica redundante del sello.
 */
export function cleanObservacionesText(observaciones) {
  if (!observaciones || typeof observaciones !== 'string') return '';
  let text = observaciones
    .replace(/\s*\|\s*SVG:\s*https?:\/\/[^\s|]+/gi, '')
    .replace(/\s*SVG:\s*https?:\/\/[^\s|]+/gi, '')
    .replace(/\s*\|\s*DJ:\s*https?:\/\/[^\s|]+/gi, '')
    .replace(/\s*DJ:\s*https?:\/\/[^\s|]+/gi, '')
    .trim();

  // Quitar duplicación de descripción del producto del creador de sellos si existe
  // Ej: "| SELLO AUTOMATICO (36X15MM) | JUAN PÉREZ PARDO | MÉDICO CLÍNICO | MATRÍCULA N° 20408978"
  text = text.replace(/\s*\|\s*SELLO\s+[^|]*\(\d+X\d+MM\)(?:\s*\|\s*(?!NOTAS|TEL|DNI|EMAIL|PEDIDO)[^|]+)*/gi, '');

  // Limpiar pipes residuales dobles, al inicio o al final
  text = text
    .replace(/\s*\|\s*\|\s*/g, ' | ')
    .replace(/^\s*\|\s*/, '')
    .replace(/\s*\|\s*$/, '')
    .trim();

  return text;
}

/**
 * Limpia y formatea las observaciones específicamente para el ticket PDF o térmico:
 * 1. Quita URLs de SVG, DJ y cualquier link técnico.
 * 2. Si el texto contiene la descripción repetida del sello que ya está en los items del pedido, la retira.
 * 3. Devuelve un texto limpio, legible y compacto que entra perfecto en el ticket.
 */
export function cleanObservacionesForPrint(observaciones, items = []) {
  if (!observaciones || typeof observaciones !== 'string') return '';
  let text = cleanObservacionesText(observaciones);

  // Quitar cualquier otra URL que haya podido quedar
  text = text.replace(/https?:\/\/[^\s|]+/gi, '').trim();

  // Si contiene NOTAS, formatearlo para salto de línea si es largo
  if (text.includes(' | NOTAS:')) {
    text = text.replace(/\s*\|\s*NOTAS:\s*/gi, '\nNOTAS: ');
  }

  return text;
}

/**
 * Reconstruye el campo observaciones al guardar en BudgetEditor:
 * - Pasa el texto humano a mayúsculas
 * - Reanexa la URL del SVG y de la DJ si existían
 */
export function mergeObservacionesWithSvg(userText, svgUrl, djUrl = null) {
  const clean = cleanObservacionesText(userText).toUpperCase();
  let result = clean;
  if (svgUrl) {
    result = result ? `${result} | SVG: ${svgUrl}` : `SVG: ${svgUrl}`;
  }
  if (djUrl) {
    result = result ? `${result} | DJ: ${djUrl}` : `DJ: ${djUrl}`;
  }
  return result;
}

/**
 * Descarga directa del archivo SVG al equipo local del usuario (forzando blob y tag <a>)
 */
export async function downloadSvgDirect(svgUrl, filename = 'sello_produccion.svg') {
  if (!svgUrl) return;

  try {
    const response = await fetch(svgUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (err) {
    console.warn('Fallback a apertura directa de pestaña:', err);
    window.open(svgUrl, '_blank');
  }
}

/**
 * Descarga o apertura directa del PDF de Declaración Jurada
 */
export async function downloadPdfDirect(pdfUrl, filename = 'declaracion_jurada.pdf') {
  if (!pdfUrl) return;

  try {
    const response = await fetch(pdfUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (err) {
    console.warn('Apertura en nueva pestaña:', err);
    window.open(pdfUrl, '_blank');
  }
}

/**
 * Elimina físicamente los archivos SVG y DJ (PDF) asociados al pedido de Supabase Storage
 */
export async function deleteOrderSvgFile(order) {
  if (!order) return;
  try {
    const filesToDelete = [];

    // 1. Obtener ruta del archivo SVG
    const svgUrl = getOrderSvgUrl(order);
    if (svgUrl) {
      const match = svgUrl.match(/\/catalogo\/(sellos\/[^\s?#]+)/i) || svgUrl.match(/(sellos\/[^\s?#]+)/i);
      if (match) filesToDelete.push(match[1]);
    }

    // 2. Obtener ruta del archivo Declaración Jurada PDF
    const djUrl = getOrderDjUrl(order);
    if (djUrl) {
      const match = djUrl.match(/\/catalogo\/(declaraciones\/[^\s?#]+)/i) || djUrl.match(/(declaraciones\/[^\s?#]+)/i);
      if (match) filesToDelete.push(match[1]);
    }

    // 3. Búsqueda por prefijo correlativo en sellos y declaraciones
    if (order.numero) {
      const prefix = order.numero.toLowerCase().trim();
      
      const [sellosList, djList] = await Promise.all([
        supabase.storage.from('catalogo').list('sellos', { search: prefix }),
        supabase.storage.from('catalogo').list('declaraciones', { search: prefix })
      ]);

      if (sellosList.data && sellosList.data.length > 0) {
        sellosList.data.forEach(f => {
          if (f.name.toLowerCase().startsWith(prefix)) {
            filesToDelete.push(`sellos/${f.name}`);
          }
        });
      }

      if (djList.data && djList.data.length > 0) {
        djList.data.forEach(f => {
          if (f.name.toLowerCase().startsWith(prefix)) {
            filesToDelete.push(`declaraciones/${f.name}`);
          }
        });
      }
    }

    const uniqueFiles = [...new Set(filesToDelete)];
    if (uniqueFiles.length > 0) {
      const { error } = await supabase.storage.from('catalogo').remove(uniqueFiles);
      if (error) {
        console.warn('Error eliminando archivos de storage:', error);
      } else {
        console.log('Archivos eliminados de storage con éxito:', uniqueFiles);
      }
    }
  } catch (err) {
    console.warn('Excepción al eliminar archivos de Storage:', err);
  }
}
