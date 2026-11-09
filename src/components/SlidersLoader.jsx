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
      {sliders.map((slider, idx) => {
        const isStampsSlider =
          idx === 0 || (slider.title && slider.title.toLowerCase().includes('sello'));
        const showCatalogLinkAfter =
          idx === 0 ||
          (isStampsSlider &&
            !sliders.slice(0, idx).some((s) => s.title?.toLowerCase().includes('sello')));

        return (
          <React.Fragment key={`slider-${idx}`}>
            <DynamicSlider
              title={slider.title}
              subtitle={slider.subtitle}
              items={slider.items}
              config={slider.config}
            />
            {showCatalogLinkAfter && idx === 0 && (
              <div
                style={{
                  width: '100%',
                  maxWidth: '390px',
                  margin: '-36px auto 16px auto',
                  padding: '0 20px',
                  boxSizing: 'border-box',
                }}
              >
                <a
                  href="/catalogo"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '13px 18px',
                    borderRadius: '20px',
                    background: '#F4F1E1',
                    border: '1px solid rgba(73, 93, 86, 0.25)',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
                    textDecoration: 'none',
                    boxSizing: 'border-box',
                    gap: '12px',
                  }}
                >
                  <div style={{ textAlign: 'left' }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '10px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: '#FF5E5E',
                        lineHeight: 1.2,
                      }}
                    >
                      Guía interactiva por uso
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '13px',
                        fontWeight: 800,
                        color: '#495D56',
                        lineHeight: 1.3,
                        marginTop: '3px',
                      }}
                    >
                      Ver catálogo completo por tipo de empaque
                    </span>
                  </div>
                  <span
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '10px',
                      background: '#495D56',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    →
                  </span>
                </a>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}
