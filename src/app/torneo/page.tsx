'use client';

import React, { useState } from 'react';
import { useApp } from '@/lib/context';
import { db } from '@/lib/firebase';
import { doc, setDoc, writeBatch, increment, addDoc, collection, serverTimestamp, query, getDocs } from 'firebase/firestore';
import confetti from 'canvas-confetti';
import { Settings, Trash2, Users, Bot, UserPlus } from 'lucide-react';

const TEAMS_REAL = ["Man. City 🔵", "Real Madrid 👑", "Bayern 🔴", "Liverpool 🔴", "Arsenal 🔴", "Inter ⚫🔵", "PSG 🗼", "Barça 🔵🔴", "Atleti 🔴⚪", "Leverkusen ⚫🔴", "Milan ⚫🔴", "Juve ⚫⚪", "Dortmund 🟡⚫", "Chelsea 🔵", "Napoli 🔵", "Spurs ⚪", "Villa 🦁", "Newcastle ⚫⚪"];
const BYE_NAME = "Pase Directo ➡️";

// 🔥 CONSTANTE DE LIQUIDEZ (Cuanto más bajo, más volátil es la cuota)
const LIQUIDITY = 50;

export default function TorneoPage() {
  const { matches, users, activeBets } = useApp();
  
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [gameMode, setGameMode] = useState<'1vs1' | '2vs2'>('1vs1');
  const [showAdmin, setShowAdmin] = useState(false); 

  const togglePlayerSelection = (name: string) => {
      if (selectedPlayers.includes(name)) setSelectedPlayers(selectedPlayers.filter(p => p !== name));
      else { if (selectedPlayers.length >= 16) return alert("Máximo 16 jugadores."); setSelectedPlayers([...selectedPlayers, name]); }
  };

  const addCpu = () => { if (selectedPlayers.length >= 16) return; const cpuName = `CPU ${selectedPlayers.filter(p => p.startsWith('CPU')).length + 1}`; setSelectedPlayers([...selectedPlayers, cpuName]); };

  const createTeams = (individualPlayers: string[]) => {
      const shuffled = [...individualPlayers].sort(() => Math.random() - 0.5);
      const teams: string[] = [];
      for (let i = 0; i < shuffled.length; i += 2) {
          if (shuffled[i+1]) teams.push(`${shuffled[i]} & ${shuffled[i+1]}`);
          else teams.push(`${shuffled[i]} & CPU Relleno`);
      }
      return teams;
  };

  const handleCrearTorneo = async () => {
      if (gameMode === '1vs1' && selectedPlayers.length < 2) return alert("Mínimo 2 jugadores.");
      if (gameMode === '2vs2' && (selectedPlayers.length < 4 || selectedPlayers.length % 2 !== 0)) return alert("Para 2vs2 necesitáis pares (min 4).");

      let participants = gameMode === '2vs2' ? createTeams(selectedPlayers) : [...selectedPlayers];
      let targetSize = participants.length <= 4 ? 4 : 8; 
      while (participants.length < targetSize) participants.push(BYE_NAME);

      const shuffledP = [...participants].sort(() => Math.random() - 0.5);
      const shuffledT = [...TEAMS_REAL].sort(() => Math.random() - 0.5);

      const getMatchData = (idx: number) => {
          const entityName = shuffledP[idx];
          const isBye = entityName === BYE_NAME;
          let displayClub = "Invitado";
          if (!isBye) {
              if (entityName.includes(" & ")) {
                  const [n1, n2] = entityName.split(" & ");
                  const u1 = users.find((u:any) => u.id === n1);
                  const u2 = users.find((u:any) => u.id === n2);
                  displayClub = `${u1 ? u1.clubName : 'Bot'} / ${u2 ? u2.clubName : 'Bot'}`;
              } else {
                  const u = users.find((user: any) => user.id === entityName);
                  if (entityName.startsWith("CPU")) displayClub = "IA Legendaria 🤖";
                  else if (u) displayClub = u.clubName;
              }
          }
          return { name: entityName, team: isBye ? null : shuffledT[idx], club: isBye ? null : displayClub };
      };

      let newMatches: any[] = [];
      if (targetSize === 4) {
          newMatches = [
              { id: 0, p1: getMatchData(0).name, p1Team: getMatchData(0).team, p1Club: getMatchData(0).club, p2: getMatchData(1).name, p2Team: getMatchData(1).team, p2Club: getMatchData(1).club, round: 'S' },
              { id: 1, p1: getMatchData(2).name, p1Team: getMatchData(2).team, p1Club: getMatchData(2).club, p2: getMatchData(3).name, p2Team: getMatchData(3).team, p2Club: getMatchData(3).club, round: 'S' },
              { id: 2, p1: "Esperando...", p2: "Esperando...", round: 'F' }, { id: 3, p1: "Esperando...", p2: "Esperando...", round: '3rd' }
          ];
      } else {
          for(let i=0; i<4; i++) newMatches.push({ id: i, p1: getMatchData(i*2).name, p1Team: getMatchData(i*2).team, p1Club: getMatchData(i*2).club, p2: getMatchData(i*2+1).name, p2Team: getMatchData(i*2+1).team, p2Club: getMatchData(i*2+1).club, round: 'Q' });
          newMatches.push({ id: 4, p1: "Esperando...", p2: "Esperando...", round: 'S' }, { id: 5, p1: "Esperando...", p2: "Esperando...", round: 'S' }, { id: 6, p1: "Esperando...", p2: "Esperando...", round: 'F' }, { id: 7, p1: "Esperando...", p2: "Esperando...", round: '3rd' });
      }

      newMatches.forEach(m => { if(m.p2===BYE_NAME){m.winner=m.p1;m.isBye=true} else if(m.p1===BYE_NAME){m.winner=m.p2;m.isBye=true} });
      
      const propagate = (tIdx: number, slot: 'p1'|'p2', s: any) => {
        const wKey = s.winner===s.p1?'p1':'p2';
        newMatches[tIdx][slot] = s.winner!;
        newMatches[tIdx][slot==='p1'?'p1Team':'p2Team'] = s[wKey==='p1'?'p1Team':'p2Team'] || null;
        newMatches[tIdx][slot==='p1'?'p1Club':'p2Club'] = s[wKey==='p1'?'p1Club':'p2Club'] || null;
      };
      if(targetSize===4) { if(newMatches[0].winner) propagate(2,'p1',newMatches[0]); if(newMatches[1].winner) propagate(2,'p2',newMatches[1]); }
      else { if(newMatches[0].winner) propagate(4,'p1',newMatches[0]); if(newMatches[1].winner) propagate(4,'p2',newMatches[1]); if(newMatches[2].winner) propagate(5,'p1',newMatches[2]); if(newMatches[3].winner) propagate(5,'p2',newMatches[3]); }

      const clean = newMatches.map(m => JSON.parse(JSON.stringify(m, (k, v) => v === undefined ? null : v)));
      await setDoc(doc(db, "sala", "principal"), { fifaMatches: clean }, { merge: true });
  };

  // --- 🔥 LÓGICA DE FINALIZAR PARTIDO (MODO PRO) ---
  const finalizarPartido = async (matchId: number, s1: number, s2: number) => {
    if (s1 === s2) return alert("❌ En eliminatorias no hay empate.");
    
    const m = matches.find((x: any) => x.id === matchId);
    if (!m) return;
    const isP1 = s1 > s2;
    const winner = isP1 ? m.p1 : m.p2;
    const isTeam = winner.includes(" & ");
    const winnerIsCpu = winner.includes("CPU");
    const totalGoals = s1 + s2;

    try {
      // 1. Obtener todas las apuestas pendientes de este partido
      const pending = activeBets.filter((b: any) => b.matchId === matchId && b.status === 'pending');
      const batch = writeBatch(db);
      
      const pools: any = { winner: 0, goals: 0 };
      const winningPools: any = { winner: 0, goals: 0 };

      // 2. CALCULAR BOLSAS PARA APUESTAS SIMPLES (Liquidez)
      pending.forEach((b: any) => {
          if (b.type !== 'combined') {
              const type = (b.type === 'goals') ? 'goals' : 'winner';
              pools[type] += (b.amount || 0);

              let isVirtualWin = false;
              // Verificar si esta apuesta ganaría para sumar al pool ganador
              if (type === 'winner' && b.chosenWinner === winner) isVirtualWin = true;
              else if (type === 'goals') {
                 if (b.chosenWinner.includes('Mas') && totalGoals > (b.chosenWinner.includes('3.5')?3.5:2.5)) isVirtualWin = true;
                 else if (b.chosenWinner.includes('Menos') && totalGoals < (b.chosenWinner.includes('3.5')?3.5:2.5)) isVirtualWin = true;
              }
              if (isVirtualWin) winningPools[type] += (b.amount || 0);
          }
      });
      
      // 3. RESOLVER CADA APUESTA (COMBINADAS Y SIMPLES)
      pending.forEach((b: any) => {
          const ref = doc(db, "bets", b.id);
          let won = false;
          
          // Helper para comprobar un resultado individual
          const checkSelection = (type: string, val: string) => {
              if (type === 'winner' && val === winner) return true;
              if (type === 'goals') {
                 if (val.includes('Mas') && totalGoals > (val.includes('3.5')?3.5:2.5)) return true;
                 if (val.includes('Menos') && totalGoals < (val.includes('3.5')?3.5:2.5)) return true;
              }
              return false;
          };

          // A) ES COMBINADA?
          if (b.type === 'combined' && Array.isArray(b.selections)) {
              // Tienen que acertarse TODAS las selecciones
              won = b.selections.every((sel: any) => checkSelection(sel.type, sel.value));
          } 
          // B) ES SIMPLE?
          else {
              won = checkSelection(b.type || 'winner', b.chosenWinner);
          }

          if (won) {
              let odd = 1.0;
              
              if (b.type === 'combined') {
                  // Si es combinada, la cuota se fijó al apostar (finalOdd)
                  odd = parseFloat(b.finalOdd || '1.0');
              } else {
                  // Si es simple, calculamos la cuota estabilizada con LIQUIDITY=50
                  const type = (b.type === 'goals') ? 'goals' : 'winner';
                  // Fórmula: (TotalReal + 2*Liquidez) / (GanadoresReales + Liquidez)
                  const virtualTotal = pools[type] + (LIQUIDITY * 2);
                  const virtualTarget = winningPools[type] + LIQUIDITY;
                  odd = virtualTotal / virtualTarget;
                  
                  // Límites de seguridad
                  if (odd < 1.05) odd = 1.05;
                  if (odd > 10.0) odd = 10.0;
              }

              const profit = Math.floor(b.amount * odd);
              
              // Pagar al usuario
              batch.update(doc(db, "users", b.bettor), { balance: increment(profit) }); 
              // Marcar apuesta como ganada y guardar cuota final
              batch.update(ref, { status: 'won', finalOdd: odd.toFixed(2) });
          } else {
              // Marcar como perdida
              batch.update(ref, { status: 'lost' });
          }
      });
      
      await batch.commit();

      // 4. RANKING Y AVANZAR RONDA (Lógica original intacta)
      if (!winnerIsCpu && !m.isBye && winner !== "Esperando...") { 
          if (isTeam) {
              const [p1, p2] = winner.split(" & ");
              if (!p1.includes("CPU")) await setDoc(doc(db, "ranking", p1), { puntos: increment(3), victorias: increment(1) }, { merge: true });
              if (!p2.includes("CPU")) await setDoc(doc(db, "ranking", p2), { puntos: increment(3), victorias: increment(1) }, { merge: true });
          } else {
              await setDoc(doc(db, "ranking", winner), { puntos: increment(3), victorias: increment(1) }, { merge: true }); 
          }
      }
      
      let next = [...matches];
      next = next.map((x: any) => x.id === matchId ? { ...x, score1: s1, score2: s2, winner: winner } : x);

      const send = (tId: number, slot: 'p1'|'p2', n: string, t: any, c: any) => { if(next[tId]){ next[tId][slot]=n; next[tId][slot==='p1'?'p1Team':'p2Team']=t; next[tId][slot==='p1'?'p1Club':'p2Club']=c; }};
      const isSmall = matches.length === 4;
      if (isSmall) {
          if(matchId===0) { send(2,'p1',winner,isP1?m.p1Team:m.p2Team,isP1?m.p1Club:m.p2Club); send(3,'p1',isP1?m.p2:m.p1, isP1?m.p2Team:m.p1Team, isP1?m.p2Club:m.p1Club); }
          if(matchId===1) { send(2,'p2',winner,isP1?m.p1Team:m.p2Team,isP1?m.p1Club:m.p2Club); send(3,'p2',isP1?m.p2:m.p1, isP1?m.p2Team:m.p1Team, isP1?m.p2Club:m.p1Club); }
      } else {
          if(matchId<=3) send(matchId < 2 ? 4 : 5, matchId % 2 === 0 ? 'p1' : 'p2', winner, isP1?m.p1Team:m.p2Team, isP1?m.p1Club:m.p2Club);
          if(matchId===4) { send(6,'p1',winner,isP1?m.p1Team:m.p2Team,isP1?m.p1Club:m.p2Club); send(7,'p1',isP1?m.p2:m.p1, isP1?m.p2Team:m.p1Team, isP1?m.p2Club:m.p1Club); }
          if(matchId===5) { send(6,'p2',winner,isP1?m.p1Team:m.p2Team,isP1?m.p1Club:m.p2Club); send(7,'p2',isP1?m.p2:m.p1, isP1?m.p2Team:m.p1Team, isP1?m.p2Club:m.p1Club); }
      }

      await setDoc(doc(db, "sala", "principal"), { fifaMatches: next }, { merge: true });
      const finalId = isSmall ? 2 : 6;
      if(matchId===finalId) { if(!winnerIsCpu) confetti({particleCount:500}); await addDoc(collection(db,"history"),{winner,winnerTeam:isP1?m.p1Team:m.p2Team,date:serverTimestamp(),type:gameMode}); }
    } catch (e) { console.error(e); }
  };

  const limpiarPizarra = async () => {
      if(!confirm("¿Resetear cuadro?")) return;
      const b = writeBatch(db); b.set(doc(db,"sala","principal"),{fifaMatches:[]}); 
      const q = query(collection(db, "bets")); (await getDocs(q)).forEach(d=>b.delete(d.ref)); await b.commit(); setShowAdmin(false);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-8">
            <div><h1 className="text-3xl font-black italic">FOOTYS <span className="text-blue-600">ARENA</span></h1></div>
            <button onClick={() => setShowAdmin(!showAdmin)} className="p-2 bg-white border rounded-full text-gray-400"><Settings size={20} /></button>
        </div>
        
        {showAdmin && ( <div className="mb-8 p-4 bg-gray-100 rounded-xl flex justify-between items-center"><span className="text-xs font-bold uppercase">Zona Admin</span><button onClick={limpiarPizarra} className="flex gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-bold"><Trash2 size={14}/> RESET</button></div> )}
        
        {matches.length === 0 ? (
            <div className="bg-white p-8 rounded-3xl border shadow-xl text-center max-w-3xl mx-auto mt-10">
                <div className="inline-block p-4 bg-blue-50 rounded-full mb-6"><Settings size={48} className="text-blue-600"/></div>
                <h2 className="text-4xl font-black mb-6">PREPARAR TORNEO</h2>
                
                <div className="flex justify-center gap-4 mb-8">
                    <button onClick={()=>setGameMode('1vs1')} className={`px-6 py-2 rounded-full font-black text-sm uppercase ${gameMode==='1vs1'?'bg-black text-white':'bg-gray-100'}`}>1 vs 1</button>
                    <button onClick={()=>setGameMode('2vs2')} className={`px-6 py-2 rounded-full font-black text-sm uppercase ${gameMode==='2vs2'?'bg-black text-white':'bg-gray-100'}`}>2 vs 2</button>
                </div>
                <button onClick={addCpu} className="mb-6 flex gap-2 mx-auto bg-purple-100 text-purple-700 px-4 py-2 rounded-xl font-bold text-xs uppercase"><Bot size={16}/> CPU</button>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10 text-left">
                    {users.map((u: any) => (
                        <button key={u.id} onClick={()=>togglePlayerSelection(u.id)} className={`p-4 rounded-xl border-2 text-sm font-bold truncate transition ${selectedPlayers.includes(u.id)?'bg-blue-600 border-blue-600 text-white':'bg-white text-gray-600 border-gray-100'}`}>{u.id}</button>
                    ))}
                    {selectedPlayers.filter(p => p.startsWith('CPU')).map(cpu => ( <button key={cpu} onClick={()=>togglePlayerSelection(cpu)} className="p-4 rounded-xl border-2 text-sm font-bold truncate bg-purple-600 border-purple-600 text-white">{cpu}</button> ))}
                </div>
                <button onClick={handleCrearTorneo} disabled={selectedPlayers.length < 2} className="px-12 bg-black text-white font-black py-4 rounded-2xl shadow-xl hover:bg-gray-900 uppercase tracking-widest disabled:opacity-50">🚀 COMENZAR</button>
            </div>
        ) : (
            <div className="grid gap-8">
                 <div className="space-y-4"><h3 className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Partidos</h3>{(matches.length===4 ? [0,1,2,3] : [0,1,2,3,4,5,6,7]).map(id => matches[id] && <MatchCard key={id} m={matches[id]} onFinish={finalizarPartido} isFinal={id===2 || id===6} />)}</div>
            </div>
        )}
    </div>
  );
}

