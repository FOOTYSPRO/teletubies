'use client';
import { useState } from 'react';
import { useApp } from '@/lib/context';
import { db } from '@/lib/firebase';
import { doc, addDoc, collection, setDoc, increment } from 'firebase/firestore';
import { Lock, Banknote } from 'lucide-react';
import Link from 'next/link';

export default function ApuestasPage() {
  const { user, matches, activeBets } = useApp();
  const [betAmount, setBetAmount] = useState(100);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [betTarget, setBetTarget] = useState("");

  const realizarApuesta = async () => {
      if (!user) return;
      if (selectedMatchId===null || !betTarget || betAmount<=0) return alert("Rellena todo");
      if (user.balance < betAmount) return alert("Saldo insuficiente");
      
      // Restar saldo
      await setDoc(doc(db, "users", user.id), { balance: increment(-betAmount) }, { merge: true });
      // Guardar apuesta
      await addDoc(collection(db, "bets"), { matchId: selectedMatchId, bettor: user.id, chosenWinner: betTarget, amount: betAmount, status: 'pending' });
      alert("✅ Apuesta realizada");
  };

  if (!user) {
      return (
          <div className="text-center p-12 bg-white rounded-3xl border border-gray-200 shadow-sm mt-8 max-w-sm mx-auto">
              <Lock size={48} className="mx-auto mb-4 text-gray-300"/>
              <h3 className="font-bold text-lg text-black">Acceso Restringido</h3>
              <p className="text-gray-500 text-sm mb-6">Inicia sesión para apostar.</p>
              <Link href="/perfil" className="bg-black text-white px-6 py-2 rounded-full font-bold text-xs uppercase tracking-widest">Ir al Perfil</Link>
          </div>
      );
  }

  return (
      <div className="space-y-6 max-w-xl mx-auto animate-in fade-in">
          <div className="bg-white border-2 border-yellow-400 p-6 rounded-3xl shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-3 bg-yellow-400"></div>
              <h2 className="text-xl font-black text-black mb-6 uppercase italic flex items-center gap-2"><Banknote className="text-yellow-600"/> Casa de Apuestas</h2>
              
              {matches.length > 0 ? (
                  <div className="space-y-4">
                      <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Partido</label>
                          {/* SELECT ALTO CONTRASTE */}
                          <select className="w-full bg-white p-4 rounded-xl border-2 border-gray-200 text-black font-bold outline-none mt-1 focus:border-black transition" onChange={e=>{const m=matches.find((x:any)=>x.id===parseInt(e.target.value));setSelectedMatchId(parseInt(e.target.value));setBetTarget("");}}>
                              <option value="">Selecciona un enfrentamiento...</option>
                              {matches.filter((m:any) => !m.winner && !m.isBye).map((m:any) => (<option key={m.id} value={m.id}>{m.p1} vs {m.p2}</option>))}
                          </select>
                      </div>

                      {selectedMatchId !== null && (
                          <div className="grid grid-cols-2 gap-3">
                              <button onClick={()=>setBetTarget(matches[selectedMatchId!].p1)} className={`p-4 rounded-xl border-2 text-sm font-black transition uppercase ${betTarget===matches[selectedMatchId!].p1?'bg-black text-white border-black':'bg-white text-gray-400 border-gray-200 hover:border-gray-400'}`}>{matches[selectedMatchId!].p1}</button>
                              <button onClick={()=>setBetTarget(matches[selectedMatchId!].p2)} className={`p-4 rounded-xl border-2 text-sm font-black transition uppercase ${betTarget===matches[selectedMatchId!].p2?'bg-black text-white border-black':'bg-white text-gray-400 border-gray-200 hover:border-gray-400'}`}>{matches[selectedMatchId!].p2}</button>
                          </div>
                      )}

                      <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Cantidad</label>
                          <div className="flex items-center gap-3 bg-white p-3 rounded-xl border-2 border-gray-200 mt-1 focus-within:border-black transition">
                              <span className="text-xl">💰</span>
                              <input type="number" className="bg-transparent w-full outline-none text-black font-mono font-bold text-lg" value={betAmount} onChange={e=>setBetAmount(parseInt(e.target.value))} />
                          </div>
                      </div>

                      <button onClick={realizarApuesta} className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-black p-4 rounded-xl shadow-lg uppercase tracking-wider transition transform active:scale-95 mt-2 border-b-4 border-yellow-600 active:border-b-0 active:mt-3">CONFIRMAR APUESTA</button>
                  </div>
              ) : (<p className="text-gray-500 text-center py-6 text-sm font-medium">No hay partidos disponibles para apostar.</p>)}
          </div>
          
          <div>
              <h3 className="font-bold text-gray-400 uppercase text-xs tracking-widest mb-3 ml-2">Mercado en Vivo</h3>
              <div className="space-y-2">
                  {activeBets.filter((b:any) => b.status === 'pending').map((b:any) => (
                      <div key={b.id} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex justify-between items-center text-sm">
                          <div><span className="font-bold text-black uppercase">{b.bettor}</span> <span className="text-gray-400 text-xs">vs</span> <span className="text-blue-600 font-bold uppercase">{b.chosenWinner}</span></div>
                          <span className="font-mono font-bold bg-gray-100 px-3 py-1 rounded-lg text-black border border-gray-200">{b.amount} €</span>
                      </div>
                  ))}
                  {activeBets.filter((b:any) => b.status === 'pending').length === 0 && <p className="text-gray-400 text-xs text-center italic py-4">El mercado está tranquilo...</p>}
              </div>
          </div>
      </div>
  );
}