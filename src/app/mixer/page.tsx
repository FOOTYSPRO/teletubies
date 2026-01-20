'use client';
import { useState } from 'react';
import { useApp } from '@/lib/context';
import { Dices, Users, Trash2, Shield, Shuffle, Sparkles } from 'lucide-react';

export default function MixerPage() {
  const { users, ranking } = useApp();
  
  const [pool, setPool] = useState<any[]>([]);
  const [teamA, setTeamA] = useState<any[]>([]);
  const [teamB, setTeamB] = useState<any[]>([]);
  const [manualName, setManualName] = useState("");
  const [mode, setMode] = useState<'random' | 'balanced'>('random');

  // Añadir usuario de la lista
  const toggleUser = (u: any) => {
      if (pool.find(p => p.id === u.id)) {
          setPool(pool.filter(p => p.id !== u.id));
      } else {
          setPool([...pool, { id: u.id, score: ranking.find((r:any)=>r.nombre===u.id)?.puntos || 0 }]);
      }
  };

  // Añadir invitado manual
  const addManual = () => {
      if (!manualName) return;
      setPool([...pool, { id: manualName, score: 0, isGuest: true }]);
      setManualName("");
  };

  // --- EL CEREBRO DE SORTEO ---
  const generateTeams = () => {
      if (pool.length < 2) return alert("Necesitas al menos 2 jugadores.");
      
      let tA: any[] = [];
      let tB: any[] = [];
      
      if (mode === 'random') {
          // MODO ALEATORIO PURO
          const shuffled = [...pool].sort(() => Math.random() - 0.5);
          const mid = Math.ceil(shuffled.length / 2);
          tA = shuffled.slice(0, mid);
          tB = shuffled.slice(mid);
      } else {
          // MODO EQUILIBRADO (Intentar igualar ELO/Puntos)
          // Ordenamos por puntos descendente
          const sorted = [...pool].sort((a, b) => b.score - a.score);
          
          // Algoritmo "Snake" simple (1->A, 2->B, 3->B, 4->A...)
          let scoreA = 0;
          let scoreB = 0;

          sorted.forEach(p => {
              if (scoreA <= scoreB) {
                  tA.push(p);
                  scoreA += p.score;
              } else {
                  tB.push(p);
                  scoreB += p.score;
              }
          });
      }

      setTeamA(tA);
      setTeamB(tB);
  };

  return (
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24 animate-in fade-in">
          
          {/* CABECERA */}
          <div className="text-center mb-8">
              <div className="inline-block p-4 bg-purple-100 rounded-full mb-3 text-purple-600 shadow-sm">
                  <Dices size={32} />
              </div>
              <h1 className="text-3xl font-black italic uppercase tracking-tighter">Mixer <span className="text-purple-600">Pro</span></h1>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Generador de Equipos</p>
          </div>

          {/* ZONA DE SELECCIÓN */}
          <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-xl mb-8 relative overflow-hidden">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-sm uppercase flex items-center gap-2"><Users size={16}/> Elige Jugadores ({pool.length})</h3>
                  <button onClick={()=>setPool([])} className="text-[10px] font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded transition">LIMPIAR</button>
               </div>

               {/* Grid de Usuarios */}
               <div className="flex flex-wrap gap-2 mb-4">
                  {users.map((u:any) => (
                      <button 
                          key={u.id} 
                          onClick={() => toggleUser(u)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition border-2 flex items-center gap-2 ${pool.find(p=>p.id===u.id) ? 'bg-black text-white border-black scale-105 shadow-lg' : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-gray-300'}`}
                      >
                          {u.id}
                          {pool.find(p=>p.id===u.id) && <span className="w-2 h-2 rounded-full bg-green-400"></span>}
                      </button>
                  ))}
               </div>

               {/* Añadir Manual */}
               <div className="flex gap-2 mb-6">
                  <input 
                      value={manualName}
                      onChange={e=>setManualName(e.target.value)}
                      placeholder="Nombre Invitado..."
                      className="bg-gray-50 px-4 py-2 rounded-xl text-xs font-bold w-full outline-none focus:ring-2 focus:ring-purple-500 transition"
                      onKeyDown={e => e.key === 'Enter' && addManual()}
                  />
                  <button onClick={addManual} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 rounded-xl font-bold text-xs">+</button>
               </div>

               {/* CONTROLES */}
               <div className="grid grid-cols-2 gap-4">
                  <div className="flex bg-gray-100 p-1 rounded-xl">
                      <button onClick={()=>setMode('random')} className={`flex-1 rounded-lg text-[10px] font-black py-2 transition uppercase ${mode==='random' ? 'bg-white shadow text-black' : 'text-gray-400'}`}>🎲 Azar</button>
                      <button onClick={()=>setMode('balanced')} className={`flex-1 rounded-lg text-[10px] font-black py-2 transition uppercase ${mode==='balanced' ? 'bg-white shadow text-purple-600' : 'text-gray-400'}`}>⚖️ Nivel</button>
                  </div>
                  <button onClick={generateTeams} className="bg-black text-white rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 transition shadow-lg flex items-center justify-center gap-2">
                      <Shuffle size={14}/> Generar
                  </button>
               </div>
          </div>

          {/* RESULTADO: EQUIPOS */}
          {(teamA.length > 0 || teamB.length > 0) && (
              <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-bottom-4">
                  {/* EQUIPO A */}
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-3xl p-4 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10"><Shield size={64} className="text-blue-500"/></div>
                      <h3 className="text-blue-600 font-black text-sm uppercase tracking-widest mb-4 border-b border-blue-200 pb-2">Equipo Azul</h3>
                      <div className="space-y-2 relative z-10">
                          {teamA.map((p, i) => (
                              <div key={i} className="bg-white p-3 rounded-xl shadow-sm flex items-center gap-2 font-bold text-sm">
                                  <span className="text-blue-400 text-xs">#{i+1}</span>
                                  {p.id}
                                  {mode==='balanced' && p.score > 0 && <span className="text-[9px] bg-gray-100 px-1 rounded text-gray-400 ml-auto">{p.score}pts</span>}
                              </div>
                          ))}
                      </div>
                  </div>

                  {/* EQUIPO B */}
                  <div className="bg-red-50 border-2 border-red-200 rounded-3xl p-4 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10"><Shield size={64} className="text-red-500"/></div>
                      <h3 className="text-red-600 font-black text-sm uppercase tracking-widest mb-4 border-b border-red-200 pb-2">Equipo Rojo</h3>
                      <div className="space-y-2 relative z-10">
                          {teamB.map((p, i) => (
                              <div key={i} className="bg-white p-3 rounded-xl shadow-sm flex items-center gap-2 font-bold text-sm">
                                  <span className="text-red-400 text-xs">#{i+1}</span>
                                  {p.id}
                                  {mode==='balanced' && p.score > 0 && <span className="text-[9px] bg-gray-100 px-1 rounded text-gray-400 ml-auto">{p.score}pts</span>}
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          )}
          
          {teamA.length > 0 && (
               <div className="mt-8 text-center animate-pulse">
                   <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">VS</p>
               </div>
          )}
      </div>
  );
}