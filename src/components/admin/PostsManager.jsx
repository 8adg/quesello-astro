import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

const GITHUB_OWNER = '8adg';
const GITHUB_REPO = 'quesello-astro';
const GITHUB_TOKEN_KEY = 'gh_dispatch_token'; // guardado en config de supabase

function slugify(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/**
 * Detecta a nivel binario si un archivo WebP contiene chunks de animación (ANIM / ANMF)
 * para jamás pasarlo por <canvas> y preservar todos sus cuadros intactos.
 */
async function isAnimatedWebp(file) {
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    // Verificar firma RIFF....WEBP
    if (bytes.length < 16) return false;
    const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (riff !== 'RIFF' || webp !== 'WEBP') return false;

    // Buscar chunks ANIM (0x41 0x4E 0x49 0x4D) o ANMF (0x41 0x4E 0x4D 0x46) en los primeros 64KB
    const limit = Math.min(bytes.length - 4, 65536);
    for (let i = 12; i < limit; i++) {
      if (
        bytes[i] === 0x41 && // 'A'
        bytes[i + 1] === 0x4E && // 'N'
        ((bytes[i + 2] === 0x49 && bytes[i + 3] === 0x4D) || // 'IM'
         (bytes[i + 2] === 0x4D && bytes[i + 3] === 0x46))   // 'MF'
      ) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Optimiza imágenes estáticas (JPG/PNG/WebP fijo) a WebP liviano (máx 1400px, calidad 0.84)
 * pero deja pasar intactos byte por byte los WebP animados, GIFs y SVGs.
 */
async function prepareImageForUpload(file) {
  const originalKB = Math.max(1, Math.round(file.size / 1024));
  const lowerName = (file.name || '').toLowerCase();
  const baseName = slugify(lowerName.replace(/\.[^.]+$/, '')) || 'imagen';

  // 1. Si es WebP animado, GIF o SVG: paso directo sin tocar un solo byte
  const isWebpFile = file.type === 'image/webp' || lowerName.endsWith('.webp');
  if (isWebpFile && (await isAnimatedWebp(file))) {
    return {
      blob: file,
      fileName: `${baseName}-${Date.now()}.webp`,
      contentType: 'image/webp',
      mode: 'animated-webp',
      originalKB,
      finalKB: originalKB
    };
  }

  if (file.type === 'image/gif' || lowerName.endsWith('.gif') || file.type === 'image/svg+xml' || lowerName.endsWith('.svg')) {
    const ext = lowerName.endsWith('.svg') ? 'svg' : 'gif';
    return {
      blob: file,
      fileName: `${baseName}-${Date.now()}.${ext}`,
      contentType: file.type || (ext === 'svg' ? 'image/svg+xml' : 'image/gif'),
      mode: 'passthrough',
      originalKB,
      finalKB: originalKB
    };
  }

  // 2. Imagen estática: optimizar y convertir a .webp vía Canvas
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX_DIM = 1400;
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width >= height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (webpBlob) => {
          if (!webpBlob) {
            return reject(new Error('No se pudo convertir la imagen a WebP'));
          }
          // Si ya era un WebP estático aún más liviano que el re-encode, conservar el más liviano
          if (isWebpFile && file.size <= webpBlob.size) {
            return resolve({
              blob: file,
              fileName: `${baseName}-${Date.now()}.webp`,
              contentType: 'image/webp',
              mode: 'webp-original',
              originalKB,
              finalKB: originalKB
            });
          }
          const finalKB = Math.max(1, Math.round(webpBlob.size / 1024));
          resolve({
            blob: webpBlob,
            fileName: `${baseName}-${Date.now()}.webp`,
            contentType: 'image/webp',
            mode: 'optimized-webp',
            originalKB,
            finalKB
          });
        },
        'image/webp',
        0.84
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo leer el archivo de imagen'));
    };

    img.src = objectUrl;
  });
}

