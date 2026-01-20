'use client';
import { useState, useMemo } from 'react';
import { useApp } from '@/lib/context';
import { db } from '@/lib/firebase';
import { doc, addDoc, collection, setDoc, increment, serverTimestamp } from 'firebase/firestore';
import { Lock, Banknote, TrendingUp, TrendingDown, Wallet, Coins, AlertTriangle, Crown } from 'lucide-react';
import Link from 'next/link';

export default function ApuestasPage() {
  const { user, users, matches, activeBets } = useApp();
  const [betAmount, setBetAmount] = useState(100);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [betTarget, setBetTarget] = useState("");

  // --- ESTADÍSTICAS DEL MERCADO ---
  const richest = useMemo(() => users.length ? [...users].sort((a,b) => b.balance - a.balance)[0] : null, [users]);
  const poorest = useMemo(() => users.length ? [...users].sort((a,b) => a.balance - b.balance)[0] : null, [users]);

  // --- FUNCIONES ---
  const realizarApuesta = async () => {
      if (!user) return;
      if (selectedMatchId===null || !betTarget || betAmount<=0) return alert("Rellena todo");
      if (user.balance < betAmount) return alert("No tienes tanta pasta, fantasma 👻");
      
      try {
        // Restar saldo
        await setDoc(doc(db, "users", user.id), { balance: increment(-betAmount) }, { merge: true });
        // Guardar apuesta
        await addDoc(collection(db, "bets"), { 
            matchId: selectedMatchId, 
            bettor: user.id, 
            chosenWinner: betTarget, 
            amount: betAmount, 
            status: 'pending',
            timestamp: serverTimestamp() 
        });
        alert(`✅ ¡Apuesta de ${betAmount}€ realizada!`);
      } catch (e) {
          alert("Error al apostar");
      }
  };

  const pedirPrestamo = async () => {
      if(!user) return;
      if(user.balance >= 100) return alert("Aún tienes dinero, no seas llorón.");
      
      if(confirm("¿Pedir préstamo de urgencia al banco? (Te daremos 500€)")) {
          await setDoc(doc(db, "users", user.id), { balance: 500 }, { merge: true });
          alert("💸 Préstamo concedido. ¡No lo malgastes!");
      }
  };

  // --- VISTA SIN LOGIN ---
  if (!user) {
      return (
          <div className="text-center p-12 bg-white rounded-3xl border border-gray-200 shadow-sm mt-8 max-w-sm mx-auto">
              <Lock size={48} className="mx-auto mb-4 text-gray-300"/>
              <h3 className="font-bold text-lg text-black">Zona VIP Cerrada</h3>
              <p className="text-gray-500 text-sm mb-6">Identifícate para entrar al casino.</p>
              <Link href="/perfil" className="bg-black text-white px-6 py-2 rounded-full font-bold text-xs uppercase tracking-widest">Ir al Perfil</Link>
          </div>
      );
  }

  return (
      <div className="space-y-6 max-w-xl mx-auto animate-in fade-in pb-20">
          
          {/* 📊 WIDGET: EL TIBURÓN Y EL RUINAS */}
          <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-yellow-50 to-white p-4 rounded-2xl border border-yellow-200 shadow-sm flex flex-col items-center text-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 opacity-10"><Crown size={40} className="text-yellow-500"/></div>
                  <span className="text-[10px] font-black text-yellow-600 uppercase tracking-widest mb-1">El Tiburón 🦈</span>
                  <p className="text-lg font-black text-black truncate w-full">{richest?.id || "-"}</p>
                  <p className="text-xs font-mono font-bold text-green-600">{richest?.balance || 0} €</p>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-white p-4 rounded-2xl border border-red-200 shadow-sm flex flex-col items-center text-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 opacity-10"><TrendingDown size={40} className="text-red-500"/></div>
                  <span className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">El Ruinas 🤡</span>
                  <p className="text-lg font-black text-black truncate w-full">{poorest?.id || "-"}</p>
                  <p className="text-xs font-mono font-bold text-red-600">{poorest?.balance || 0} €</p>
              </div>
          </div>

          {/* 💰 ZONA DE APUESTAS */}
          <div className="bg-white border-2 border-green-500 p-6 rounded-3xl shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-3 bg-green-500"></div>
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-black text-black uppercase italic flex items-center gap-2"><Coins className="text-green-600"/> Apostar</h2>
                  <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Tu Saldo</p>
                      <p className={`font-mono font-black text-xl ${user.balance < 100 ? 'text-red-500' : 'text-black'}`}>{user.balance} €</p>
                  </div>
              </div>
              
              {matches.length > 0 ? (
                  <div className="space-y-5">
                      {/* 1. SELECCIONAR PARTIDO */}
                      <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">1. Elige Enfrentamiento</label>
                          <select className="w-full bg-white p-4 rounded-xl border-2 border-gray-200 text-black font-bold outline-none mt-1 focus:border-green-500 transition cursor-pointer appearance-none" onChange={e=>{const m=matches.find((x:any)=>x.id===parseInt(e.target.value));setSelectedMatchId(parseInt(e.target.value));setBetTarget("");}}>
                              <option value="">-- Seleccionar Partido --</option>
                              {matches.filter((m:any) => !m.winner && !m.isBye && m.p1 !== "Esperando...").map((m:any) => (<option key={m.id} value={m.id}>{m.p1} vs {m.p2}</option>))}
                          </select>
                      </div>

                      {/* 2. SELECCIONAR GANADOR */}
                      {selectedMatchId !== null && (
                          <div className="animate-in fade-in slide-in-from-top-2">
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1 block">2. ¿Quién Gana?</label>
                              <div className="grid grid-cols-2 gap-3">
                                  <button onClick={()=>setBetTarget(matches[selectedMatchId!].p1)} className={`p-4 rounded-xl border-2 text-sm font-black transition uppercase relative overflow-hidden ${betTarget===matches[selectedMatchId!].p1?'bg-black text-white border-black':'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                                      {matches[selectedMatchId!].p1}
                                      {betTarget===matches[selectedMatchId!].p1 && <div className="absolute bottom-0 left-0 w-full h-1 bg-green-500"></div>}
                                  </button>
                                  <button onClick={()=>setBetTarget(matches[selectedMatchId!].p2)} className={`p-4 rounded-xl border-2 text-sm font-black transition uppercase relative overflow-hidden ${betTarget===matches[selectedMatchId!].p2?'bg-black text-white border-black':'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                                      {matches[selectedMatchId!].p2}
                                      {betTarget===matches[selectedMatchId!].p2 && <div className="absolute bottom-0 left-0 w-full h-1 bg-green-500"></div>}
                                  </button>
                              </div>
                          </div>
                      )}

                      {/* 3. CANTIDAD (FICHAS) */}
                      <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">3. Cantidad</label>
                          <div className="flex items-center gap-3 bg-white p-3 rounded-xl border-2 border-gray-200 mt-1 mb-3 focus-within:border-black transition">
                              <span className="text-xl">💰</span>
                              <input type="number" className="bg-transparent w-full outline-none text-black font-mono font-bold text-lg" value={betAmount} onChange={e=>setBetAmount(parseInt(e.target.value))} />
                          </div>
                          {/* FICHAS RÁPIDAS */}
                          <div className="grid grid-cols-4 gap-2">
                              {[50, 100, 500].map(amt => (
                                  <button key={amt} onClick={()=>setBetAmount(amt)} className="bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2 rounded-lg text-xs transition">{amt}</button>
                              ))}
                              <button onClick={()=>setBetAmount(user.balance)} className="bg-red-100 hover:bg-red-200 text-red-600 font-bold py-2 rounded-lg text-xs transition uppercase">All In</button>
                          </div>
                      </div>

                      <button onClick={realizarApuesta} className="w-full bg-green-500 hover:bg-green-600 text-white font-black p-4 rounded-xl shadow-lg shadow-green-200 uppercase tracking-wider transition transform active:scale-95 mt-2 flex justify-center gap-2 items-center">
                          <Wallet size={20}/> CONFIRMAR APUESTA
                      </button>
                  </div>
              ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                      <p className="text-gray-400 font-bold text-sm">No hay partidos abiertos.</p>
                      <p className="text-xs text-gray-300 mt-1">El mercado está cerrado.</p>
                  </div>
              )}
          </div>

          {/* 🆘 BOTÓN DE BANCARROTA */}
          {user.balance < 50 && (
              <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center justify-between animate-pulse">
                  <div>
                      <p className="text-red-700 font-black text-sm uppercase">¡Estás arruinado!</p>
                      <p className="text-red-500 text-xs">Pide un rescate para seguir jugando.</p>
                  </div>
                  <button onClick={pedirPrestamo} className="bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md hover:bg-red-700 transition">
                      PEDIR 500€
                  </button>
              </div>
          )}
          
          {/* 📡 MERCADO EN VIVO */}
          <div>
              <div className="flex items-center gap-2 mb-3 ml-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-ping"></div>
                  <h3 className="font-bold text-gray-400 uppercase text-xs tracking-widest">Mercado en Vivo</h3>
              </div>
              
              <div className="space-y-2">
                  {activeBets.filter((b:any) => b.status === 'pending').map((b:any) => (
                      <div key={b.id} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2">
                              <span className="font-bold text-black uppercase text-xs">{b.bettor}</span>
                              <span className="text-gray-300 text-[10px]">▶</span>
                              <span className="text-blue-600 font-black uppercase text-xs">{b.chosenWinner}</span>
                          </div>
                          <span className="font-mono font-bold bg-green-50 text-green-700 px-2 py-1 rounded text-xs border border-green-100">{b.amount} €</span>
                      </div>
                  ))}
                  {activeBets.filter((b:any) => b.status === 'pending').length === 0 && (
                      <p className="text-gray-300 text-xs text-center italic py-4">Todo tranquilo... Sé el primero en mover el mercado.</p>
                  )}
              </div>
          </div>
      </div>
  );
}