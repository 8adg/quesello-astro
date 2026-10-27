import { supabase } from './supabase';

export async function createMercadoPagoPreference({
  title,
  unitPrice,
  externalReference,
  clientName,
  clientPhone
}) {
  try {
    // 1. Buscar si hay token configurado en Supabase config
    const { data: configToken } = await supabase
      .from('config')
      .select('valor')
      .eq('clave', 'mp_access_token')
      .maybeSingle();

    const token = configToken?.valor || null;

    if (!token) {
      console.warn('No hay token de Mercado Pago configurado en config (clave: mp_access_token).');
      return {
        initPoint: null,
        error: 'MP_NOT_CONFIGURED',
        message: 'Falta configurar el Access Token de Mercado Pago en la tabla config.'
      };
    }

    // 2. Crear la preferencia en Mercado Pago
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://quesello.com.ar';
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: [
          {
            id: `SELLO-${Date.now()}`,
            title: title || 'Sello Automático Personalizado - Queselló',
            quantity: 1,
            unit_price: Number(unitPrice),
            currency_id: 'ARS'
          }
        ],
        payer: {
          name: clientName || 'Cliente',
          phone: {
            number: clientPhone ? String(clientPhone).replace(/\D/g, '') : ''
          }
        },
        external_reference: String(externalReference),
        back_urls: {
          success: `${origin}/pedidos`,
          failure: `${origin}/creador`,
          pending: `${origin}/pedidos`
        },
        auto_return: 'approved'
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Error MP Preference:', errText);
      return { initPoint: null, error: errText };
    }

    const data = await response.json();
    return {
      initPoint: data.init_point || data.sandbox_init_point,
      preferenceId: data.id
    };

  } catch (err) {
    console.error('Error creando preferencia MP:', err);
    return { initPoint: null, error: err.message };
  }
}

export async function checkPaymentStatus(budgetNumberOrId) {
  try {
    // 1. Consultar si el presupuesto ya figura como pagado
    const query = typeof budgetNumberOrId === 'number'
      ? supabase.from('presupuestos').select('id, numero, pagado, estado').eq('id', budgetNumberOrId)
      : supabase.from('presupuestos').select('id, numero, pagado, estado').eq('numero', String(budgetNumberOrId));

    const { data: budget } = await query.maybeSingle();

    if (budget && budget.pagado) {
      return { isPaid: true, budget };
    }

    // 2. Consultar en pagos_recibidos_mp
    if (budget?.id) {
      const { data: payment } = await supabase
        .from('pagos_recibidos_mp')
        .select('*')
        .eq('presupuesto_id', budget.id)
        .maybeSingle();

      if (payment) {
        // Actualizar a pagado
        await supabase
          .from('presupuestos')
          .update({ pagado: true, estado: 'EN PROCESO' })
          .eq('id', budget.id);
        return { isPaid: true, payment };
      }
    }

    return { isPaid: false };
  } catch (err) {
    console.error('Error verificando pago:', err);
    return { isPaid: false, error: err.message };
  }
}
