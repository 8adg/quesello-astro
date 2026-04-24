import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

// ICONOS SEGÚN DESIGN SYSTEM (CAPT 2)
const iconEdit = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    <path d="M15 5l4 4" />
    <path d="M9 17h6" />
  </svg>
);

const iconDelete = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const iconCheck = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const iconX = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

export default function FranchiseManager() {
  const [franquicias, setFranquicias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    nombre: "",
    slug: "",
    whatsapp: "",
    email: "", 
    password: "", 
    activo: true
  });

  useEffect(() => { loadFranquicias(); }, []);

  const loadFranquicias = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("franquicias").select("*").order("nombre");
      if (error) throw error;
      setFranquicias(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ nombre: "", slug: "", whatsapp: "", email: "", password: "", activo: true });
    setEditingId(null);
  };

  const handleEditClick = (f) => {
    setEditingId(f.id);
    setFormData({
      nombre: f.nombre,
      slug: f.slug,
      whatsapp: f.whatsapp || "",
      email: "", 
      password: "",
      activo: f.activo
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setProcessing(true);
    try {
      const payload = {
        nombre: formData.nombre,
        slug: formData.slug || formData.nombre.toLowerCase().replace(/ /g, '-'),
        whatsapp: formData.whatsapp,
        activo: formData.activo
      };

      if (editingId) {
        const { error } = await supabase.from("franquicias").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { data: newFranq, error: fError } = await supabase.from("franquicias").insert(payload).select().single();
        if (fError) throw fError;

        if (formData.email && formData.password) {
          const { error: aError } = await supabase.auth.admin.createUser({
            email: formData.email,
            password: formData.password,
            email_confirm: true,
            user_metadata: { 
              franquicia_id: newFranq.id,
              nombre: formData.nombre
            }
          });
          if (aError) throw aError;
        }
      }

      setShowForm(false);
      resetForm();
      loadFranquicias();
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setProcessing(false);
    }
  };

  const toggleStatus = async (franq) => {
    try {
      const { error } = await supabase.from("franquicias").update({ activo: !franq.activo }).eq("id", franq.id);
      if (error) throw error;
      loadFranquicias();
    } catch (e) {
      alert(e.message);
    }
  };

  if (loading && franquicias.length === 0) return <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'Inter' }}>Cargando administrador...</div>;

  return (
    <div style={{ fontFamily: 'Inter', maxWidth: '1000px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: '#FF5E5E', fontWeight: 800, margin: 0 }}>Gestión de Franquicias</h1>
          <p style={{ color: '#64748B', fontSize: '14px', marginTop: '5px' }}>Administra los locales y sus accesos al sistema.</p>
        </div>
        {!showForm && (
          <button 
            onClick={() => { resetForm(); setShowForm(true); }}
            style={{ background: '#111', color: 'white', border: 'none', padding: '14px 28px', borderRadius: '18px', fontWeight: 700, cursor: 'pointer' }}
          >
            NUEVO LOCAL
          </button>
        )}
      </header>

      {showForm && (
        <div style={{ background: 'white', padding: '35px', borderRadius: '35px', marginBottom: '40px', boxShadow: '0 20px 50px rgba(0,0,0,0.08)', border: '1px solid #f0f0f0' }}>
          <h2 style={{ marginTop: 0, fontSize: '18px', fontWeight: 800, marginBottom: '25px' }}>
            {editingId ? 'Editar Franquicia' : 'Registrar Nueva Franquicia'}
          </h2>
          <form onSubmit={handleSave}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#998E55', marginBottom: '8px' }}>NOMBRE DEL LOCAL / CIUDAD</label>
                <input type="text" required value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} style={{ width: '100%', padding: '16px', borderRadius: '14px', border: '2px solid #F1F5F9', outline: 'none', fontSize: '15px' }} placeholder="Ej: Córdoba Centro" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#998E55', marginBottom: '8px' }}>URL / SLUG (ej: cordoba)</label>
                <input type="text" required value={formData.slug} onChange={(e) => setFormData({...formData, slug: e.target.value})} style={{ width: '100%', padding: '16px', borderRadius: '14px', border: '2px solid #F1F5F9', outline: 'none', fontSize: '15px' }} placeholder="cordoba" />
              </div>
            </div>

            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#998E55', marginBottom: '8px' }}>WHATSAPP DE CONTACTO (Sin símbolos)</label>
              <input type="text" value={formData.whatsapp} onChange={(e) => setFormData({...formData, whatsapp: e.target.value})} style={{ width: '100%', padding: '16px', borderRadius: '14px', border: '2px solid #F1F5F9', outline: 'none', fontSize: '15px' }} placeholder="549351..." />
            </div>

            {!editingId && (
              <div style={{ background: '#F8FAFC', padding: '25px', borderRadius: '24px', marginBottom: '25px', border: '1px solid #E2E8F0' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 900, color: '#64748B', marginBottom: '15px' }}>CREAR ACCESO PARA EL FRANQUICIADO</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      <div>
                          <label style={{ display: 'block', fontSize: '12px', color: '#64748B', marginBottom: '5px' }}>Email</label>
                          <input type="email" required={!editingId} value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0' }} placeholder="cordoba@quesello.com" />
                      </div>
                      <div>
                          <label style={{ display: 'block', fontSize: '12px', color: '#64748B', marginBottom: '5px' }}>Contraseña</label>
                          <input type="password" required={!editingId} value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0' }} placeholder="Mínimo 6 caracteres" />
                      </div>
                  </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '15px' }}>
              <button type="button" onClick={() => { setShowForm(false); resetForm(); }} style={{ flex: 1, padding: '18px', borderRadius: '18px', border: 'none', background: '#F1F5F9', color: '#64748B', fontWeight: 700, cursor: 'pointer' }}>DESCARTAR</button>
              <button type="submit" disabled={processing} style={{ flex: 2, padding: '18px', borderRadius: '18px', border: 'none', background: '#FF5E5E', color: 'white', fontWeight: 800, cursor: 'pointer' }}>
                {processing ? 'GUARDANDO...' : (editingId ? 'ACTUALIZAR DATOS' : 'DAR DE ALTA LOCAL')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {franquicias.map((f) => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', background: 'white', padding: '22px 30px', borderRadius: '28px', border: '1px solid #f8f8f8', boxShadow: '0 5px 25px rgba(0,0,0,0.02)' }}>
            <div style={{ width: '50px', height: '50px', borderRadius: '15px', background: f.activo ? '#ECFDF5' : '#FEF2F2', display: 'flex', alignItems: 'center', justifyCenter: 'center', marginRight: '20px' }}>
               <div style={{ margin: '0 auto' }}>{f.activo ? iconCheck : iconX}</div>
            </div>
            
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#1E293B' }}>{f.nombre}</div>
              <div style={{ fontSize: '13px', color: '#94A3B8' }}>WhatsApp: {f.whatsapp || '---'} | Slug: <span style={{ color: '#FF5E5E', fontWeight: 600 }}>/{f.slug}</span></div>
            </div>

            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: f.activo ? '#059669' : '#DC2626', background: f.activo ? '#D1FAE5' : '#FEE2E2', padding: '5px 12px', borderRadius: '10px' }}>
                    {f.activo ? 'ACTIVO' : 'PAUSADO'}
                </span>
                <button 
                  onClick={() => handleEditClick(f)} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px', display: 'flex', alignItems: 'center' }}
                  title="Editar franquicia"
                >
                  {iconEdit}
                </button>
                <button 
                    onClick={() => toggleStatus(f)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px', display: 'flex', alignItems: 'center', opacity: 0.8 }}
                    title={f.activo ? "Desactivar" : "Activar"}
                >
                    {f.activo ? iconDelete : iconCheck}
                </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
