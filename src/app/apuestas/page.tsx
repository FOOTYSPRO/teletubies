'use client';
import { useState, useMemo } from 'react';
import { useApp } from '@/lib/context';
import { db } from '@/lib/firebase';
import { doc, addDoc, collection, setDoc, increment, serverTimestamp } from 'firebase/firestore';
import { Lock, Coins, Crown, TrendingDown, Zap, CheckCheck, Layers, Calculator } from 'lucide-react';
import Link from 'next/link';

// CONSTANTE DE ESTABILIDAD (Evita cuotas locas)
const LIQUIDITY = 500; 

export default function ApuestasPage() {
  const { user, users, matches, activeBets } = useApp();
  const [betAmount, setBetAmount] = useState(100);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [selections, setSelections] = useState<{type: string, value: string, odd: number}[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'ranking'>('active');

  const richest = useMemo(() => users.length ? [...users].sort((a,b) => b.balance - a.balance)[0] : null, [users]);
  const poorest = useMemo(() => users.length ? [...users].sort((a,b) => a.balance - b.balance)[0] : null, [users]);
  const pendingBets = activeBets.filter((b:any) => b.status === 'pending');
  const globalHistory = activeBets.filter((b:any) => b.status !== 'pending').sort((a:any, b:any) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

  // --- CUOTAS ESTABILIZADAS ---
  const getOdds = (matchId: number, target: string, currentMarket: string) => {
      // 1. Dinero REAL apostado
      const marketBets = activeBets.filter((b:any) => b.matchId === matchId && b.type === currentMarket && b.status === 'pending');
      const realTotalPool = marketBets.reduce((acc: number, b:any) => acc + b.amount, 0); 
      const realTargetPool = marketBets.filter((b:any) => b.chosenWinner === target).reduce((acc: number, b:any) => acc + b.amount, 0); 
      
      // 2. Dinero VIRTUAL (La Banca) para estabilizar
      // Suponemos que hay 2 opciones (Gana/Pierde o Mas/Menos), así que metemos LIQUIDITY a cada lado.
      const virtualTotal = realTotalPool + (LIQUIDITY * 2);
      const virtualTarget = realTargetPool + LIQUIDITY;

      // 3. Cálculo Cuota: Total / Opción
      const rawOdd = virtualTotal / virtualTarget;
      
      // Recortamos margen (x1.05 mínimo, x10.0 máximo para seguridad)
      let finalOdd = parseFloat(rawOdd.toFixed(2));
      if (finalOdd < 1.05) finalOdd = 1.05;
      if (finalOdd > 10.0) finalOdd = 10.0;
      
      return finalOdd;
  };

  const toggleSelection = (type: 'winner'|'goals', value: string) => {
      if (!selectedMatchId) return;
      const odd = getOdds(selectedMatchId, value, type);
      const exists = selections.find(s => s.type === type && s.value === value);
      
      if (exists) {
          setSelections(selections.filter(s => !(s.type === type && s.value === value)));
      } else {
          const clean = selections.filter(s => s.type !== type); 
          setSelections([...clean, { type, value, odd }]);
      }
  };

  const isSelected = (type: string, value: string) => selections.some(s => s.type === type && s.value === value);

  const totalOdd = useMemo(() => {
      if (selections.length === 0) return 0;
      const combined = selections.reduce((acc, s) => acc * s.odd, 1);
      return parseFloat(combined.toFixed(2));
  }, [selections]);

  const potentialWin = Math.floor(betAmount * totalOdd);

  const realizarApuesta = async () => {
      if (!user) return;
      if (selectedMatchId === null || selections.length === 0 || betAmount <= 0) return alert("Selecciona algo y pon pasta.");
      if (user.balance < betAmount) return alert(`No tienes ${betAmount}€.`);

      try {
          await setDoc(doc(db, "users", user.id), { balance: increment(-betAmount) }, { merge: true });

          await addDoc(collection(db, "bets"), { 
              matchId: selectedMatchId, 
              bettor: user.id, 
              type: 'combined',
              selections: selections, 
              amount: betAmount, 
              finalOdd: totalOdd, 
              status: 'pending', 
              timestamp: serverTimestamp() 
          });
          
          alert(`✅ Combinada x${totalOdd} realizada!`);
          setSelections([]);
          setActiveTab('active');
      } catch (e) { alert("Error al apostar"); }
  };

  if (!user) return <div className="text-center p-12 mt-10"><Lock size={48} className="mx-auto text-gray-300"/><p className="text-gray-500 font-bold mt-4">Identifícate primero.</p><Link href="/perfil" className="underline font-bold">Ir al Perfil</Link></div>;
  const currentMatch = matches.find((m:any) => m.id === selectedMatchId);

  // STATS
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

          <div className="bg-white border-2 border-black p-5 rounded-3xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden">
              <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-black uppercase italic flex items-center gap-2"><Coins className="text-yellow-500"/> Combinadas</h2>
                  <p className={`font-mono font-black text-lg ${user.balance < 100 ? 'text-red-500' : 'text-black'}`}>{user.balance} €</p>
              </div>
              
              {matches.length > 0 ? (
                  <div className="space-y-6">
                      <select className="w-full bg-gray-50 p-3 rounded-xl border border-gray-200 text-black text-xs font-bold outline-none uppercase tracking-wide" onChange={e=>{setSelectedMatchId(parseInt(e.target.value));setSelections([]);}}>
                          <option value="">👇 Seleccionar Partido</option>
                          {matches.filter((m:any) => !m.winner && !m.isBye && m.p1 !== "Esperando...").map((m:any) => (<option key={m.id} value={m.id}>{m.p1} vs {m.p2}</option>))}
                      </select>

                      {currentMatch && (
                          <div className="animate-in slide-in-from-bottom-4 space-y-6">
                              <div>
                                  <h3 className="text-[10px] font-black uppercase text-gray-400 mb-2 flex items-center gap-1"><Layers size={12}/> Ganador</h3>
                                  <div className="grid grid-cols-2 gap-3">
                                      <OddBtn target={currentMatch.p1} odd={getOdds(currentMatch.id, currentMatch.p1, 'winner')} active={isSelected('winner', currentMatch.p1)} onClick={()=>toggleSelection('winner', currentMatch.p1)} />
                                      <OddBtn target={currentMatch.p2} odd={getOdds(currentMatch.id, currentMatch.p2, 'winner')} active={isSelected('winner', currentMatch.p2)} onClick={()=>toggleSelection('winner', currentMatch.p2)} />
                                  </div>
                              </div>
                              <div>
                                  <h3 className="text-[10px] font-black uppercase text-gray-400 mb-2 flex items-center gap-1"><Layers size={12}/> Total Goles</h3>
                                  <div className="grid grid-cols-2 gap-3">
                                      <OddBtn target="Mas de 2.5" odd={getOdds(currentMatch.id, 'Mas de 2.5', 'goals')} active={isSelected('goals', 'Mas de 2.5')} onClick={()=>toggleSelection('goals', 'Mas de 2.5')} />
                                      <OddBtn target="Menos de 2.5" odd={getOdds(currentMatch.id, 'Menos de 2.5', 'goals')} active={isSelected('goals', 'Menos de 2.5')} onClick={()=>toggleSelection('goals', 'Menos de 2.5')} />
                                  </div>
                              </div>
                          </div>
                      )}

                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 shadow-inner">
                          <div className="flex justify-between items-center mb-3 border-b border-gray-200 pb-2">
                              <span className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1"><Calculator size={12}/> Cuota Total</span>
                              <span className="font-mono font-black text-2xl text-purple-600">x{totalOdd}</span>
                          </div>
                          
                          <div className="flex gap-2 items-center">
                              <input type="number" className="bg-white border-2 border-gray-200 rounded-xl px-4 py-3 w-1/3 font-mono font-bold outline-none focus:border-black text-center text-lg" value={betAmount} onChange={e=>setBetAmount(parseInt(e.target.value))} />
                              <button onClick={realizarApuesta} disabled={selections.length===0} className="flex-1 bg-black text-white font-black p-3 rounded-xl uppercase tracking-wider text-xs hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center">
                                  <span>APOSTAR {betAmount}€</span>
                                  {selections.length > 0 && <span className="text-[9px] text-green-400">Ganas: {potentialWin}€</span>}
                              </button>
                          </div>
                      </div>
                  </div>
              ) : ( <div className="text-center py-6 text-gray-400 font-bold text-xs uppercase">Mercado Cerrado</div> )}
          </div>

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
                              {b.type === 'combined' ? (
                                  <div className="text-[10px] text-gray-500 font-bold">
                                      <span className="bg-purple-100 text-purple-700 px-1 rounded mr-1">COMBINADA x{b.finalOdd}</span>
                                      {b.selections.map((s:any)=>s.value).join(" + ")}
                                  </div>
                              ) : (
                                  <p className="text-[10px] text-gray-500 font-bold">Con: <span className="text-black">{b.chosenWinner}</span></p>
                              )}
                          </div>
                          <span className="font-mono font-black text-sm">{b.amount}€</span>
                      </div>
                  )) : <p className="text-center text-gray-300 text-xs italic py-4">Sin datos.</p>
              )}
              {/* Omitido History y Ranking (sin cambios) */}
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