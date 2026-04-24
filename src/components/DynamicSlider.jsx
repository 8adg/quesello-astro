import React, { useState, useEffect } from 'react';
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import { addToCart } from "../store/cart";
import { toast, Toaster } from "react-hot-toast";

// Importación total de estilos para evitar fallos de carga
import "swiper/css";
import "swiper/css/autoplay";

export default function DynamicSlider({ title, subtitle, items, config = {} }) {
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    // Delay de seguridad para que el DOM se asiente
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleAddToCart = (p) => {
    addToCart(p);
    toast.success(`Agregado a tu pedido`, {
      style: { borderRadius: '24px', background: '#495D56', color: '#fff' },
    });
  };

  if (!items || items.length === 0) return null;

  return (
    <section className="section" style={{ width: '100vw', overflow: 'hidden', paddingBottom: '60px' }}>
      <Toaster position="bottom-center" />
      <div style={{ textAlign: 'center', marginBottom: '24px', width: '100%', padding: '0 20px' }}>
        <h2 style={{ textTransform: 'lowercase', fontSize: '28px', color: 'var(--primary)', marginBottom: '8px' }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ fontWeight: 600, fontSize: '14px', maxWidth: '340px', margin: '0 auto', color: '#495D56' }}>
            {subtitle}
          </p>
        )}
      </div>

      <div style={{ width: '100%', minHeight: '300px' }}>
        {isReady ? (
          <Swiper
            modules={[Autoplay]}
            autoplay={config.autoplay ? {
              delay: config.delay || 2500,
              disableOnInteraction: config.disableOnInteraction !== false,
            } : false}
            loop={items.length > 2}
            spaceBetween={20}
            slidesPerView="auto"
            centeredSlides={true}
            style={{ width: '100%', overflow: 'visible' }}
          >
            {items.map((p, i) => (
              <SwiperSlide key={`${p.codigo}-${i}`} style={{ width: '300px' }}>
                <div
                  className="card"
                  style={{
                    width: '100%',
                    backgroundImage: `linear-gradient(rgba(0,0,0,0.1), rgba(0,0,0,0.4)), url("${p.img || '/Android Compact-ajustado.png'}")`
                  }}
                >
                  <div className="card-top">
                    <h2 style={{ color: 'white', textAlign: 'left', fontSize: '22px', marginBottom: '4px' }}>{p.descripcion}</h2>
                    <h1 style={{ textAlign: 'left', fontSize: '36px', color: 'white', margin: '0 0 8px 0' }}>$ {p.precio?.toLocaleString()}</h1>
                    <h4 style={{ color: 'rgba(255,255,255,0.85)', textAlign: 'left', fontSize: '14px' }}>{p.data}</h4>
                  </div>
                  <button className="btn" onClick={() => handleAddToCart(p)}>Encargar</button>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        ) : (
            <div style={{ textAlign: 'center', padding: '100px 0', opacity: 0.1 }}>...</div>
        )}
      </div>
    </section>
  );
}
