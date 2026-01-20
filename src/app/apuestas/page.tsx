'use client';
import { useState, useMemo } from 'react';
import { useApp } from '@/lib/context';
import { db } from '@/lib/firebase';
import { doc, addDoc, collection, setDoc, increment, serverTimestamp } from 'firebase/firestore';
import { Lock, Coins, Crown, TrendingDown, Zap, Trash2, CheckCheck, Layers } from 'lucide-react';
import Link from 'next/link';

export default function ApuestasPage() {
  const { user, users, matches, activeBets } = useApp();
  const [betAmount, setBetAmount] = useState(100);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  
  // AHORA LAS SELECCIONES SON UN ARRAY DE OBJETOS
  const [selections, setSelections] = useState<{type: string, value: string}[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'ranking'>('active');

  const richest = useMemo(() => users.length ? [...users].sort((a,b) => b.balance - a.balance)[0] : null, [users]);
  const poorest = useMemo(() => users.length ? [...users].sort((a,b) => a.balance - b.balance)[0] : null, [users]);
  const pendingBets = activeBets.filter((b:any) => b.status === 'pending');
  const globalHistory = activeBets.filter((b:any) => b.status !== 'pending').sort((a:any, b:any) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

  // --- GESTIÓN DE SELECCIONES ---
  const toggleSelection = (type: 'winner'|'goals', value: string) => {
      const exists = selections.find(s => s.type === type && s.value === value);
      if (exists) {
          // Si ya está, la quitamos (desmarcar)
          setSelections(selections.filter(s => !(s.type === type && s.value === value)));
      } else {
          // Si es del mismo tipo (ej: otro ganador), reemplazamos la anterior para no apostar a los dos ganadores a la vez por error
          // Opcional: Si quieres permitir apostar a los dos, quita el .filter
          const clean = selections.filter(s => s.type !== type); 
          setSelections([...clean, { type, value }]);
      }
  };

  const isSelected = (type: string, value: string) => selections.some(s => s.type === type && s.value === value);

  // --- CUOTAS DINÁMICAS ---
  const getOdds = (matchId: number, target: string, currentMarket: string) => {
      const marketBets = activeBets.filter((b:any) => b.matchId === matchId && b.type === currentMarket && b.status === 'pending');
      const totalPool = marketBets.reduce((acc: number, b:any) => acc + b.amount, 0) + 100; 
      const targetBets = marketBets.filter((b:any) => b.chosenWinner === target);
      const targetPool = targetBets.reduce((acc: number, b:any) => acc + b.amount, 0) + 50; 
      const rawOdd = totalPool / targetPool;
      return rawOdd < 1.05 ? 1.05 : parseFloat(rawOdd.toFixed(2));
  };

  // --- LANZAR MULTI-APUESTA ---
  const realizarApuesta = async () => {
      if (!user) return;
      if (selectedMatchId === null || selections.length === 0 || betAmount <= 0) return alert("Selecciona algo y pon pasta.");
      
      const totalCost = betAmount * selections.length;
      if (user.balance < totalCost) return alert(`Necesitas ${totalCost}€ para estas ${selections.length} apuestas.`);

      try {
          // 1. Cobrar todo de golpe
          await setDoc(doc(db, "users", user.id), { balance: increment(-totalCost) }, { merge: true });

          // 2. Crear las apuestas individuales
          const promises = selections.map(sel => 
              addDoc(collection(db, "bets"), { 
                  matchId: selectedMatchId, 
                  bettor: user.id, 
                  type: sel.type, 
                  chosenWinner: sel.value, 
                  amount: betAmount, 
                  status: 'pending', 
                  timestamp: serverTimestamp() 
              })
          );
          
          await Promise.all(promises);
          
          alert(`✅ ¡${selections.length} apuestas realizadas con éxito!`);
          setSelections([]); // Limpiar
          setActiveTab('active');
      } catch (e) { alert("Error al apostar"); }
  };

  if (!user) return <div className="text-center p-12 mt-10"><Lock size={48} className="mx-auto text-gray-300"/><p className="text-gray-500 font-bold mt-4">Identifícate primero.</p><Link href="/perfil" className="underline font-bold">Ir al Perfil</Link></div>;
  const currentMatch = matches.find((m:any) => m.id === selectedMatchId);

  // --- ESTADÍSTICAS RANKING ---
  const bettingStats = useMemo(() => {
      const stats: any = {};
      activeBets.forEach((b: any) => {
          if (b.status === 'pending') return;
          if (!stats[b.bettor]) stats[b.bettor] = { name: b.bettor, profit: 0, wins: 0, total: 0 };
          stats[b.bettor].total++;
          if (b.status === 'won') {
              stats[b.bettor].wins++;
              const odd = b.finalOdd ? parseFloat(b.finalOdd) : 2.0;
              stats[b.bettor].profit += (b.amount * odd) - b.amount;
          } else {
              stats[b.bettor].profit -= b.amount;
          }
      });
      return Object.values(stats).sort((a:any, b:any) => b.profit - a.profit);
  }, [activeBets]);

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

          {/* 🎰 ZONA APUESTAS */}
          <div className="bg-white border-2 border-black p-5 rounded-3xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden">
              <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-black uppercase italic flex items-center gap-2"><Coins className="text-yellow-500"/> Mercado</h2>
                  <p className={`font-mono font-black text-lg ${user.balance < 100 ? 'text-red-500' : 'text-black'}`}>{user.balance} €</p>
              </div>
              
              {matches.length > 0 ? (
                  <div className="space-y-6">
                      {/* 1. SELECTOR PARTIDO */}
                      <select className="w-full bg-gray-50 p-3 rounded-xl border border-gray-200 text-black text-xs font-bold outline-none uppercase tracking-wide" onChange={e=>{setSelectedMatchId(parseInt(e.target.value));setSelections([]);}}>
                          <option value="">👇 Seleccionar Partido</option>
                          {matches.filter((m:any) => !m.winner && !m.isBye && m.p1 !== "Esperando...").map((m:any) => (<option key={m.id} value={m.id}>{m.p1} vs {m.p2}</option>))}
                      </select>

                      {currentMatch && (
                          <div className="animate-in slide-in-from-bottom-4 space-y-6">
                              {/* SECCIÓN GANADOR */}
                              <div>
                                  <h3 className="text-[10px] font-black uppercase text-gray-400 mb-2 flex items-center gap-1"><Layers size={12}/> Ganador del Partido</h3>
                                  <div className="grid grid-cols-2 gap-3">
                                      <OddBtn target={currentMatch.p1} odd={getOdds(currentMatch.id, currentMatch.p1, 'winner')} active={isSelected('winner', currentMatch.p1)} onClick={()=>toggleSelection('winner', currentMatch.p1)} />
                                      <OddBtn target={currentMatch.p2} odd={getOdds(currentMatch.id, currentMatch.p2, 'winner')} active={isSelected('winner', currentMatch.p2)} onClick={()=>toggleSelection('winner', currentMatch.p2)} />
                                  </div>
                              </div>

                              {/* SECCIÓN GOLES */}
                              <div>
                                  <h3 className="text-[10px] font-black uppercase text-gray-400 mb-2 flex items-center gap-1"><Layers size={12}/> Total Goles</h3>
                                  <div className="grid grid-cols-2 gap-3">
                                      <OddBtn target="Mas de 2.5" odd={getOdds(currentMatch.id, 'Mas de 2.5', 'goals')} active={isSelected('goals', 'Mas de 2.5')} onClick={()=>toggleSelection('goals', 'Mas de 2.5')} />
                                      <OddBtn target="Menos de 2.5" odd={getOdds(currentMatch.id, 'Menos de 2.5', 'goals')} active={isSelected('goals', 'Menos de 2.5')} onClick={()=>toggleSelection('goals', 'Menos de 2.5')} />
                                  </div>
                              </div>
                          </div>
                      )}

                      {/* BARRA DE ACCIÓN */}
                      <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                          <div className="flex justify-between items-center mb-2">
                              <span className="text-[10px] font-bold text-gray-400 uppercase">Apuesta por selección</span>
                              <span className="text-[10px] font-bold text-gray-400 uppercase">Selecciones: <span className="text-black text-sm">{selections.length}</span></span>
                          </div>
                          <div className="flex gap-2">
                              <input type="number" className="bg-white border-2 border-gray-200 rounded-xl px-4 w-1/3 font-mono font-bold outline-none focus:border-black text-center" value={betAmount} onChange={e=>setBetAmount(parseInt(e.target.value))} />
                              <button onClick={realizarApuesta} disabled={selections.length===0} className="flex-1 bg-black text-white font-black p-3 rounded-xl uppercase tracking-wider text-xs hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                  {selections.length > 0 ? `APOSTAR (${betAmount * selections.length}€)` : 'Elige algo'} <CheckCheck size={16}/>
                              </button>
                          </div>
                          {selections.length > 0 && <p className="text-[9px] text-center text-gray-400 mt-2 font-bold uppercase">Se crearán {selections.length} apuestas independientes de {betAmount}€ cada una.</p>}
                      </div>
                  </div>
              ) : ( <div className="text-center py-6 text-gray-400 font-bold text-xs uppercase">Mercado Cerrado</div> )}
          </div>

          {/* TABS INFERIORES */}
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

              {activeTab === 'ranking' && (
                  <div className="animate-in slide-in-from-bottom-2">
                      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                          <table className="w-full text-left">
                              <thead className="bg-gray-50 border-b border-gray-100">
                                  <tr>
                                      <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Pos</th>
                                      <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Jugador</th>
                                      <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Profit</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                  {bettingStats.map((stat:any, idx:number) => (
                                      <tr key={stat.name} className={`hover:bg-gray-50 transition ${idx===0 ? 'bg-yellow-50/50' : idx===bettingStats.length-1 ? 'bg-red-50/50' : ''}`}>
                                          <td className="p-4 text-xs font-bold text-gray-500">#{idx+1}</td>
                                          <td className="p-4"><div className="flex items-center gap-2"><span className="font-black text-xs uppercase">{stat.name}</span>{idx === 0 && <Crown size={14} className="text-yellow-500"/>}</div></td>
                                          <td className={`p-4 text-right font-mono font-black text-sm ${stat.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{stat.profit > 0 ? '+' : ''}{Math.round(stat.profit)} €</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </div>
              )}
          </div>
      </div>
  );
}

function OddBtn({ target, odd, active, onClick }: any) {
    return (
        <button onClick={onClick} className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center transition uppercase relative overflow-hidden group ${active?'bg-black text-white border-black shadow-lg scale-[1.02]':'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
            <span className="text-[10px] font-black mb-1 z-10 text-center leading-tight">{target}</span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded z-10 ${active ? 'bg-green-500 text-black' : 'bg-gray-100 text-gray-600'}`}>x{odd}</span>
            {active && <div className="absolute top-0 right-0 p-1 opacity-20"><Zap size={20}/></div>}
            {active && <div className="absolute bottom-2 right-2"><CheckCheck size={14} className="text-green-500"/></div>}
        </button>
    );
}