'use client';
import { useState, useMemo } from 'react';
import { useApp } from '@/lib/context';
import { db } from '@/lib/firebase';
import { doc, addDoc, collection, setDoc, increment, serverTimestamp } from 'firebase/firestore';
import { Lock, Wallet, Coins, Crown, TrendingDown, History, Flame, CheckCircle2, XCircle, Globe, User } from 'lucide-react';
import Link from 'next/link';

export default function ApuestasPage() {
  const { user, users, matches, activeBets } = useApp();
  const [betAmount, setBetAmount] = useState(100);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [betTarget, setBetTarget] = useState("");
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  // --- ESTADÍSTICAS ---
  const richest = useMemo(() => users.length ? [...users].sort((a,b) => b.balance - a.balance)[0] : null, [users]);
  const poorest = useMemo(() => users.length ? [...users].sort((a,b) => a.balance - b.balance)[0] : null, [users]);

  // FILTROS
  const pendingBets = activeBets.filter((b:any) => b.status === 'pending');
  // HISTORIAL GLOBAL (Ya no filtro por user.id)
  const globalHistory = activeBets.filter((b:any) => b.status !== 'pending').sort((a:any, b:any) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

  // --- FUNCIONES ---
  const realizarApuesta = async () => {
      if (!user) return;
      if (selectedMatchId===null || !betTarget || betAmount<=0) return alert("Rellena todo");
      if (user.balance < betAmount) return alert("No tienes tanta pasta, fantasma 👻");
      
      try {
        await setDoc(doc(db, "users", user.id), { balance: increment(-betAmount) }, { merge: true });
        await addDoc(collection(db, "bets"), { 
            matchId: selectedMatchId, 
            bettor: user.id, 
            chosenWinner: betTarget, 
            amount: betAmount, 
            status: 'pending',
            timestamp: serverTimestamp() 
        });
        alert(`✅ ¡Apuesta de ${betAmount}€ realizada!`);
        setActiveTab('active');
      } catch (e) { alert("Error al apostar"); }
  };

  const pedirPrestamo = async () => {
      if(!user) return;
      if(user.balance >= 100) return alert("Aún tienes dinero, no seas llorón.");
      if(confirm("¿Pedir préstamo de urgencia al banco? (Te daremos 500€)")) {
          await setDoc(doc(db, "users", user.id), { balance: 500 }, { merge: true });
          alert("💸 Préstamo concedido. ¡No lo malgastes!");
      }
  };

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
      <div className="space-y-6 max-w-xl mx-auto animate-in fade-in pb-20 px-4">
          
          {/* 📊 WIDGET: EL TIBURÓN Y EL RUINAS */}
          <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-yellow-50 to-white p-4 rounded-3xl border border-yellow-200 shadow-sm flex flex-col items-center text-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 opacity-10"><Crown size={40} className="text-yellow-500"/></div>
                  <span className="text-[10px] font-black text-yellow-600 uppercase tracking-widest mb-1">El Tiburón 🦈</span>
                  <p className="text-lg font-black text-black truncate w-full">{richest?.id || "-"}</p>
                  <p className="text-xs font-mono font-bold text-green-600">{richest?.balance || 0} €</p>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-white p-4 rounded-3xl border border-red-200 shadow-sm flex flex-col items-center text-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 opacity-10"><TrendingDown size={40} className="text-red-500"/></div>
                  <span className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">El Ruinas 🤡</span>
                  <p className="text-lg font-black text-black truncate w-full">{poorest?.id || "-"}</p>
                  <p className="text-xs font-mono font-bold text-red-600">{poorest?.balance || 0} €</p>
              </div>
          </div>

          {/* 💰 ZONA DE APUESTAS */}
          <div className="bg-white border-2 border-black p-6 rounded-3xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-black text-black uppercase italic flex items-center gap-2"><Coins className="text-yellow-500"/> Nueva Apuesta</h2>
                  <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Tu Saldo</p>
                      <p className={`font-mono font-black text-xl ${user.balance < 100 ? 'text-red-500' : 'text-black'}`}>{user.balance} €</p>
                  </div>
              </div>
              
              {matches.length > 0 ? (
                  <div className="space-y-5">
                      <div>
                          <select className="w-full bg-gray-50 p-3 rounded-xl border border-gray-200 text-black text-xs font-bold outline-none focus:border-black transition cursor-pointer appearance-none uppercase tracking-wide" onChange={e=>{const m=matches.find((x:any)=>x.id===parseInt(e.target.value));setSelectedMatchId(parseInt(e.target.value));setBetTarget("");}}>
                              <option value="">👇 Seleccionar Partido</option>
                              {matches.filter((m:any) => !m.winner && !m.isBye && m.p1 !== "Esperando...").map((m:any) => (<option key={m.id} value={m.id}>{m.p1} vs {m.p2}</option>))}
                          </select>
                      </div>

                      {selectedMatchId !== null && (
                          <div className="animate-in fade-in slide-in-from-top-2 grid grid-cols-2 gap-3">
                              <button onClick={()=>setBetTarget(matches[selectedMatchId!].p1)} className={`p-3 rounded-xl border-2 text-xs font-black transition uppercase ${betTarget===matches[selectedMatchId!].p1?'bg-black text-white border-black':'bg-white text-gray-500 border-gray-200'}`}>{matches[selectedMatchId!].p1}</button>
                              <button onClick={()=>setBetTarget(matches[selectedMatchId!].p2)} className={`p-3 rounded-xl border-2 text-xs font-black transition uppercase ${betTarget===matches[selectedMatchId!].p2?'bg-black text-white border-black':'bg-white text-gray-500 border-gray-200'}`}>{matches[selectedMatchId!].p2}</button>
                          </div>
                      )}

                      <div>
                          <div className="flex items-center gap-3 bg-white p-3 rounded-xl border-2 border-gray-200 mb-3 focus-within:border-black transition">
                              <span className="text-xl">💵</span>
                              <input type="number" className="bg-transparent w-full outline-none text-black font-mono font-bold text-lg" value={betAmount} onChange={e=>setBetAmount(parseInt(e.target.value))} />
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                              {[50, 100, 500].map(amt => ( <button key={amt} onClick={()=>setBetAmount(amt)} className="bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2 rounded-lg text-[10px] transition">{amt}</button> ))}
                              <button onClick={()=>setBetAmount(user.balance)} className="bg-red-50 hover:bg-red-100 text-red-600 font-bold py-2 rounded-lg text-[10px] transition uppercase">All In</button>
                          </div>
                      </div>

                      <button onClick={realizarApuesta} className="w-full bg-green-500 hover:bg-green-600 text-white font-black p-4 rounded-xl shadow-lg uppercase tracking-wider transition transform active:scale-95 flex justify-center gap-2 items-center">
                          <Wallet size={18}/> APOSTAR
                      </button>
                  </div>
              ) : (
                  <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-300"><p className="text-gray-400 font-bold text-xs uppercase">Mercado Cerrado</p></div>
              )}
          </div>

          {/* 🆘 BOTÓN DE BANCARROTA */}
          {user.balance < 50 && (
              <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center justify-between animate-pulse">
                  <div><p className="text-red-700 font-black text-xs uppercase">¡Estás en la ruina!</p><p className="text-red-500 text-[10px]">Pide un rescate.</p></div>
                  <button onClick={pedirPrestamo} className="bg-red-600 text-white px-3 py-2 rounded-lg text-[10px] font-bold shadow-md hover:bg-red-700 transition">PEDIR 500€</button>
              </div>
          )}
          
          {/* --- PESTAÑAS --- */}
          <div className="flex bg-gray-200 p-1 rounded-2xl">
              <button onClick={() => setActiveTab('active')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition ${activeTab === 'active' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-gray-700'}`}>
                  <Flame size={14} className={activeTab === 'active' ? 'text-orange-500' : ''}/> En Juego ({pendingBets.length})
              </button>
              <button onClick={() => setActiveTab('history')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition ${activeTab === 'history' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-gray-700'}`}>
                  <Globe size={14} className={activeTab === 'history' ? 'text-blue-500' : ''}/> Historial Global
              </button>
          </div>

          {/* --- CONTENIDO --- */}
          <div>
              {activeTab === 'active' ? (
                  /* VISTA: EN JUEGO */
                  <div className="space-y-3">
                      {pendingBets.length > 0 ? pendingBets.map((b:any) => (
                          <div key={b.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                  <div className="bg-orange-100 p-2 rounded-full text-orange-600"><Flame size={16}/></div>
                                  <div>
                                      <p className="font-black text-xs uppercase text-black">{b.bettor}</p>
                                      <p className="text-[10px] text-gray-500 font-bold">Apostó a: <span className="text-blue-600">{b.chosenWinner}</span></p>
                                  </div>
                              </div>
                              <span className="font-mono font-black text-sm">{b.amount} €</span>
                          </div>
                      )) : ( <div className="text-center py-8 text-gray-300 text-xs italic">No hay apuestas activas.</div> )}
                  </div>
              ) : (
                  /* VISTA: HISTORIAL GLOBAL */
                  <div className="space-y-3">
                      {globalHistory.length > 0 ? globalHistory.map((b:any) => (
                          <div key={b.id} className={`p-4 rounded-2xl border flex justify-between items-center transition ${b.status === 'won' ? 'bg-green-50/50 border-green-200' : 'bg-red-50/50 border-red-200'}`}>
                              <div className="flex items-center gap-3">
                                  {/* ICONO */}
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-[10px] text-white uppercase ${b.status==='won'?'bg-green-500':'bg-red-500'}`}>
                                      {b.bettor.substring(0,2)}
                                  </div>
                                  {/* INFO */}
                                  <div>
                                      <div className="flex items-center gap-2">
                                          <p className="font-black text-xs uppercase text-black">{b.bettor}</p>
                                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${b.status==='won'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>
                                              {b.status === 'won' ? 'WIN' : 'LOSS'}
                                          </span>
                                      </div>
                                      <p className="text-[10px] text-gray-500 font-bold">Iba con {b.chosenWinner}</p>
                                  </div>
                              </div>
                              {/* DINERO */}
                              <div className="text-right">
                                  <span className={`font-mono font-black text-sm block ${b.status === 'won' ? 'text-green-600' : 'text-red-500'}`}>
                                      {b.status === 'won' ? '+' : '-'}{b.amount} €
                                  </span>
                              </div>
                          </div>
                      )) : (
                          <div className="text-center py-10 bg-white rounded-3xl border border-gray-100">
                              <Globe size={32} className="mx-auto text-gray-200 mb-2"/>
                              <p className="text-gray-400 text-xs font-bold">Aún no hay salseo histórico.</p>
                          </div>
                      )}
                  </div>
              )}
          </div>
      </div>
  );
}