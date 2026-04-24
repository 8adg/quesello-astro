import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function CategoryManager() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [nombre, setNombre] = useState('');
  
  const FRANQUICIA_ID = 1;

  const loadCategories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .eq('franquicia_id', FRANQUICIA_ID)
      .order('orden', { ascending: true }); // Orden por la nueva columna
    
    // Fallback: si no hay orden cargado o falla, ordenamos por nombre
    if (error) {
        const { data: d2 } = await supabase.from('categorias').select('*').eq('franquicia_id', FRANQUICIA_ID).order('nombre');
        if (d2) setCategories(d2);
    } else {
        if (data) setCategories(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const payload = {
      nombre: nombre.toUpperCase(),
      franquicia_id: FRANQUICIA_ID
    };

    if (editingCategory) {
      await supabase.from('categorias').update(payload).eq('id', editingCategory.id);
    } else {
      // Al crear nueva, le ponemos el orden al final
      payload.orden = categories.length;
      await supabase.from('categorias').insert([payload]);
    }

    setNombre('');
    setEditingCategory(null);
    setShowEditor(false);
    loadCategories();
  };

  const deleteCategory = async (id) => {
    if (confirm('¿Seguro que deseas eliminar esta categoría?')) {
      await supabase.from('categorias').delete().eq('id', id);
      loadCategories();
    }
  };

  // --- LÓGICA DRAG & DROP ---
  const [draggedItem, setDraggedItem] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedItem(categories[index]);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
  };

  const handleDrop = async (e, index) => {
    e.preventDefault();
    const dropItem = categories[index];
    if (draggedItem === dropItem) return;

    let newCategories = categories.filter(item => item !== draggedItem);
    newCategories.splice(index, 0, draggedItem);
    
    setCategories(newCategories);
    setDraggedItem(null);

    // Persistencia
    const updates = newCategories.map((c, idx) => ({
        id: c.id,
        nombre: c.nombre, 
        franquicia_id: FRANQUICIA_ID,
        orden: idx
    }));

    const { error } = await supabase.from('categorias').upsert(updates);
    if (error) console.error("Error guardando orden de categorías:", error);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'Inter' }}>
      
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h1 style={{ fontSize: '28px', color: '#FF5E5E', fontWeight: 800, margin: 0 }}>Categorias</h1>
        <button 
          onClick={() => {
            setEditingCategory(null);
            setNombre('');
            setShowEditor(true);
          }}
          style={{
            background: '#FF5E5E',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '20px',
            fontWeight: 500,
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Nueva Categoria
        </button>
      </header>

      <hr style={{ border: 'none', height: '2px', background: '#aba9a4', opacity: 0.2, margin: '24px 0' }} />

      {showEditor && (
        <div style={{ 
          background: 'rgba(250, 249, 246, 0.8)', 
          padding: '24px', 
          borderRadius: '24px', 
          marginBottom: '30px',
          border: '1px solid #dfded9'
        }}>
          <form onSubmit={handleSave} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 700, color: '#998E55' }}>NOMBRE DE CATEGORIA</label>
              <input 
                type="text" 
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                placeholder="EJ: SELLOS AUTOMATICOS"
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  border: '1px solid #dfded9',
                  background: 'white',
                  fontSize: '14px'
                }}
              />
            </div>
            <button type="submit" style={{ background: '#495D56', color: 'white', border: 'none', padding: '14px 24px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>
              {editingCategory ? 'ACTUALIZAR' : 'GUARDAR'}
            </button>
            <button type="button" onClick={() => setShowEditor(false)} style={{ background: '#eee', color: '#666', border: 'none', padding: '14px 24px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>
              CANCELAR
            </button>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', padding: '0 20px', marginBottom: '10px', color: '#998E55', fontSize: '12px', fontWeight: 400, letterSpacing: '0.02em', fontFamily: 'Inter' }}>
          <div style={{ width: '30px' }}></div>
          <div style={{ flex: 1 }}>Nombre</div>
          <div style={{ width: '100px', textAlign: 'right' }}>Acciones</div>
        </div>

        {loading && categories.length === 0 ? (
          <p>Cargando categorias...</p>
        ) : (
          categories.map((cat, idx) => (
            <div 
              key={cat.id} 
              draggable="true"
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                padding: '20px', 
                background: 'white', 
                borderRadius: '24px',
                border: '1px solid #f0f0f0',
                cursor: 'move',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
              <div style={{ width: '30px', color: '#dfded9', cursor: 'grab' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
              </div>
              <div style={{ flex: 1, fontWeight: 500, color: '#495D56' }}>{cat.nombre}</div>
              <div style={{ width: '100px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button 
                  onClick={() => {
                    setEditingCategory(cat);
                    setNombre(cat.nombre);
                    setShowEditor(true);
                  }}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
                >
                  <img src="https://api.iconify.design/lucide:edit-3.svg?color=%23495D56" style={{ width: '20px' }} />
                </button>
                <button 
                  onClick={() => deleteCategory(cat.id)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
                >
                  <img src="https://api.iconify.design/lucide:trash-2.svg?color=%23FF5E5E" style={{ width: '20px' }} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
