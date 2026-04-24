import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function AdminAuth({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    // 1. Chequear sesión al cargar
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // 2. Escuchar cambios de estado (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setLoginError(error.message);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div style={{ 
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', 
        fontFamily: 'Inter', background: '#F8FAFC', color: '#64748B', fontWeight: 700 
      }}>
        CARGANDO ACCESO...
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ 
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', 
        background: '#F1F5F9', fontFamily: 'Inter' 
      }}>
        <div style={{ 
          background: "white", padding: "40px", borderRadius: "30px", width: "100%", 
          maxWidth: "400px", boxShadow: "0 20px 40px rgba(0,0,0,0.05)", textAlign: "center" 
        }}>
          <img src="/logo.svg" alt="Queselló" style={{ width: '150px', marginBottom: '30px' }} />
          <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '10px', color: '#1E293B' }}>Acceso Admin</h2>
          <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '30px' }}>Ingresá tus credenciales de franquicia</p>
          
          {loginError && (
            <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '12px', borderRadius: '12px', fontSize: '13px', fontWeight: 700, marginBottom: '20px' }}>
              ❌ {loginError === 'Invalid login credentials' ? 'Datos incorrectos' : loginError}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            <input 
              type="email" 
              placeholder="Email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ padding: "15px", borderRadius: "15px", border: "2px solid #E2E8F0", fontSize: "15px", outline: 'none', fontWeight: 600 }}
              required
            />
            <input 
              type="password" 
              placeholder="Contraseña" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ padding: "15px", borderRadius: "15px", border: "2px solid #E2E8F0", fontSize: "15px", outline: 'none', fontWeight: 600 }}
              required
            />
            <button 
              type="submit" 
              style={{ 
                padding: "16px", borderRadius: "15px", border: "none", background: "#FF5E5E", 
                color: "white", fontSize: "16px", cursor: "pointer", fontWeight: 800, marginTop: "10px" 
              }}
              disabled={loading}
            >
              {loading ? "ENTRANDO..." : "INGRESAR"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Si hay sesión, renderizar el contenido del admin
  return <>{children}</>;
}
