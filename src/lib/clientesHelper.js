// src/lib/clientesHelper.js

/**
 * Normaliza un número de teléfono dejando solo dígitos para comparar duplicados
 */
export function normalizePhoneDigits(phone = '') {
  return String(phone || '').replace(/\D/g, '');
}

/**
 * Registra o actualiza un cliente en la tabla `clientes` sin duplicar.
 * Prioridad de coincidencia: 1) email, 2) teléfono (últimos 8+ dígitos), 3) nombre_completo.
 */
export async function upsertCliente({
  supabaseClient,
  nombre = '',
  apellido = '',
  nombreCompleto = '',
  telefono = '',
  email = '',
  franquiciaId = 1,
  incrementOrders = false,
}) {
  try {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanTel = String(telefono || '').trim();
    const cleanTelDigits = normalizePhoneDigits(cleanTel);

    let full = String(nombreCompleto || '').trim();
    let nom = String(nombre || '').trim();
    let ape = String(apellido || '').trim();

    if (!full && (nom || ape)) {
      full = `${nom} ${ape}`.trim();
    } else if (full && !nom) {
      const parts = full.replace(/\s+/g, ' ').split(' ');
      nom = parts[0] || '';
      ape = parts.slice(1).join(' ');
    }

    full = full.replace(/\s+/g, ' ').trim().toUpperCase();
    nom = nom.toUpperCase();
    ape = ape.toUpperCase();

    if (!full && !cleanEmail && !cleanTel) return null;
    if (!full) full = cleanEmail || cleanTel;

    let existing = null;

    // 1. Buscar por email exacto (case-insensitive)
    if (cleanEmail) {
      const { data } = await supabaseClient
        .from('clientes')
        .select('*')
        .eq('franquicia_id', franquiciaId)
        .ilike('email', cleanEmail)
        .limit(1);
      if (data && data.length > 0) existing = data[0];
    }

    // 2. Buscar por teléfono si no hubo match por email
    if (!existing && cleanTelDigits.length >= 6) {
      const suffix = cleanTelDigits.slice(-8);
      const { data } = await supabaseClient
        .from('clientes')
        .select('*')
        .eq('franquicia_id', franquiciaId)
        .neq('telefono', '');
      if (data && data.length > 0) {
        existing =
          data.find((c) => {
            const d = normalizePhoneDigits(c.telefono);
            return d && (d === cleanTelDigits || (suffix.length >= 7 && d.endsWith(suffix)));
          }) || null;
      }
    }

    // 3. Buscar por nombre completo exacto si aún no se encontró
    if (!existing && full) {
      const { data } = await supabaseClient
        .from('clientes')
        .select('*')
        .eq('franquicia_id', franquiciaId)
        .ilike('nombre_completo', full)
        .limit(1);
      if (data && data.length > 0) existing = data[0];
    }

    const nowIso = new Date().toISOString();

    if (existing) {
      const updatePayload = {
        nombre: nom || existing.nombre,
        apellido: ape || existing.apellido || '',
        nombre_completo: full || existing.nombre_completo,
        telefono: cleanTel || existing.telefono || '',
        email: cleanEmail || existing.email || '',
        actualizado_en: nowIso,
      };
      if (incrementOrders) {
        updatePayload.total_pedidos = (Number(existing.total_pedidos) || 0) + 1;
        updatePayload.ultimo_pedido_at = nowIso;
      }
      const { data: updated } = await supabaseClient
        .from('clientes')
        .update(updatePayload)
        .eq('id', existing.id)
        .select()
        .single();
      return updated || existing;
    }

    const insertPayload = {
      nombre: nom || full,
      apellido: ape || '',
      nombre_completo: full,
      telefono: cleanTel,
      email: cleanEmail,
      acepta_campanas: true,
      total_pedidos: incrementOrders ? 1 : 0,
      ultimo_pedido_at: incrementOrders ? nowIso : null,
      franquicia_id: franquiciaId,
    };

    const { data: inserted } = await supabaseClient
      .from('clientes')
      .insert(insertPayload)
      .select()
      .single();
    return inserted || null;
  } catch (err) {
    console.warn('upsertCliente warning:', err);
    return null;
  }
}
