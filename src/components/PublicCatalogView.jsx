// src/components/PublicCatalogView.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { addToCart } from '../store/cart';
import { parseDimensionsFromText } from '../lib/pricingEngine';

/**
 * Íconos vectoriales lineales minimalistas compuestos para las 3 Cards Cuadradas de Criterio de Uso
 */
const UsageCardIcon = ({ type, active }) => {
  const stroke = active ? '#FFFFFF' : '#495D56';
  const accent = active ? '#F4F1E1' : '#FF5E5E';

  if (type === 'pequenos') {
    // Sobre postal + Vaso de polipapel (takeaway)
    return (
      <svg width="56" height="44" viewBox="0 0 64 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Sobre */}
        <rect
          x="3"
          y="15"
          width="30"
          height="21"
          rx="3"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4 17L18 27L32 17"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Vaso de polipapel */}
        <path
          d="M40 13H58L55.5 40C55.4 41.1 54.5 42 53.4 42H44.6C43.5 42 42.6 41.1 42.5 40L40 13Z"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Tapa del vaso */}
        <path
          d="M38 13H60M41 9H57L58.5 13H39.5L41 9Z"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Faja térmica / sello en el vaso */}
        <circle cx="49" cy="26" r="4" stroke={accent} strokeWidth="2" />
      </svg>
    );
  }

  if (type === 'medianos') {
    // Bolsa de papel kraft con manija + Caja mediana de pastelería/envío
    return (
      <svg width="56" height="44" viewBox="0 0 64 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Bolsa papel mediana */}
        <path
          d="M6 16H28L29.5 41H4.5L6 16Z"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 16V12C12 9.2 14.2 7 17 7C19.8 7 22 9.2 22 12V16"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="17" cy="28" r="3.5" stroke={accent} strokeWidth="2" />
        {/* Caja mediana */}
        <rect
          x="35"
          y="21"
          width="24"
          height="20"
          rx="2.5"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M35 21L40 14H54L59 21"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M47 14V21" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  // Empaques Grandes: Caja de pizza / embalaje grande + Bolsón de delivery
  return (
    <svg width="56" height="44" viewBox="0 0 64 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Caja grande de embalaje / pizza */}
      <path
        d="M4 22L20 14L36 22L20 30L4 22Z"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 22V33L20 41L36 33V22"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M20 30V41" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      <circle cx="20" cy="22" r="3" stroke={accent} strokeWidth="2" />
      {/* Bolsón grande */}
      <rect
        x="41"
        y="14"
        width="19"
        height="27"
        rx="2.5"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M46 14V10C46 7.8 48 6 50.5 6C53 6 55 7.8 55 10V14"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
};

const USAGE_FILTERS = [
  {
    id: 'pequenos',
    title: 'Empaques Pequeños',
    subtitle: 'Sobres, vasos polipapel y tarjetas',
    badge: 'Hasta 6×6 cm',
  },
  {
    id: 'medianos',
    title: 'Empaques Medianos',
    subtitle: 'Bolsas papel, cajas chicas y delivery',
    badge: '7×7 a 10×10 cm',
  },
  {
    id: 'grandes',
    title: 'Empaques Grandes',
    subtitle: 'Cajas de pizza, embalaje y bolsones',
    badge: '11×11 a 20×20 cm',
  },
];

function matchesUsageCriteria(product, usageId) {
  if (!usageId) return true;

  const code = String(product.codigo || '').toUpperCase();
  const desc = String(product.descripcion || '').toLowerCase();
  const data = String(product.data || '').toLowerCase();
  const cat = String(product.categoria || '').toLowerCase();
  const combined = `${desc} ${data}`;

  // Extraer dimensiones en cm si existen en descripción
  const dims = parseDimensionsFromText(product.descripcion || '');
  const sumSides = dims ? dims.sumSides : null;
  const maxSide = dims ? Math.max(dims.width, dims.height) : null;

  if (usageId === 'pequenos') {
    if (cat.includes('tinta')) {
      return (
        code === 'QS-016' || // Combo Starter
        code === 'QS-021' || // Almohadilla Universal
        code === 'QS-023' || // Tinta 10cc
        code === 'QS-019'    // Tinta telas
      );
    }
    if (dims && !desc.includes('mm')) {
      return sumSides <= 12.5 && maxSide <= 6.5;
    }
    return (
      combined.includes('pequeño') ||
      combined.includes('polipapel') ||
      combined.includes('vaso') ||
      combined.includes('tarjeta') ||
      combined.includes('exlibris') ||
      combined.includes('escolar') ||
      combined.includes('automatico') ||
      combined.includes('automático') ||
      combined.includes('ceramica') ||
      combined.includes('cerámica')
    );
  }

  if (usageId === 'medianos') {
    if (cat.includes('tinta')) {
      return (
        code === 'QS-016' || // Combo Starter
        code === 'QS-020' || // Tinta 30cc
        code === 'QS-021'    // Almohadilla Universal
      );
    }
    if (desc.includes('emprende')) return true;
    if (dims && !desc.includes('mm')) {
      return sumSides >= 13 && sumSides <= 20.5;
    }
    return combined.includes('mediano') || combined.includes('mediana') || combined.includes('bolsas');
  }

  if (usageId === 'grandes') {
    if (cat.includes('tinta')) {
      return code === 'QS-037'; // Tinta 100cc
    }
    if (code === 'QS-038' || code === 'QS-040') return true; // Almohadilla 15x15 y Supersello 20x20
    if (dims && !desc.includes('mm')) {
      return sumSides >= 21;
    }
    return (
      combined.includes('grande') ||
      combined.includes('pizza') ||
      combined.includes('embalaje') ||
      combined.includes('supersello')
    );
  }

  return true;
}

export default function PublicCatalogView({ initialProducts = [] }) {
  const [products, setProducts] = useState(initialProducts);
  const [selectedUsage, setSelectedUsage] = useState(null); // null | 'pequenos' | 'medianos' | 'grandes'
  const [searchTerm, setSearchTerm] = useState('');
  const [addedId, setAddedId] = useState(null);

  // Actualizar en vivo desde Supabase para reflejar cualquier cambio de precios al instante
  useEffect(() => {
    supabase
      .from('productos')
      .select('*')
      .eq('franquicia_id', 1)
      .eq('activo', 1)
      .order('orden', { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setProducts(data);
        }
      });
  }, []);

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => Number(p.activo ?? 1) === 1)
      .filter((p) => {
        // No mostrar códigos temporales ESP-* en la vidriera pública salvo que se busquen por código exacto
        const code = String(p.codigo || '').toUpperCase();
        if (code.startsWith('ESP-') && !searchTerm.trim()) return false;
        return true;
      })
      .filter((p) => matchesUsageCriteria(p, selectedUsage))
      .filter((p) => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        return (
          (p.descripcion || '').toLowerCase().includes(q) ||
          (p.data || '').toLowerCase().includes(q) ||
          (p.codigo || '').toLowerCase().includes(q)
        );
      });
  }, [products, selectedUsage, searchTerm]);

  const groupedByCategory = useMemo(() => {
    const map = {};
    filteredProducts.forEach((p) => {
      const cat = p.categoria || 'Otros';
      if (!map[cat]) map[cat] = [];
      map[cat].push(p);
    });

    const preferredOrder = ['Sellos', 'Tintas', 'Servicios'];
    const sortedKeys = Object.keys(map).sort((a, b) => {
      const ia = preferredOrder.findIndex((x) => x.toLowerCase() === a.toLowerCase());
      const ib = preferredOrder.findIndex((x) => x.toLowerCase() === b.toLowerCase());
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });

    // Ordenar sellos de menor a mayor tamaño para facilitar lectura
    sortedKeys.forEach((k) => {
      map[k].sort((a, b) => {
        const da = parseDimensionsFromText(a.descripcion || '');
        const db = parseDimensionsFromText(b.descripcion || '');
        if (da && db) return da.area - db.area;
        return Number(a.precio || 0) - Number(b.precio || 0);
      });
    });

    return sortedKeys.map((cat) => ({ category: cat, items: map[cat] }));
  }, [filteredProducts]);

  const handleAdd = (prod) => {
    addToCart(prod);
    setAddedId(prod.id);
    setTimeout(() => {
      setAddedId((prev) => (prev === prod.id ? null : prev));
    }, 1000);
  };

  return (
    <div style={styles.wrapper}>
      {/* Cabecera de sección */}
      <div style={{ textAlign: 'center', marginBottom: '22px' }}>
        <span style={styles.kicker}>GUÍA RÁPIDA DE MEDIDAS Y PRECIOS</span>
        <h1 style={styles.mainTitle}>Catálogo Completo</h1>
        <p style={styles.subtitle}>
          Elegí el tipo de empaque que querés estampar para filtrar las medidas ideales, o explorá
          la lista completa por categoría:
        </p>
      </div>

      {/* 3 CARDS CUADRADAS DE FILTRO POR CRITERIO DE USO */}
      <div style={styles.usageGrid}>
        {USAGE_FILTERS.map((card) => {
          const isActive = selectedUsage === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setSelectedUsage((prev) => (prev === card.id ? null : card.id))}
              style={{
                ...styles.usageCard,
                background: isActive ? '#495D56' : '#FFFFFF',
                color: isActive ? '#FFFFFF' : '#495D56',
                borderColor: isActive ? '#495D56' : '#DFDED9',
                boxShadow: isActive
                  ? '0 10px 24px rgba(73, 93, 86, 0.22)'
                  : '0 4px 14px rgba(0, 0, 0, 0.04)',
              }}
            >
              <div
                style={{
                  ...styles.iconCircle,
                  background: isActive ? 'rgba(255,255,255,0.12)' : '#F4F1E1',
                }}
              >
                <UsageCardIcon type={card.id} active={isActive} />
              </div>

              <div style={{ fontSize: '13px', fontWeight: 800, lineHeight: 1.2, marginTop: '4px' }}>
                {card.title}
              </div>

              <div
                style={{
                  fontSize: '11px',
                  lineHeight: 1.3,
                  color: isActive ? '#E2E8F0' : '#64748B',
                  marginTop: '2px',
                }}
              >
                {card.subtitle}
              </div>

              <span
                style={{
                  marginTop: 'auto',
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '999px',
                  background: isActive ? '#FF5E5E' : '#F4F1E1',
                  color: isActive ? '#FFFFFF' : '#998E55',
                }}
              >
                {card.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Barra de búsqueda + estado de filtro activo */}
      <div style={styles.searchBarRow}>
        <div style={{ position: 'relative', flex: 1 }}>
          <img
            src="https://api.iconify.design/lucide/search.svg?color=%23998E55"
            style={{
              width: '17px',
              height: '17px',
              position: 'absolute',
              left: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
            }}
            alt=""
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar medida (ej: 5x5, 10x10, tinta, automático)..."
            style={styles.searchInput}
          />
        </div>

        {(selectedUsage || searchTerm) && (
          <button
            type="button"
            onClick={() => {
              setSelectedUsage(null);
              setSearchTerm('');
            }}
            style={styles.clearBtn}
          >
            Ver todos ({products.filter((p) => Number(p.activo ?? 1) === 1).length})
          </button>
        )}
      </div>

      {/* Listado de productos agrupados por Categoría */}
      {groupedByCategory.length === 0 ? (
        <div style={styles.emptyBox}>
          No encontramos productos con ese filtro. Probá tocando "Ver todos".
        </div>
      ) : (
        groupedByCategory.map(({ category, items }) => (
          <section key={category} style={styles.categorySection}>
            <div style={styles.categoryHeader}>
              <h2 style={styles.categoryTitle}>{category}</h2>
              <span style={styles.categoryCount}>{items.length} opciones</span>
            </div>

            <div style={styles.productList}>
              {items.map((prod) => {
                const isJustAdded = addedId === prod.id;
                return (
                  <div key={prod.id || prod.codigo} style={styles.productRow}>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={styles.codeBadge}>{prod.codigo}</span>
                        <span style={styles.productName}>{prod.descripcion}</span>
                      </div>
                      {prod.data && (
                        <div style={styles.productDetail}>{prod.data}</div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                      <span style={styles.productPrice}>
                        ${Number(prod.precio || 0).toLocaleString('es-AR')}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAdd(prod)}
                        style={{
                          ...styles.addBtn,
                          background: isJustAdded ? '#495D56' : '#FF5E5E',
                        }}
                        title="Agregar al pedido"
                      >
                        {isJustAdded ? '✓' : '+'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

const styles = {
  wrapper: {
    width: '100%',
    maxWidth: '640px',
    margin: '0 auto',
    padding: '10px 16px 40px 16px',
    fontFamily: 'Inter, sans-serif',
    boxSizing: 'border-box',
  },
  kicker: {
    display: 'inline-block',
    fontSize: '11px',
    fontWeight: 700,
    color: '#998E55',
    letterSpacing: '0.08em',
    background: '#F4F1E1',
    padding: '4px 12px',
    borderRadius: '999px',
    marginBottom: '8px',
  },
  mainTitle: {
    fontSize: '32px',
    fontWeight: 800,
    color: '#FF5E5E',
    margin: '0 0 8px 0',
    lineHeight: 1.15,
  },
  subtitle: {
    fontSize: '14px',
    color: '#495D56',
    margin: '0 auto',
    maxWidth: '480px',
    lineHeight: 1.5,
  },
  usageGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px',
    marginBottom: '18px',
  },
  usageCard: {
    aspectRatio: '1 / 1',
    borderRadius: '22px',
    border: '1.5px solid #DFDED9',
    padding: '12px 8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    textAlign: 'center',
    cursor: 'pointer',
    fontFamily: 'Inter, sans-serif',
    transition: 'all 0.2s ease',
    boxSizing: 'border-box',
  },
  iconCircle: {
    width: '62px',
    height: '50px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  searchBarRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    marginBottom: '22px',
  },
  searchInput: {
    width: '100%',
    padding: '13px 16px 13px 42px',
    borderRadius: '18px',
    border: '1px solid #DFDED9',
    background: '#FFFFFF',
    fontSize: '14px',
    color: '#1E293B',
    outline: 'none',
    fontFamily: 'Inter, sans-serif',
    boxSizing: 'border-box',
  },
  clearBtn: {
    background: '#F4F1E1',
    color: '#495D56',
    border: '1px solid #DFDED9',
    borderRadius: '16px',
    padding: '12px 14px',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontFamily: 'Inter, sans-serif',
  },
  categorySection: {
    marginBottom: '26px',
  },
  categoryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
    padding: '0 6px',
  },
  categoryTitle: {
    fontSize: '18px',
    fontWeight: 800,
    color: '#495D56',
    margin: 0,
    textAlign: 'left',
  },
  categoryCount: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#998E55',
    background: '#F4F1E1',
    padding: '3px 10px',
    borderRadius: '999px',
  },
  productList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  productRow: {
    background: '#FFFFFF',
    borderRadius: '18px',
    padding: '14px 16px',
    border: '1px solid rgba(223, 222, 217, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
  },
  codeBadge: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#998E55',
    background: '#F4F1E1',
    padding: '2px 7px',
    borderRadius: '6px',
  },
  productName: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#495D56',
  },
  productDetail: {
    fontSize: '12px',
    color: '#64748B',
    marginTop: '3px',
    lineHeight: 1.35,
  },
  productPrice: {
    fontSize: '16px',
    fontWeight: 800,
    color: '#8E1F52',
    whiteSpace: 'nowrap',
  },
  addBtn: {
    width: '34px',
    height: '34px',
    borderRadius: '12px',
    border: 'none',
    color: '#FFFFFF',
    fontWeight: 800,
    fontSize: '18px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background 0.15s ease',
  },
  emptyBox: {
    background: '#FFFFFF',
    borderRadius: '20px',
    padding: '32px 20px',
    textAlign: 'center',
    color: '#64748B',
    fontSize: '14px',
    border: '1px solid #DFDED9',
  },
};

