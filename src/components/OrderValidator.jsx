import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

export default function OrderValidator() {
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [correctPin, setCorrectPin] = useState("1234");
  const [attempts, setAttempts] = useState(0);
  const [processingDelivery, setProcessingDelivery] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const pid = urlParams.get('id');
    const tk = urlParams.get('tk');

    if (!pid || !tk) {
      setErrorMsg("❌ Enlace inválido.");
      setLoading(false);
      return;
    }

    const init = async () => {
      try {
        // Fetch PIN validation from settings
        const { data: pinData } = await supabase.from('ajustes').select('valor').eq('id', 'pin_validacion').single();
        if (pinData) setCorrectPin(pinData.valor);

        // Fetch Order Data
        const { data: order, error } = await supabase
          .from('presupuestos')
          .select('*')
          .eq('id', pid)
          .eq('token', tk)
          .single();

        if (error || !order) {
          setErrorMsg("❌ No se encontró el pedido.");
        } else {
          setOrderData(order);
        }
      } catch (err) {
        console.error(err);
        setErrorMsg("Error cargando datos.");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const formatLabel = (val) => {
    if (!val) return "Sin fecha";
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const confirmarEntrega = async () => {
    if (pin !== correctPin) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      alert(`PIN Incorrecto. Intento ${newAttempts} de 2.`);
      if (newAttempts >= 2) {
        setIsDrawerOpen(false);
        alert("Se han agotado los intentos.");
      }
      return;
    }

    setProcessingDelivery(true);
    const now = new Date().toISOString();
    
    try {
      const { error } = await supabase
        .from('presupuestos')
        .update({
          estado: 'ENTREGADO',
          entregado_at: now
        })
        .eq('id', orderData.id);

      if (error) {
        alert("Error al actualizar: " + error.message);
      } else {
        setOrderData({ ...orderData, estado: 'ENTREGADO', entregado_at: now });
        setIsDrawerOpen(false);
      }
    } catch (e) {
      alert("Error de conexión.");
    } finally {
      setProcessingDelivery(false);
    }
  };

  const getStatusConfig = (status) => {
    const s = status?.toUpperCase() || "";
    if (s === 'ENTREGADO') {
      return { bg: '#D1FAE5', color: '#065F46', text: 'EL PAQUETE FUE ENTREGADO' };
    }
    if (s.includes('PUNTO DE ENTREGA')) {
      return { bg: '#FEF3C7', color: '#92400E', text: '¡LISTO PARA RETIRAR EN EL LOCAL!' };
    }
    if (s === 'PENDIENTE') {
      return { bg: '#F1F5F9', color: '#475569', text: 'PEDIDO RECIBIDO' };
    }
    return { bg: '#DBEAFE', color: '#1E40AF', text: 'ESTAMOS PREPARANDO TU PEDIDO' };
  };

  if (loading) return <div style={{ marginTop: "100px", fontWeight: 700, color: "#718096" }}>Cargando datos...</div>;

  const statusCfg = orderData ? getStatusConfig(orderData.estado) : null;

  return (
    <div style={{ width: "100%", maxWidth: "420px", position: "relative" }}>
      
      {/* Admin Trigger Icon */}
      {orderData && orderData.estado !== 'ENTREGADO' && (
        <div 
          onClick={() => setIsDrawerOpen(true)}
          style={{ position: "absolute", top: "-50px", right: "0px", cursor: "pointer", opacity: 0.5 }}
        >
          <svg width="24" height="24" viewBox="0 0 42 49" fill="currentColor">
            <path d="M18.6667 30.3333V35C14.9536 35 11.3927 36.475 8.76717 39.1005C6.14166 41.726 4.66667 45.287 4.66667 49H0C0 44.0493 1.96666 39.3013 5.46734 35.8007C8.96802 32.3 13.716 30.3333 18.6667 30.3333ZM18.6667 28C10.9317 28 4.66667 21.735 4.66667 14C4.66667 6.265 10.9317 0 18.6667 0C26.4017 0 32.6667 6.265 32.6667 14C32.6667 21.735 26.4017 28 18.6667 28ZM18.6667 23.3333C23.8233 23.3333 28 19.1567 28 14C28 8.84333 23.8233 4.66667 18.6667 4.66667C13.51 4.66667 9.33333 8.84333 9.33333 14C9.33333 19.1567 13.51 23.3333 18.6667 23.3333ZM39.6667 37.3333H42V49H23.3333V37.3333H25.6667V35C25.6667 33.1435 26.4042 31.363 27.7169 30.0503C29.0297 28.7375 30.8102 28 32.6667 28C34.5232 28 36.3037 28.7375 37.6164 30.0503C38.9292 31.363 39.6667 33.1435 39.6667 35V37.3333ZM35 37.3333V35C35 34.3812 34.7542 33.7877 34.3166 33.3501C33.879 32.9125 33.2855 32.6667 32.6667 32.6667C32.0478 32.6667 31.4543 32.9125 31.0168 33.3501C30.5792 33.7877 30.3333 34.3812 30.3333 35V37.3333H35Z" />
          </svg>
        </div>
      )}

      <div style={{ textAlign: "center", color: "var(--primary)", marginBottom: "30px" }}>
        <img src="/logo.svg" alt="Queselló" style={{ width: "160px", marginBottom: "12px" }} />
        <div style={{ fontSize: "18px", fontWeight: 500 }}>Podés ver el estado de tu pedido</div>
      </div>

      {errorMsg && <div style={{ padding: "16px", borderRadius: "16px", backgroundColor: "#ffebec", color: "#d32f2f", textAlign: "center", fontWeight: "bold" }}>{errorMsg}</div>}

      {orderData && (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
          
          <div style={{ background: "white", padding: "35px 25px", borderRadius: "27px", boxShadow: "0 8px 32px rgba(73, 93, 86, 0.08)", width: "100%", textAlign: "center" }}>
            <h1 style={{ fontSize: "24px", color: "#1A202C", margin: "0 0 10px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", fontWeight: 800 }}>📦 Entrega de Pedido</h1>
            
            <div style={{ padding: "8px 20px", borderRadius: "30px", fontSize: "13px", fontWeight: 800, textAlign: "center", marginBottom: "25px", textTransform: "uppercase", background: statusCfg.bg, color: statusCfg.color }}>
              {statusCfg.text}
            </div>

            <div style={{ width: "100%", background: "#F1F5F9", padding: "25px", borderRadius: "24px", textAlign: "left", marginBottom: "25px" }}>
              <div style={{ marginBottom: "15px" }}>
                <div style={{ color: "#94A3B8", fontSize: "13px", fontWeight: 400, marginBottom: "4px" }}>Número de Presupuesto</div>
                <div style={{ color: "#1E293B", fontSize: "17px", fontWeight: 800 }}>{orderData.numero}</div>
              </div>
              
              <div style={{ marginBottom: "15px" }}>
                <div style={{ color: "#94A3B8", fontSize: "13px", fontWeight: 400, marginBottom: "4px" }}>Cliente</div>
                <div style={{ color: "#1E293B", fontSize: "17px", fontWeight: 800 }}>{orderData.cliente}</div>
              </div>
              
              <div style={{ marginTop: "5px" }}>
                <div style={{ color: "#94A3B8", fontSize: "13px", fontWeight: 400, marginBottom: "4px" }}>
                  {orderData.pagado ? "PAGADO: Total a pagar" : "Total a Cobrar"}
                </div>
                <div style={{ display: "block", color: "#FF5E5E", fontSize: "24px", fontWeight: 800, marginTop: "5px" }}>
                  {orderData.pagado ? "$ 0,00" : `$ ${(orderData.total || 0).toLocaleString('es-AR')}`}
                </div>
              </div>
            </div>

            {orderData.retiro_sugerido && orderData.estado !== 'ENTREGADO' && (
              <div style={{ width: "100%", background: "#D1FAE5", padding: "20px", borderRadius: "18px", textAlign: "center", border: "2px solid #afefd8", color: "#065F46" }}>
                <span style={{ fontWeight: 600, fontSize: "15px" }}>📅 Podés pasar a retirar el:</span>
                <span style={{ fontSize: "24px", fontWeight: 800, display: "block", marginTop: "5px" }}>{formatLabel(orderData.retiro_sugerido)}</span>
              </div>
            )}

            {orderData.estado === 'ENTREGADO' && (
              <div style={{ color: "#38A169", fontSize: "16px", fontWeight: 700, marginTop: "15px", lineHeight: 1.4, padding: "0 10px" }}>
                Este pedido ya fue entregado el {formatLabel(orderData.entregado_at || orderData.fecha)}
              </div>
            )}
          </div>

          {/* Footer Buttons like original validar.html */}
          <div style={{ marginTop: "30px", width: "100%", textAlign: "center" }}>
            <div style={{ marginBottom: "35px" }}>
              <a href="https://g.page/r/CZLBllWe0Sj8EBE/review" target="_blank" className="btn" style={{ maxWidth: "220px", margin: "0 auto", display: "inline-block" }}>Calificanos</a>
              <div style={{ color: "#4A5568", fontSize: "16px", marginTop: "15px", lineHeight: 1.4 }}>Tu opinión en Google nos ayuda un montón!</div>
            </div>

            <div style={{ marginBottom: "35px" }}>
              <a href="https://quesello.com.ar" target="_blank" className="btn" style={{ maxWidth: "220px", margin: "0 auto", display: "inline-block" }}>Tienda</a>
              <div style={{ color: "#4A5568", fontSize: "16px", marginTop: "15px", lineHeight: 1.4 }}>Si te falta tinta, otro sello o renovar tu marca, visitanos.</div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Drawer (PIN) */}
      {isDrawerOpen && (
        <>
          <div 
            onClick={() => setIsDrawerOpen(false)}
            style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", zIndex: 1000, backdropFilter: "blur(4px)" }}
          />
          <div style={{ 
            position: "fixed", bottom: 0, left: 0, width: "100%", background: "white", zIndex: 1001, 
            borderRadius: "40px 40px 0 0", padding: "45px 30px 60px 30px", textAlign: "center", boxSizing: "border-box",
            boxShadow: "0 -15px 40px rgba(0,0,0,0.15)"
          }}>
            <div style={{ width: "50px", height: "6px", background: "#E2E8F0", borderRadius: "10px", margin: "-25px auto 40px auto" }} />
            <div style={{ fontSize: "24px", fontWeight: 800, color: "#FF5E5E", marginBottom: "30px" }}>Area administradores</div>
            <input 
              type="password" 
              placeholder="PIN de Seguridad" 
              maxLength={4} 
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              style={{ 
                width: "100%", padding: "20px", border: "2px solid #EDF2F7", borderRadius: "20px", 
                fontSize: "24px", textAlign: "center", marginBottom: "25px", outline: "none", background: "#F8FAFC", letterSpacing: "10px"
              }}
            />
            <button 
              onClick={confirmarEntrega}
              disabled={processingDelivery}
              className="btn" 
              style={{ width: "100%", margin: 0 }}
            >
              {processingDelivery ? "PROCESANDO..." : "CONFIRMAR ENTREGA"}
            </button>
          </div>
        </>
      )}

    </div>
  );
}
