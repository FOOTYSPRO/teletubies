'use client';
import { useState } from 'react';
import { useApp } from '@/lib/context';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { LogOut, Trophy, TrendingUp, History, UserCircle, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';

export default function PerfilPage() {
  const { user, users, login, logout, activeBets, ranking, history } = useApp();
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState("");
  const [club, setClub] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [debugError, setDebugError] = useState(""); // Para mostrar errores en pantalla

  // --- LOGIN ---
  const handleLogin = async () => {
      if (!name || !pass) return alert("Rellena usuario y contraseña");
      setLoading(true); setDebugError("");
      
      try {
          console.log("Intentando login para:", name);
          // 1. TIMEOUT DE SEGURIDAD (5 seg)
          const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Tiempo de espera agotado. Revisa tu conexión a internet o la configuración de Firebase.")), 5000));
          
          // 2. BUSCAR EN FIREBASE
          const docRef = doc(db, "users", name.trim());
          const fetchPromise = getDoc(docRef);

          // Corremos la carrera: Firebase vs 5 segundos
          const userSnap: any = await Promise.race([fetchPromise, timeout]);

          if (userSnap.exists()) {
              const userData = userSnap.data();
              if (userData.password === pass) {
                  login({ id: userSnap.id, ...userData });
              } else {
                  alert("❌ Contraseña incorrecta");
              }
          } else {
              alert("❌ Usuario no encontrado. Regístrate.");
          }
      } catch (e: any) {
          console.error("ERROR LOGIN:", e);
          setDebugError(e.message);
      } finally {
          setLoading(false);
      }
  };

  // --- REGISTRO ---
  const handleRegister = async () => {
      const cleanName = name.trim();
      if (!cleanName || !club || !pass) return alert("Rellena todos los campos");
      
      setLoading(true); setDebugError("");
      
      try {
          console.log("Iniciando registro para:", cleanName);

          // 1. TIMEOUT DE SEGURIDAD (5 seg)
          const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Firebase no responde. ¿Has creado la base de datos en la consola?")), 5000));

          // 2. VALIDAR SI EXISTE
          const docRef = doc(db, "users", cleanName);
          const checkPromise = getDoc(docRef);
          
          const docSnap: any = await Promise.race([checkPromise, timeout]);

          if (docSnap.exists()) {
              alert("⚠️ Ese nombre ya está ocupado.");
              setLoading(false);
              return;
          }

          // 3. GUARDAR
          const newUser = { 
              clubName: club.trim(), 
              balance: 1000, 
              password: pass,
              createdAt: new Date().toISOString()
          };
          
          console.log("Guardando datos...", newUser);
          await setDoc(docRef, newUser);
          console.log("¡Guardado éxito!");

          // 4. LOGIN
          login({ id: cleanName, ...newUser });
          
      } catch (error: any) {
          console.error("ERROR REGISTRO:", error);
          setDebugError(error.message || "Error desconocido");
      } finally {
          setLoading(false);
      }
  };

  if (!user) {
      return (
          <div className="max-w-sm mx-auto mt-10 bg-white p-8 rounded-3xl border-2 border-gray-200 shadow-2xl">
              <div className="flex justify-center mb-4">
                  <div className="bg-black p-3 rounded-full text-white shadow-lg"><UserCircle size={40} /></div>
              </div>
              <h2 className="text-2xl font-black text-center mb-6 text-black tracking-tight uppercase">
                  {isRegistering ? 'Fichar Jugador' : 'Acceso Club'}
              </h2>
              
              {/* CAJA DE ERROR VISIBLE */}
              {debugError && (
                  <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-xs font-bold mb-4 flex gap-2 items-center animate-pulse">
                      <AlertCircle size={16} className="shrink-0"/>
                      <span>{debugError}</span>
                  </div>
              )}

              <div className="space-y-4">
                  <input className="w-full bg-white p-4 rounded-xl border-2 border-gray-200 text-black font-bold outline-none focus:border-black transition" placeholder="Usuario" value={name} onChange={e=>setName(e.target.value)} />
                  {isRegistering && <input className="w-full bg-white p-4 rounded-xl border-2 border-gray-200 text-black font-bold outline-none focus:border-black transition" placeholder="Club" value={club} onChange={e=>setClub(e.target.value)} />}
                  <input className="w-full bg-white p-4 rounded-xl border-2 border-gray-200 text-black font-bold outline-none focus:border-black transition" type="password" placeholder="Contraseña" value={pass} onChange={e=>setPass(e.target.value)} />
                  
                  <button onClick={isRegistering ? handleRegister : handleLogin} disabled={loading} className="w-full bg-black text-white font-black p-4 rounded-xl hover:bg-gray-800 transition shadow-lg text-sm tracking-widest uppercase disabled:opacity-70 flex justify-center gap-2 items-center">
                      {loading && <Loader2 className="animate-spin" size={16} />}
                      {loading ? 'CONECTANDO...' : (isRegistering ? 'FIRMAR CONTRATO' : 'ENTRAR AL VESTUARIO')}
                  </button>
              </div>
              <p className="text-center text-gray-500 text-xs mt-6 cursor-pointer hover:underline font-bold uppercase" onClick={() => setIsRegistering(!isRegistering)}>
                  {isRegistering ? '¿Ya tienes cuenta? Entra aquí' : '¿No tienes cuenta? Regístrate'}
              </p>
          </div>
      );
  }

  // VISTA LOGUEADO (Igual que antes...)
  return (
      <div className="space-y-6 max-w-md mx-auto mt-4 px-4 fade-in">
          <div className="bg-black text-white p-6 rounded-3xl shadow-xl flex justify-between items-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-blue-600 rounded-full blur-3xl opacity-40"></div>
              <div className="relative z-10"><div className="flex items-center gap-2 mb-1"><ShieldCheck size={16} className="text-green-400"/><span className="text-[10px] font-bold bg-white/10 px-2 py-0.5 rounded text-green-400 uppercase tracking-wider">Verificado</span></div><h2 className="text-3xl font-black italic uppercase tracking-tighter">{user.id}</h2><p className="text-gray-400 text-sm font-bold uppercase tracking-widest">{user.clubName}</p></div>
              <div className="text-right relative z-10"><p className="text-[10px] text-gray-400 font-bold uppercase">Saldo</p><p className="text-4xl font-mono font-black text-green-400">{user.balance}</p><p className="text-[10px] text-green-600 font-bold text-right mt-1">EUR (€)</p></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-gray-200 text-center"><Trophy className="mx-auto mb-2 text-yellow-500"/><p className="font-black text-2xl">{ranking.find((r:any)=>r.nombre===user.id)?.victorias||0}</p><p className="text-[9px] font-bold text-gray-400 uppercase">Win</p></div>
              <div className="bg-white p-4 rounded-2xl border border-gray-200 text-center"><TrendingUp className="mx-auto mb-2 text-blue-600"/><p className="font-black text-2xl">{ranking.find((r:any)=>r.nombre===user.id)?.puntos||0}</p><p className="text-[9px] font-bold text-gray-400 uppercase">Pts</p></div>
              <div className="bg-white p-4 rounded-2xl border border-gray-200 text-center"><History className="mx-auto mb-2 text-purple-600"/><p className="font-black text-2xl">{history.filter((h:any)=>h.winner===user.id).length}</p><p className="text-[9px] font-bold text-gray-400 uppercase">Copas</p></div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-gray-200"><h3 className="font-black text-xs uppercase mb-4 text-gray-400">Apuestas</h3><div className="space-y-2">{activeBets.filter((b:any)=>b.bettor===user.id).map((b:any)=>(<div key={b.id} className="flex justify-between text-sm p-3 bg-gray-50 rounded-xl"><span>{b.chosenWinner}</span><span className="font-bold">{b.status}</span></div>))}{activeBets.filter((b:any)=>b.bettor===user.id).length===0 && <p className="text-xs text-center text-gray-400">Sin apuestas.</p>}</div></div>
          <button onClick={logout} className="w-full bg-white border-2 border-red-100 text-red-500 font-bold p-4 rounded-xl flex items-center justify-center gap-2 hover:bg-red-50 text-xs uppercase mb-10"><LogOut size={16}/> CERRAR SESIÓN</button>
      </div>
  );
}