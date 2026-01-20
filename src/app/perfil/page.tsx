'use client';
import { useState } from 'react';
import { useApp } from '@/lib/context';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { LogOut, Trophy, TrendingUp, History, UserCircle, ShieldCheck, Loader2 } from 'lucide-react';

export default function PerfilPage() {
  const { user, users, login, logout, activeBets, ranking, history } = useApp();
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState("");
  const [club, setClub] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
      if (!name || !pass) return alert("Rellena usuario y contraseña");
      const cleanName = name.trim();
      const found = users.find((u: any) => u.id.toLowerCase() === cleanName.toLowerCase());

      if (!found) return alert("❌ Usuario no encontrado. Regístrate.");
      if (found.password !== pass) return alert("❌ Contraseña incorrecta.");
      
      login(found);
      // NO REDIRIGIMOS
  };

  const handleRegister = async () => {
      const cleanName = name.trim();
      if (!cleanName || !club || !pass) return alert("Rellena todos los campos");
      setLoading(true);
      
      try {
          const exists = users.some((u: any) => u.id.toLowerCase() === cleanName.toLowerCase());
          if (exists) {
              alert("⚠️ Ese nombre ya está en uso.");
              setLoading(false);
              return;
          }

          const newUser = { clubName: club.trim(), balance: 1000, password: pass };
          
          const savePromise = setDoc(doc(db, "users", cleanName), newUser);
          const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 3000));
          await Promise.race([savePromise, timeoutPromise]);
          
          login({ id: cleanName, ...newUser });
          // NO REDIRIGIMOS
          
      } catch (error) {
          console.error(error);
          login({ id: cleanName, clubName: club, balance: 1000, password: pass });
      } finally {
          setLoading(false);
      }
  };

  if (!user) {
      return (
          <div className="max-w-sm mx-auto mt-10 bg-white p-8 rounded-3xl border border-gray-200 shadow-xl animate-in fade-in slide-in-from-bottom-4">
              <div className="flex justify-center mb-4">
                  <div className="bg-black p-3 rounded-full text-white shadow-lg"><UserCircle size={40} /></div>
              </div>
              <h2 className="text-2xl font-black text-center mb-6 text-black tracking-tight uppercase">
                  {isRegistering ? 'Fichar Jugador' : 'Acceso Club'}
              </h2>
              <div className="space-y-4">
                  <input className="w-full bg-white p-4 rounded-xl border-2 border-gray-100 text-black font-bold placeholder:text-gray-400 focus:border-black outline-none transition" placeholder="Usuario" value={name} onChange={e=>setName(e.target.value)} />
                  {isRegistering && <input className="w-full bg-white p-4 rounded-xl border-2 border-gray-100 text-black font-bold placeholder:text-gray-400 focus:border-black outline-none transition" placeholder="Club (Ej: Aston Birra)" value={club} onChange={e=>setClub(e.target.value)} />}
                  <input className="w-full bg-white p-4 rounded-xl border-2 border-gray-100 text-black font-bold placeholder:text-gray-400 focus:border-black outline-none transition" type="password" placeholder="Contraseña" value={pass} onChange={e=>setPass(e.target.value)} />
                  <button onClick={isRegistering ? handleRegister : handleLogin} disabled={loading} className="w-full bg-black text-white font-black p-4 rounded-xl hover:bg-gray-800 transition shadow-lg text-sm tracking-widest uppercase flex justify-center gap-2 items-center">
                      {loading && <Loader2 className="animate-spin" size={16} />}
                      {loading ? 'PROCESANDO...' : (isRegistering ? 'FIRMAR CONTRATO' : 'ENTRAR AL VESTUARIO')}
                  </button>
              </div>
              <p className="text-center text-gray-500 text-xs mt-6 cursor-pointer hover:underline hover:text-black font-bold uppercase tracking-wide" onClick={() => { setIsRegistering(!isRegistering); setName(''); setPass(''); }}>
                  {isRegistering ? '¿Ya tienes cuenta? Entra aquí' : '¿No tienes cuenta? Regístrate'}
              </p>
          </div>
      );
  }

  // --- VISTA LOGUEADO ---
  return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 max-w-md mx-auto mt-4 px-4">
          <div className="bg-black text-white p-6 rounded-3xl shadow-2xl flex justify-between items-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full -mr-12 -mt-12 blur-3xl opacity-40"></div>
              <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-1"><ShieldCheck size={16} className="text-green-400"/><span className="text-[10px] font-bold bg-white/10 px-2 py-0.5 rounded text-green-400 uppercase tracking-wider">Verificado</span></div>
                  <h2 className="text-3xl font-black italic uppercase tracking-tighter">{user.id}</h2>
                  <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">{user.clubName}</p>
              </div>
              <div className="text-right relative z-10">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Presupuesto</p>
                  <p className="text-4xl font-mono font-black text-green-400 tracking-tighter">{user.balance}</p>
                  <p className="text-[10px] text-green-600 font-bold text-right mt-1">EUR (€)</p>
              </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm text-center"><Trophy className="w-5 h-5 mx-auto mb-2 text-yellow-500" /><p className="text-2xl font-black text-black">{ranking.find((r:any)=>r.nombre===user.id)?.victorias || 0}</p><p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Victorias</p></div>
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm text-center"><TrendingUp className="w-5 h-5 mx-auto mb-2 text-blue-600" /><p className="text-2xl font-black text-black">{ranking.find((r:any)=>r.nombre===user.id)?.puntos || 0}</p><p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Puntos</p></div>
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm text-center"><History className="w-5 h-5 mx-auto mb-2 text-purple-600" /><p className="text-2xl font-black text-black">{history.filter((h:any) => h.winner === user.id).length}</p><p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Copas</p></div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
              <h3 className="font-black text-xs uppercase mb-4 text-gray-400 tracking-widest border-b pb-2">Últimas Apuestas</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {activeBets.filter((b:any) => b.bettor === user.id).length > 0 ? (
                      activeBets.filter((b:any) => b.bettor === user.id).map((b:any) => (
                          <div key={b.id} className="flex justify-between items-center text-sm p-3 bg-gray-50 rounded-xl border border-gray-100">
                              <span className="text-xs font-bold text-gray-600">Apostaste a <span className="text-black uppercase">{b.chosenWinner}</span></span>
                              <span className={`font-bold font-mono text-xs ${b.status==='won'?'text-green-600':b.status==='lost'?'text-red-500':'text-yellow-600 bg-yellow-50 px-2 py-1 rounded'}`}>{b.status==='won' ? `+${b.amount*2}€` : b.status==='lost' ? `-${b.amount}€` : 'PENDIENTE'}</span>
                          </div>
                      ))
                  ) : (<p className="text-gray-400 text-xs text-center py-4 italic">No tienes apuestas registradas.</p>)}
              </div>
          </div>

          <button onClick={logout} className="w-full bg-white border-2 border-red-100 text-red-500 font-bold p-4 rounded-xl flex items-center justify-center gap-2 hover:bg-red-50 transition text-xs uppercase tracking-widest mb-10"><LogOut size={16}/> CERRAR SESIÓN</button>
      </div>
  );
}