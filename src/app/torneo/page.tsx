'use client';

import React, { useState } from 'react';
import { useApp } from '@/lib/context';
import { db } from '@/lib/firebase';
import { doc, setDoc, writeBatch, increment, addDoc, collection, serverTimestamp, query, getDocs } from 'firebase/firestore';
import confetti from 'canvas-confetti';
import { Settings, Trash2, Users, Shuffle, Bot, UserPlus } from 'lucide-react';

const TEAMS_REAL = ["Man. City 🔵", "Real Madrid 👑", "Bayern 🔴", "Liverpool 🔴", "Arsenal 🔴", "Inter ⚫🔵", "PSG 🗼", "Barça 🔵🔴", "Atleti 🔴⚪", "Leverkusen ⚫🔴", "Milan ⚫🔴", "Juve ⚫⚪", "Dortmund 🟡⚫", "Chelsea 🔵", "Napoli 🔵", "Spurs ⚪", "Villa 🦁", "Newcastle ⚫⚪"];
const BYE_NAME = "Pase Directo ➡️";

export default function TorneoPage() {
  const { matches, users, activeBets } = useApp();
  
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [gameMode, setGameMode] = useState<'1vs1' | '2vs2'>('1vs1');
  const [showAdmin, setShowAdmin] = useState(false); 

  // --- GESTIÓN JUGADORES ---
  const togglePlayerSelection = (name: string) => {
      if (selectedPlayers.includes(name)) setSelectedPlayers(selectedPlayers.filter(p => p !== name));
      else { if (selectedPlayers.length >= 16) return alert("Máximo 16 jugadores."); setSelectedPlayers([...selectedPlayers, name]); }
  };

  const addCpu = () => {
      if (selectedPlayers.length >= 16) return alert("Máximo 16.");
      const cpuName = `CPU ${selectedPlayers.filter(p => p.startsWith('CPU')).length + 1}`;
      setSelectedPlayers([...selectedPlayers, cpuName]);
  };

  // --- LÓGICA DE EMPAREJAMIENTO 2vs2 ---
  const createTeams = (individualPlayers: string[]) => {
      // Barajar jugadores
      const shuffled = [...individualPlayers].sort(() => Math.random() - 0.5);
      const teams: string[] = [];
      
      // Crear parejas "Jugador 1 & Jugador 2"
      for (let i = 0; i < shuffled.length; i += 2) {
          if (shuffled[i+1]) {
              teams.push(`${shuffled[i]} & ${shuffled[i+1]}`);
          } else {
              // Si sobra uno (no debería si validamos antes), lo dejamos solo o con CPU
              teams.push(`${shuffled[i]} & CPU Relleno`);
          }
      }
      return teams;
  };

  // --- GENERAR BRACKET ---
  const handleCrearTorneo = async () => {
      // VALIDACIONES
      if (gameMode === '1vs1') {
          if (selectedPlayers.length < 2) return alert("Mínimo 2 jugadores.");
      } else {
          // Lógica 2vs2
          if (selectedPlayers.length < 4) return alert("Para 2vs2 necesitáis al menos 4 jugadores (2 equipos).");
          if (selectedPlayers.length % 2 !== 0) return alert("Para 2vs2 el número de jugadores debe ser PAR. Añade una CPU o a otro amigo.");
      }

      // PREPARAR PARTICIPANTES (INDIVIDUALES O EQUIPOS)
      let participants = [];
      if (gameMode === '2vs2') {
          participants = createTeams(selectedPlayers);
      } else {
          participants = [...selectedPlayers];
      }

      // AJUSTAR TAMAÑO CUADRO (4 u 8 EQUIPOS/JUGADORES)
      let targetSize = participants.length <= 4 ? 4 : 8; 
      while (participants.length < targetSize) participants.push(BYE_NAME);

      const shuffledP = [...participants].sort(() => Math.random() - 0.5);
      const shuffledT = [...TEAMS_REAL].sort(() => Math.random() - 0.5);

      const getMatchData = (idx: number) => {
          const entityName = shuffledP[idx]; // Puede ser "Jorge" o "Jorge & Pepe"
          const isBye = entityName === BYE_NAME;
          
          let displayClub = "Invitado";

          if (!isBye) {
              if (entityName.includes(" & ")) {
                  // ES UN EQUIPO 2vs2: Buscamos los clubes de ambos
                  const [n1, n2] = entityName.split(" & ");
                  const u1 = users.find((u:any) => u.id === n1);
                  const u2 = users.find((u:any) => u.id === n2);
                  
                  const c1 = u1 ? u1.clubName : (n1.includes("CPU") ? "Bot" : "Invitado");
                  const c2 = u2 ? u2.clubName : (n2.includes("CPU") ? "Bot" : "Invitado");
                  
                  displayClub = `${c1} / ${c2}`; // Ej: "Aston Birra / Rayo"
              } else {
                  // ES 1vs1
                  const u = users.find((user: any) => user.id === entityName);
                  if (entityName.startsWith("CPU")) displayClub = "IA Legendaria 🤖";
                  else if (u) displayClub = u.clubName;
              }
          }

          return { 
              name: entityName, 
              team: isBye ? null : shuffledT[idx], 
              club: isBye ? null : displayClub
          };
      };

      let newMatches: any[] = [];
      
      // GENERAR ESTRUCTURA
      if (targetSize === 4) {
          newMatches = [
              { id: 0, p1: getMatchData(0).name, p1Team: getMatchData(0).team, p1Club: getMatchData(0).club, p2: getMatchData(1).name, p2Team: getMatchData(1).team, p2Club: getMatchData(1).club, round: 'S' },
              { id: 1, p1: getMatchData(2).name, p1Team: getMatchData(2).team, p1Club: getMatchData(2).club, p2: getMatchData(3).name, p2Team: getMatchData(3).team, p2Club: getMatchData(3).club, round: 'S' },
              { id: 2, p1: "Esperando...", p2: "Esperando...", round: 'F' }, 
              { id: 3, p1: "Esperando...", p2: "Esperando...", round: '3rd' }
          ];
      } else {
          newMatches = [
              { id: 0, p1: getMatchData(0).name, p1Team: getMatchData(0).team, p1Club: getMatchData(0).club, p2: getMatchData(1).name, p2Team: getMatchData(1).team, p2Club: getMatchData(1).club, round: 'Q' },
              { id: 1, p1: getMatchData(2).name, p1Team: getMatchData(2).team, p1Club: getMatchData(2).club, p2: getMatchData(3).name, p2Team: getMatchData(3).team, p2Club: getMatchData(3).club, round: 'Q' },
              { id: 2, p1: getMatchData(4).name, p1Team: getMatchData(4).team, p1Club: getMatchData(4).club, p2: getMatchData(5).name, p2Team: getMatchData(5).team, p2Club: getMatchData(5).club, round: 'Q' },
              { id: 3, p1: getMatchData(6).name, p1Team: getMatchData(6).team, p1Club: getMatchData(6).club, p2: getMatchData(7).name, p2Team: getMatchData(7).team, p2Club: getMatchData(7).club, round: 'Q' },
              { id: 4, p1: "Esperando...", p2: "Esperando...", round: 'S' }, { id: 5, p1: "Esperando...", p2: "Esperando...", round: 'S' },
              { id: 6, p1: "Esperando...", p2: "Esperando...", round: 'F' }, { id: 7, p1: "Esperando...", p2: "Esperando...", round: '3rd' }
          ];
      }

      // Propagar BYEs
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

  const finalizarPartido = async (matchId: number, s1: number, s2: number) => {
    if (s1 === s2) return alert("❌ En eliminatorias no hay empate.");
    const m = matches.find((x: any) => x.id === matchId);
    if (!m) return;
    const isP1 = s1 > s2;
    const winner = isP1 ? m.p1 : m.p2;
    
    // Detectar si es un equipo (contiene "&")
    const isTeam = winner.includes(" & ");
    const winnerIsCpu = winner.includes("CPU");

    try {
      // 1. Apuestas
      const pending = activeBets.filter((b: any) => b.matchId === matchId && b.status === 'pending');
      const batch = writeBatch(db);
      pending.forEach((b: any) => {
          const ref = doc(db, "bets", b.id);
          if (b.chosenWinner === winner) { 
              batch.update(doc(db, "users", b.bettor), { balance: increment(b.amount * 2) }); 
              batch.update(ref, { status: 'won' }); 
          } else batch.update(ref, { status: 'lost' });
      });
      await batch.commit();

      // 2. Ranking
      // Si es 2vs2 (Team), buscamos a los dos jugadores y les damos puntos a ambos
      if (!winnerIsCpu && !m.isBye && winner !== "Esperando...") { 
          if (isTeam) {
              const [p1, p2] = winner.split(" & ");
              if (!p1.includes("CPU")) await setDoc(doc(db, "ranking", p1), { puntos: increment(3), victorias: increment(1) }, { merge: true });
              if (!p2.includes("CPU")) await setDoc(doc(db, "ranking", p2), { puntos: increment(3), victorias: increment(1) }, { merge: true });
          } else {
              // 1vs1
              await setDoc(doc(db, "ranking", winner), { puntos: increment(3), victorias: increment(1) }, { merge: true }); 
          }
      }
      
      // 3. Avanzar
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
      if(matchId===finalId) { 
          if(!winnerIsCpu) confetti({particleCount:500}); 
          await addDoc(collection(db,"history"),{winner,winnerTeam:isP1?m.p1Team:m.p2Team,date:serverTimestamp(),type:gameMode}); 
      }
    } catch (e) { console.error(e); }
  };

  const limpiarPizarra = async () => {
      if(!confirm("¿Resetear cuadro?")) return;
      const b = writeBatch(db); b.set(doc(db,"sala","principal"),{fifaMatches:[], equipoA:[], equipoB:[], ultimoCastigo:"..."}); 
      const q = query(collection(db, "bets")); (await getDocs(q)).forEach(d=>b.delete(d.ref)); await b.commit(); setShowAdmin(false);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-8">
            <div>
                <h1 className="text-3xl font-black text-black uppercase tracking-tighter italic">FOOTYS <span className="text-blue-600">ARENA</span></h1>
                <p className="text-gray-500 text-sm font-bold uppercase tracking-widest">{matches.length > 0 ? 'Torneo Oficial en Curso' : 'Sala de Espera'}</p>
            </div>
            <button onClick={() => setShowAdmin(!showAdmin)} className="p-2 bg-white border border-gray-200 rounded-full hover:bg-gray-100 transition text-gray-400"><Settings size={20} /></button>
        </div>
        
        {/* PANEL ADMIN */}
        {showAdmin && ( 
            <div className="mb-8 p-4 bg-gray-100 border border-gray-300 rounded-xl flex flex-wrap gap-4 justify-between items-center animate-in slide-in-from-top-2">
                <span className="text-xs font-bold text-gray-500 uppercase">Zona de Gestión</span>
                <button onClick={limpiarPizarra} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-700 transition">
                    <Trash2 size={14}/> RESETEAR TORNEO
                </button>
            </div> 
        )}
        
        {/* --- MODO SELECCIÓN --- */}
        {matches.length === 0 ? (
            <div className="bg-white p-8 md:p-12 rounded-3xl border border-gray-200 shadow-xl text-center max-w-3xl mx-auto mt-10">
                <div className="inline-block p-4 bg-blue-50 rounded-full mb-6"><Settings size={48} className="text-blue-600"/></div>
                <h2 className="text-4xl font-black mb-2 text-black tracking-tight">PREPARAR TORNEO</h2>
                <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-6">
                    {gameMode === '2vs2' ? 'Selecciona jugadores PARES para formar equipos' : 'Selecciona los participantes'}
                </p>
                
                <div className="flex justify-center gap-4 mb-8">
                    <button onClick={()=>setGameMode('1vs1')} className={`px-6 py-2 rounded-full font-black text-sm uppercase tracking-wider transition ${gameMode==='1vs1'?'bg-black text-white':'bg-gray-100 text-gray-400'}`}>1 vs 1</button>
                    <button onClick={()=>setGameMode('2vs2')} className={`px-6 py-2 rounded-full font-black text-sm uppercase tracking-wider transition ${gameMode==='2vs2'?'bg-black text-white':'bg-gray-100 text-gray-400'}`}>2 vs 2</button>
                </div>

                {/* BOTÓN MÁGICO: AÑADIR CPU */}
                <button onClick={addCpu} className="mb-6 flex items-center gap-2 mx-auto bg-purple-100 text-purple-700 px-6 py-3 rounded-xl font-bold text-xs uppercase hover:bg-purple-200 transition">
                    <Bot size={18}/> {gameMode === '2vs2' ? 'Añadir CPU (Relleno)' : 'Añadir CPU'}
                </button>

                {/* LISTA DE JUGADORES */}
                {users.length > 0 || selectedPlayers.some(p => p.startsWith('CPU')) ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10 text-left">
                        {users.map((u: any) => (
                            <button key={u.id} onClick={()=>togglePlayerSelection(u.id)} className={`p-4 rounded-xl border-2 text-sm font-bold truncate transition flex items-center justify-between ${selectedPlayers.includes(u.id)?'bg-blue-600 border-blue-600 text-white shadow-md transform scale-105':'bg-white text-gray-600 border-gray-100 hover:border-gray-300'}`}>
                                {u.id}
                                {selectedPlayers.includes(u.id) && <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>}
                            </button>
                        ))}
                        {/* MOSTRAR CPUs SELECCIONADAS */}
                        {selectedPlayers.filter(p => p.startsWith('CPU')).map(cpu => (
                            <button key={cpu} onClick={()=>togglePlayerSelection(cpu)} className="p-4 rounded-xl border-2 text-sm font-bold truncate transition flex items-center justify-between bg-purple-600 border-purple-600 text-white shadow-md transform scale-105">
                                {cpu}
                                <Bot size={14}/>
                            </button>
                        ))}
                    </div>
                ) : ( <div className="mb-10 p-6 bg-gray-50 rounded-xl border border-gray-100 text-gray-400 text-sm flex flex-col items-center gap-2"><Users size={32} className="opacity-50"/><p>No hay jugadores registrados.</p></div> )}
                
                <button onClick={handleCrearTorneo} disabled={selectedPlayers.length < 2} className="w-full md:w-auto px-12 bg-black text-white font-black py-4 rounded-2xl shadow-xl hover:bg-gray-900 transition transform hover:scale-[1.02] active:scale-95 text-sm uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed">
                    🚀 COMENZAR {gameMode} ({selectedPlayers.length})
                </button>
            </div>
        ) : (
            // --- MODO CUADRO (VISTA IGUAL QUE ANTES) ---
            <div className="w-full">
                <div className="md:hidden flex flex-col gap-8">
                    <div className="space-y-4"><h3 className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Primera Ronda</h3>{(matches.length===4 ? [0,1] : [0,1,2,3]).map(id => <MatchCard key={id} m={matches[id]} onFinish={finalizarPartido} />)}</div>
                    {matches.length===8 && (<div className="space-y-4"><h3 className="text-xs font-black text-purple-500 uppercase tracking-widest pl-1">Semifinales</h3>{[4,5].map(id => <MatchCard key={id} m={matches[id]} onFinish={finalizarPartido} />)}</div>)}
                    <div className="space-y-4 pt-4 border-t-2 border-dashed border-gray-200"><h3 className="text-xs font-black text-yellow-500 uppercase tracking-widest pl-1 text-center">🏆 Gran Final</h3><MatchCard m={matches[matches.length===4 ? 2 : 6]} onFinish={finalizarPartido} isFinal /><h3 className="text-[10px] font-bold text-orange-400 uppercase tracking-widest text-center mt-2">3er Puesto</h3><div className="scale-95 opacity-80"><MatchCard m={matches[matches.length===4 ? 3 : 7]} onFinish={finalizarPartido} /></div></div>
                </div>
                <div className="hidden md:grid grid-cols-3 gap-12 items-center">
                    <div className="space-y-6"><h3 className="text-center font-bold text-gray-400 text-xs uppercase tracking-widest mb-4">Ronda 1</h3>{(matches.length===4 ? [0,1] : [0,1,2,3]).map(id => <MatchCard key={id} m={matches[id]} onFinish={finalizarPartido} />)}</div>
                    <div className="space-y-6 flex flex-col justify-center">{matches.length===8 && (<><h3 className="text-center font-bold text-purple-500 text-xs uppercase tracking-widest mb-4">Semifinales</h3>{[4,5].map(id => <MatchCard key={id} m={matches[id]} onFinish={finalizarPartido} />)}</>)}</div>
                    <div className="space-y-8 flex flex-col justify-center"><div><h3 className="text-center font-black text-yellow-500 text-sm uppercase tracking-widest mb-4">🏆 Gran Final</h3><MatchCard m={matches[matches.length===4 ? 2 : 6]} onFinish={finalizarPartido} isFinal /></div><div><h3 className="text-center font-bold text-orange-400 text-xs uppercase tracking-widest mb-2">Bronce</h3><MatchCard m={matches[matches.length===4 ? 3 : 7]} onFinish={finalizarPartido} /></div></div>
                </div>
            </div>
        )}
    </div>
  );
}

