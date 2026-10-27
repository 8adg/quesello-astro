import React, { useMemo, forwardRef, useImperativeHandle, useRef, useState, useLayoutEffect, useEffect } from 'react';
import { 
  STAMP_WIDTH_MM, 
  STAMP_HEIGHT_MM, 
  FACTOR_PT_A_MM,
  PROFESSIONAL_FONTS, 
  SCHOOL_FONTS, 
  SCHOOL_ICONS 
} from './constants';
import { SCHOOL_ICONS_VECTOR_DATA } from './schoolIconsData';

const StampCanvasPreview = forwardRef(({
  mode = 'profesional', // 'profesional' | 'escolar'
  professionalLines = [],
  schoolData = { iconId: 1, lineas: [] },
  showGuides = false,
  onMetricsChange,
  className = '',
  style = {}
}, ref) => {
  const svgRef = useRef(null);
  const textRefs = useRef([]);
  const [fontsTick, setFontsTick] = useState(0);
  const [hasOverflowWidth, setHasOverflowWidth] = useState(false);
  const lastMetricsRef = useRef({ usedHeightMm: -1, isValid: true });

  // Re-medir cuando terminan de cargar las tipografías web
  useEffect(() => {
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(() => setFontsTick((t) => t + 1));
    }
  }, []);

  // Mapeo rápido de fuentes CSS
  const fontMap = useMemo(() => {
    const map = {};
    [...PROFESSIONAL_FONTS, ...SCHOOL_FONTS].forEach(f => {
      map[f.id] = f;
    });
    return map;
  }, []);

  // Ícono escolar seleccionado (datos vectoriales SVG nativos puros)
  const iconVector = useMemo(() => {
    if (mode !== 'escolar') return null;
    const id = schoolData?.iconId || 1;
    return SCHOOL_ICONS_VECTOR_DATA[id] || SCHOOL_ICONS_VECTOR_DATA[1];
  }, [mode, schoolData?.iconId]);

  // Líneas activas según el modo
  const activeLines = mode === 'profesional' ? professionalLines : schoolData.lineas;

  // Configuración dinámica de tamaño y posición del ícono escolar
  const iconSize = mode === 'escolar' ? (Number(schoolData?.iconSize) || 11.5) : 11.5;
  const iconOffsetX = mode === 'escolar' ? (Number(schoolData?.iconOffsetX) || 0) : 0;
  const iconOffsetY = mode === 'escolar' ? (Number(schoolData?.iconOffsetY) || 0) : 0;

  const iconScale = iconVector ? (iconSize / iconVector.maxDim) : 1;

  const minIconX = 0.0;
  const maxIconX = Math.max(minIconX, STAMP_WIDTH_MM - iconSize);
  const iconX = Math.max(minIconX, Math.min(maxIconX, 0.5 + iconOffsetX));

  const minIconY = 0.0;
  const maxIconY = Math.max(minIconY, STAMP_HEIGHT_MM - iconSize);
  const rawIconY = (STAMP_HEIGHT_MM - iconSize) / 2 + iconOffsetY;
  const iconY = Math.max(minIconY, Math.min(maxIconY, rawIconY));

  // Espacio dinámico para el texto (aprovecha 100% el borde físico exterior hasta 36 mm)
  const textColStart = mode === 'escolar' ? Math.max(0, iconX + iconSize) : 0;
  const textColEnd = STAMP_WIDTH_MM;
  const schoolTextCenter = (textColStart + textColEnd) / 2;

  // 1. Cálculo de Altura Usada (en mm) directamente del tamaño numérico exacto de cada línea
  const totalHeightUsedMm = useMemo(() => {
    return activeLines.reduce((acc, l) => acc + (Number(l.size) * FACTOR_PT_A_MM), 0);
  }, [activeLines]);

  const isValidVertical = (STAMP_HEIGHT_MM - totalHeightUsedMm) >= -0.6;

  // 2. Cálculo de posiciones Y para cada línea (borde vertical full de 0 a 15 mm)
  const linePositions = useMemo(() => {
    const startY = Math.max(0.0, (STAMP_HEIGHT_MM - totalHeightUsedMm) / 2);
    let currentY = startY;

    return activeLines.map((line) => {
      const lineHeightMm = Number(line.size) * FACTOR_PT_A_MM;
      const yPos = currentY + (Number(line.offset_y) || 0) + (lineHeightMm * 0.82);
      const xOffset = Number(line.offset_x) || 0;
      currentY += lineHeightMm;
      return {
        ...line,
        lineHeightMm,
        yPos,
        xOffset
      };
    });
  }, [activeLines, totalHeightUsedMm]);

  // Chequeo de desborde horizontal contra el borde físico REAL del sello (0 a 36 mm)
  // Con tolerancia para compensar el padding tipográfico invisible (side bearings / itálicas)
  useEffect(() => {
    let overflow = false;
    const HORIZONTAL_TOLERANCE_MM = 2.0;
    const leftLimit = -HORIZONTAL_TOLERANCE_MM;
    const rightLimit = STAMP_WIDTH_MM + HORIZONTAL_TOLERANCE_MM;

    textRefs.current.forEach((el) => {
      if (el?.getBBox) {
        try {
          const box = el.getBBox();
          if (box.x < leftLimit || (box.x + box.width) > rightLimit) {
            overflow = true;
          }
        } catch (e) {
          // ignore
        }
      }
    });
    setHasOverflowWidth(overflow);
  }, [activeLines, fontsTick, mode]);

  const isValid = isValidVertical && !hasOverflowWidth;
  const borderColor = isValid ? '#1E293B' : '#EF4444';

  useEffect(() => {
    const roundedHeight = parseFloat(totalHeightUsedMm.toFixed(1));
    if (
      Math.abs(lastMetricsRef.current.usedHeightMm - roundedHeight) > 0.05 ||
      lastMetricsRef.current.isValid !== isValid ||
      lastMetricsRef.current.isValidVertical !== isValidVertical ||
      lastMetricsRef.current.hasOverflowWidth !== hasOverflowWidth
    ) {
      lastMetricsRef.current = { usedHeightMm: roundedHeight, isValid, isValidVertical, hasOverflowWidth };
      onMetricsChange?.({
        usedHeightMm: roundedHeight,
        isValidVertical,
        hasOverflowWidth,
        isValid
      });
    }
  }, [totalHeightUsedMm, isValid, isValidVertical, hasOverflowWidth, onMetricsChange]);

  // Exponer método para exportar a SVG vectorial puro y PDF
  const getCleanVectorSVG = async () => {
    if (!svgRef.current) return null;
    const clone = svgRef.current.cloneNode(true);

    // 1. Establecer dimensiones físicas métricas explícitas para Inkscape / Láser (36 mm × 15 mm escala 1:1)
    clone.setAttribute('width', `${STAMP_WIDTH_MM}mm`);
    clone.setAttribute('height', `${STAMP_HEIGHT_MM}mm`);
    clone.setAttribute('viewBox', `0 0 ${STAMP_WIDTH_MM} ${STAMP_HEIGHT_MM}`);
    clone.removeAttribute('class');
    clone.removeAttribute('style');

    // 2. Quitar todas las guías técnicas opcionales (NO van en producción)
    clone.querySelectorAll('g[opacity="0.4"], line, rect[stroke-dasharray]').forEach((el) => el.remove());
    
    // 3. Garantizar que NO haya ningún marco negro perimetral ni bordes residuales
    clone.querySelectorAll('rect').forEach((r) => {
      if (r.getAttribute('stroke')) r.remove();
    });

    // 4. Estilos tipográficos integrados
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Aleo:ital,wght@0,300..900;1,300..900&family=Mukta+Mahee:wght@200;300;400;500;600;700;800&family=Playwrite+DK+Uloopet:wght@100..400&family=Quicksand:wght@300..700&family=Roboto:ital,wght@0,100..900;1,100..900&display=swap');
      @font-face { font-family: 'Amaze'; src: url('/fuentes/Amaze.ttf') format('truetype'); }
      text { text-rendering: geometricPrecision; shape-rendering: geometricPrecision; fill: #000000; }
      path { fill: #000000; }
    `;
    clone.insertBefore(styleEl, clone.firstChild);

    return {
      element: clone,
      svgString: new XMLSerializer().serializeToString(clone)
    };
  };

  useImperativeHandle(ref, () => ({
    getDimensions: () => ({
      widthMm: STAMP_WIDTH_MM,
      heightMm: STAMP_HEIGHT_MM,
      usedHeightMm: totalHeightUsedMm,
      isValid: isValidVertical
    }),
    getCleanVectorSVG,
    exportCleanSVG: async () => {
      const res = await getCleanVectorSVG();
      return res?.svgString || null;
    }
  }));

  return (
    <div 
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{
        ...style
      }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${STAMP_WIDTH_MM} ${STAMP_HEIGHT_MM}`}
        width={`${STAMP_WIDTH_MM}mm`}
        height={`${STAMP_HEIGHT_MM}mm`}
        className="w-full h-auto max-w-full drop-shadow-md rounded-md bg-white transition-all duration-200"
        style={{
          aspectRatio: `${STAMP_WIDTH_MM} / ${STAMP_HEIGHT_MM}`,
          boxShadow: `0 0 0 1.5px ${borderColor}`,
          borderRadius: '4px'
        }}
        shapeRendering="geometricPrecision"
        textRendering="geometricPrecision"
      >
        {/* Fondo blanco del sello (sin bordes stroke) */}
        <rect
          x="0"
          y="0"
          width={STAMP_WIDTH_MM}
          height={STAMP_HEIGHT_MM}
          fill="#FFFFFF"
        />

        {/* Guías Técnicas Opcionales */}
        {showGuides && (
          <g opacity="0.4">
            {/* Eje central horizontal y vertical */}
            <line x1="0" y1={STAMP_HEIGHT_MM / 2} x2={STAMP_WIDTH_MM} y2={STAMP_HEIGHT_MM / 2} stroke="#3B82F6" strokeWidth="0.15" strokeDasharray="0.5 0.5" />
            <line x1={STAMP_WIDTH_MM / 2} y1="0" x2={STAMP_WIDTH_MM / 2} y2={STAMP_HEIGHT_MM} stroke="#3B82F6" strokeWidth="0.15" strokeDasharray="0.5 0.5" />
          </g>
        )}

        {/* MODO ESCOLAR: Ícono como TRAZADOS VECTORIALES SVG DIRECTOS (100% Vectorial Puro, NUNCA <image>, NUNCA rasterizado) */}
        {mode === 'escolar' && iconVector && (
          <g transform={`translate(${iconX}, ${iconY}) scale(${iconScale}) translate(${-iconVector.vbX}, ${-iconVector.vbY})`}>
            <g dangerouslySetInnerHTML={{ __html: iconVector.content }} />
            {showGuides && (
              <rect
                x={iconVector.vbX}
                y={iconVector.vbY}
                width={iconVector.vbW}
                height={iconVector.vbH}
                fill="none"
                stroke="#F59E0B"
                strokeWidth={0.1 / iconScale}
                strokeDasharray={`${0.3 / iconScale} ${0.3 / iconScale}`}
              />
            )}
          </g>
        )}

        {/* Renderizado de Textos */}
        {linePositions.map((line, index) => {
          if (!line.texto) return null;
          const fontConfig = fontMap[line.fuente] || { css: 'sans-serif', fontStyle: 'normal', fontWeight: 'normal' };
          
          // Coordenada X
          // Profesional: centrado en todo el sello (x = 18)
          // Escolar: centrado dinámicamente en la columna a la derecha del ícono
          const basePosX = mode === 'escolar' ? schoolTextCenter : 18;
          const posX = basePosX + (line.xOffset || 0);
          const textAnchor = "middle";

          // Conversión de pt de font-size a mm de SVG (estrictamente independiente del ícono)
          const fontSizeMm = Number(line.size) * FACTOR_PT_A_MM;

          return (
            <g key={index}>
              {/* Guía de línea de base en modo técnico */}
              {showGuides && (
                <line 
                  x1={mode === 'escolar' ? textColStart : 0} 
                  y1={line.yPos} 
                  x2={STAMP_WIDTH_MM} 
                  y2={line.yPos} 
                  stroke="#60A5FA" 
                  strokeWidth="0.1" 
                />
              )}
              <text
                ref={(el) => { textRefs.current[index] = el; }}
                x={posX}
                y={line.yPos}
                textAnchor={textAnchor}
                fill="#000000"
                style={{
                  fontFamily: fontConfig.css,
                  fontStyle: fontConfig.fontStyle || 'normal',
                  fontWeight: fontConfig.fontWeight || 'normal',
                  fontSize: `${fontSizeMm}px`
                }}
              >
                {line.texto}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
});

export default StampCanvasPreview;
