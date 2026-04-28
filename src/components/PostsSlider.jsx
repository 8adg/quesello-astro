import React, { useState, useEffect } from 'react';
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";

import "swiper/css";
import "swiper/css/autoplay";

export default function PostsSlider({ title, posts }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return "";
    const fecha = new Date(fechaStr);
    return `Publicado el ${fecha.getDate()}/${fecha.getMonth() + 1}/${fecha.getFullYear()}`;
  };

  if (!posts || posts.length === 0) return null;

  return (
    <section style={{ width: '100%', overflow: 'hidden', paddingBottom: '40px' }}>
      <div style={{ padding: '0 20px', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#3b5276', margin: 0, textTransform: 'capitalize' }}>
          {title}
        </h2>
      </div>

      <div style={{ width: '100%' }}>
        {isReady ? (
          <Swiper
            modules={[Autoplay]}
            autoplay={{ delay: 3500, disableOnInteraction: true }}
            loop={false}
            spaceBetween={20}
            slidesPerView="auto"
            centeredSlides={false}
            style={{ width: '100%', overflow: 'visible', paddingLeft: '20px', height: '95%' }}
          >
            {posts.map((p, i) => {
              const angles = [-1.5, 1.2, -0.8, 1.5, -1, 2];
              const rotation = angles[i % angles.length];

              return (
              <SwiperSlide key={`${p.slug}-${i}`} style={{ width: '85vw', maxWidth: '380px', height: 'auto' }}>
                <a
                  href={p.categoria ? `/posts/${p.categoria}/${p.slug}` : `/posts/${p.slug}`}
                  style={{
                    textDecoration: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'white',
                    borderRadius: '24px',
                    overflow: 'hidden',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                    border: '1px solid #F1F5F9',
                    transition: 'transform 0.2s',
                    height: '100%',
                    transform: `rotate(${rotation}deg)`
                  }}
                >
                  {p.imagen_url && (
                    <img
                      src={p.imagen_url}
                      alt={p.titulo}
                      style={{ width: '95vw', height: 'auto', maxHeight: '220px', objectFit: 'cover', display: 'block' }}
                    />
                  )}
                  <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>
                        {formatearFecha(p.creado_en)}
                      </span>
                      {p.categoria && (
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#FF5E5E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {p.categoria}
                        </span>
                      )}
                    </div>

                    <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#1E293B', margin: '0 0 8px 0' }}>
                      {p.titulo}
                    </h2>
                    {p.subtitulo && (
                      <p style={{ fontSize: '15px', color: '#64748B', fontWeight: 600, margin: '0 0 12px 0' }}>
                        {p.subtitulo}
                      </p>
                    )}

                    <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
                      <span style={{ fontSize: '13px', color: '#FF5E5E', fontWeight: 700 }}>
                        Leer más →
                      </span>
                    </div>
                  </div>
                </a>
              </SwiperSlide>
              );
            })}
          </Swiper>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 0', opacity: 0.1 }}>...</div>
        )}
      </div>
    </section>
  );
}
