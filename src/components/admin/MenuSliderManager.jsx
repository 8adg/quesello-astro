import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import HeroSlideManager from './HeroSlideManager';
import {
  iconDelete, iconDrag, AddButton, FormActions, SwiperBehaviorPanel,
  SliderListRow, useDragReorder, badgeStyle, badgeOnStyle
} from './sliderAdminUI';

export default function MenuSliderManager() {
  const [activeTab, setActiveTab] = useState('productos'); // 'productos' | 'portada'
  const [menus, setMenus] = useState([]);
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [heroNewRequest, setHeroNewRequest] = useState(0);
  const [heroFormOpen, setHeroFormOpen] = useState(false);
  
  const dragItem = useRef();
  const dragOverItem = useRef();

  const [formData, setFormData] = useState({
    titulo: "", subtitulo: "", tipo: "categoria", categoriaTarget: "", items: [],
    config: { autoplay: true, delay: 2500, disableOnInteraction: true, slidesPerViewDesktop: 4, slidesPerViewMobile: 2 }
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pRes, cRes, configRes] = await Promise.all([
        supabase.from("productos").select("id, codigo, descripcion, img, categoria").eq("activo", 1).order("descripcion"),
        supabase.from("categorias").select("nombre"),
        supabase.from("config").select("*").eq("clave", "app_menus")
      ]);

      if (pRes.data) setProductos(pRes.data);
      if (cRes.data) setCategorias(cRes.data);
      
      let initialData = [];
      if (configRes.data && configRes.data.length > 0) {
        initialData = JSON.parse(configRes.data[0].valor);
      }
      setMenus(initialData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const saveAllToDB = async (newList) => {
    setSaving(true);
    const valStr = JSON.stringify(newList);
    try {
      await supabase.from("config").upsert({ clave: "app_menus", valor: valStr });
      setMenus(newList);
      return true;
    } catch (e) {
      alert("Error: " + e.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveForm = async (e) => {
    if (e) e.preventDefault();
    const dataToSave = { 
        ...formData, 
        id: editingId || "menu_" + Date.now().toString(36),
        // Aseguramos que config tenga valores por defecto si no existen
        config: {
            autoplay: formData.config?.autoplay ?? true,
            delay: formData.config?.delay ?? 2500,
            disableOnInteraction: formData.config?.disableOnInteraction ?? true,
            slidesPerViewDesktop: 4,
            slidesPerViewMobile: 2
        }
    };
    let newList = editingId ? menus.map(m => m.id === editingId ? dataToSave : m) : [...menus, dataToSave];
    if (await saveAllToDB(newList)) { setShowForm(false); setEditingId(null); }
  };

  const toggleProduct = (codigo) => {
    const items = [...formData.items];
    const index = items.indexOf(codigo);
    if (index > -1) items.splice(index, 1);
    else items.push(codigo);
    setFormData({ ...formData, items });
  };

  const handleCategoryChange = (catName) => {
    const catProducts = productos.filter(p => !catName || p.categoria === catName).map(p => p.codigo);
    setFormData({ ...formData, categoriaTarget: catName, items: catProducts });
  };

  const menuDragProps = useDragReorder(menus, (next) => saveAllToDB(next));

  const onItemDragEnd = () => {
    const newItems = [...formData.items];
    const dragged = newItems.splice(dragItem.current, 1)[0];
    newItems.splice(dragOverItem.current, 0, dragged);
    setFormData({ ...formData, items: newItems });
  };

  if (loading && menus.length === 0) return <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'Inter' }}>Cargando administrador...</div>;

  return (
    <div style={{ fontFamily: 'Inter', maxWidth: '1000px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: '#FF5E5E', fontWeight: 800, margin: 0 }}>Menús Sliders</h1>
          <p style={{ color: '#64748B', fontSize: '14px', marginTop: '5px' }}>Organiza y configura tus carruseles dinámicos y portada.</p>
        </div>
        {activeTab === 'productos' && !showForm && (
          <AddButton onClick={() => { setShowForm(true); setEditingId(null); setFormData({
            titulo: "", subtitulo: "", tipo: "categoria", categoriaTarget: "", items: [],
            config: { autoplay: true, delay: 2500, disableOnInteraction: true, slidesPerViewDesktop: 4, slidesPerViewMobile: 2 }
          }); }}>
            NUEVO CARRUSEL
          </AddButton>
        )}
        {activeTab === 'portada' && !heroFormOpen && (
          <AddButton onClick={() => setHeroNewRequest((n) => n + 1)}>
            NUEVO SLIDE DE PORTADA
          </AddButton>
        )}
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', background: '#F1F5F9', padding: '6px', borderRadius: '18px', marginBottom: '25px', width: 'fit-content' }}>
        <button
          onClick={() => setActiveTab('productos')}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 22px',
            borderRadius: '14px',
            border: 'none',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            background: activeTab === 'productos' ? '#FFFFFF' : 'transparent',
            color: activeTab === 'productos' ? '#1E293B' : '#64748B',
            boxShadow: activeTab === 'productos' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          <img src={`https://api.iconify.design/lucide/layout-list.svg?color=${activeTab === 'productos' ? '%231E293B' : '%2364748B'}`} style={{ width: '18px' }} alt="" />
          Carruseles de Catálogo
        </button>
        <button
          onClick={() => setActiveTab('portada')}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 22px',
            borderRadius: '14px',
            border: 'none',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            background: activeTab === 'portada' ? '#FFFFFF' : 'transparent',
            color: activeTab === 'portada' ? '#1E293B' : '#64748B',
            boxShadow: activeTab === 'portada' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          <img src={`https://api.iconify.design/lucide/image.svg?color=${activeTab === 'portada' ? '%231E293B' : '%2364748B'}`} style={{ width: '18px' }} alt="" />
          Slides de Portada (Hero)
        </button>
      </div>

      {activeTab === 'portada' ? (
        <HeroSlideManager newRequest={heroNewRequest} onFormToggle={setHeroFormOpen} />
      ) : (
        <>

      {showForm && (
        <div style={{ background: 'white', padding: '35px', borderRadius: '35px', marginBottom: '40px', boxShadow: '0 20px 50px rgba(0,0,0,0.08)', border: '1px solid #f0f0f0' }}>
          <form onSubmit={handleSaveForm}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
              {/* COLUMNA IZQUIERDA: TEXTOS Y CONFIG */}
              <div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#998E55', marginBottom: '8px' }}>TÍTULO PRINCIPAL</label>
                  <input type="text" required value={formData.titulo} onChange={(e) => setFormData({...formData, titulo: e.target.value})} style={{ width: '100%', padding: '16px', borderRadius: '14px', border: '2px solid #F1F5F9', outline: 'none' }} />
                </div>
                <div style={{ marginBottom: '25px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#998E55', marginBottom: '8px' }}>SUBTÍTULO</label>
                  <input type="text" value={formData.subtitulo} onChange={(e) => setFormData({...formData, subtitulo: e.target.value})} style={{ width: '100%', padding: '16px', borderRadius: '14px', border: '2px solid #F1F5F9', outline: 'none' }} />
                </div>

                <SwiperBehaviorPanel config={formData.config} onChange={(config) => setFormData({ ...formData, config })} />
              </div>

              {/* COLUMNA DERECHA: TEMA CARGA */}
              <div>
                <div style={{ marginBottom: '20px' }}>
                   <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#998E55', marginBottom: '8px' }}>MODO DE CARGA</label>
                   <select value={formData.tipo} onChange={(e) => setFormData({...formData, tipo: e.target.value})} style={{ width: '100%', padding: '16px', borderRadius: '14px', border: '2px solid #F1F5F9', background: 'white' }}>
                    <option value="categoria">Dinámico por Categoría</option>
                    <option value="mixto">Selección Libre / Mixto</option>
                   </select>
                </div>
                <div style={{ marginBottom: '20px' }}>
                   <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#998E55', marginBottom: '8px' }}>FILTRAR CATÁLOGO POR</label>
                   <select value={formData.categoriaTarget} onChange={(e) => handleCategoryChange(e.target.value)} style={{ width: '100%', padding: '16px', borderRadius: '14px', border: '2px solid #F1F5F9', background: 'white' }}>
                    <option value="">-- Ver Todas --</option>
                    {categorias.map(c => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
                   </select>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '30px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ background: '#F8FAFC', padding: '20px', borderRadius: '24px', border: '2px dashed #E2E8F0', minHeight: '300px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '15px' }}>PRODUCTOS EN CARRUSEL ({formData.items.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                    {formData.items.map((codigo, idx) => {
                      const p = productos.find(x => x.codigo === codigo);
                      if (!p) return null;
                      return (
                        <div key={codigo} draggable onDragStart={(e) => { dragItem.current = idx; }} onDragEnter={(e) => { dragOverItem.current = idx; }} onDragEnd={onItemDragEnd} onDragOver={(e) => e.preventDefault()}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', cursor: 'grab' }}>
                          <span style={{ color: '#CBD5E1' }}>{iconDrag}</span>
                          <span style={{ fontSize: '13px', fontWeight: 600, flex: 1 }}>{p.descripcion}</span>
                          <button type="button" onClick={() => toggleProduct(codigo)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#1E293B' }}>{iconDelete}</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div style={{ background: '#F1F5F9', padding: '20px', borderRadius: '24px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '15px' }}>DISPONIBLES EN CATÁLOGO</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                    {productos.filter(p => !formData.items.includes(p.codigo)).filter(p => !formData.categoriaTarget || p.categoria === formData.categoriaTarget).map(p => (
                      <div key={p.id} onClick={() => toggleProduct(p.codigo)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: 'rgba(255,255,255,0.7)', borderRadius: '12px', cursor: 'pointer' }}>
                        <span style={{ fontSize: '13px', flex: 1 }}>{p.descripcion}</span>
                        <span style={{ fontSize: '18px', color: '#FF5E5E', fontWeight: 800 }}>+</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <FormActions onCancel={() => setShowForm(false)} saving={saving} saveLabel="GUARDAR CARRUSEL" />
          </form>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {menus.map((m, idx) => (
          <SliderListRow
            key={m.id}
            dragProps={menuDragProps(idx)}
            title={m.titulo}
            subtitle={m.subtitulo}
            badges={<>
              <span style={badgeStyle}>Tipo: {m.tipo}</span>
              {m.config?.autoplay && <span style={badgeOnStyle}>Autoplay ON</span>}
            </>}
            onEdit={() => { setFormData(m); setEditingId(m.id); setShowForm(true); }}
            onDelete={() => saveAllToDB(menus.filter(x => x.id !== m.id))}
          />
        ))}
      </div>
      </>
      )}
    </div>
  );
}
