import React from 'react';

/**
 * Ícono lineal flat (lucide vía iconify), la misma iconografía que usa el admin y el sitio.
 */
export default function Icon({ name, size = 20, color = '#495D56', style }) {
  return (
    <img
      src={`https://api.iconify.design/lucide/${name}.svg?color=${encodeURIComponent(color)}`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0, ...style }}
    />
  );
}
