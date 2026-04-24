import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import DynamicSlider from './DynamicSlider';

const FALLBACK_CATEGORIES = ['sellos', 'tintas'];

export default function SlidersLoader() {
  const [sliders, setSliders] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      // Traer productos y config en paralelo
      const [pRes, cRes] = await Promise.all([
        supabase.from('productos').select('*').eq('franquicia_id', 1).eq('activo', 1).order('orden', { ascending: true }),
        supabase.from('config').select('valor').eq('clave', 'app_menus')
      ]);

      const products = pRes.data || [];
      const rawValor = cRes.data && cRes.data.length > 0 ? cRes.data[0].valor : null;

      let finalSliders = [];

      if (rawValor) {
        // Sliders configurados desde el Admin
        const slidersConfig = JSON.parse(rawValor);
        finalSliders = slidersConfig.map(config => {
          let items = [];
          if (config.items && config.items.length > 0) {
            items = config.items.map(codigo => products.find(p => p.codigo === codigo)).filter(Boolean);
          } else if (config.categoriaTarget) {
            items = products.filter(p => p.categoria?.toLowerCase().trim() === config.categoriaTarget.toLowerCase().trim());
          }
          return { title: config.titulo, subtitle: config.subtitulo, items, config: config.config || {} };
        }).filter(s => s.items.length > 0);
      } else {
        // Fallback: agrupar por categoría
        const byCategory = products.reduce((acc, p) => {
          const cat = (p.categoria || 'otros').toLowerCase().trim();
          if (!acc[cat]) acc[cat] = [];
          acc[cat].push(p);
          return acc;
        }, {});

        const orderedCategories = [
          ...FALLBACK_CATEGORIES.filter(c => byCategory[c]?.length > 0),
          ...Object.keys(byCategory).filter(c => !FALLBACK_CATEGORIES.includes(c) && c !== 'otros'),
          ...(byCategory['otros']?.length > 0 ? ['otros'] : [])
        ];

        finalSliders = orderedCategories.map(cat => ({
          title: cat,
          subtitle: null,
          items: byCategory[cat],
          config: { autoplay: true, delay: 2500 }
        }));
      }

      setSliders(finalSliders);
    } catch (e) {
      console.error('SlidersLoader error:', e);
    } finally {
      setReady(true);
    }
  };

  if (!ready) return (
    <div style={{ textAlign: 'center', padding: '60px 0', opacity: 0.3, fontSize: '14px' }}>
      Cargando catálogo...
    </div>
  );

  if (sliders.length === 0) return null;

  return (
    <>
      {sliders.map((slider, idx) => (
        <DynamicSlider
          key={`slider-${idx}`}
          title={slider.title}
          subtitle={slider.subtitle}
          items={slider.items}
          config={slider.config}
        />
      ))}
    </>
  );
}
