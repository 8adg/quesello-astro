import { atom, computed } from 'nanostores';
import { persistentAtom } from '@nanostores/persistent';
import { supabaseAdmin } from '../lib/supabase';

// Estado persistente: los items del carrito
export const $cartItems = persistentAtom('quesello_cart', [], {
  encode: JSON.stringify,
  decode: JSON.parse,
});

// Estado de la UI
export const $isCartOpen = atom(false);
export const $customerName = atom('');
export const $isSaving = atom(false);

// Estado de la franquicia actual (por defecto Central)
export const $currentFranchise = atom({
  id: 1,
  nombre: 'Central Queselló',
  whatsapp: '5492235203360'
});

// Cálculos derivados
export const $cartTotal = computed($cartItems, (items) => 
  items.reduce((sum, item) => sum + item.precio * item.quantity, 0)
);

export const $cartCount = computed($cartItems, (items) => 
  items.reduce((sum, item) => sum + item.quantity, 0)
);

// Acciones
export const addToCart = (product) => {
  const items = $cartItems.get();
  const existingItem = items.find((item) => item.id === product.id);
  if (existingItem) {
    $cartItems.set(
      items.map((item) =>
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      )
    );
  } else {
    $cartItems.set([...items, { ...product, quantity: 1 }]);
  }
};

export const removeFromCart = (id) => {
  $cartItems.set($cartItems.get().filter((item) => item.id !== id));
};

export const updateQuantity = (id, quantity) => {
  if (quantity < 1) return removeFromCart(id);
  $cartItems.set(
    $cartItems.get().map((item) => (item.id === id ? { ...item, quantity } : item))
  );
};

export const clearCart = () => {
  $cartItems.set([]);
};

// Generación de mensaje WhatsApp (Réplica exacta de tu lógica)
const generateWhatsAppMessage = (name, cartItems, totalValue) => {
  const box = "📦";
  const bag = "💰";
  const check = "✅";
  const email = "📩";
  const money = "💳";
  const clip = "📎";
  const rocket = "🚀";

  let msg = `Hola soy ${name}! Este es ${box} *Mi Pedido:*\n\n`;
  cartItems.forEach((item) => {
    msg += `• ${item.quantity} x ${item.descripcion} - $${(item.precio * item.quantity).toLocaleString()}\n`;
  });

  msg += `\n${bag} *Total:* $${totalValue.toLocaleString()}\n\n`;
  msg += `Gracias *${name}*!\n`;
  msg += `${check} *Perfecto!* Ya tu pedido está en proceso.\n\n`;
  msg += `${email} Ahora enviame el *logo en PDF* así vamos avanzando. Completá el formulario:\nhttps://forms.gle/V7fj7HMitqUwhJb2A\n\n`;
  msg += `${money} Además podés hace el depósito por transferencia bancaria al *alias:* mi.sello\n\n`;
  msg += `${clip} Una vez realizado, enviá el comprobante por acá mismo.\n\n`;
  msg += `${rocket} ¡Ya falta poco para tener tu sello emprendedor!`;
  
  return msg;
};

// Procesar pedido (Lógica de Supabase + WhatsApp)
export const processOrder = async () => {
  const name = $customerName.get();
  const items = $cartItems.get();
  const total = $cartTotal.get();
  
  if (!name) return;
  $isSaving.set(true);
  const franq = $currentFranchise.get();
  let phone = franq.whatsapp ? franq.whatsapp.replace(/\D/g, '') : "5492235203360";

  try {
    const tempId = `W${Date.now().toString().slice(-5)}`;
    const { data: pData, error: pError } = await supabaseAdmin
      .from("presupuestos")
      .insert([{
        numero: tempId,
        cliente: name,
        total: total,
        estado: 'PENDIENTE',
        pagado: false,
        franquicia_id: franq.id, 
        observaciones: `Pedido desde WEB - ${franq.nombre}`,
        fecha: new Date().toLocaleDateString('es-AR')
      }])
      .select()
      .single();
    
    if (pError) throw pError;

    const itemsToInsert = items.map(it => ({
      presupuesto_id: pData.id,
      descripcion: it.descripcion,
      cantidad: it.quantity,
      precio_unitario: it.precio,
      total: it.precio * it.quantity
    }));

    const { error: iError } = await supabaseAdmin.from("presupuesto_items").insert(itemsToInsert);
    if (iError) throw iError;

    const fullMsg = generateWhatsAppMessage(name, items, total);
    window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(fullMsg)}`, "_blank");
    
  } catch (err) {
    console.error("Error:", err);
    const fallbackMsg = generateWhatsAppMessage(name, items, total);
    window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(fallbackMsg)}`, "_blank");
  } finally {
    clearCart();
    $isCartOpen.set(false);
    $customerName.set('');
    $isSaving.set(false);
  }
};
