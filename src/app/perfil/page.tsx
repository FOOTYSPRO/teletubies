'use client';
import { useState } from 'react';
import { useApp } from '@/lib/context';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, writeBatch, increment } from 'firebase/firestore';
import { LogOut, Trophy, TrendingUp, History, UserCircle, ShieldCheck, Loader2, AlertTriangle, Send, Wallet } from 'lucide-react';

export default function PerfilPage() {
  const { user, users, login, logout, activeBets, ranking, history } = useApp();
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState("");
  const [club, setClub] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  // ESTADOS PARA TRANSFERENCIA
  const [showTransfer, setShowTransfer] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");

  // REGISTRO
  const handleRegister = async () => {
      setErrorMsg("");
      const cleanName = name.trim();
      if (!cleanName || !club || !pass) { setErrorMsg("Faltan campos"); return; }
      setLoading(true);
      try {
          const exists = users.some((u: any) => u.id.toLowerCase() === cleanName.toLowerCase());
          if (exists) throw new Error("Nombre ocupado.");
          await setDoc(doc(db, "users", cleanName), { clubName: club.trim(), balance: 1000, password: pass, createdAt: new Date().toISOString() });
          login({ id: cleanName, clubName: club, balance: 1000, password: pass });
      } catch (error: any) { setErrorMsg(error.message); } finally { setLoading(false); }
  };

  // LOGIN
  const handleLogin = () => {
      const cleanName = name.trim();
      const found = users.find((u: any) => u.id.toLowerCase() === cleanName.toLowerCase());
      if (!found) return setErrorMsg("Usuario no encontrado.");
      if (found.password !== pass) return setErrorMsg("Contraseña incorrecta.");
      login(found);
  };

  // --- FUNCIÓN DE ENVIAR DINERO (BIZUM) ---
  const handleTransfer = async () => {
      if (!recipient || !amount) return alert("Rellena todo.");
      const quantity = parseInt(amount);
      if (quantity <= 0) return alert("No seas rata, envía algo positivo.");
      if (user.balance < quantity) return alert("No tienes tanto dinero.");
      if (recipient === user.id) return alert("No puedes enviarte dinero a ti mismo.");

      if (!confirm(`¿Enviar ${quantity}€ a ${recipient}?`)) return;

      try {
          const batch = writeBatch(db);
          // 1. Quitar al que envía
          batch.update(doc(db, "users", user.id), { balance: increment(-quantity) });
          // 2. Dar al que recibe
          batch.update(doc(db, "users", recipient), { balance: increment(quantity) });
          
          await batch.commit();
          alert("✅ ¡Bizum realizado con éxito!");
          setShowTransfer(false);
          setAmount("");
          setRecipient("");
      } catch (e) {
          alert("Error en la transferencia");
      }
  };

  if (!user) {
      return (
          <div className="max-w-sm mx-auto mt-10 bg-white p-8 rounded-3xl border-2 border-gray-100 shadow-xl animate-in fade-in">
              <div className="flex justify-center mb-4"><div className="bg-black p-3 rounded-full text-white"><UserCircle size={40} /></div></div>
              <h2 className="text-2xl font-black text-center mb-6 text-black uppercase tracking-tight">{isRegistering ? 'CREAR USUARIO' : 'ACCESO'}</h2>
              {errorMsg && <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-xs font-bold flex items-center gap-2"><AlertTriangle size={14}/> {errorMsg}</div>}
              <div className="space-y-3">
                  <input className="w-full bg-gray-50 p-4 rounded-xl border-2 border-transparent focus:border-black outline-none font-bold text-sm" placeholder="Usuario" value={name} onChange={e=>setName(e.target.value)} />
                  {isRegistering && <input className="w-full bg-gray-50 p-4 rounded-xl border-2 border-transparent focus:border-black outline-none font-bold text-sm" placeholder="Club" value={club} onChange={e=>setClub(e.target.value)} />}
                  <input className="w-full bg-gray-50 p-4 rounded-xl border-2 border-transparent focus:border-black outline-none font-bold text-sm" type="password" placeholder="Contraseña" value={pass} onChange={e=>setPass(e.target.value)} />
                  <button onClick={isRegistering ? handleRegister : handleLogin} disabled={loading} className="w-full bg-black text-white font-black p-4 rounded-xl hover:bg-gray-800 transition text-sm uppercase tracking-widest flex justify-center gap-2 items-center">{loading && <Loader2 className="animate-spin" size={16} />}{loading ? '...' : (isRegistering ? 'REGISTRAR' : 'ENTRAR')}</button>
              </div>
              <p className="text-center text-gray-400 text-xs mt-6 cursor-pointer hover:text-black font-bold uppercase" onClick={() => { setIsRegistering(!isRegistering); setErrorMsg(""); }}>{isRegistering ? '¿Ya tienes cuenta? Entra' : 'Crear cuenta nueva'}</p>
          </div>
      );
  }

  return (
      <div className="space-y-6 max-w-md mx-auto mt-2 px-4 animate-in slide-in-from-bottom-4">
          
          {/* TARJETA DE USUARIO */}
          <div className="bg-black text-white p-6 rounded-3xl shadow-2xl flex justify-between items-center relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-40 h-40 bg-blue-600 rounded-full blur-3xl opacity-30 group-hover:opacity-50 transition duration-700"></div>
              <div className="relative z-10">
                  <h2 className="text-3xl font-black italic uppercase tracking-tighter">{user.id}</h2>
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">{user.clubName}</p>
              </div>
              <div className="text-right relative z-10">
                  <p className="text-[9px] text-gray-400 font-bold uppercase mb-1">Saldo Disponible</p>
                  <p className="text-4xl font-mono font-black text-green-400 tracking-tighter">{user.balance} €</p>
              </div>
          </div>

          {/* 💸 ZONA BIZUM / TRANSFERENCIA */}
          <div className="bg-white p-1 rounded-3xl border border-gray-200 shadow-sm">
              <button onClick={() => setShowTransfer(!showTransfer)} className="w-full py-3 px-4 flex items-center justify-between hover:bg-gray-50 rounded-2xl transition group">
                  <div className="flex items-center gap-3">
                      <div className="bg-purple-100 text-purple-600 p-2 rounded-full group-hover:scale-110 transition"><Send size={18} /></div>
                      <div className="text-left">
                          <p className="font-black text-xs uppercase text-purple-900">Footys Bizum</p>
                          <p className="text-[10px] text-gray-400 font-bold">Enviar dinero a un amigo</p>
                      </div>
                  </div>
                  <span className="text-gray-300 text-lg font-black group-hover:text-purple-600 transition">{showTransfer ? '−' : '+'}</span>
              </button>
              
              {showTransfer && (
                  <div className="p-4 pt-0 animate-in fade-in slide-in-from-top-2">
                      <div className="h-px w-full bg-gray-100 mb-4"></div>
                      <div className="space-y-3">
                          <div>
                              <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Destinatario</label>
                              <select className="w-full bg-gray-50 p-3 rounded-xl border border-gray-200 text-sm font-bold outline-none focus:border-purple-500 transition" value={recipient} onChange={e=>setRecipient(e.target.value)}>
                                  <option value="">Selecciona amigo...</option>
                                  {users.filter((u:any) => u.id !== user.id).map((u:any) => (
                                      <option key={u.id} value={u.id}>{u.id}</option>
                                  ))}
                              </select>
                          </div>
                          <div className="flex gap-2">
                              <div className="flex-1">
                                  <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Cantidad</label>
                                  <input type="number" className="w-full bg-gray-50 p-3 rounded-xl border border-gray-200 text-sm font-bold outline-none focus:border-purple-500 transition" placeholder="0 €" value={amount} onChange={e=>setAmount(e.target.value)} />
                              </div>
                              <button onClick={handleTransfer} className="mt-5 bg-purple-600 hover:bg-purple-700 text-white font-black px-6 rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-purple-200 transition active:scale-95">
                                  ENVIAR
                              </button>
                          </div>
                      </div>
                  </div>
              )}
          </div>

          {/* ESTADÍSTICAS */}
          <div className="grid grid-cols-3 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-gray-200 text-center shadow-sm"><Trophy className="mx-auto mb-2 text-yellow-500" size={20}/><p className="font-black text-2xl">{ranking.find((r:any)=>r.nombre===user.id)?.victorias||0}</p><p className="text-[9px] font-bold text-gray-400 uppercase">Victorias</p></div>
              <div className="bg-white p-4 rounded-2xl border border-gray-200 text-center shadow-sm"><TrendingUp className="mx-auto mb-2 text-blue-600" size={20}/><p className="font-black text-2xl">{ranking.find((r:any)=>r.nombre===user.id)?.puntos||0}</p><p className="text-[9px] font-bold text-gray-400 uppercase">Puntos</p></div>
              <div className="bg-white p-4 rounded-2xl border border-gray-200 text-center shadow-sm"><History className="mx-auto mb-2 text-purple-600" size={20}/><p className="font-black text-2xl">{history.filter((h:any)=>h.winner===user.id).length}</p><p className="text-[9px] font-bold text-gray-400 uppercase">Torneos</p></div>
          </div>
          
          <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
              <h3 className="font-black text-xs uppercase mb-4 text-gray-400 flex items-center gap-2"><Wallet size={14}/> Mis Apuestas Activas</h3>
              <div className="space-y-2">
                  {activeBets.filter((b:any)=>b.bettor===user.id && b.status==='pending').map((b:any)=>(<div key={b.id} className="flex justify-between text-xs p-3 bg-gray-50 rounded-xl font-bold border border-gray-100"><span>{b.chosenWinner}</span><span className="text-blue-600">{b.amount}€</span></div>))}
                  {activeBets.filter((b:any)=>b.bettor===user.id && b.status==='pending').length===0 && <p className="text-xs text-center text-gray-300 italic">No tienes apuestas en juego.</p>}
              </div>
          </div>
          
          <button onClick={logout} className="w-full bg-white border-2 border-red-50 text-red-400 font-bold p-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition text-xs uppercase tracking-widest mb-10">
              <LogOut size={16}/> Cerrar Sesión
          </button>
      </div>
  );
}