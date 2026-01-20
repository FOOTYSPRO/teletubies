'use client';
import { useState, useMemo } from 'react';
import { useApp } from '@/lib/context';
import { db } from '@/lib/firebase';
import { doc, addDoc, collection, setDoc, increment, serverTimestamp } from 'firebase/firestore';
import { Lock, Coins, Crown, TrendingDown, Flame, Globe, Zap, BarChart3, Brain, Skull } from 'lucide-react';
import Link from 'next/link';

export default function ApuestasPage() {
  const { user, users, matches, activeBets } = useApp();
  const [betAmount, setBetAmount] = useState(100);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [market, setMarket] = useState<'winner' | 'goals' | 'corners'>('winner');
  const [betTarget, setBetTarget] = useState("");
  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'ranking'>('active'); // NUEVA PESTAÑA

  const richest = useMemo(() => users.length ? [...users].sort((a,b) => b.balance - a.balance)[0] : null, [users]);
  const poorest = useMemo(() => users.length ? [...users].sort((a,b) => a.balance - b.balance)[0] : null, [users]);
  const pendingBets = activeBets.filter((b:any) => b.status === 'pending');
  const globalHistory = activeBets.filter((b:any) => b.status !== 'pending').sort((a:any, b:any) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

  // --- 📊 CÁLCULO DEL RANKING DE APOSTADORES ---
  const bettingStats = useMemo(() => {
      const stats: any = {};
      
      activeBets.forEach((b: any) => {
          if (b.status === 'pending') return;
          
          if (!stats[b.bettor]) stats[b.bettor] = { name: b.bettor, profit: 0, wins: 0, total: 0 };
          stats[b.bettor].total++;

          if (b.status === 'won') {
              stats[b.bettor].wins++;
              // Calculamos beneficio neto: (Lo que ganaste - Lo que pusiste)
              // Si guardamos finalOdd usamos eso, si no asumimos x2 por compatibilidad antigua
              const odd = b.finalOdd ? parseFloat(b.finalOdd) : 2.0;
              const winAmount = b.amount * odd;
              const netProfit = winAmount - b.amount;
              stats[b.bettor].profit += netProfit;
          } else {
              // Si perdiste, tu beneficio baja lo que apostaste
              stats[b.bettor].profit -= b.amount;
          }
      });

      // Convertir a array y ordenar por beneficio (Profit)
      return Object.values(stats).sort((a:any, b:any) => b.profit - a.profit);
  }, [activeBets]);

  // --- LÓGICA DE CUOTAS ---
  const getOdds = (matchId: number, target: string, currentMarket: string) => {
      const marketBets = activeBets.filter((b:any) => b.matchId === matchId && b.type === currentMarket && b.status === 'pending');
      const totalPool = marketBets.reduce((acc: number, b:any) => acc + b.amount, 0) + 100; 
      const targetBets = marketBets.filter((b:any) => b.chosenWinner === target);
      const targetPool = targetBets.reduce((acc: number, b:any) => acc + b.amount, 0) + 50; 
      const rawOdd = totalPool / targetPool;
      return rawOdd < 1.05 ? 1.05 : parseFloat(rawOdd.toFixed(2));
  };

  const realizarApuesta = async () => {
      if (!user) return;
      if (selectedMatchId===null || !betTarget || betAmount<=0) return alert("Rellena todo");
      if (user.balance < betAmount) return alert("No tienes tanta pasta 👻");
      try {
        await setDoc(doc(db, "users", user.id), { balance: increment(-betAmount) }, { merge: true });
        await addDoc(collection(db, "bets"), { 
            matchId: selectedMatchId, bettor: user.id, type: market, chosenWinner: betTarget, amount: betAmount, status: 'pending', timestamp: serverTimestamp() 
        });
        alert(`✅ Apuesta realizada.`); setActiveTab('active'); setBetTarget("");
      } catch (e) { alert("Error al apostar"); }
  };

  const pedirPrestamo = async () => { if(user && user.balance < 100 && confirm("¿Pedir 500€?")) await setDoc(doc(db, "users", user.id), { balance: 500 }, { merge: true }); };

  if (!user) return <div className="text-center p-12 mt-10"><Lock size={48} className="mx-auto text-gray-300"/><p className="text-gray-500 font-bold mt-4">Identifícate primero.</p><Link href="/perfil" className="underline font-bold">Ir al Perfil</Link></div>;
  const currentMatch = matches.find((m:any) => m.id === selectedMatchId);

  return (
      <div className="space-y-6 max-w-xl mx-auto animate-in fade-in pb-24 px-4">
          
          {/* TOP WIDGETS */}
          <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-yellow-50 to-white p-4 rounded-3xl border border-yellow-200 shadow-sm text-center">
                  <Crown size={24} className="mx-auto text-yellow-500 mb-1"/>
                  <span className="text-[10px] font-black text-yellow-600 uppercase">Patrimonio</span>
                  <p className="text-sm font-black truncate">{richest?.id || "-"}</p>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-white p-4 rounded-3xl border border-red-200 shadow-sm text-center">
                  <TrendingDown size={24} className="mx-auto text-red-500 mb-1"/>
                  <span className="text-[10px] font-black text-red-600 uppercase">Ruina</span>
                  <p className="text-sm font-black truncate">{poorest?.id || "-"}</p>
              </div>
          </div>

          {/* ZONA APUESTAS */}
          <div className="bg-white border-2 border-black p-5 rounded-3xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-black uppercase italic flex items-center gap-2"><Coins className="text-yellow-500"/> Mercado</h2>
                  <p className={`font-mono font-black text-lg ${user.balance < 100 ? 'text-red-500' : 'text-black'}`}>{user.balance} €</p>
              </div>
              
              {matches.length > 0 ? (
                  <div className="space-y-4">
                      <select className="w-full bg-gray-50 p-3 rounded-xl border border-gray-200 text-black text-xs font-bold outline-none uppercase tracking-wide" onChange={e=>{setSelectedMatchId(parseInt(e.target.value));setBetTarget("");}}>
                          <option value="">👇 Seleccionar Partido</option>
                          {matches.filter((m:any) => !m.winner && !m.isBye && m.p1 !== "Esperando...").map((m:any) => (<option key={m.id} value={m.id}>{m.p1} vs {m.p2}</option>))}
                      </select>
                      {currentMatch && (
                          <div className="bg-gray-100 p-1 rounded-xl flex gap-1">
                              <button onClick={()=>setMarket('winner')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition ${market==='winner'?'bg-white shadow text-black':'text-gray-400'}`}>🏆 Ganador</button>
                              <button onClick={()=>setMarket('goals')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition ${market==='goals'?'bg-white shadow text-blue-600':'text-gray-400'}`}>⚽ Goles</button>
                              <button onClick={()=>setMarket('corners')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition ${market==='corners'?'bg-white shadow text-green-600':'text-gray-400'}`}>⛳ Corners</button>
                          </div>
                      )}
                      {currentMatch && (
                          <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-top-2">
                              {market === 'winner' && (
                                  <>
                                      <OddBtn target={currentMatch.p1} odd={getOdds(currentMatch.id, currentMatch.p1, 'winner')} active={betTarget===currentMatch.p1} onClick={()=>setBetTarget(currentMatch.p1)} />
                                      <OddBtn target={currentMatch.p2} odd={getOdds(currentMatch.id, currentMatch.p2, 'winner')} active={betTarget===currentMatch.p2} onClick={()=>setBetTarget(currentMatch.p2)} />
                                  </>
                              )}
                              {market === 'goals' && (
                                  <>
                                      <OddBtn target="Mas de 2.5" odd={getOdds(currentMatch.id, 'Mas de 2.5', 'goals')} active={betTarget==='Mas de 2.5'} onClick={()=>setBetTarget('Mas de 2.5')} />
                                      <OddBtn target="Menos de 2.5" odd={getOdds(currentMatch.id, 'Menos de 2.5', 'goals')} active={betTarget==='Menos de 2.5'} onClick={()=>setBetTarget('Menos de 2.5')} />
                                  </>
                              )}
                              {market === 'corners' && (
                                  <>
                                      <OddBtn target="Mas de 5.5" odd={getOdds(currentMatch.id, 'Mas de 5.5', 'corners')} active={betTarget==='Mas de 5.5'} onClick={()=>setBetTarget('Mas de 5.5')} />
                                      <OddBtn target="Menos de 5.5" odd={getOdds(currentMatch.id, 'Menos de 5.5', 'corners')} active={betTarget==='Menos de 5.5'} onClick={()=>setBetTarget('Menos de 5.5')} />
                                  </>
                              )}
                          </div>
                      )}
                      <div className="flex gap-2">
                          <input type="number" className="bg-white border-2 border-gray-200 rounded-xl px-4 w-1/3 font-mono font-bold outline-none focus:border-black" value={betAmount} onChange={e=>setBetAmount(parseInt(e.target.value))} />
                          <button onClick={realizarApuesta} className="flex-1 bg-black text-white font-black p-3 rounded-xl uppercase tracking-wider text-xs hover:bg-gray-800 transition">APOSTAR</button>
                      </div>
                  </div>
              ) : ( <div className="text-center py-6 text-gray-400 font-bold text-xs uppercase">Mercado Cerrado</div> )}
          </div>

          {/* --- PESTAÑAS (Ahora son 3) --- */}
          <div className="flex bg-gray-200 p-1 rounded-2xl overflow-x-auto">
              <button onClick={() => setActiveTab('active')} className={`flex-1 py-3 px-2 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider transition whitespace-nowrap ${activeTab === 'active' ? 'bg-white shadow text-black' : 'text-gray-500'}`}>🔥 En Juego</button>
              <button onClick={() => setActiveTab('history')} className={`flex-1 py-3 px-2 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider transition whitespace-nowrap ${activeTab === 'history' ? 'bg-white shadow text-black' : 'text-gray-500'}`}>🌍 Historial</button>
              <button onClick={() => setActiveTab('ranking')} className={`flex-1 py-3 px-2 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider transition whitespace-nowrap ${activeTab === 'ranking' ? 'bg-white shadow text-black' : 'text-gray-500'}`}>📊 Ranking</button>
          </div>

          <div className="space-y-3">
              {activeTab === 'active' && (
                  pendingBets.length > 0 ? pendingBets.map((b:any) => (
                      <div key={b.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center">
                          <div>
                              <div className="flex items-center gap-2 mb-1"><span className="font-black text-xs uppercase text-black">{b.bettor}</span></div>
                              <p className="text-[10px] text-gray-500 font-bold">Con: <span className="text-black">{b.chosenWinner}</span></p>
                          </div>
                          <span className="font-mono font-black text-sm">{b.amount}€</span>
                      </div>
                  )) : <p className="text-center text-gray-300 text-xs italic py-4">Sin datos.</p>
              )}

              {activeTab === 'history' && (
                  globalHistory.length > 0 ? globalHistory.map((b:any) => (
                      <div key={b.id} className={`p-4 rounded-2xl border flex justify-between items-center bg-white border-gray-100 shadow-sm ${b.status==='won' && 'bg-green-50 !border-green-200'} ${b.status==='lost' && 'bg-red-50 !border-red-200'}`}>
                          <div>
                              <div className="flex items-center gap-2 mb-1"><span className="font-black text-xs uppercase text-black">{b.bettor}</span></div>
                              <p className="text-[10px] text-gray-500 font-bold">Con: <span className="text-black">{b.chosenWinner}</span></p>
                          </div>
                          <span className={`font-mono font-black text-sm ${b.status==='won'?'text-green-600':b.status==='lost'?'text-red-500':'text-black'}`}>{b.status==='won'?'+':''}{b.status==='lost'?'-':''}{b.amount}€</span>
                      </div>
                  )) : <p className="text-center text-gray-300 text-xs italic py-4">Sin datos.</p>
              )}

              {/* --- VISTA: RANKING DE APOSTADORES --- */}
              {activeTab === 'ranking' && (
                  <div className="animate-in slide-in-from-bottom-2">
                      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                          <table className="w-full text-left">
                              <thead className="bg-gray-50 border-b border-gray-100">
                                  <tr>
                                      <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Pos</th>
                                      <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Jugador</th>
                                      <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Aciertos</th>
                                      <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Profit Neto</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                  {bettingStats.map((stat:any, idx:number) => (
                                      <tr key={stat.name} className={`hover:bg-gray-50 transition ${idx===0 ? 'bg-yellow-50/50' : idx===bettingStats.length-1 ? 'bg-red-50/50' : ''}`}>
                                          <td className="p-4 text-xs font-bold text-gray-500">#{idx+1}</td>
                                          <td className="p-4">
                                              <div className="flex items-center gap-2">
                                                  <span className="font-black text-xs uppercase">{stat.name}</span>
                                                  {idx === 0 && <Brain size={14} className="text-yellow-500"/>}
                                                  {idx === bettingStats.length-1 && idx > 0 && <Skull size={14} className="text-red-500"/>}
                                              </div>
                                          </td>
                                          <td className="p-4 text-right">
                                              <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-[10px] font-bold">{stat.wins}/{stat.total}</span>
                                          </td>
                                          <td className={`p-4 text-right font-mono font-black text-sm ${stat.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                              {stat.profit > 0 ? '+' : ''}{Math.round(stat.profit)} €
                                          </td>
                                      </tr>
                                  ))}
                                  {bettingStats.length === 0 && (
                                      <tr><td colSpan={4} className="p-8 text-center text-gray-300 text-xs italic">Aún no hay estadísticas.</td></tr>
                                  )}
                              </tbody>
                          </table>
                      </div>
                      <p className="text-center text-[9px] text-gray-400 uppercase mt-4 font-bold">Ordenado por Beneficio Neto (Ganado - Jugado)</p>
                  </div>
              )}
          </div>
      </div>
  );
}

function OddBtn({ target, odd, active, onClick }: any) {
    return (
        <button onClick={onClick} className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center transition uppercase relative overflow-hidden ${active?'bg-black text-white border-black':'bg-white text-gray-500 border-gray-200'}`}>
            <span className="text-xs font-black mb-1 z-10">{target}</span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded z-10 ${active ? 'bg-green-500 text-black' : 'bg-gray-100 text-gray-600'}`}>x{odd}</span>
            {active && <div className="absolute top-0 right-0 p-1 opacity-20"><Zap size={20}/></div>}
        </button>
    );
}