// ... MatchCard component (sin cambios) ...
// ... (Todo el código anterior de TorneoPage sigue igual)

// SUSTITUYE SOLO ESTE COMPONENTE AL FINAL DEL ARCHIVO
function MatchCard({ m, onFinish, isFinal, label }: { m?: any, onFinish: (id: number, s1: number, s2: number) => void, isFinal?: boolean, label?: string }) {
    const [s1, setS1] = useState(""); const [s2, setS2] = useState("");
    
    if (!m) return <div className="bg-gray-100/50 h-32 rounded-3xl animate-pulse border-2 border-gray-100"></div>;
    const isWaiting = m.p1 === "Esperando..." || m.p2 === "Esperando...";
    
    // Pase directo visualmente mejorado
    if (m.isBye) return <div className="bg-green-50/50 border-2 border-green-100/50 p-4 rounded-3xl flex flex-col items-center justify-center text-center h-full opacity-60 backdrop-blur-sm"><span className="text-green-700 font-black text-[10px] uppercase mb-1 tracking-widest">Pase Directo</span><p className="font-black text-xl text-green-900">{m.winner}</p></div>;

    // LÓGICA VISUAL:
    // - Si ya hay ganador: Gris y apagado.
    // - Si es la final: Borde dorado intenso y sombra.
    // - Si está activo (jugándose): Borde animado de colores (NUEVO!).
    // - Si está esperando: Borde gris suave.
    let cardStyle = "border-2 border-gray-100 shadow-sm"; // Por defecto
    if (m.winner) {
        cardStyle = "border-2 border-gray-100 opacity-50 grayscale bg-gray-50/50 shadow-none";
    } else if (isFinal && !isWaiting) {
        cardStyle = "border-4 border-yellow-400 shadow-2xl shadow-yellow-200/50 scale-[1.02]";
    } else if (!isWaiting) {
        // APLICAMOS EL BORDE ANIMADO AQUÍ
        cardStyle = "animated-border shadow-xl scale-[1.01]";
    }

    return (
        <div className={`relative bg-white p-6 rounded-3xl overflow-hidden transition-all duration-500 ${cardStyle}`}>
            {label && <div className="absolute top-0 right-0 bg-black text-white text-[9px] font-bold px-4 py-1.5 rounded-bl-2xl uppercase tracking-wider shadow-sm">{label}</div>}
            
            {/* Jugador 1 */}
            <div className="flex justify-between items-center mb-4 pt-2">
                <div className="overflow-hidden pr-2">
                    <p className={`font-black text-lg truncate transition-colors ${m.winner===m.p1 ? 'text-green-600' : 'text-black'}`}>{m.p1}</p>
                    <div className="flex gap-2 text-[10px] font-bold uppercase tracking-wide opacity-80"><span className="text-gray-500 truncate max-w-[100px]">{m.p1Club || 'Club'}</span><span className="text-blue-600 truncate max-w-[100px]">{m.p1Team}</span></div>
                </div>
                {m.winner ? <span className="font-mono font-black text-3xl text-black">{m.score1}</span> : <input type="number" className="w-14 h-14 bg-gray-50 text-center rounded-2xl font-black text-xl outline-none focus:ring-2 focus:ring-black transition border-2 border-gray-100 text-black shadow-inner" value={s1} onChange={e=>setS1(e.target.value)} disabled={isWaiting} placeholder="-" />}
            </div>
            
            {/* Separador VS */}
            <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mb-4 flex items-center justify-center">
                <span className="bg-white px-3 text-xs text-gray-400 font-black tracking-widest rounded-full border border-gray-100 italic">VS</span>
            </div>
            
            {/* Jugador 2 */}
            <div className="flex justify-between items-center mb-6">
                <div className="overflow-hidden pr-2">
                    <p className={`font-black text-lg truncate transition-colors ${m.winner===m.p2 ? 'text-green-600' : 'text-black'}`}>{m.p2}</p>
                    <div className="flex gap-2 text-[10px] font-bold uppercase tracking-wide opacity-80"><span className="text-gray-500 truncate max-w-[100px]">{m.p2Club || 'Club'}</span><span className="text-blue-600 truncate max-w-[100px]">{m.p2Team}</span></div>
                </div>
                {m.winner ? <span className="font-mono font-black text-3xl text-black">{m.score2}</span> : <input type="number" className="w-14 h-14 bg-gray-50 text-center rounded-2xl font-black text-xl outline-none focus:ring-2 focus:ring-black transition border-2 border-gray-100 text-black shadow-inner" value={s2} onChange={e=>setS2(e.target.value)} disabled={isWaiting} placeholder="-" />}
            </div>

            {/* Botón de Finalizar (Ahora es negro mate más elegante) */}
            {!m.winner && !isWaiting && (
                <button onClick={()=>s1&&s2&&onFinish(m.id, +s1, +s2)} className="w-full bg-black hover:bg-gray-900 text-white text-xs font-black py-4 rounded-2xl transition-all shadow-md hover:shadow-xl active:scale-95 uppercase tracking-widest flex justify-center items-center gap-2 group">
                    Finalizar Partido <span className="group-hover:translate-x-1 transition-transform">→</span>
                </button>
            )}
        </div>
    );
}