export default function PostsManager() {
  const [posts, setPosts] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingInline, setUploadingInline] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState(null);

  const dragPost = useRef();
  const dragOverPost = useRef();
  const coverInputRef = useRef(null);
  const inlineInputRef = useRef(null);
  const mdTextareaRef = useRef(null);

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
    const { data } = await supabase.from('posts').select('*').order('orden', { ascending: true }).order('id', { ascending: false });
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

  const uploadProcessedImage = async (file) => {
    const prepared = await prepareImageForUpload(file);
    const folderSlug = form.slug ? slugify(form.slug) : 'general';
    const storagePath = `posts/${folderSlug}/${prepared.fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('catalogo')
      .upload(storagePath, prepared.blob, {
        contentType: prepared.contentType,
        upsert: true
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from('catalogo').getPublicUrl(storagePath);
    return {
      publicUrl: urlData.publicUrl,
      ...prepared
    };
  };

  const formatUploadNotice = (info) => {
    if (info.mode === 'animated-webp') {
      return `WebP animado preservado intacto (${info.finalKB} KB)`;
    }
    if (info.mode === 'passthrough') {
      return `Archivo original preservado (${info.finalKB} KB)`;
    }
    if (info.mode === 'webp-original') {
      return `WebP estático mantenido (${info.finalKB} KB)`;
    }
    return `Optimizado a WebP (${info.originalKB} KB -> ${info.finalKB} KB)`;
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadingCover(true);
    try {
      const result = await uploadProcessedImage(file);
      setForm(f => ({ ...f, imagen_url: result.publicUrl }));
      setMsg({ type: 'success', text: `Portada subida: ${formatUploadNotice(result)}` });
    } catch (err) {
      setMsg({ type: 'error', text: 'Error al subir portada: ' + err.message });
    } finally {
      setUploadingCover(false);
      setTimeout(() => setMsg(null), 5000);
    }
  };

  const handleInlineUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;

    setUploadingInline(true);
    try {
      const snippets = [];
      const notices = [];

      for (const file of files) {
        const result = await uploadProcessedImage(file);
        const altText = (file.name || 'Imagen').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
        snippets.push(
          `<img \n  src="${result.publicUrl}" \n  alt="${altText}" \n  style="max-height: 95vh; width: auto; display: flex; justify-self: center;" \n/>`
        );
        notices.push(formatUploadNotice(result));
      }

      const blockToInsert = '\n' + snippets.join('\n\n') + '\n';
      const textarea = mdTextareaRef.current;

      if (textarea && typeof textarea.selectionStart === 'number') {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const current = form.contenido_md || '';
        const updated = current.slice(0, start) + blockToInsert + current.slice(end);
        setForm(f => ({ ...f, contenido_md: updated }));
      } else {
        setForm(f => ({ ...f, contenido_md: (f.contenido_md || '') + blockToInsert }));
      }

      setMsg({ type: 'success', text: `Imagen insertada en el post: ${notices.join(' | ')}` });
    } catch (err) {
      setMsg({ type: 'error', text: 'Error al subir imagen: ' + err.message });
    } finally {
      setUploadingInline(false);
      setTimeout(() => setMsg(null), 5000);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.titulo || !form.slug) return alert('Título y slug son obligatorios');
    setSaving(true);
    try {
      const payload = { ...form, franquicia_id: 1, categoria: form.categoria ? form.categoria.toLowerCase() : null };
      let dbError;
      if (editingId) {
        const { error } = await supabase.from('posts').update(payload).eq('id', editingId);
        dbError = error;
      } else {
        const { error } = await supabase.from('posts').insert(payload);
        dbError = error;
      }
      if (dbError) throw dbError;
      if (form.publicado) {
        setMsg({ type: 'success', text: 'Guardado. Disparando rebuild...' });
        await triggerDeploy();
      }
      setMsg({ type: 'success', text: 'Post guardado correctamente' });
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
      setMsg({ type: 'success', text: 'Publicado. Disparando rebuild...' });
      await triggerDeploy();
      setTimeout(() => setMsg(null), 4000);
    }
    loadPosts();
  };

  const handleDragEnd = async () => {
    const from = dragPost.current;
    const to = dragOverPost.current;
    if (from === undefined || to === undefined || from === to) return;
    const reordered = [...posts];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setPosts(reordered);
    dragPost.current = undefined;
    dragOverPost.current = undefined;
    const updates = reordered.map((p, idx) => ({ id: p.id, orden: idx }));
    for (const u of updates) {
      await supabase.from('posts').update({ orden: u.orden }).eq('id', u.id);
    }
  };

  // Estilos base del design system
  const cardStyle = { background: 'white', borderRadius: '28px', padding: '35px', boxShadow: '0 4px 25px rgba(0,0,0,0.03)', border: '1px solid #f0f0f0', marginBottom: '20px' };
  const rowStyle  = { background: 'white', borderRadius: '28px', padding: '22px 30px', border: '1px solid #f8f8f8', marginBottom: '15px', display: 'flex', alignItems: 'center' };
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
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={form.imagen_url}
                  onChange={e => setForm(f => ({ ...f, imagen_url: e.target.value }))}
                  placeholder="https://... o subí una imagen"
                />
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*,.webp"
                  onChange={handleCoverUpload}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  disabled={uploadingCover}
                  onClick={() => coverInputRef.current?.click()}
                  style={{
                    background: '#F4F1E1',
                    color: '#495D56',
                    border: 'none',
                    padding: '15px 18px',
                    borderRadius: '14px',
                    fontWeight: 700,
                    fontSize: '13px',
                    fontFamily: 'Inter',
                    cursor: uploadingCover ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    whiteSpace: 'nowrap',
                    opacity: uploadingCover ? 0.7 : 1
                  }}
                >
                  <img src="https://api.iconify.design/lucide/upload.svg?color=%23495D56" style={{ width: '16px', height: '16px' }} alt="" />
                  {uploadingCover ? 'Subiendo...' : 'Subir portada'}
                </button>
              </div>
              {form.imagen_url && (
                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img
                    src={form.imagen_url}
                    alt="Portada"
                    style={{ width: '64px', height: '42px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #E2E8F0' }}
                  />
                  <span style={{ fontSize: '12px', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {form.imagen_url}
                  </span>
                </div>
              )}
            </div>

            <div style={{ marginBottom: '25px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '12px', flexWrap: 'wrap' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Contenido (Markdown)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>
                    Convierte fotos a WebP liviano · Preserva WebP animados
                  </span>
                  <input
                    ref={inlineInputRef}
                    type="file"
                    accept="image/*,.webp"
                    multiple
                    onChange={handleInlineUpload}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    disabled={uploadingInline}
                    onClick={() => inlineInputRef.current?.click()}
                    style={{
                      background: '#F4F1E1',
                      color: '#495D56',
                      border: 'none',
                      padding: '8px 14px',
                      borderRadius: '12px',
                      fontWeight: 700,
                      fontSize: '12px',
                      fontFamily: 'Inter',
                      cursor: uploadingInline ? 'wait' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      opacity: uploadingInline ? 0.7 : 1
                    }}
                  >
                    <img src="https://api.iconify.design/lucide/image-plus.svg?color=%23495D56" style={{ width: '15px', height: '15px' }} alt="" />
                    {uploadingInline ? 'Procesando...' : 'Insertar imagen / WebP'}
                  </button>
                </div>
              </div>
              <textarea
                ref={mdTextareaRef}
                style={{ ...inputStyle, minHeight: '250px', resize: 'vertical', fontFamily: 'monospace', fontSize: '13px' }}
                value={form.contenido_md}
                onChange={e => setForm(f => ({ ...f, contenido_md: e.target.value }))}
                placeholder="## Título&#10;&#10;Escribí el contenido en Markdown..."
              />
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
          <div key={p.id}
            draggable
            onDragStart={() => { dragPost.current = posts.indexOf(p); }}
            onDragEnter={() => { dragOverPost.current = posts.indexOf(p); }}
            onDragEnd={handleDragEnd}
            onDragOver={e => e.preventDefault()}
            style={{ ...rowStyle, cursor: 'move' }}>
            <div style={{ marginRight: '16px', color: '#E2E8F0', flexShrink: 0 }}>
              <img src="https://api.iconify.design/lucide/grip-vertical.svg?color=%23CBD5E1" style={{ width: '20px', display: 'block' }} alt="" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <span style={{ fontSize: '17px', fontWeight: 800, color: '#1E293B' }}>{p.titulo}</span>
                <span style={{ fontSize: '10px', padding: '3px 10px', borderRadius: '20px', fontWeight: 700, background: p.publicado ? '#D1FAE5' : '#F1F5F9', color: p.publicado ? '#065F46' : '#64748B' }}>
                  {p.publicado ? 'PUBLICADO' : 'BORRADOR'}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#94A3B8' }}>
                {p.categoria ? `/posts/${p.categoria}/${p.slug}` : `/posts/${p.slug}`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '4px', marginLeft: '20px', alignItems: 'center' }}>
              <button onClick={() => handleTogglePublicado(p)} title={p.publicado ? 'Despublicar' : 'Publicar'} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '5px' }}>
                <img src={`https://api.iconify.design/lucide/${p.publicado ? 'eye-off' : 'send'}.svg?color=%234b3b28`} style={{ width: '22px' }} alt={p.publicado ? 'Despublicar' : 'Publicar'} />
              </button>
              <button onClick={() => handleEdit(p)} title="Editar" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '5px' }}>
                <img src="https://api.iconify.design/lucide/edit-3.svg?color=%231a202c" style={{ width: '22px' }} alt="Editar" />
              </button>
              <button onClick={() => handleDelete(p.id)} title="Eliminar" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '5px' }}>
                <img src="https://api.iconify.design/lucide/trash-2.svg?color=%231a202c" style={{ width: '22px' }} alt="Eliminar" />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
