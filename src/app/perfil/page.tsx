'use client';
import { useState } from 'react';
import { useApp } from '@/lib/context';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { LogOut, Trophy, TrendingUp, History, UserCircle, ShieldCheck, Loader2, AlertTriangle } from 'lucide-react';

export default function PerfilPage() {
  const { user, users, login, logout, activeBets, ranking, history } = useApp();
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState("");
  const [club, setClub] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(""); // Mensaje de error visible

  const handleRegister = async () => {
      console.log("--- INICIANDO REGISTRO ---");
      setErrorMsg("");
      const cleanName = name.trim();
      
      if (!cleanName || !club || !pass) {
          setErrorMsg("Faltan campos por rellenar");
          return;
      }
      
      setLoading(true);
      
      try {
          console.log("1. Verificando duplicados locales...");
          const exists = users.some((u: any) => u.id.toLowerCase() === cleanName.toLowerCase());
          if (exists) throw new Error("Ese nombre ya está cogido (Local check).");

          console.log("2. Conectando con Firebase en: users/" + cleanName);
          const docRef = doc(db, "users", cleanName);
          
          console.log("3. Intentando escribir...");
          // FORZAMOS LA ESCRITURA SIN LEER ANTES PARA PROBAR CONEXIÓN
          await setDoc(docRef, {
              clubName: club.trim(),
              balance: 1000,
              password: pass,
              createdAt: new Date().toISOString()
          });
          
          console.log("4. ¡ESCRITURA EXITOSA!");
          alert("✅ ¡USUARIO CREADO!");
          login({ id: cleanName, clubName: club, balance: 1000, password: pass });

      } catch (error: any) {
          console.error("❌ ERROR CRÍTICO:", error);
          // TRADUCCIÓN DE ERRORES COMUNES
          let msg = error.message;
          if (msg.includes("offline")) msg = "Estás sin conexión a internet.";
          if (msg.includes("permission-denied")) msg = "Error de Permisos: Revisa las Reglas en Firebase.";
          setErrorMsg("ERROR: " + msg);
      } finally {
          setLoading(false);
          console.log("--- FIN PROCESO ---");
      }
  };

  // Login simple (sin cambios grandes)
  const handleLogin = () => {
      const cleanName = name.trim();
      const found = users.find((u: any) => u.id.toLowerCase() === cleanName.toLowerCase());
      if (!found) return setErrorMsg("Usuario no encontrado.");
      if (found.password !== pass) return setErrorMsg("Contraseña incorrecta.");
      login(found);
  };

  if (!user) {
      return (
          <div className="max-w-sm mx-auto mt-10 bg-white p-8 rounded-3xl border-2 border-gray-200 shadow-xl">
              <div className="flex justify-center mb-4"><div className="bg-black p-3 rounded-full text-white"><UserCircle size={40} /></div></div>
              <h2 className="text-2xl font-black text-center mb-6 text-black uppercase">{isRegistering ? 'CREAR USUARIO' : 'ACCESO'}</h2>
              
              {/* CAJA DE ERROR VISIBLE */}
              {errorMsg && (
                  <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 text-xs font-bold">
                      <p className="flex items-center gap-2"><AlertTriangle size={16}/> {errorMsg}</p>
                  </div>
              )}

              <div className="space-y-4">
                  <input className="w-full bg-white p-4 rounded-xl border-2 border-gray-200 text-black font-bold outline-none focus:border-black" placeholder="Usuario (Ej: JORGE)" value={name} onChange={e=>setName(e.target.value)} />
                  {isRegistering && <input className="w-full bg-white p-4 rounded-xl border-2 border-gray-200 text-black font-bold outline-none focus:border-black" placeholder="Club (Ej: Calvos FC)" value={club} onChange={e=>setClub(e.target.value)} />}
                  <input className="w-full bg-white p-4 rounded-xl border-2 border-gray-200 text-black font-bold outline-none focus:border-black" type="password" placeholder="Contraseña" value={pass} onChange={e=>setPass(e.target.value)} />
                  
                  <button onClick={isRegistering ? handleRegister : handleLogin} disabled={loading} className="w-full bg-black text-white font-black p-4 rounded-xl hover:bg-gray-800 transition text-sm tracking-widest uppercase disabled:opacity-50 flex justify-center gap-2 items-center">
                      {loading && <Loader2 className="animate-spin" size={16} />}
                      {loading ? 'CONECTANDO...' : (isRegistering ? 'REGISTRAR' : 'ENTRAR')}
                  </button>
              </div>
              <p className="text-center text-gray-500 text-xs mt-6 cursor-pointer hover:text-black font-bold uppercase" onClick={() => { setIsRegistering(!isRegistering); setErrorMsg(""); }}>
                  {isRegistering ? '¿Ya tienes cuenta? Entra' : 'Crear cuenta nueva'}
              </p>
          </div>
      );
  }

  // ... (RESTO DEL PERFIL LOGUEADO IGUAL QUE ANTES) ...
  return (
      <div className="space-y-6 max-w-md mx-auto mt-4 px-4 fade-in">
          <div className="bg-black text-white p-6 rounded-3xl shadow-xl flex justify-between items-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-blue-600 rounded-full blur-3xl opacity-40"></div>
              <div className="relative z-10"><h2 className="text-3xl font-black italic uppercase">{user.id}</h2><p className="text-gray-400 text-sm font-bold uppercase">{user.clubName}</p></div>
              <div className="text-right relative z-10"><p className="text-[10px] text-gray-400 font-bold uppercase">Saldo</p><p className="text-4xl font-mono font-black text-green-400">{user.balance} €</p></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-gray-200 text-center"><Trophy className="mx-auto mb-2 text-yellow-500"/><p className="font-black text-2xl">{ranking.find((r:any)=>r.nombre===user.id)?.victorias||0}</p><p className="text-[9px] font-bold text-gray-400 uppercase">Win</p></div>
              <div className="bg-white p-4 rounded-2xl border border-gray-200 text-center"><TrendingUp className="mx-auto mb-2 text-blue-600"/><p className="font-black text-2xl">{ranking.find((r:any)=>r.nombre===user.id)?.puntos||0}</p><p className="text-[9px] font-bold text-gray-400 uppercase">Pts</p></div>
              <div className="bg-white p-4 rounded-2xl border border-gray-200 text-center"><History className="mx-auto mb-2 text-purple-600"/><p className="font-black text-2xl">{history.filter((h:any)=>h.winner===user.id).length}</p><p className="text-[9px] font-bold text-gray-400 uppercase">Copas</p></div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-gray-200"><h3 className="font-black text-xs uppercase mb-4 text-gray-400">Apuestas</h3><div className="space-y-2">{activeBets.filter((b:any)=>b.bettor===user.id).map((b:any)=>(<div key={b.id} className="flex justify-between text-sm p-3 bg-gray-50 rounded-xl"><span>{b.chosenWinner}</span><span className="font-bold">{b.status}</span></div>))}{activeBets.filter((b:any)=>b.bettor===user.id).length===0 && <p className="text-xs text-center text-gray-400">Sin apuestas.</p>}</div></div>
          <button onClick={logout} className="w-full bg-white border-2 border-red-100 text-red-500 font-bold p-4 rounded-xl flex items-center justify-center gap-2 hover:bg-red-50 text-xs uppercase">CERRAR SESIÓN</button>
      </div>
  );
}