import React, { useState, useEffect } from 'react';
import ProductRow from './ProductRow';
import { supabase } from '../../lib/supabase';

export default function ProductManager() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [view, setView] = useState('list'); // 'list' | 'form'
  const [editingProduct, setEditingProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const FRANQUICIA_ID = 1;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (products.length === 0) setLoading(true);
    const [pRes, cRes] = await Promise.all([
      supabase.from('productos').select('*').eq('franquicia_id', FRANQUICIA_ID).order('orden', { ascending: true }),
      supabase.from('categorias').select('*').eq('franquicia_id', FRANQUICIA_ID).order('nombre')
    ]);
    
    if (pRes.data) setProducts(pRes.data);
    if (cRes.data) setCategories(cRes.data);
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (confirm('¿Seguro desea eliminar este producto?')) {
      await supabase.from('productos').delete().eq('id', id);
      loadData();
    }
  };

  const handleEdit = (p) => {
    setEditingProduct(p);
    setView('form');
  };

  const handleCreate = () => {
    setEditingProduct(null);
    setView('form');
  };

  const handleSave = () => {
    setView('list');
    loadData();
  };

  const filtered = products.filter(p => 
    p.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.codigo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- LÓGICA DRAG & DROP ---
  const [draggedItem, setDraggedItem] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedItem(products[index]);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
  };

  const handleDrop = async (e, index) => {
    e.preventDefault();
    const dropItem = products[index];
    if (draggedItem === dropItem) return;

    let newProducts = products.filter(item => item !== draggedItem);
    newProducts.splice(index, 0, draggedItem);
    
    // Optimismo: actualizamos UI rápido
    setProducts(newProducts);
    setDraggedItem(null);

    // Persistencia: Guardar el nuevo orden en DB
    const updates = newProducts.map((p, idx) => ({
        id: p.id,
        orden: idx
    }));

    // Ejecutamos actualizaciones (Supabase permite upsert múltiple)
    const { error } = await supabase.from('productos').upsert(updates);
    if (error) {
        console.error("Error guardando orden:", error);
        loadData(); // Revertir si falla
    }
  };

  if (view === 'form') {
    return (
      <ProductForm 
        product={editingProduct} 
        categories={categories}
        onSave={handleSave} 
        onCancel={() => setView('list')} 
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'Inter' }}>
      
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h1 style={{ fontSize: '28px', color: '#FF5E5E', fontWeight: 800, margin: 0 }}>Catalogo de Productos</h1>
        <button 
          onClick={handleCreate}
          style={{ 
            background: '#FF5E5E', color: 'white', border: 'none', padding: '12px 24px', 
            borderRadius: '20px', fontWeight: 500, cursor: 'pointer', fontSize: '14px'
          }}
        >
          Nuevo Producto
        </button>
      </header>

      <hr style={{ border: 'none', height: '2px', background: '#aba9a4', opacity: 0.2, margin: '24px 0' }} />

      <div style={{ marginBottom: '40px' }}>
        <input 
          type="text" 
          placeholder="Buscar por descripcion o codigo..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%', padding: '16px 25px', borderRadius: '24px', border: '1px solid #dfded9', 
            background: 'white', fontSize: '15px', outline: 'none', boxSizing: 'border-box'
          }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '100px', color: '#998E55', fontWeight: 500 }}>Cargando catálogo...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {/* Header de tabla sincronizado exactamente con ProductRow */}
          <div style={{ 
            display: 'flex', 
            padding: '0 30px', 
            marginBottom: '15px', 
            color: '#998E55', 
            fontSize: '12px', 
            fontWeight: 400, 
            gap: '20px',
            letterSpacing: '0.02em',
            fontFamily: 'Inter'
          }}>
            <div style={{ width: '20px' }}></div> {/* Espacio para drag handle */}
            <div style={{ width: '56px' }}>Img</div>
            <div style={{ width: '100px' }}>Código</div>
            <div style={{ flex: 1 }}>Descripción</div>
            <div style={{ width: '140px', textAlign: 'center' }}>Categoría</div>
            <div style={{ width: '120px', textAlign: 'right' }}>Precio</div>
            <div style={{ width: '100px', textAlign: 'center' }}>Estado</div>
            <div style={{ width: '90px', textAlign: 'right' }}>Acciones</div>
          </div>

          {filtered.map((p, idx) => (
            <ProductRow 
              key={p.id} 
              product={p} 
              onEdit={() => handleEdit(p)}
              onDelete={() => handleDelete(p.id)}
              onRefresh={loadData} 
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductForm({ product, categories, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    codigo: product?.codigo || "",
    descripcion: product?.descripcion || "",
    precio: product?.precio || "",
    categoria: product?.categoria || "",
    data: product?.data || "",
    img: product?.img || "",
    activo: product?.activo ?? 1
  });
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(product?.img || "");
  const [loading, setLoading] = useState(false);

  const FRANQUICIA_ID = 1;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    let finalImageUrl = formData.img;

    try {
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const folderPath = `franquicia_${FRANQUICIA_ID}/${formData.categoria || 'sin_categoria'}`;
        const filePath = `${folderPath}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('catalogo')
          .upload(filePath, imageFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('catalogo').getPublicUrl(filePath);
        finalImageUrl = publicUrl;
      }

      const payload = {
        ...formData,
        img: finalImageUrl,
        precio: parseFloat(formData.precio),
        franquicia_id: FRANQUICIA_ID
      };

      const { error } = await supabase
        .from('productos')
        .upsert({
          id: product?.id,
          ...payload
        });
      
      if (!error) onSave();
      else alert("Error: " + error.message);
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const labelStyle = { display: 'block', marginBottom: '8px', fontSize: '11px', fontWeight: 700, color: '#998E55' };
  const inputStyle = {
    width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #dfded9', 
    background: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box'
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%', fontFamily: 'Inter' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#495D56', margin: 0 }}>
          {product ? 'Editar Producto' : 'Crear Nuevo Producto'}
        </h2>
      </header>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <label style={labelStyle}>CODIGO</label>
            <input type="text" required value={formData.codigo} onChange={e => setFormData({...formData, codigo: e.target.value.toUpperCase()})} style={inputStyle} placeholder="EJ: 4911" />
          </div>
          <div>
            <label style={labelStyle}>CATEGORÍA</label>
            <select value={formData.categoria} onChange={e => setFormData({...formData, categoria: e.target.value})} style={inputStyle} required>
              <option value="">Seleccionar...</option>
              {categories.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label style={labelStyle}>DESCRIPCIÓN / TÍTULO</label>
          <input type="text" required value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value.toUpperCase()})} style={inputStyle} placeholder="EJ: SELLO AUTOMATICO..." />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <label style={labelStyle}>PRECIO ($)</label>
            <input type="number" step="0.01" required value={formData.precio} onChange={e => setFormData({...formData, precio: e.target.value})} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>MEDIDAS / DATA EXTRA</label>
            <input type="text" value={formData.data} onChange={e => setFormData({...formData, data: e.target.value})} style={inputStyle} placeholder="EJ: 38X14MM" />
          </div>
        </div>

        <div style={{ background: '#FAF9F6', padding: '24px', borderRadius: '24px', border: '1px solid #dfded9' }}>
          <label style={labelStyle}>IMAGEN DEL PRODUCTO</label>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <div style={{ 
              width: '100px', height: '100px', borderRadius: '16px', background: 'white', 
              border: '1px solid #dfded9', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' 
            }}>
              {previewUrl ? (
                <img src={previewUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Preview" />
              ) : (
                <img src="https://api.iconify.design/lucide:image.svg?color=%23aba9a4" style={{ width: '32px' }} />
              )}
            </div>
            <div style={{ flex: 1 }}>
              <input type="file" accept="image/*" onChange={handleFileChange} style={{ fontSize: '13px' }} />
              <p style={{ fontSize: '11px', color: '#998E55', marginTop: '8px' }}>Subida directa a Supabase Storage (Bucket: catalogo)</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
          <button type="button" onClick={onCancel} style={{ flex: 1, padding: '16px', borderRadius: '16px', border: '1px solid #dfded9', background: 'white', cursor: 'pointer', fontWeight: 700, color: '#666' }}>CANCELAR</button>
          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              flex: 2, padding: '16px', borderRadius: '16px', border: 'none', 
              background: '#495D56', color: 'white', cursor: 'pointer', fontWeight: 700,
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'GUARDANDO...' : 'GUARDAR PRODUCTO'}
          </button>
        </div>
      </form>
    </div>
  );
}
