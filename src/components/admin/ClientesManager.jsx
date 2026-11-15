import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { upsertCliente } from '../../lib/clientesHelper';

const LinearIcon = ({ name, color = '#495D56', size = 16 }) => (
  <img
    src={`https://api.iconify.design/lucide/${name}.svg?color=${encodeURIComponent(color)}`}
    style={{ width: `${size}px`, height: `${size}px`, flexShrink: 0, display: 'block' }}
    alt=""
  />
);

export default function ClientesManager() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'WITH_EMAIL' | 'CAMPAIGN_READY'
  const [editingCliente, setEditingCliente] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [historyCliente, setHistoryCliente] = useState(null);
  const [historyOrders, setHistoryOrders] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    telefono: '',
    email: '',
    acepta_campanas: true,
    notas: '',
  });

  const FRANQUICIA_ID = 1;

  useEffect(() => {
    loadClientes();
  }, []);

  const showToastMsg = (text) => {
    setToast(text);
    setTimeout(() => setToast(null), 3000);
  };

  const loadClientes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('franquicia_id', FRANQUICIA_ID)
        .order('actualizado_en', { ascending: false });
      if (error) throw error;
      setClientes(data || []);
    } catch (err) {
      console.error('Error cargando clientes:', err);
    } finally {
      setLoading(false);
    }
  };

  const openNewForm = () => {
    setEditingCliente(null);
    setFormData({
      nombre: '',
      apellido: '',
      telefono: '',
      email: '',
      acepta_campanas: true,
      notas: '',
    });
    setShowForm(true);
  };

  const openEditForm = (c) => {
    setEditingCliente(c);
    setFormData({
      nombre: c.nombre || '',
      apellido: c.apellido || '',
      telefono: c.telefono || '',
      email: c.email || '',
      acepta_campanas: c.acepta_campanas !== false,
      notas: c.notas || '',
    });
    setShowForm(true);
  };

  const handleSaveForm = async (e) => {
    e.preventDefault();
    if (!formData.nombre.trim() && !formData.telefono.trim() && !formData.email.trim()) {
      alert('Ingresá al menos el nombre, teléfono o mail.');
      return;
    }
    setSaving(true);
    try {
      const fullName = `${formData.nombre} ${formData.apellido}`.trim().toUpperCase();
      if (editingCliente) {
        const { error } = await supabase
          .from('clientes')
          .update({
            nombre: formData.nombre.trim().toUpperCase(),
            apellido: formData.apellido.trim().toUpperCase(),
            nombre_completo: fullName || formData.telefono.trim() || formData.email.trim(),
            telefono: formData.telefono.trim(),
            email: formData.email.trim().toLowerCase(),
            acepta_campanas: !!formData.acepta_campanas,
            notas: formData.notas.trim(),
            actualizado_en: new Date().toISOString(),
          })
          .eq('id', editingCliente.id);
        if (error) throw error;
        showToastMsg('Cliente actualizado correctamente');
      } else {
        await upsertCliente({
          supabaseClient: supabase,
          nombre: formData.nombre,
          apellido: formData.apellido,
          nombreCompleto: fullName,
          telefono: formData.telefono,
          email: formData.email,
          franquiciaId: FRANQUICIA_ID,
          incrementOrders: false,
        });
        showToastMsg('Cliente guardado correctamente');
      }
      setShowForm(false);
      loadClientes();
    } catch (err) {
      alert('Error al guardar cliente: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCampanas = async (c) => {
    const nextVal = !c.acepta_campanas;
    setClientes((prev) =>
      prev.map((item) => (item.id === c.id ? { ...item, acepta_campanas: nextVal } : item))
    );
    await supabase
      .from('clientes')
      .update({ acepta_campanas: nextVal, actualizado_en: new Date().toISOString() })
      .eq('id', c.id);
  };

  const handleDeleteCliente = async (c) => {
    if (!window.confirm(`¿Eliminar a "${c.nombre_completo}" del registro de clientes?`)) return;
    await supabase.from('clientes').delete().eq('id', c.id);
    showToastMsg('Cliente eliminado');
    loadClientes();
  };

  const handleViewHistory = async (c) => {
    setHistoryCliente(c);
    setLoadingHistory(true);
    try {
      const { data } = await supabase
        .from('presupuestos')
        .select('id, numero, cliente, fecha, total, estado, pagado, telefono, email')
        .eq('franquicia_id', FRANQUICIA_ID)
        .ilike('cliente', `%${(c.nombre_completo || '').trim()}%`)
        .order('id', { ascending: false })
        .limit(20);
      setHistoryOrders(data || []);
    } catch (err) {
      console.error(err);
      setHistoryOrders([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const stats = useMemo(() => {
    const total = clientes.length;
    const withPhone = clientes.filter((c) => (c.telefono || '').trim().length > 0).length;
    const withEmail = clientes.filter((c) => (c.email || '').trim().length > 0).length;
    const campaignReady = clientes.filter(
      (c) => (c.email || '').trim().length > 0 && c.acepta_campanas !== false
    ).length;
    return { total, withPhone, withEmail, campaignReady };
  }, [clientes]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return clientes.filter((c) => {
      if (filterMode === 'WITH_EMAIL' && !(c.email || '').trim()) return false;
      if (filterMode === 'CAMPAIGN_READY' && (!(c.email || '').trim() || c.acepta_campanas === false))
        return false;
      if (!q) return true;
      return (
        (c.nombre_completo || '').toLowerCase().includes(q) ||
        (c.telefono || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q)
      );
    });
  }, [clientes, searchTerm, filterMode]);

  const handleCopyEmails = async () => {
    const emails = filtered
      .filter((c) => (c.email || '').trim() && c.acepta_campanas !== false)
      .map((c) => c.email.trim().toLowerCase());
    const unique = Array.from(new Set(emails));
    if (unique.length === 0) {
      showToastMsg('No hay mails válidos en la vista actual');
      return;
    }
    await navigator.clipboard.writeText(unique.join(', '));
    showToastMsg(`${unique.length} mail(s) copiados al portapapeles`);
  };

  const handleExportCSV = () => {
    const rows = [
      ['Nombre', 'Apellido', 'Nombre Completo', 'Telefono', 'Email', 'Pedidos', 'Acepta Campanas'],
      ...filtered.map((c) => [
        c.nombre || '',
        c.apellido || '',
        c.nombre_completo || '',
        c.telefono || '',
        c.email || '',
        String(c.total_pedidos || 0),
        c.acepta_campanas !== false ? 'SI' : 'NO',
      ]),
    ];
    const csv = rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Clientes_Quesello_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToastMsg('CSV exportado para campañas');
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '14px',
    border: '1px solid #DFDED9',
    background: '#FFFFFF',
    fontSize: '14px',
    color: '#1E293B',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'Inter, sans-serif',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 700,
    color: '#998E55',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  };

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', paddingBottom: '40px' }}>
      {/* HEADER */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '28px', color: '#FF5E5E', fontWeight: 800, margin: 0 }}>
            Clientes
          </h1>
          <p style={{ color: '#64748B', fontSize: '14px', margin: '4px 0 0 0' }}>
            Base unificada desde web y presupuestos, lista para reutilizar y armar campañas de mail.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleCopyEmails}
            style={{
              background: '#F4F1E1',
              color: '#495D56',
              border: '1px solid #DFDED9',
              padding: '11px 16px',
              borderRadius: '16px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <LinearIcon name="copy" color="#495D56" size={16} />
            <span>Copiar Mails ({stats.campaignReady})</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            style={{
              background: '#F4F1E1',
              color: '#495D56',
              border: '1px solid #DFDED9',
              padding: '11px 16px',
              borderRadius: '16px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <LinearIcon name="download" color="#495D56" size={16} />
            <span>Exportar CSV</span>
          </button>

          <button
            type="button"
            onClick={openNewForm}
            style={{
              background: '#FF5E5E',
              color: '#FFFFFF',
              border: 'none',
              padding: '11px 20px',
              borderRadius: '16px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(255, 94, 94, 0.25)',
            }}
          >
            <LinearIcon name="user-plus" color="#FFFFFF" size={16} />
            <span>Nuevo Cliente</span>
          </button>
        </div>
      </header>

      {/* MÉTRICAS RÁPIDAS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div style={{ background: '#FFFFFF', padding: '16px 18px', borderRadius: '20px', border: '1px solid #E5E0D0' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#998E55' }}>TOTAL CLIENTES</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#495D56', marginTop: '4px' }}>
            {stats.total}
          </div>
        </div>
        <div style={{ background: '#FFFFFF', padding: '16px 18px', borderRadius: '20px', border: '1px solid #E5E0D0' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#998E55' }}>CON TELÉFONO</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#495D56', marginTop: '4px' }}>
            {stats.withPhone}
          </div>
        </div>
        <div style={{ background: '#FFFFFF', padding: '16px 18px', borderRadius: '20px', border: '1px solid #E5E0D0' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#998E55' }}>CON MAIL</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#495D56', marginTop: '4px' }}>
            {stats.withEmail}
          </div>
        </div>
        <div style={{ background: '#FFFFFF', padding: '16px 18px', borderRadius: '20px', border: '1px solid #E5E0D0' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#998E55' }}>APTOS CAMPAÑA</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#8E1F52', marginTop: '4px' }}>
            {stats.campaignReady}
          </div>
        </div>
      </div>

      {/* BARRA DE BÚSQUEDA Y FILTROS */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: '18px',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}>
            <LinearIcon name="search" color="#998E55" size={16} />
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono o mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '40px', borderRadius: '18px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '6px', background: '#F4F1E1', padding: '4px', borderRadius: '16px' }}>
          {[
            { id: 'ALL', label: 'Todos' },
            { id: 'WITH_EMAIL', label: 'Con Mail' },
            { id: 'CAMPAIGN_READY', label: 'Aptos Campaña' },
          ].map((tab) => {
            const active = filterMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterMode(tab.id)}
                style={{
                  background: active ? '#FF5E5E' : 'transparent',
                  color: active ? '#FFFFFF' : '#495D56',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '8px 14px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* LISTADO DE CLIENTES */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#998E55' }}>Cargando clientes...</div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            background: '#FFFFFF',
            padding: '40px',
            borderRadius: '24px',
            textAlign: 'center',
            color: '#64748B',
            border: '1px solid #E5E0D0',
          }}
        >
          No se encontraron clientes con ese criterio.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map((c) => {
            const phoneDigits = String(c.telefono || '').replace(/\D/g, '');
            return (
              <div
                key={c.id}
                style={{
                  background: '#FFFFFF',
                  padding: '16px 20px',
                  borderRadius: '20px',
                  border: '1px solid #E5E0D0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '14px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: '#495D56' }}>
                      {c.nombre_completo}
                    </span>
                    <span
                      style={{
                        background: '#F4F1E1',
                        color: '#998E55',
                        padding: '2px 9px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      {c.total_pedidos || 0} pedido{(c.total_pedidos || 0) === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: '14px',
                      flexWrap: 'wrap',
                      marginTop: '6px',
                      fontSize: '13px',
                      color: '#64748B',
                    }}
                  >
                    {c.telefono ? (
                      <a
                        href={`https://wa.me/${phoneDigits}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          color: '#055B5C',
                          fontWeight: 600,
                          textDecoration: 'none',
                        }}
                      >
                        <LinearIcon name="phone" color="#055B5C" size={14} />
                        <span>{c.telefono}</span>
                      </a>
                    ) : (
                      <span style={{ color: '#CBD5E1' }}>Sin teléfono</span>
                    )}

                    {c.email ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#495D56' }}>
                        <LinearIcon name="mail" color="#998E55" size={14} />
                        <span>{c.email}</span>
                      </span>
                    ) : (
                      <span style={{ color: '#CBD5E1' }}>Sin mail</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handleToggleCampanas(c)}
                    title="Incluir/excluir en futuras campañas de mail"
                    style={{
                      background: c.acepta_campanas !== false ? '#DCFCE7' : '#F1F5F9',
                      color: c.acepta_campanas !== false ? '#166534' : '#64748B',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '6px 11px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {c.acepta_campanas !== false ? 'Campaña: Sí' : 'Campaña: No'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleViewHistory(c)}
                    title="Ver presupuestos de este cliente"
                    style={{
                      background: '#F4F1E1',
                      color: '#495D56',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '7px 11px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <LinearIcon name="receipt" color="#495D56" size={14} />
                    <span>Pedidos</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditForm(c)}
                    title="Editar"
                    style={{
                      background: '#F4F1E1',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    <LinearIcon name="pencil" color="#495D56" size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteCliente(c)}
                    title="Eliminar"
                    style={{
                      background: '#FEE2E2',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    <LinearIcon name="trash-2" color="#991B1B" size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL CREAR / EDITAR CLIENTE */}
      {showForm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(75, 59, 40, 0.45)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
          onClick={() => setShowForm(false)}
        >
          <form
            onSubmit={handleSaveForm}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#FAF9F6',
              borderRadius: '28px',
              maxWidth: '480px',
              width: '100%',
              padding: '26px',
              border: '1px solid #E5E0D0',
              boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
            }}
          >
            <h2 style={{ margin: '0 0 18px 0', color: '#FF5E5E', fontSize: '20px', fontWeight: 800 }}>
              {editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div>
                <label style={labelStyle}>NOMBRE</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>APELLIDO</label>
                <input
                  type="text"
                  value={formData.apellido}
                  onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div>
                <label style={labelStyle}>TELÉFONO</label>
                <input
                  type="tel"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>MAIL</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>NOTAS</label>
              <input
                type="text"
                value={formData.notas}
                onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                placeholder="Rubro, emprendimiento, localidad..."
                style={inputStyle}
              />
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#495D56',
                marginBottom: '18px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={!!formData.acepta_campanas}
                onChange={(e) => setFormData({ ...formData, acepta_campanas: e.target.checked })}
              />
              <span>Incluir en campañas de email</span>
            </label>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{
                  flex: 1,
                  padding: '13px',
                  borderRadius: '16px',
                  border: '1px solid #DFDED9',
                  background: '#FFFFFF',
                  color: '#495D56',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  flex: 2,
                  padding: '13px',
                  borderRadius: '16px',
                  border: 'none',
                  background: '#FF5E5E',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {saving ? 'Guardando...' : 'Guardar Cliente'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL HISTORIAL DE PEDIDOS DEL CLIENTE */}
      {historyCliente && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(75, 59, 40, 0.45)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
          onClick={() => setHistoryCliente(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#FAF9F6',
              borderRadius: '28px',
              maxWidth: '520px',
              width: '100%',
              padding: '26px',
              border: '1px solid #E5E0D0',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >
            <h3 style={{ margin: '0 0 6px 0', color: '#495D56', fontSize: '18px', fontWeight: 800 }}>
              Pedidos de {historyCliente.nombre_completo}
            </h3>
            <p style={{ margin: '0 0 16px 0', color: '#998E55', fontSize: '12px' }}>
              {[historyCliente.telefono, historyCliente.email].filter(Boolean).join(' · ') || 'Sin contacto'}
            </p>

            {loadingHistory ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#998E55' }}>Buscando pedidos...</div>
            ) : historyOrders.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>
                No encontramos presupuestos asociados por nombre.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {historyOrders.map((o) => (
                  <div
                    key={o.id}
                    style={{
                      background: '#FFFFFF',
                      padding: '12px 14px',
                      borderRadius: '14px',
                      border: '1px solid #E5E0D0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#495D56' }}>
                        #{o.numero} · {o.estado}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>{o.fecha}</div>
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#8E1F52' }}>
                      ${Number(o.total || 0).toLocaleString('es-AR')}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setHistoryCliente(null)}
              style={{
                width: '100%',
                marginTop: '16px',
                padding: '12px',
                borderRadius: '14px',
                border: 'none',
                background: '#495D56',
                color: '#FFFFFF',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '30px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#1E293B',
            color: '#FFFFFF',
            padding: '12px 24px',
            borderRadius: '999px',
            fontSize: '13px',
            fontWeight: 700,
            zIndex: 10000,
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
