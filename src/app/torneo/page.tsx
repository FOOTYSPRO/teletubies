'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/lib/context';
import { db } from '@/lib/firebase';
import { doc, setDoc, writeBatch, increment, addDoc, collection, serverTimestamp, query, getDocs, onSnapshot } from 'firebase/firestore';
import confetti from 'canvas-confetti';
import { Settings, Trash2, Users, Bot, UserPlus, Trophy, ArrowRightLeft, Skull, Shield, ShoppingBag, PlayCircle } from 'lucide-react';
import Link from 'next/link';

const TEAMS_REAL = ["Arsenal 🔴", "Inter ⚫🔵", "Barça 🔵🔴", "Atleti 🔴⚪", "PSV", "Leverkusen ⚫🔴", "Juve ⚫⚪", "Dortmund 🟡⚫", "Chelsea 🔵", "Napoli 🔵", "Spurs ⚪", "Villa 🦁", "Newcastle ⚫⚪", "Sporting", "Mónaco", "Leipzig"];
const BYE_NAME = "Pase Directo ➡️";
const LIQUIDITY = 50;

export default function TorneoPage() {
  const { matches, users, activeBets } = useApp();
  const [powerups, setPowerups] = useState<any[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [gameMode, setGameMode] = useState<'1vs1' | '2vs2'>('1vs1');
  const [showAdmin, setShowAdmin] = useState(false); 

  useEffect(() => {
    const q = query(collection(db, "powerups"));
    const unsub = onSnapshot(q, (snap) => setPowerups(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, []);

  // ... (RESTO DE FUNCIONES IGUALES: togglePlayerSelection, addCpu, createTeams, handleCrearTorneo, empezarPartido, finalizarPartido, limpiarPizarra) ...
  // Para ahorrar espacio, pego solo el return y las funciones principales que no cambian, asegurando que copies todo el bloque
  // COPIA Y PEGA EL CONTENIDO PREVIO DE LAS FUNCIONES SI NO LAS CAMBIAS, PERO AQUÍ ESTÁ EL BLOQUE COMPLETO PARA EVITAR ERRORES:

  const togglePlayerSelection = (name: string) => { if (selectedPlayers.includes(name)) setSelectedPlayers(selectedPlayers.filter(p => p !== name)); else { if (selectedPlayers.length >= 16) return alert("Máximo 16 players."); setSelectedPlayers([...selectedPlayers, name]); } };
  const addCpu = () => { if (selectedPlayers.length >= 16) return; const cpuName = `CPU ${selectedPlayers.filter(p => p.startsWith('CPU')).length + 1}`; setSelectedPlayers([...selectedPlayers, cpuName]); };
  const createTeams = (individualPlayers: string[]) => { const shuffled = [...individualPlayers].sort(() => Math.random() - 0.5); const teams: string[] = []; for (let i = 0; i < shuffled.length; i += 2) { if (shuffled[i+1]) teams.push(`${shuffled[i]} & ${shuffled[i+1]}`); else teams.push(`${shuffled[i]} & CPU Relleno`); } return teams; };
  
  const handleCrearTorneo = async () => { 
      if (gameMode === '1vs1' && selectedPlayers.length < 2) return alert("Mínimo 2.");
      if (gameMode === '2vs2' && (selectedPlayers.length < 4 || selectedPlayers.length % 2 !== 0)) return alert("Para 2vs2 necesitáis pares (min 4).");
      let participants = gameMode === '2vs2' ? createTeams(selectedPlayers) : [...selectedPlayers];
      let targetSize = participants.length <= 4 ? 4 : 8; 
      while (participants.length < targetSize) participants.push(BYE_NAME);
      const shuffledP = [...participants].sort(() => Math.random() - 0.5);
      const shuffledT = [...TEAMS_REAL].sort(() => Math.random() - 0.5);
      const getMatchData = (idx: number) => {
          const entityName = shuffledP[idx]; const isBye = entityName === BYE_NAME; let displayClub = "Invitado";
          if (!isBye) { if (entityName.includes(" & ")) { const [n1, n2] = entityName.split(" & "); const u1 = users.find((u:any) => u.id === n1); const u2 = users.find((u:any) => u.id === n2); displayClub = `${u1 ? u1.clubName : 'Bot'} / ${u2 ? u2.clubName : 'Bot'}`; } else { const u = users.find((user: any) => user.id === entityName); if (entityName.startsWith("CPU")) displayClub = "IA Legendaria 🤖"; else if (u) displayClub = u.clubName; } }
          return { name: entityName, team: isBye ? null : shuffledT[idx], club: isBye ? null : displayClub };
      };
      
      let newMatches: any[] = [];
      if (targetSize === 4) { newMatches = [ { id: 0, p1: getMatchData(0).name, p1Team: getMatchData(0).team, p1Club: getMatchData(0).club, p2: getMatchData(1).name, p2Team: getMatchData(1).team, p2Club: getMatchData(1).club, round: 'S' }, { id: 1, p1: getMatchData(2).name, p1Team: getMatchData(2).team, p1Club: getMatchData(2).club, p2: getMatchData(3).name, p2Team: getMatchData(3).team, p2Club: getMatchData(3).club, round: 'S' }, { id: 2, p1: "Esperando...", p2: "Esperando...", round: 'F' } ]; } 
      else { for(let i=0; i<4; i++) newMatches.push({ id: i, p1: getMatchData(i*2).name, p1Team: getMatchData(i*2).team, p1Club: getMatchData(i*2).club, p2: getMatchData(i*2+1).name, p2Team: getMatchData(i*2+1).team, p2Club: getMatchData(i*2+1).club, round: 'Q' }); newMatches.push({ id: 4, p1: "Esperando...", p2: "Esperando...", round: 'S' }, { id: 5, p1: "Esperando...", p2: "Esperando...", round: 'S' }, { id: 6, p1: "Esperando...", p2: "Esperando...", round: 'F' }); }
      
      newMatches.forEach(m => { if(m.p2===BYE_NAME){m.winner=m.p1;m.isBye=true} else if(m.p1===BYE_NAME){m.winner=m.p2;m.isBye=true} });
      const propagate = (tIdx: number, slot: 'p1'|'p2', s: any) => { const wKey = s.winner===s.p1?'p1':'p2'; newMatches[tIdx][slot] = s.winner!; newMatches[tIdx][slot==='p1'?'p1Team':'p2Team'] = s[wKey==='p1'?'p1Team':'p2Team'] || null; newMatches[tIdx][slot==='p1'?'p1Club':'p2Club'] = s[wKey==='p1'?'p1Club':'p2Club'] || null; };
      if(targetSize===4) { if(newMatches[0].winner) propagate(2,'p1',newMatches[0]); if(newMatches[1].winner) propagate(2,'p2',newMatches[1]); } 
      else { if(newMatches[0].winner) propagate(4,'p1',newMatches[0]); if(newMatches[1].winner) propagate(4,'p2',newMatches[1]); if(newMatches[2].winner) propagate(5,'p1',newMatches[2]); if(newMatches[3].winner) propagate(5,'p2',newMatches[3]); }

      const clean = newMatches.map(m => JSON.parse(JSON.stringify(m, (k, v) => v === undefined ? null : v)));
      await setDoc(doc(db, "sala", "principal"), { fifaMatches: clean }, { merge: true });
      const q = query(collection(db, "powerups")); const snap = await getDocs(q); const batch = writeBatch(db); snap.forEach(d => batch.delete(d.ref)); await batch.commit();
  };

  const empezarPartido = async (matchId: number) => {
      if(!confirm("¿Cerrar mercado y empezar partido?")) return;
      let next = [...matches];
      next = next.map((x: any) => x.id === matchId ? { ...x, started: true } : x);
      await setDoc(doc(db, "sala", "principal"), { fifaMatches: next }, { merge: true });
  };

  const finalizarPartido = async (matchId: number, s1: number, s2: number) => {
    if (s1 === s2) return alert("❌ En eliminatorias no hay empate.");
    const m = matches.find((x: any) => x.id === matchId);
    if (!m) return;
    const isP1 = s1 > s2;
    const winner = isP1 ? m.p1 : m.p2;
    const loser = isP1 ? m.p2 : m.p1;
    const totalGoals = s1 + s2;

    try {
      const pending = activeBets.filter((b: any) => b.matchId === matchId && b.status === 'pending');
      const batch = writeBatch(db);
      const pools: any = { winner: 0, goals: 0 };
      const winningPools: any = { winner: 0, goals: 0 };

      const checkSelection = (type: string, val: string) => {
          if (type === 'winner' && val === winner) return true;
          if (type === 'goals') {
             const limit = val.includes('4.5') ? 4.5 : val.includes('3.5') ? 3.5 : 2.5; 
             if (val.includes('Mas') && totalGoals > limit) return true;
             if (val.includes('Menos') && totalGoals < limit) return true;
          }
          return false;
      };

      pending.forEach((b: any) => {
          if (b.type !== 'combined') {
              const type = (b.type === 'goals') ? 'goals' : 'winner';
              pools[type] += (Number(b.amount) || 0);
              if (checkSelection(b.type || 'winner', b.chosenWinner)) winningPools[type] += (Number(b.amount) || 0);
          }
      });
      
      pending.forEach((b: any) => {
          const ref = doc(db, "bets", b.id);
          let won = false;
          if (b.type === 'combined' && Array.isArray(b.selections)) {
              won = b.selections.every((sel: any) => checkSelection(sel.type, sel.value));
          } else { won = checkSelection(b.type || 'winner', b.chosenWinner); }

          if (won) {
              let odd = 1.0;
              if (b.type === 'combined') { odd = parseFloat(b.finalOdd || '1.0'); } 
              else {
                  const type = (b.type === 'goals') ? 'goals' : 'winner';
                  const virtualTotal = pools[type] + (LIQUIDITY * 2);
                  const virtualTarget = winningPools[type] + LIQUIDITY;
                  odd = virtualTotal / virtualTarget;
                  if (odd < 1.05) odd = 1.05; if (odd > 10.0) odd = 10.0;
              }
              const profit = Math.floor(Number(b.amount) * odd);
              batch.update(doc(db, "users", b.bettor), { balance: increment(profit) }); 
              batch.update(ref, { status: 'won', finalOdd: odd.toFixed(2) });
          } else { batch.update(ref, { status: 'lost' }); }
      });

      if (!winner.includes("CPU") && !m.isBye && winner !== "Esperando...") { 
          if (winner.includes(" & ")) {
              const [p1, p2] = winner.split(" & ");
              if (!p1.includes("CPU")) batch.set(doc(db, "ranking", p1), { jugados: increment(1), ganados: isP1 ? increment(1) : increment(0) }, { merge: true });
              if (!p2.includes("CPU")) batch.set(doc(db, "ranking", p2), { jugados: increment(1), ganados: isP1 ? increment(1) : increment(0) }, { merge: true });
          } else {
              batch.set(doc(db, "ranking", winner), { jugados: increment(1), ganados: increment(1) }, { merge: true });
          }
          if (!loser.includes("CPU") && !loser.includes(" & ")) {
             batch.set(doc(db, "ranking", loser), { jugados: increment(1) }, { merge: true });
          }
      }

      const isSmall = matches.length <= 4;
      const finalId = isSmall ? 2 : 6;
      if (matchId === finalId) {
          if (!winner.includes("CPU")) batch.update(doc(db, "users", winner), { balance: increment(1000) });
          if (!loser.includes("CPU")) batch.update(doc(db, "users", loser), { balance: increment(600) });
          const semi1Id = isSmall ? 0 : 4; const semi2Id = isSmall ? 1 : 5; const s1Match = matches[semi1Id]; const s2Match = matches[semi2Id];
          if (s1Match && s2Match && s1Match.winner && s2Match.winner) {
              const loser1 = s1Match.winner === s1Match.p1 ? s1Match.p2 : s1Match.p1; const loser2 = s2Match.winner === s2Match.p1 ? s2Match.p2 : s2Match.p1;
              const scoreL1 = s1Match.winner === s1Match.p1 ? s1Match.score2 : s1Match.score1; const scoreW1 = s1Match.winner === s1Match.p1 ? s1Match.score1 : s1Match.score2; const diff1 = scoreL1 - scoreW1;
              const scoreL2 = s2Match.winner === s2Match.p1 ? s2Match.score2 : s2Match.score1; const scoreW2 = s2Match.winner === s2Match.p1 ? s2Match.score1 : s2Match.score2; const diff2 = scoreL2 - scoreW2;
              let thirdPlace = null; if (diff1 > diff2) thirdPlace = loser1; else if (diff2 > diff1) thirdPlace = loser2; else thirdPlace = Math.random() > 0.5 ? loser1 : loser2;
              if (thirdPlace && !thirdPlace.includes("CPU")) batch.update(doc(db, "users", thirdPlace), { balance: increment(250) });
              alert(`🏆 CAMPEÓN: ${winner}\n🥈 SUBCAMPEÓN: ${loser}\n🥉 3º PUESTO: ${thirdPlace}`);
          } else { alert(`🏆 CAMPEÓN: ${winner}`); }
          if(!winner.includes("CPU")) confetti({particleCount:500}); await addDoc(collection(db,"history"),{winner,winnerTeam:isP1?m.p1Team:m.p2Team,date:serverTimestamp(),type:gameMode});
      }
      await batch.commit();

      if (matchId !== finalId) {
          let next = [...matches];
          next = next.map((x: any) => x.id === matchId ? { ...x, score1: s1, score2: s2, winner: winner } : x);
          const send = (tId: number, slot: 'p1'|'p2', n: string, t: any, c: any) => { if(next[tId]){ next[tId][slot]=n; next[tId][slot==='p1'?'p1Team':'p2Team']=t; next[tId][slot==='p1'?'p1Club':'p2Club']=c; }};
          if (isSmall) { if(matchId===0) send(2,'p1',winner,isP1?m.p1Team:m.p2Team,isP1?m.p1Club:m.p2Club); if(matchId===1) send(2,'p2',winner,isP1?m.p1Team:m.p2Team,isP1?m.p1Club:m.p2Club); } 
          else { if(matchId<=3) send(matchId < 2 ? 4 : 5, matchId % 2 === 0 ? 'p1' : 'p2', winner, isP1?m.p1Team:m.p2Team, isP1?m.p1Club:m.p2Club); if(matchId===4) send(6,'p1',winner,isP1?m.p1Team:m.p2Team,isP1?m.p1Club:m.p2Club); if(matchId===5) send(6,'p2',winner,isP1?m.p1Team:m.p2Team,isP1?m.p1Club:m.p2Club); }
          await setDoc(doc(db, "sala", "principal"), { fifaMatches: next }, { merge: true });
      } else {
          let next = [...matches];
          next = next.map((x: any) => x.id === matchId ? { ...x, score1: s1, score2: s2, winner: winner } : x);
          await setDoc(doc(db, "sala", "principal"), { fifaMatches: next }, { merge: true });
      }
    } catch (e) { console.error(e); }
  };

  const limpiarPizarra = async () => { if(!confirm("Reset?"))return; const b = writeBatch(db); b.set(doc(db,"sala","principal"),{fifaMatches:[]}); const q = query(collection(db, "bets")); (await getDocs(q)).forEach(d=>b.delete(d.ref)); const q2 = query(collection(db, "powerups")); (await getDocs(q2)).forEach(d=>b.delete(d.ref)); await b.commit(); setShowAdmin(false); };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-8">
            <div><h1 className="text-3xl font-black italic">FOOTYS <span className="text-blue-600">ARENA</span></h1></div>
            <div className="flex gap-2">
                <Link href="/tienda" className="p-2 bg-black text-white rounded-full"><ShoppingBag size={20} /></Link>
                <button onClick={() => setShowAdmin(!showAdmin)} className="p-2 bg-white border rounded-full text-gray-400"><Settings size={20} /></button>
            </div>
        </div>
        {showAdmin && ( <div className="mb-8 p-4 bg-gray-100 rounded-xl flex justify-between items-center"><span className="text-xs font-bold uppercase">Zona Admin</span><button onClick={limpiarPizarra} className="flex gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-bold"><Trash2 size={14}/> RESET</button></div> )}
        {matches.length === 0 ? (
            <div className="bg-white p-8 rounded-3xl border shadow-xl text-center max-w-3xl mx-auto mt-10">
                <div className="inline-block p-4 bg-blue-50 rounded-full mb-6"><Settings size={48} className="text-blue-600"/></div>
                <h2 className="text-4xl font-black mb-6">PREPARAR TORNEO</h2>
                <div className="flex justify-center gap-4 mb-8"><button onClick={()=>setGameMode('1vs1')} className={`px-6 py-2 rounded-full font-black text-sm uppercase ${gameMode==='1vs1'?'bg-black text-white':'bg-gray-100'}`}>1 vs 1</button><button onClick={()=>setGameMode('2vs2')} className={`px-6 py-2 rounded-full font-black text-sm uppercase ${gameMode==='2vs2'?'bg-black text-white':'bg-gray-100'}`}>2 vs 2</button></div>
                <button onClick={addCpu} className="mb-6 flex gap-2 mx-auto bg-purple-100 text-purple-700 px-4 py-2 rounded-xl font-bold text-xs uppercase"><Bot size={16}/> CPU</button>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10 text-left">{users.map((u: any) => (<button key={u.id} onClick={()=>togglePlayerSelection(u.id)} className={`p-4 rounded-xl border-2 text-sm font-bold truncate transition ${selectedPlayers.includes(u.id)?'bg-blue-600 border-blue-600 text-white':'bg-white text-gray-600 border-gray-100'}`}>{u.id}</button>))}{selectedPlayers.filter(p => p.startsWith('CPU')).map(cpu => ( <button key={cpu} onClick={()=>togglePlayerSelection(cpu)} className="p-4 rounded-xl border-2 text-sm font-bold truncate bg-purple-600 border-purple-600 text-white">{cpu}</button> ))}</div>
                <button onClick={handleCrearTorneo} disabled={selectedPlayers.length < 2} className="px-12 bg-black text-white font-black py-4 rounded-2xl shadow-xl hover:bg-gray-900 uppercase tracking-widest disabled:opacity-50">🚀 COMENZAR</button>
            </div>
        ) : (
            <div className="grid gap-8">
                <div className="space-y-4"><h3 className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Partidos</h3>
                {(matches.length <= 4 ? [0,1,2] : [0,1,2,3,4,5,6]).map(id => matches[id] && <MatchCard key={id} m={matches[id]} onFinish={finalizarPartido} onStart={empezarPartido} isFinal={matches.length <= 4 ? id===2 : id===6} powerups={powerups.filter(p => p.matchId === matches[id].id)} />)}
                </div>
            </div>
        )}
    </div>
  );
}

function MatchCard({ m, onFinish, onStart, isFinal, powerups }: { m?: any, onFinish: (id: number, s1: number, s2: number) => void, onStart: (id: number) => void, isFinal?: boolean, powerups: any[] }) {
    const [s1, setS1] = useState(""); const [s2, setS2] = useState("");
    if (!m) return null;
    const isWaiting = m.p1 === "Esperando..." || m.p2 === "Esperando...";
    if (m.isBye) return <div className="bg-green-50 border-2 border-green-100 p-4 rounded-3xl flex flex-col items-center justify-center text-center opacity-60"><span className="text-green-700 font-black text-[10px] uppercase">Pase Directo</span><p className="font-black text-xl text-green-900">{m.winner}</p></div>;
    let cardStyle = "border-2 border-gray-100 shadow-sm"; 
    if (m.winner) cardStyle = "border-2 border-gray-100 opacity-50 grayscale bg-gray-50/50 shadow-none"; else if (isFinal && !isWaiting) cardStyle = "border-4 border-yellow-400 shadow-xl shadow-yellow-100"; else if (!isWaiting) cardStyle = "animated-border shadow-xl";
    const getPowerups = (player: string) => powerups.filter(p => p.buyer === player);

    return (
        <div className={`relative bg-white p-6 rounded-3xl overflow-hidden transition-all ${cardStyle}`}>
            {isFinal && !m.winner && <div className="absolute top-0 right-0 bg-yellow-400 text-black text-[10px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-widest shadow-sm flex items-center gap-1"><Trophy size={10}/> GRAN FINAL</div>}
            
            <div className="flex justify-between items-center mb-4 pt-2">
                <div className="overflow-hidden pr-2">
                    <p className={`font-black text-lg truncate ${m.winner===m.p1 ? 'text-green-600' : 'text-black'}`}>{m.p1}</p>
                    <div className="flex gap-2 text-[10px] font-bold uppercase opacity-80"><span className="text-blue-600">{m.p1Team}</span></div>
                    {/* AQUI SE MUESTRA EL ICONO DE INTERCAMBIO (SWAP) */}
                    <div className="flex gap-1 mt-1">{getPowerups(m.p1).map((p:any, i:number) => (<span key={i} className="text-[9px] bg-purple-100 text-purple-700 px-1 rounded border border-purple-200 flex items-center gap-1" title={p.name}>{p.type==='swap' && <ArrowRightLeft size={10}/>} {p.type==='injury' && <Skull size={10}/>} {p.type==='insurance' && <Shield size={10}/>} {p.name}</span>))}</div>
                </div>
                {m.winner ? <span className="font-mono font-black text-3xl">{m.score1}</span> : <input type="number" className="w-14 h-14 bg-gray-50 text-center rounded-2xl font-black text-xl outline-none focus:ring-2 focus:ring-black border-2 border-gray-100" value={s1} onChange={e=>setS1(e.target.value)} disabled={isWaiting || !m.started} />}
            </div>
            <div className="w-full h-px bg-gray-200 mb-4 flex items-center justify-center"><span className="bg-white px-2 text-xs text-gray-400 font-black italic">VS</span></div>
            <div className="flex justify-between items-center mb-6">
                <div className="overflow-hidden pr-2">
                    <p className={`font-black text-lg truncate ${m.winner===m.p2 ? 'text-green-600' : 'text-black'}`}>{m.p2}</p>
                    <div className="flex gap-2 text-[10px] font-bold uppercase opacity-80"><span className="text-blue-600">{m.p2Team}</span></div>
                    {/* AQUI SE MUESTRA EL ICONO DE INTERCAMBIO (SWAP) */}
                    <div className="flex gap-1 mt-1">{getPowerups(m.p2).map((p:any, i:number) => (<span key={i} className="text-[9px] bg-purple-100 text-purple-700 px-1 rounded border border-purple-200 flex items-center gap-1" title={p.name}>{p.type==='swap' && <ArrowRightLeft size={10}/>} {p.type==='injury' && <Skull size={10}/>} {p.type==='insurance' && <Shield size={10}/>} {p.name}</span>))}</div>
                </div>
                {m.winner ? <span className="font-mono font-black text-3xl">{m.score2}</span> : <input type="number" className="w-14 h-14 bg-gray-50 text-center rounded-2xl font-black text-xl outline-none focus:ring-2 focus:ring-black border-2 border-gray-100" value={s2} onChange={e=>setS2(e.target.value)} disabled={isWaiting || !m.started} />}
            </div>
            
            {!m.winner && !isWaiting && (
                <div className="space-y-2">
                    {!m.started ? (
                        <button onClick={() => onStart(m.id)} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-black py-4 rounded-2xl transition shadow-md uppercase tracking-widest flex justify-center items-center gap-2"><PlayCircle size={16}/> Pitido Inicial</button>
                    ) : (
                        <button onClick={() => { if (s1 === "" || s2 === "") return alert("❌ Introduce el marcador."); onFinish(m.id, +s1, +s2); }} className="w-full bg-black hover:bg-gray-900 text-white text-xs font-black py-4 rounded-2xl transition shadow-md uppercase tracking-widest flex justify-center items-center gap-2">Finalizar Partido →</button>
                    )}
                </div>
            )}
        </div>
    );
}