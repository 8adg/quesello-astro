import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function OrderTracker() {
  const [ticket, setTicket] = useState("");
  const [loading, setLoading] = useState(false);
  const [orderData, setOrderData] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    let html5QrCode;
    if (isScanning) {
      import("html5-qrcode").then(({ Html5Qrcode }) => {
        html5QrCode = new Html5Qrcode("qr-reader");
        html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
          (decodedText) => {
            html5QrCode.stop().then(() => setIsScanning(false)).catch(console.warn);
            procesarQR(decodedText);
          },
          () => { } // Ignorar errores de frame
        ).catch((err) => {
          console.error(err);
          setErrorMsg("No pudimos acceder a tu cámara. Dale permisos en tu navegador.");
          setIsScanning(false);
        });
      });
    }
    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(console.warn);
      }
    };
  }, [isScanning]);

  const procesarQR = async (qrText) => {
    setLoading(true);
    setErrorMsg("");
    setOrderData(null);

    try {
      if (qrText.startsWith('http')) {
        const url = new URL(qrText);
        const pid = url.searchParams.get("id");
        const tk = url.searchParams.get("tk");
        if (pid && tk) {
          const { data, error } = await supabase.from("presupuestos").select("*").eq("id", pid).eq("token", tk).single();
          if (error) throw error;
          setOrderData(data);
          setLoading(false);
          return;
        }
      }
    } catch (e) { }

    setTicket(qrText);
    buscarPedidoGnr(qrText.trim());
  };

  const buscarPedidoGnr = async (numeroClave) => {
    setLoading(true);
    setErrorMsg("");
    setOrderData(null);
    try {
      const { data, error } = await supabase.from("presupuestos").select("*").eq("numero", numeroClave).single();
      if (error) throw error;
      setOrderData(data);
    } catch (err) {
      setErrorMsg("No encontramos ningún pedido con ese código.");
    } finally {
      setLoading(false);
    }
  };

  const formatLabel = (val) => {
    if (!val) return "Sin fecha";
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const getStatusConfig = (status) => {
    const s = status?.toUpperCase() || "";
    if (s === 'ENTREGADO') {
      return { bg: '#D1FAE5', color: '#065F46', text: 'EL PAQUETE FUE ENTREGADO' };
    }
    if (s === 'EN PUNTO DE ENTREGA') {
      return { bg: '#FEF3C7', color: '#92400E', text: '¡LISTO PARA RETIRAR!' };
    }
    if (s === 'PENDIENTE') {
      return { bg: '#F1F5F9', color: '#475569', text: 'PEDIDO RECIBIDO' };
    }
    // DEFAULT O "EN PROCESO"
    return { bg: '#DBEAFE', color: '#1E40AF', text: 'ESTAMOS PREPARANDO TU PEDIDO' };
  };

  const statusCfg = orderData ? getStatusConfig(orderData.estado) : null;

  return (
    <section style={{ width: "100%", maxWidth: "420px", display: "flex", flexDirection: "column", alignItems: "center", padding: "0px" }}>
      <div style={{ textAlign: "center", color: "var(--primary)", marginBottom: "30px" }}>
        <h2 style={{ fontWeight: 700, margin: "24px", color: "#FF5555", fontFamily: "var(--font-outfit)" }}>Estado de mi pedido</h2>
        <p style={{ margin: "0", fontSize: "16px", opacity: 0.8, color: "#495D56" }}>Ingresá el número de código o escanéalo con tu cámara.</p>
      </div>

      <div id="qr-reader" style={{ width: "100%", maxWidth: "340px", borderRadius: "24px", overflow: "hidden", marginBottom: isScanning ? "24px" : "0", display: isScanning ? "block" : "none" }}></div>

      <form onSubmit={(e) => { e.preventDefault(); buscarPedidoGnr(ticket); }} style={{ width: "100%", display: "flex", flexDirection: "column", gap: "12px" }}>
        <input
          type="text"
          placeholder="# Número de presupuesto"
          value={ticket}
          onChange={(e) => setTicket(e.target.value)}
          disabled={isScanning || loading}
          style={{ width: "100%", padding: "16px", borderRadius: "24px", border: "2px solid rgba(73, 93, 86, 0.2)", fontSize: "18px", fontWeight: 500, textAlign: "center", color: "var(--primary)", backgroundColor: "white", outline: 'none' }}
        />
        <button type="submit" className="btn" style={{ width: "100%", margin: 0 }} disabled={loading || isScanning}>{loading ? "..." : "Consultar"}</button>
        <button type="button" className="btn" onClick={() => setIsScanning(!isScanning)} style={{ width: "100%", margin: 0, background: isScanning ? "#FF5E5E" : "transparent", color: isScanning ? "white" : "#FF5E5E", border: "2px solid #FF5E5E" }}>
          {isScanning ? "Ocultar Escáner" : "Escanear QR"}
        </button>
      </form>

      <div style={{ width: "100%", marginTop: "32px", display: "flex", flexDirection: "column", alignItems: "center" }}>
        {errorMsg && <div style={{ padding: "16px", borderRadius: "16px", backgroundColor: "#ffebec", color: "#d32f2f", textAlign: "center", fontWeight: "bold", width: "100%" }}>{errorMsg}</div>}

        {orderData && (
          <div style={{ background: "white", padding: "35px 25px", borderRadius: "27px", boxShadow: "0 8px 32px rgba(73, 93, 86, 0.08)", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>

            <h2 style={{ fontSize: "24px", color: "#1A202C", margin: "0 0 15px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", fontWeight: 800 }}>📦 Entrega de Pedido</h2>

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
        )}

      </div>
    </section>
  );
}
