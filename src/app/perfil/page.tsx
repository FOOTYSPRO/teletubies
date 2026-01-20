'use client';
import { useState } from 'react';
import { useApp } from '@/lib/context';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { LogOut, Trophy, TrendingUp, History } from 'lucide-react';

export default function PerfilPage() {
  const { user, users, login, logout, activeBets, ranking, history } = useApp();
  
  // Estados formulario
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState("");
  const [club, setClub] = useState("");
  const [pass, setPass] = useState("");

  const handleLogin = () => {
      const found = users.find((u:any) => u.id.toLowerCase() === name.toLowerCase());
      if (!found || found.password !== pass) return alert("Error de credenciales");
      login(found);
  };

  const handleRegister = async () => {
      if (!name || !club || !pass) return alert("Rellena todo");
      if (users.find((u:any) => u.id.toLowerCase() === name.toLowerCase())) return alert("Nombre ocupado");
      const newUser = { clubName: club, balance: 1000, password: pass };
      await setDoc(doc(db, "users", name), newUser);
      login({ id: name, ...newUser });
  };

  // --- VISTA NO LOGUEADO ---
  if (!user) {
      return (
          <div className="max-w-sm mx-auto mt-8 bg-white p-8 rounded-3xl border-2 border-gray-100 shadow-xl">
              <h2 className="text-2xl font-black text-center mb-6 text-black tracking-tight">{isRegistering ? 'NUEVO FICHAJE' : 'ACCESO SOCIOS'}</h2>
              <div className="space-y-4">
                  <input className="w-full bg-white p-4 rounded-xl border-2 border-gray-200 text-black font-bold placeholder:text-gray-400 focus:border-black outline-none transition" placeholder="Usuario" value={name} onChange={e=>setName(e.target.value)} />
                  {isRegistering && <input className="w-full bg-white p-4 rounded-xl border-2 border-gray-200 text-black font-bold placeholder:text-gray-400 focus:border-black outline-none" placeholder="Nombre Club (Ej: Aston Birra)" value={club} onChange={e=>setClub(e.target.value)} />}
                  <input className="w-full bg-white p-4 rounded-xl border-2 border-gray-200 text-black font-bold placeholder:text-gray-400 focus:border-black outline-none" type="password" placeholder="Contraseña" value={pass} onChange={e=>setPass(e.target.value)} />
                  <button onClick={isRegistering ? handleRegister : handleLogin} className="w-full bg-black text-white font-black p-4 rounded-xl hover:bg-gray-800 transition shadow-lg text-sm tracking-widest uppercase">{isRegistering ? 'CREAR CUENTA' : 'ENTRAR AL VESTUARIO'}</button>
              </div>
              <p className="text-center text-gray-500 text-xs mt-6 cursor-pointer hover:underline hover:text-black font-bold uppercase tracking-wide" onClick={() => setIsRegistering(!isRegistering)}>{isRegistering ? '¿Ya tienes cuenta? Entra aquí' : '¿No tienes cuenta? Regístrate'}</p>
          </div>
      );
  }

  // --- VISTA LOGUEADO (DASHBOARD) ---
  return (
      <div className="space-y-6 animate-in fade-in">
          {/* TARJETA DE USUARIO */}
          <div className="bg-black text-white p-6 rounded-3xl shadow-xl flex justify-between items-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600 rounded-full -mr-10 -mt-10 blur-3xl opacity-40"></div>
              <div className="relative z-10">
                  <h2 className="text-3xl font-black italic uppercase">{user.id}</h2>
                  <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">{user.clubName}</p>
              </div>
              <div className="text-right relative z-10">
                  <p className="text-xs text-gray-400 uppercase tracking-widest">Saldo</p>
                  <p className="text-4xl font-mono font-black text-green-400">{user.balance} €</p>
              </div>
          </div>

          {/* ESTADÍSTICAS */}
          <div className="grid grid-cols-3 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm text-center">
                  <Trophy className="w-5 h-5 mx-auto mb-2 text-yellow-500" />
                  <p className="text-2xl font-black text-black">{ranking.find((r:any)=>r.nombre===user.id)?.victorias || 0}</p>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Victorias</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm text-center">
                  <TrendingUp className="w-5 h-5 mx-auto mb-2 text-blue-600" />
                  <p className="text-2xl font-black text-black">{ranking.find((r:any)=>r.nombre===user.id)?.puntos || 0}</p>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Puntos</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm text-center">
                  <History className="w-5 h-5 mx-auto mb-2 text-purple-600" />
                  <p className="text-2xl font-black text-black">{history.filter((h:any) => h.winner === user.id).length}</p>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Títulos</p>
              </div>
          </div>

          {/* ÚLTIMAS APUESTAS */}
          <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
              <h3 className="font-black text-xs uppercase mb-4 text-gray-400 tracking-widest border-b pb-2">Historial de Apuestas</h3>
              <div className="space-y-2">
                  {activeBets.filter((b:any) => b.bettor === user.id).length > 0 ? (
                      activeBets.filter((b:any) => b.bettor === user.id).map((b:any) => (
                          <div key={b.id} className="flex justify-between items-center text-sm p-3 bg-gray-50 rounded-xl border border-gray-100">
                              <span>Apostaste a <span className="text-black font-bold uppercase">{b.chosenWinner}</span></span>
                              <span className={`font-bold font-mono ${b.status==='won'?'text-green-600':b.status==='lost'?'text-red-500':'text-yellow-600'}`}>
                                  {b.status==='won' ? `+${b.amount*2}€` : b.status==='lost' ? `-${b.amount}€` : 'PENDIENTE'}
                              </span>
                          </div>
                      ))
                  ) : (
                      <p className="text-gray-400 text-xs text-center py-4 italic">No tienes apuestas activas.</p>
                  )}
              </div>
          </div>

          <button onClick={logout} className="w-full bg-white border-2 border-red-100 text-red-500 font-bold p-4 rounded-xl flex items-center justify-center gap-2 hover:bg-red-50 transition text-xs uppercase tracking-widest">
              <LogOut size={16}/> CERRAR SESIÓN
          </button>
      </div>
  );
}