import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import {
  FormCard, FormField, FormActions, SwiperBehaviorPanel, SliderListRow,
  useDragReorder, inputStyle, badgeStyle
} from './sliderAdminUI';

const DEFAULT_SLIDES = [
  {
    id: 'hero-1',
    titulo: 'Tu sello<br />es emprender',
    subtitulo: '',
    imagen: '/portada.png',
    botonTexto: 'Quiero mi sello',
    botonUrl: '/creador'
  }
];

const EMPTY_SLIDE = {
  titulo: 'Tu sello<br />es emprender',
  subtitulo: '',
  imagen: '/portada.png',
  botonTexto: 'Quiero mi sello',
  botonUrl: '/creador'
};

const DEFAULT_CONFIG = { autoplay: true, delay: 4500, disableOnInteraction: false, effect: 'slide' };

/**
 * Slides de portada. Misma estructura que MenuSliderManager:
 * lista con drag & drop, formulario en tarjeta y caja "Comportamiento Swiper".
 * El botón de alta vive en el header del módulo (props newRequest / onFormToggle).
 */
export default function HeroSlideManager({ newRequest = 0, onFormToggle }) {
  const [slides, setSlides] = useState([]);
  const [swiperConfig, setSwiperConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_SLIDE);
  const configTimer = useRef(null);

  useEffect(() => { loadData(); }, []);

  // Alta solicitada desde el header del módulo
  useEffect(() => {
    if (newRequest > 0) {
      setEditingIndex(null);
      setFormData(EMPTY_SLIDE);
      setShowForm(true);
    }
  }, [newRequest]);

  useEffect(() => { onFormToggle?.(showForm); }, [showForm]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('config').select('*').eq('clave', 'app_hero_slides').maybeSingle();
      if (data && data.valor) {
        const parsed = JSON.parse(data.valor);
        if (Array.isArray(parsed)) {
          setSlides(parsed);
        } else {
          setSlides(parsed.slides || DEFAULT_SLIDES);
          if (parsed.config) setSwiperConfig({ ...DEFAULT_CONFIG, ...parsed.config });
        }
      } else {
        setSlides(DEFAULT_SLIDES);
      }
    } catch (e) {
      console.error(e);
      setSlides(DEFAULT_SLIDES);
    } finally {
      setLoading(false);
    }
  };

  const saveToDB = async (newSlides, newConfig = swiperConfig) => {
    setSaving(true);
    try {
      await supabase.from('config').upsert({ clave: 'app_hero_slides', valor: JSON.stringify({ slides: newSlides, config: newConfig }) });
      setSlides(newSlides);
      setSwiperConfig(newConfig);
      return true;
    } catch (err) {
      alert('Error guardando slides: ' + err.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleConfigChange = (nextCfg) => {
    setSwiperConfig(nextCfg);
    clearTimeout(configTimer.current);
    configTimer.current = setTimeout(() => saveToDB(slides, nextCfg), 600);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    const updated = editingIndex !== null
      ? slides.map((s, i) => (i === editingIndex ? { ...formData, id: s.id || `hero-${Date.now()}` } : s))
      : [...slides, { ...formData, id: `hero-${Date.now()}` }];
    if (await saveToDB(updated)) { setShowForm(false); setEditingIndex(null); }
  };

  const handleDelete = (idx) => {
    if (!confirm('¿Eliminar este slide de portada?')) return;
    saveToDB(slides.filter((_, i) => i !== idx));
  };

  const dragProps = useDragReorder(slides, (next) => saveToDB(next));

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'Inter' }}>Cargando slides de portada...</div>;

  const set = (key) => (e) => setFormData({ ...formData, [key]: e.target.value });

  return (
    <div style={{ fontFamily: 'Inter' }}>
      {showForm && (
        <FormCard onSubmit={handleSubmitForm}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '10px' }}>
            <div>
              <FormField label="TÍTULO PRINCIPAL" hint="Para saltos de línea usá <br />">
                <input type="text" required value={formData.titulo} onChange={set('titulo')} style={inputStyle} />
              </FormField>
              <FormField label="SUBTÍTULO" hint="Permite tags HTML como <br />, <span>, <b>, etc.">
                <input type="text" value={formData.subtitulo} onChange={set('subtitulo')} style={inputStyle} />
              </FormField>
              <FormField label="URL IMAGEN" hint="PNG transparente">
                <input type="text" required value={formData.imagen} onChange={set('imagen')} style={inputStyle} />
              </FormField>
            </div>
            <div>
              <FormField label="TEXTO DEL BOTÓN">
                <input type="text" required value={formData.botonTexto} onChange={set('botonTexto')} style={inputStyle} />
              </FormField>
              <FormField label="ENLACE DEL BOTÓN">
                <input type="text" required value={formData.botonUrl} onChange={set('botonUrl')} placeholder="/creador o enlace completo" style={inputStyle} />
              </FormField>
            </div>
          </div>
          <FormActions onCancel={() => { setShowForm(false); setEditingIndex(null); }} saving={saving} saveLabel="GUARDAR SLIDE" />
        </FormCard>
      )}

      {!showForm && (
        <SwiperBehaviorPanel config={swiperConfig} onChange={handleConfigChange} showEffect />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {slides.map((s, idx) => (
          <SliderListRow
            key={s.id || idx}
            dragProps={dragProps(idx)}
            thumb={s.imagen}
            title={<span dangerouslySetInnerHTML={{ __html: s.titulo }} />}
            subtitle={s.subtitulo ? <span dangerouslySetInnerHTML={{ __html: s.subtitulo }} /> : null}
            badges={<span style={badgeStyle}>Botón: {s.botonTexto} ({s.botonUrl})</span>}
            onEdit={() => { setEditingIndex(idx); setFormData(s); setShowForm(true); }}
            onDelete={() => handleDelete(idx)}
          />
        ))}
      </div>
    </div>
  );
}
