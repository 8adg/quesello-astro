import React, { useState, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, EffectFade, EffectCoverflow, Pagination } from 'swiper/modules';
import { supabase } from '../lib/supabase';

// Estilos de Swiper
import 'swiper/css';
import 'swiper/css/effect-fade';
import 'swiper/css/effect-coverflow';
import 'swiper/css/pagination';

const DEFAULT_SLIDES = [
  {
    id: 'slide-default-1',
    titulo: 'Tu sello<br />es emprender',
    subtitulo: '',
    imagen: '/portada.png',
    botonTexto: 'Quiero mi sello',
    botonUrl: '/creador'
  }
];

export default function HeroSlider() {
  const [slides, setSlides] = useState(DEFAULT_SLIDES);
  const [swiperConfig, setSwiperConfig] = useState({
    autoplay: true,
    delay: 4500,
    effect: 'slide' // 'slide' | 'fade' | 'coverflow'
  });

  useEffect(() => {
    loadHeroSlides();
  }, []);

  const loadHeroSlides = async () => {
    try {
      const { data, error } = await supabase
        .from('config')
        .select('valor')
        .eq('clave', 'app_hero_slides')
        .maybeSingle();

      if (data && data.valor) {
        const parsed = JSON.parse(data.valor);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSlides(parsed);
        } else if (parsed.slides && parsed.slides.length > 0) {
          setSlides(parsed.slides);
          if (parsed.config) setSwiperConfig(prev => ({ ...prev, ...parsed.config }));
        }
      }
    } catch (e) {
      console.warn('Usando slide por defecto:', e);
    }
  };

  const modules = [Autoplay, Pagination];
  if (swiperConfig.effect === 'fade') modules.push(EffectFade);
  if (swiperConfig.effect === 'coverflow') modules.push(EffectCoverflow);

  return (
    <section className="w-full flex justify-center pt-[54px]! pb-4 overflow-hidden">
      <div className="w-full max-w-[480px] px-4">
        <Swiper
          modules={modules}
          effect={swiperConfig.effect || 'slide'}
          fadeEffect={{ crossFade: true }}
          autoplay={
            swiperConfig.autoplay
              ? { delay: swiperConfig.delay || 4500, disableOnInteraction: !!swiperConfig.disableOnInteraction }
              : false
          }
          pagination={slides.length > 1 ? { clickable: true, dynamicBullets: true } : false}
          loop={slides.length > 1}
          className="w-full !pb-8"
        >
          {slides.map((slide, idx) => (
            <SwiperSlide key={slide.id || idx}>
              <div className="flex flex-col items-center text-center">
                
                {/* Título */}
                <h1
                  className="font-extrabold text-[#FF5555] text-3xl sm:text-4xl leading-tight mb-2 tracking-tight"
                  style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                  dangerouslySetInnerHTML={{ __html: slide.titulo || 'Tu sello es emprender' }}
                />

                {/* Subtítulo opcional */}
                {slide.subtitulo && (
                  <p
                    className="text-sm sm:text-base text-[#495D56] opacity-85 mb-3 max-w-sm"
                    dangerouslySetInnerHTML={{ __html: slide.subtitulo }}
                  />
                )}

                {/* Imagen Central Transparente */}
                <div className="w-full flex justify-center my-1">
                  <img
                    src={slide.imagen || '/portada.png'}
                    alt="Portada Queselló"
                    className="w-full sm:max-w-[380px] h-auto object-contain transition-transform duration-300 hover:scale-[1.02]"
                    loading={idx === 0 ? 'eager' : 'lazy'}
                  />
                </div>

                {/* Botón Principal (CTA) */}
                <div className="mt-2">
                  <a
                    href={slide.botonUrl || '/creador'}
                    className="btn inline-flex items-center justify-center px-8 py-3 rounded-full bg-[#FF5555] hover:bg-[#E04444] text-white font-bold text-base hover:shadow-lg transition-all"
                  >
                    {slide.botonTexto || 'Quiero mi sello'}
                  </a>
                </div>

              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}