function MatchCard({ m, onFinish, isFinal, label }: { m?: any, onFinish: (id: number, s1: number, s2: number) => void, isFinal?: boolean, label?: string }) {
    const [s1, setS1] = useState(""); const [s2, setS2] = useState("");
    if (!m) return null;
    const isWaiting = m.p1 === "Esperando..." || m.p2 === "Esperando...";
    
    // ESTILOS
    if (m.isBye) return <div className="bg-green-50 border-2 border-green-100 p-4 rounded-3xl flex flex-col items-center justify-center text-center opacity-60"><span className="text-green-700 font-black text-[10px] uppercase">Pase Directo</span><p className="font-black text-xl text-green-900">{m.winner}</p></div>;
    let cardStyle = "border-2 border-gray-100 shadow-sm"; 
    if (m.winner) cardStyle = "border-2 border-gray-100 opacity-50 grayscale bg-gray-50/50 shadow-none";
    else if (isFinal && !isWaiting) cardStyle = "border-4 border-yellow-400 shadow-xl shadow-yellow-100";
    else if (!isWaiting) cardStyle = "animated-border shadow-xl";

    return (
        <div className={`relative bg-white p-6 rounded-3xl overflow-hidden transition-all ${cardStyle}`}>
            <div className="flex justify-between items-center mb-4 pt-2">
                <div className="overflow-hidden pr-2"><p className={`font-black text-lg truncate ${m.winner===m.p1 ? 'text-green-600' : 'text-black'}`}>{m.p1}</p><div className="flex gap-2 text-[10px] font-bold uppercase opacity-80"><span className="text-blue-600">{m.p1Team}</span></div></div>
                {m.winner ? <span className="font-mono font-black text-3xl">{m.score1}</span> : <input type="number" className="w-14 h-14 bg-gray-50 text-center rounded-2xl font-black text-xl outline-none focus:ring-2 focus:ring-black border-2 border-gray-100" value={s1} onChange={e=>setS1(e.target.value)} disabled={isWaiting} />}
            </div>
            
            <div className="w-full h-px bg-gray-200 mb-4 flex items-center justify-center"><span className="bg-white px-2 text-xs text-gray-400 font-black italic">VS</span></div>
            
            <div className="flex justify-between items-center mb-6">
                <div className="overflow-hidden pr-2"><p className={`font-black text-lg truncate ${m.winner===m.p2 ? 'text-green-600' : 'text-black'}`}>{m.p2}</p><div className="flex gap-2 text-[10px] font-bold uppercase opacity-80"><span className="text-blue-600">{m.p2Team}</span></div></div>
                {m.winner ? <span className="font-mono font-black text-3xl">{m.score2}</span> : <input type="number" className="w-14 h-14 bg-gray-50 text-center rounded-2xl font-black text-xl outline-none focus:ring-2 focus:ring-black border-2 border-gray-100" value={s2} onChange={e=>setS2(e.target.value)} disabled={isWaiting} />}
            </div>

            {!m.winner && !isWaiting && (
                <button 
                    onClick={() => {
                        if (s1 === "" || s2 === "") return alert("❌ Introduce el marcador.");
                        onFinish(m.id, +s1, +s2);
                    }} 
                    className="w-full bg-black hover:bg-gray-900 text-white text-xs font-black py-4 rounded-2xl transition shadow-md uppercase tracking-widest flex justify-center items-center gap-2"
                >
                    Finalizar Partido →
                </button>
            )}
        </div>
    );
}