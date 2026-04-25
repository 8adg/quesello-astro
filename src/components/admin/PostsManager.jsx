import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const GITHUB_OWNER = '8adg';
const GITHUB_REPO = 'quesello-astro';
const GITHUB_TOKEN_KEY = 'gh_dispatch_token'; // guardado en config de supabase

function slugify(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function PostsManager() {
  const [posts, setPosts] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState(null);

  const [form, setForm] = useState({
    titulo: '', subtitulo: '', resumen: '', imagen_url: '', contenido_md: '', slug: '', categoria: '', fecha_publicacion: '', publicado: false
  });

  useEffect(() => { loadPosts(); loadCategorias(); }, []);

  const loadCategorias = async () => {
    const { data } = await supabase.from('categorias').select('nombre').order('nombre');
    setCategorias(data || []);
  };

  const loadPosts = async () => {
    setLoading(true);
    const { data } = await supabase.from('posts').select('*').order('id', { ascending: false });
    setPosts(data || []);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({ titulo: '', subtitulo: '', resumen: '', imagen_url: '', contenido_md: '', slug: '', categoria: '', fecha_publicacion: '', publicado: false });
    setEditingId(null);
    setShowForm(false);
    setSlugEdited(false);
  };

  const handleEdit = (p) => {
    setForm({ titulo: p.titulo, subtitulo: p.subtitulo || '', resumen: p.resumen || '', imagen_url: p.imagen_url || '', contenido_md: p.contenido_md || '', slug: p.slug, categoria: p.categoria || '', fecha_publicacion: p.fecha_publicacion || '', publicado: p.publicado });
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleTituloChange = (val) => {
    setForm(f => ({ ...f, titulo: val, slug: slugEdited ? f.slug : slugify(val) }));
  };

  const handleSlugChange = (val) => {
    setSlugEdited(true);
    setForm(f => ({ ...f, slug: slugify(val) }));
  };

  const triggerDeploy = async () => {
    try {
      const { data } = await supabase.from('config').select('valor').eq('clave', 'github_token');
      const token = data?.[0]?.valor;
      if (!token) return;
      await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/dispatches`, {
        method: 'POST',
        headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: 'deploy' })
      });
    } catch (e) { console.error('Deploy trigger error:', e); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.titulo || !form.slug) return alert('Título y slug son obligatorios');
    setSaving(true);
    try {
      const payload = { ...form, franquicia_id: 1 };
      if (editingId) {
        await supabase.from('posts').update(payload).eq('id', editingId);
      } else {
        await supabase.from('posts').insert(payload);
      }
      if (form.publicado) {
        setMsg({ type: 'success', text: '✅ Guardado. Disparando rebuild...' });
        await triggerDeploy();
      }
      setMsg({ type: 'success', text: '✅ Post guardado correctamente' });
      resetForm();
      loadPosts();
    } catch (err) {
      setMsg({ type: 'error', text: 'Error: ' + err.message });
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 4000);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este post?')) return;
    await supabase.from('posts').delete().eq('id', id);
    loadPosts();
  };

  const handleTogglePublicado = async (p) => {
    await supabase.from('posts').update({ publicado: !p.publicado }).eq('id', p.id);
    if (!p.publicado) {
      setMsg({ type: 'success', text: '✅ Publicado. Disparando rebuild...' });
      await triggerDeploy();
      setTimeout(() => setMsg(null), 4000);
    }
    loadPosts();
  };

  // Estilos base del design system
  const cardStyle = { background: 'white', borderRadius: '35px', padding: '35px', boxShadow: '0 4px 25px rgba(0,0,0,0.03)', border: '1px solid #f0f0f0', marginBottom: '20px' };
  const inputStyle = { width: '100%', padding: '16px', borderRadius: '14px', border: '2px solid #F1F5F9', fontSize: '15px', fontFamily: 'Inter', outline: 'none', boxSizing: 'border-box' };
  const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 700, color: '#998E55', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' };
  const btnPrimary = { background: '#FF5E5E', color: 'white', border: 'none', padding: '14px 28px', borderRadius: '18px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter', fontSize: '14px' };
  const btnSecondary = { background: '#F4F1E1', color: '#495D56', border: 'none', padding: '14px 28px', borderRadius: '18px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter', fontSize: '14px' };

  return (
    <div style={{ fontFamily: 'Inter', maxWidth: '900px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: '#FF5E5E', fontWeight: 800, margin: 0 }}>Posts</h1>
          <p style={{ color: '#64748B', fontSize: '14px', marginTop: '5px' }}>Creá y gestioná los artículos del blog.</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} style={btnPrimary}>NUEVO POST</button>
        )}
      </header>

      {msg && (
        <div style={{ padding: '15px 20px', borderRadius: '15px', marginBottom: '20px', background: msg.type === 'success' ? '#D1FAE5' : '#FEE2E2', color: msg.type === 'success' ? '#065F46' : '#991B1B', fontWeight: 600 }}>
          {msg.text}
        </div>
      )}

      {showForm && (
        <div style={cardStyle}>
          <form onSubmit={handleSave}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label style={labelStyle}>Título *</label>
                <input style={inputStyle} value={form.titulo} onChange={e => handleTituloChange(e.target.value)} required />
              </div>
              <div>
                <label style={labelStyle}>Slug (URL) *</label>
                <input style={inputStyle} value={form.slug} onChange={e => handleSlugChange(e.target.value)} required />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label style={labelStyle}>Categoría</label>
                <select style={{ ...inputStyle, background: 'white' }} value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                  <option value="">-- Sin categoría --</option>
                  {categorias.map(c => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Fecha de publicación</label>
                <input type="date" style={inputStyle} value={form.fecha_publicacion} onChange={e => setForm(f => ({ ...f, fecha_publicacion: e.target.value }))} />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Subtítulo</label>
              <input style={inputStyle} value={form.subtitulo} onChange={e => setForm(f => ({ ...f, subtitulo: e.target.value }))} />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Resumen (intro)</label>
              <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} value={form.resumen} onChange={e => setForm(f => ({ ...f, resumen: e.target.value }))} />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>URL de imagen de portada</label>
              <input style={inputStyle} value={form.imagen_url} onChange={e => setForm(f => ({ ...f, imagen_url: e.target.value }))} placeholder="https://..." />
            </div>

            <div style={{ marginBottom: '25px' }}>
              <label style={labelStyle}>Contenido (Markdown)</label>
              <textarea style={{ ...inputStyle, minHeight: '250px', resize: 'vertical', fontFamily: 'monospace', fontSize: '13px' }} value={form.contenido_md} onChange={e => setForm(f => ({ ...f, contenido_md: e.target.value }))} placeholder="## Título&#10;&#10;Escribí el contenido en Markdown..." />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.publicado} onChange={e => setForm(f => ({ ...f, publicado: e.target.checked }))} />
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#495D56' }}>Publicar (dispara rebuild automático)</span>
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={resetForm} style={btnSecondary}>DESCARTAR</button>
                <button type="submit" disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>{saving ? 'GUARDANDO...' : 'GUARDAR POST'}</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#94A3B8' }}>Cargando posts...</div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#94A3B8' }}>No hay posts todavía.</div>
      ) : (
        posts.map(p => (
          <div key={p.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '5px' }}>
                <span style={{ fontSize: '18px', fontWeight: 800, color: '#1E293B' }}>{p.titulo}</span>
                <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: 700, background: p.publicado ? '#D1FAE5' : '#F1F5F9', color: p.publicado ? '#065F46' : '#64748B' }}>
                  {p.publicado ? 'PUBLICADO' : 'BORRADOR'}
                </span>
              </div>
              {p.resumen && <div style={{ fontSize: '13px', color: '#64748B', marginBottom: '5px' }}>{p.resumen.substring(0, 100)}...</div>}
              <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                {p.categoria ? `/posts/${p.categoria}/${p.slug}` : `/posts/${p.slug}`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginLeft: '20px' }}>
              <button onClick={() => handleTogglePublicado(p)} style={{ ...btnSecondary, padding: '8px 16px', fontSize: '12px' }}>
                {p.publicado ? 'DESPUBLICAR' : 'PUBLICAR'}
              </button>
              <button onClick={() => handleEdit(p)} style={{ background: 'none', border: '1px solid #E2E8F0', padding: '8px 16px', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}>EDITAR</button>
              <button onClick={() => handleDelete(p.id)} style={{ background: 'none', border: '1px solid #FEE2E2', color: '#DC2626', padding: '8px 16px', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}>DROP</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
