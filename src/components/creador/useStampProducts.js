import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

// Productos del sistema que respaldan cada categoría del creador.
export const STAMP_PRODUCT_CODES = {
  profesional: 'QS-002', // Sello automático
  escolar: 'QS-022'      // Sello Automático escolar
};

/**
 * Devuelve { profesional, escolar, status } con { codigo, descripcion, precio }
 * leídos de la tabla `productos`. status: 'loading' | 'ready' | 'error'
 */
export default function useStampProducts() {
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    supabase
      .from('productos')
      .select('codigo, descripcion, precio')
      .in('codigo', Object.values(STAMP_PRODUCT_CODES))
      .then(({ data, error }) => {
        if (!alive) return;
        if (error || !data) {
          setState({ status: 'error' });
          return;
        }
        const byCode = Object.fromEntries(data.map((p) => [p.codigo, p]));
        const next = { status: 'ready' };
        for (const [cat, code] of Object.entries(STAMP_PRODUCT_CODES)) {
          if (byCode[code]) next[cat] = byCode[code];
        }
        setState(next);
      });
    return () => { alive = false; };
  }, []);

  return state;
}

export const formatPrice = (n) =>
  typeof n === 'number' ? `$${n.toLocaleString('es-AR')}` : '—';
