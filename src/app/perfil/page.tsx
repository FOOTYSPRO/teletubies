// src/app/perfil/page.tsx
'use client';
import { useState } from 'react';
import { useApp } from '@/lib/context'; // Usamos el cerebro
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { LogOut } from 'lucide-react';

export default function PerfilPage() {
  const { user, users, login, logout, activeBets } = useApp();
  
  // Estados locales para formularios
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState("");
  const [club, setClub] = useState("");
  const [pass, setPass] = useState("");

  const handleLogin = () => {
      const found = users.find((u:any) => u.id.toLowerCase() === name.toLowerCase());
      if (!found || found.password !== pass) return alert("Error de acceso");
      login(found);
  };

  const handleRegister = async () => {
      if (!name || !club || !pass) return alert("Rellena todo");
      if (users.find((u:any) => u.id.toLowerCase() === name.toLowerCase())) return alert("Nombre ocupado");
      const newUser = { clubName: club, balance: 1000, password: pass };
      await setDoc(doc(db, "users", name), newUser);
      login({ id: name, ...newUser });
  };

  if (!user) {
      return (
          <div className="p-6 max-w-sm mx-auto mt-10">
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl">
                  <h2 className="text-2xl font-black text-center mb-6">{isRegistering ? 'NUEVO FICHAJE' : 'ACCESO CLUB'}</h2>
                  <input className="w-full bg-gray-50 p-4 rounded-xl mb-3 border-none" placeholder="Nombre" value={name} onChange={e=>setName(e.target.value)} />
                  {isRegistering && <input className="w-full bg-gray-50 p-4 rounded-xl mb-3 border-none" placeholder="Club (ej: Aston Birra)" value={club} onChange={e=>setClub(e.target.value)} />}
                  <input className="w-full bg-gray-50 p-4 rounded-xl mb-6 border-none" type="password" placeholder="Contraseña" value={pass} onChange={e=>setPass(e.target.value)} />
                  <button onClick={isRegistering ? handleRegister : handleLogin} className="w-full bg-black text-white font-bold p-4 rounded-xl mb-4">{isRegistering ? 'REGISTRARSE' : 'ENTRAR'}</button>
                  <p className="text-center text-gray-500 text-sm cursor-pointer underline" onClick={() => setIsRegistering(!isRegistering)}>{isRegistering ? '¿Ya tienes cuenta? Entra' : 'Crear cuenta'}</p>
              </div>
          </div>
      );
  }

  return (
      <div className="p-4 max-w-md mx-auto space-y-6 mt-6">
          <div className="bg-black text-white p-6 rounded-3xl shadow-xl flex justify-between items-center relative overflow-hidden">
              <div className="relative z-10">
                  <h2 className="text-3xl font-black italic uppercase">{user.id}</h2>
                  <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">{user.clubName}</p>
              </div>
              <div className="text-right relative z-10">
                  <p className="text-xs text-gray-400 uppercase tracking-widest">Saldo</p>
                  <p className="text-4xl font-mono font-black text-green-400">{user.balance} €</p>
              </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="font-black text-sm uppercase mb-4">Tus Apuestas</h3>
              <div className="space-y-2">
                  {activeBets.filter((b:any) => b.bettor === user.id).map((b:any) => (
                      <div key={b.id} className="flex justify-between items-center text-sm p-3 bg-gray-50 rounded-xl">
                          <span>Apostaste a <span className="font-bold text-blue-600">{b.chosenWinner}</span></span>
                          <span className={`font-bold ${b.status==='won'?'text-green-600':b.status==='lost'?'text-red-500':'text-yellow-600'}`}>
                              {b.status==='won' ? `+${b.amount*2}€` : b.status==='lost' ? `-${b.amount}€` : 'Pendiente'}
                          </span>
                      </div>
                  ))}
                  {activeBets.filter((b:any) => b.bettor === user.id).length === 0 && <p className="text-gray-400 text-xs text-center">Sin actividad.</p>}
              </div>
          </div>

          <button onClick={logout} className="w-full bg-red-50 text-red-500 font-bold p-4 rounded-xl flex items-center justify-center gap-2"><LogOut size={16}/> Cerrar Sesión</button>
      </div>
  );
}