"use client";
import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { 
  doc, onSnapshot, setDoc, collection, query, orderBy, increment, 
  addDoc, serverTimestamp, getDocs, writeBatch, deleteDoc 
} from "firebase/firestore";
import confetti from "canvas-confetti";

// --- TIPOS ---
type Match = { 
  id: number; 
  p1: string; p1Team?: string | null; p1Club?: string | null;
  p2: string; p2Team?: string | null; p2Club?: string | null;
  score1?: number; score2?: number; 
  winner?: string; 
  round: 'Q' | 'S' | 'F' | '3rd'; // Añadido 3rd place
  isBye?: boolean;
};

type UserProfile = { id: string; clubName: string; balance: number; };
type Bet = { id: string; matchId: number; bettor: string; chosenWinner: string; amount: number; status: 'pending' | 'won' | 'lost'; };
type HistoryItem = { winner: string; winnerTeam?: string; date: any; type: string };
type Tab = 'perfiles' | 'fifa' | 'apuestas' | 'pachanga' | 'castigos';

const BYE_NAME = "Pase Directo ➡️";
const STARTING_BALANCE = 1000;

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('perfiles');
  
  // DATOS
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [fifaMatches, setFifaMatches] = useState<Match[]>([]);
  const [activeBets, setActiveBets] = useState<Bet[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // ESTADO JUEGO
  const [gameMode, setGameMode] = useState<'1vs1' | '2vs2'>('1vs1');
  const [newName, setNewName] = useState("");
  const [newClub, setNewClub] = useState("");
  const [betAmount, setBetAmount] = useState<number>(100);
  const [betTarget, setBetTarget] = useState<string>("");
  const [bettorName, setBettorName] = useState<string>("");
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);

  // EXTRA
  const [mayorPaliza, setMayorPaliza] = useState<{winner: string, loser: string, diff: number, result: string} | null>(null);
  const [resultadoRuleta, setResultadoRuleta] = useState<string>("☠️ Esperando víctima...");
  const [excusa, setExcusa] = useState<string | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [showDJ, setShowDJ] = useState(false);
  const [pachangaInput, setPachangaInput] = useState("");
  const [equipoA, setEquipoA] = useState<string[]>([]);
  const [equipoB, setEquipoB] = useState<string[]>([]);

  // CRONÓMETRO
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // LISTAS
  const TEAMS_REAL = ["Man. City 🔵", "Real Madrid 👑", "Bayern 🔴", "Liverpool 🔴", "Arsenal 🔴", "Inter ⚫🔵", "PSG 🗼", "Barça 🔵🔴", "Atleti 🔴⚪", "Leverkusen ⚫🔴", "Milan ⚫🔴", "Juve ⚫⚪", "Dortmund 🟡⚫", "Chelsea 🔵", "Napoli 🔵", "Spurs ⚪", "Villa 🦁", "Newcastle ⚫⚪"];
  const TEAMS_FUNNY = ["Aston Birra", "Nottingham Prisa", "Inter de Mitente", "Vodka Juniors", "Rayo Vayacaño", "Coca Juniors", "Maccabi de Levantar", "Steaua del Grifo", "Schalke Te Meto", "Abuelos FC", "Patético de Madrid", "Bajern de Munich", "Real Suciedad", "Olimpique de Marsopa", "West Jamón", "Levante en Barra", "Borussia de la Birra", "Peshownal", "Estrella Coja", "Fenerbache el Vaso"];
  const EXCUSAS = ["Mando roto", "Lag", "Handicap", "Sol en la cara", "Probando tácticas", "Árbitro comprado", "Jugador bugueado", "Dedos fríos", "5 defensas", "Portero manco"];
  const LISTA_SOFT = ["10 Flexiones", "Audio cantando", "Baila 30s", "Silencio 1 ronda", "Comentarista", "Enseña última foto", "Sirve bebida"];
  const LISTA_CHUPITOS = ["1 Chupito", "2 Chupitos", "Cascada", "Elige compañero", "Te libras", "CHUPITO MORTAL"];

  // --- LISTENERS ---
  useEffect(() => {
    const unsubSala = onSnapshot(doc(db, "sala", "principal"), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setFifaMatches(Array.isArray(data.fifaMatches) ? data.fifaMatches : []);
        if (data.equipoA) setEquipoA(data.equipoA);
        if (data.equipoB) setEquipoB(data.equipoB);
        if (data.ultimoCastigo) setResultadoRuleta(data.ultimoCastigo);
        if (data.fifaMatches) calcularPaliza(data.fifaMatches);
      }
    });
    const unsubUsers = onSnapshot(query(collection(db, "users"), orderBy("balance", "desc")), (snap) => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })) as UserProfile[]));
    const unsubBets = onSnapshot(query(collection(db, "bets")), (snap) => setActiveBets(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Bet[]));
    const unsubHist = onSnapshot(query(collection(db, "history"), orderBy("date", "desc")), (snap) => setHistory(snap.docs.map(d => d.data()) as HistoryItem[]));
    return () => { unsubSala(); unsubUsers(); unsubBets(); unsubHist(); };
  }, []);

  // --- LOGICA USUARIOS ---
  const crearPerfil = async () => {
      if (!newName || !newClub) return alert("Pon nombre y club.");
      await setDoc(doc(db, "users", newName), { clubName: newClub, balance: STARTING_BALANCE });
      setNewName(""); setNewClub("");
  };
  const borrarPerfil = async (id: string) => { if(confirm("¿Borrar a " + id + "?")) await deleteDoc(doc(db, "users", id)); };
  const togglePlayerSelection = (name: string) => {
      if (selectedPlayers.includes(name)) setSelectedPlayers(selectedPlayers.filter(p => p !== name));
      else {
          if (selectedPlayers.length >= 16) return alert("Máximo 16 jugadores."); // Aumentado para 2vs2
          setSelectedPlayers([...selectedPlayers, name]);
      }
  };

  // --- LOGICA TORNEO (1vs1 y 2vs2 + 3rd PLACE) ---
  const handleCrearTorneo = async () => {
      // Validaciones
      let entities: { name: string, club: string }[] = [];
      
      if (gameMode === '1vs1') {
          if (selectedPlayers.length < 2) return alert("Mínimo 2 jugadores.");
          // Mapeamos a objetos con su club real
          entities = selectedPlayers.map(p => {
              const u = users.find(user => user.id === p);
              return { name: p, club: u ? u.clubName : "Sin Club" };
          });
      } else {
          // MODO 2vs2
          if (selectedPlayers.length < 4) return alert("Para 2vs2 necesitáis al menos 4 personas.");
          if (selectedPlayers.length % 2 !== 0) return alert("Para 2vs2 necesitáis ser pares.");
          
          const shuffledP = [...selectedPlayers].sort(() => Math.random() - 0.5);
          const shuffledClubs = [...TEAMS_FUNNY].sort(() => Math.random() - 0.5); // Clubes random para parejas
          
          for (let i = 0; i < shuffledP.length; i += 2) {
              entities.push({
                  name: `${shuffledP[i]} & ${shuffledP[i+1]}`,
                  club: shuffledClubs[i/2] || "Pareja Random"
              });
          }
      }

      // Rellenar con BYEs hasta potencia de 2 (4 u 8 equipos/parejas)
      let targetSize = entities.length <= 4 ? 4 : 8;
      // Si son más de 8 entidades, cortamos o avisamos (por ahora limitamos a 8 slots)
      if (entities.length > 8) return alert("Demasiados equipos/parejas para el cuadro de 8.");

      while (entities.length < targetSize) entities.push({ name: BYE_NAME, club: "" });

      // Barajar las entidades finales (Equipos o Parejas)
      const shuffledEntities = [...entities].sort(() => Math.random() - 0.5);
      const shuffledTeams = [...TEAMS_REAL].sort(() => Math.random() - 0.5);

      const getMatchData = (idx: number) => {
          const ent = shuffledEntities[idx];
          const isBye = ent.name === BYE_NAME;
          return {
              name: ent.name,
              team: isBye ? null : shuffledTeams[idx],
              club: isBye ? null : ent.club
          };
      };

      let matches: Match[] = [];

      // Estructura de Partidos
      if (targetSize === 4) {
          // SEMIS
          matches = [
              { id: 0, p1: getMatchData(0).name, p1Team: getMatchData(0).team, p1Club: getMatchData(0).club, p2: getMatchData(1).name, p2Team: getMatchData(1).team, p2Club: getMatchData(1).club, round: 'S' },
              { id: 1, p1: getMatchData(2).name, p1Team: getMatchData(2).team, p1Club: getMatchData(2).club, p2: getMatchData(3).name, p2Team: getMatchData(3).team, p2Club: getMatchData(3).club, round: 'S' },
              // FINAL
              { id: 2, p1: "Esperando...", p2: "Esperando...", round: 'F' },
              // 3rd PLACE (ID 3)
              { id: 3, p1: "Esperando...", p2: "Esperando...", round: '3rd' }
          ];
      } else {
          // CUARTOS
          matches = [
              { id: 0, p1: getMatchData(0).name, p1Team: getMatchData(0).team, p1Club: getMatchData(0).club, p2: getMatchData(1).name, p2Team: getMatchData(1).team, p2Club: getMatchData(1).club, round: 'Q' },
              { id: 1, p1: getMatchData(2).name, p1Team: getMatchData(2).team, p1Club: getMatchData(2).club, p2: getMatchData(3).name, p2Team: getMatchData(3).team, p2Club: getMatchData(3).club, round: 'Q' },
              { id: 2, p1: getMatchData(4).name, p1Team: getMatchData(4).team, p1Club: getMatchData(4).club, p2: getMatchData(5).name, p2Team: getMatchData(5).team, p2Club: getMatchData(5).club, round: 'Q' },
              { id: 3, p1: getMatchData(6).name, p1Team: getMatchData(6).team, p1Club: getMatchData(6).club, p2: getMatchData(7).name, p2Team: getMatchData(7).team, p2Club: getMatchData(7).club, round: 'Q' },
              // SEMIS
              { id: 4, p1: "Esperando...", p2: "Esperando...", round: 'S' },
              { id: 5, p1: "Esperando...", p2: "Esperando...", round: 'S' },
              // FINAL
              { id: 6, p1: "Esperando...", p2: "Esperando...", round: 'F' },
              // 3rd PLACE (ID 7)
              { id: 7, p1: "Esperando...", p2: "Esperando...", round: '3rd' }
          ];
      }

      // Propagar BYEs iniciales
      // NOTA: Si hay un BYE en primera ronda, el ganador pasa a siguiente ronda.
      // El perdedor (BYE) NO va al 3er puesto porque no existe.
      const propagate = (targetIdx: number, slot: 'p1' | 'p2', source: Match) => {
        const winnerKey = source.winner === source.p1 ? 'p1' : 'p2';
        matches[targetIdx][slot] = source.winner!;
        matches[targetIdx][slot === 'p1' ? 'p1Team' : 'p2Team'] = source[winnerKey === 'p1' ? 'p1Team' : 'p2Team'] || null;
        matches[targetIdx][slot === 'p1' ? 'p1Club' : 'p2Club'] = source[winnerKey === 'p1' ? 'p1Club' : 'p2Club'] || null;
      };

      matches.forEach(m => {
          if (m.p2 === BYE_NAME) { m.winner = m.p1; m.isBye = true; } 
          else if (m.p1 === BYE_NAME) { m.winner = m.p2; m.isBye = true; }
      });

      if (targetSize === 4) {
          if (matches[0].winner) propagate(2, 'p1', matches[0]); // A Final
          if (matches[1].winner) propagate(2, 'p2', matches[1]); // A Final
          // En torneo de 4, si hay Bye en semis, no hay perdedor real para el 3er puesto, 
          // así que simplificamos: El 3er puesto se queda "Esperando" hasta que se juegue un partido real.
      } else {
          if (matches[0].winner) propagate(4, 'p1', matches[0]);
          if (matches[1].winner) propagate(4, 'p2', matches[1]);
          if (matches[2].winner) propagate(5, 'p1', matches[2]);
          if (matches[3].winner) propagate(5, 'p2', matches[3]);
      }

      // Guardar
      const cleanMatches = matches.map(m => JSON.parse(JSON.stringify(m, (k, v) => v === undefined ? null : v)));
      await setDoc(doc(db, "sala", "principal"), { fifaMatches: cleanMatches }, { merge: true });
      setActiveTab('fifa');
  };

  const realizarApuesta = async () => {
      if (!bettorName || !selectedMatchId || !betTarget || betAmount <= 0) return alert("Rellena todo.");
      const user = users.find(u => u.id === bettorName);
      if (!user || user.balance < betAmount) return alert("Saldo insuficiente.");
      await setDoc(doc(db, "users", bettorName), { balance: increment(-betAmount) }, { merge: true });
      await addDoc(collection(db, "bets"), { matchId: selectedMatchId, bettor: bettorName, chosenWinner: betTarget, amount: betAmount, status: 'pending' });
      alert("💰 Apuesta realizada.");
  };

  const resolverApuestas = async (matchId: number, winner: string) => {
      const pendingBets = activeBets.filter(b => b.matchId === matchId && b.status === 'pending');
      const batch = writeBatch(db);
      pendingBets.forEach(bet => {
          const betRef = doc(db, "bets", bet.id);
          if (bet.chosenWinner === winner) {
              batch.update(doc(db, "users", bet.bettor), { balance: increment(bet.amount * 2) });
              batch.update(betRef, { status: 'won' });
          } else batch.update(betRef, { status: 'lost' });
      });
      await batch.commit();
  };

  const finalizarPartido = async (matchId: number, s1: number, s2: number) => {
    if (s1 === s2) return alert("❌ Empate no vale.");
    const currentMatch = fifaMatches.find(m => m && m.id === matchId);
    if (!currentMatch) return;
    
    const isP1Winner = s1 > s2;
    const winner = isP1Winner ? currentMatch.p1 : currentMatch.p2;
    const loser = isP1Winner ? currentMatch.p2 : currentMatch.p1;
    
    // Datos del ganador (para avanzar a Final)
    const wTeam = isP1Winner ? currentMatch.p1Team : currentMatch.p2Team;
    const wClub = isP1Winner ? currentMatch.p1Club : currentMatch.p2Club;
    // Datos del perdedor (para avanzar a 3er Puesto)
    const lTeam = isP1Winner ? currentMatch.p2Team : currentMatch.p1Team;
    const lClub = isP1Winner ? currentMatch.p2Club : currentMatch.p1Club;

    try {
      await resolverApuestas(matchId, winner);

      // Si es 1vs1, sumamos puntos. Si es 2vs2 (nombres combinados), NO sumamos al ranking individual (muy complejo de trackear)
      if (gameMode === '1vs1' && !currentMatch.isBye && winner !== "Esperando...") {
        const playerRef = doc(db, "ranking", winner);
        await setDoc(playerRef, { puntos: increment(3), victorias: increment(1) }, { merge: true });
      }
      
      let nuevosPartidos = [...fifaMatches];
      nuevosPartidos = nuevosPartidos.map(m => m.id === matchId ? { ...m, score1: s1, score2: s2, winner: winner } : m);

      // FUNCIONES DE AVANCE
      const sendTo = (targetId: number, slot: 'p1' | 'p2', name: string, team: any, club: any) => {
          if (!nuevosPartidos[targetId]) return;
          nuevosPartidos[targetId][slot] = name;
          nuevosPartidos[targetId][slot === 'p1' ? 'p1Team' : 'p2Team'] = team;
          nuevosPartidos[targetId][slot === 'p1' ? 'p1Club' : 'p2Club'] = club;
      };

      const isSmall = fifaMatches.length === 4; // 2 Semis + Final + 3rd
      const isBig = fifaMatches.length === 8; // 4 Q + 2 S + Final + 3rd

      if (isSmall) {
          // Semis (0, 1) -> Final (2) y 3er (3)
          if (matchId === 0) { sendTo(2, 'p1', winner, wTeam, wClub); sendTo(3, 'p1', loser, lTeam, lClub); }
          if (matchId === 1) { sendTo(2, 'p2', winner, wTeam, wClub); sendTo(3, 'p2', loser, lTeam, lClub); }
      } else if (isBig) {
          // Cuartos -> Semis
          if (matchId === 0) sendTo(4, 'p1', winner, wTeam, wClub);
          if (matchId === 1) sendTo(4, 'p2', winner, wTeam, wClub);
          if (matchId === 2) sendTo(5, 'p1', winner, wTeam, wClub);
          if (matchId === 3) sendTo(5, 'p2', winner, wTeam, wClub);
          // Semis (4, 5) -> Final (6) y 3er (7)
          if (matchId === 4) { sendTo(6, 'p1', winner, wTeam, wClub); sendTo(7, 'p1', loser, lTeam, lClub); }
          if (matchId === 5) { sendTo(6, 'p2', winner, wTeam, wClub); sendTo(7, 'p2', loser, lTeam, lClub); }
      }

      await setDoc(doc(db, "sala", "principal"), { fifaMatches: nuevosPartidos }, { merge: true });
      
      // Si es la Gran Final (ID 2 o 6)
      const finalId = isSmall ? 2 : 6;
      if (matchId === finalId) {
          confetti({ particleCount: 500, spread: 100 });
          await addDoc(collection(db, "history"), { winner, winnerTeam: wTeam || "-", date: serverTimestamp(), type: `${gameMode}` });
      } else {
          lanzarFiesta();
      }
    } catch (e) { console.error(e); }
  };

  // HELPERS
  const calcularPaliza = (matches: Match[]) => {
      let maxDiff = 0; let palizaData = null;
      matches.forEach(m => {
          if (m && !m.isBye && m.winner && m.score1 !== undefined && m.score2 !== undefined) {
              const diff = Math.abs(m.score1 - m.score2);
              if (diff >= 3 && diff > maxDiff) {
                  maxDiff = diff;
                  const isP1Winner = m.score1 > m.score2;
                  palizaData = { winner: isP1Winner ? m.p1 : m.p2, loser: isP1Winner ? m.p2 : m.p1, diff: diff, result: `${m.score1}-${m.score2}` };
              }
          }
      });
      setMayorPaliza(palizaData);
  };
  const girarRuleta = async (tipo: 'soft' | 'chupito') => { setIsSpinning(true); const l = tipo==='soft'?LISTA_SOFT:LISTA_CHUPITOS; let i=0; const int=setInterval(()=>{setResultadoRuleta(l[i%l.length]);i++},80); setTimeout(async()=>{clearInterval(int);const f=l[Math.floor(Math.random()*l.length)];setResultadoRuleta(f);setIsSpinning(false);await setDoc(doc(db,"sala","principal"),{ultimoCastigo:f},{merge:true});if(tipo==='chupito')confetti({particleCount:50,colors:['#ff0000']})},2000); };
  const handleSorteoPachanga = () => { const n = pachangaInput.split(/[\n,]+/).map(n=>n.trim()).filter(n=>n); if(n.length<2)return alert("Mínimo 2"); const s=[...n].sort(()=>Math.random()-0.5); const m=Math.ceil(s.length/2); setDoc(doc(db,"sala","principal"),{equipoA:s.slice(0,m),equipoB:s.slice(m)},{merge:true}); };
  const lanzarFiesta = () => { confetti({particleCount:150}); const a=new Audio("/gol.mp3"); a.volume=0.5; a.play().catch(()=>{}); };
  const startTimer = (s: number) => { setTimeLeft(s); setTimerActive(true); };
  const generarExcusa = () => setExcusa(EXCUSAS[Math.floor(Math.random() * EXCUSAS.length)]);
  const limpiarPizarra = async () => { await writeBatch(db).set(doc(db,"sala","principal"),{equipoA:[],equipoB:[],fifaMatches:[],ultimoCastigo:"..."}).commit(); };
  const borrarTodaTemporada = async () => { if(!confirm("⚠️ ¿Borrar TODO?")) return; const b=writeBatch(db); (await getDocs(query(collection(db,"ranking")))).forEach(d=>b.delete(d.ref)); (await getDocs(query(collection(db,"history")))).forEach(d=>b.delete(d.ref)); b.set(doc(db,"sala","principal"),{equipoA:[],equipoB:[],fifaMatches:[],ultimoCastigo:"..."}); await b.commit(); };

  useEffect(() => { if(timerActive && timeLeft>0){timerRef.current=setTimeout(()=>setTimeLeft(timeLeft-1),1000)}else if(timeLeft===0&&timerActive){setTimerActive(false);new Audio("https://www.myinstants.com/media/sounds/ding-sound-effect_2.mp3").play().catch(()=>{})}; return()=>clearTimeout(timerRef.current!)},[timeLeft,timerActive]);

  return (
    <main className="min-h-screen bg-neutral-950 text-white font-sans pb-32 overflow-x-hidden select-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-900 via-neutral-950 to-black">
      <header className="bg-neutral-900/80 backdrop-blur-md sticky top-0 z-50 border-b border-white/10 p-4 shadow-lg">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex justify-between items-center w-full">
                <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 uppercase tracking-tighter" onClick={()=>setActiveTab('perfiles')}>Proyecto Teletubies</h1>
                <div className="flex gap-2"><button onClick={limpiarPizarra} className="bg-neutral-800 border-gray-600 border px-3 py-2 rounded-lg">🔄</button><button onClick={borrarTodaTemporada} className="bg-red-950/30 border-red-900/50 border text-red-500 px-3 py-2 rounded-lg">⛔</button></div>
            </div>
            <nav className="flex bg-black/60 p-1 rounded-2xl gap-1 overflow-x-auto w-full md:w-auto border border-white/5">{['perfiles','fifa','apuestas','pachanga','castigos'].map(tab=><button key={tab} onClick={()=>setActiveTab(tab as Tab)} className={`px-4 py-2 rounded-xl font-bold text-xs uppercase ${activeTab===tab?'bg-white text-black':'text-gray-400'}`}>{tab}</button>)}</nav>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 md:p-8">
        {activeTab === 'perfiles' && (
            <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-neutral-900/40 p-6 rounded-3xl border border-blue-500/20"><h2 className="text-xl font-bold text-blue-400 mb-4">Nuevo Fichaje</h2><div className="flex flex-col gap-3"><input className="bg-black/50 p-3 rounded-xl border border-gray-700" placeholder="Nombre" value={newName} onChange={e=>setNewName(e.target.value)} /><input className="bg-black/50 p-3 rounded-xl border border-gray-700" placeholder="Club" value={newClub} onChange={e=>setNewClub(e.target.value)} /><button onClick={crearPerfil} className="bg-blue-600 p-3 rounded-xl font-bold">Crear</button></div></div>
                <div className="bg-neutral-900/40 p-6 rounded-3xl border border-purple-500/20"><h2 className="text-xl font-bold text-purple-400 mb-4">Plantilla</h2><div className="space-y-2 max-h-[400px] overflow-y-auto">{users.map(u=><div key={u.id} className="flex justify-between items-center bg-black/40 p-3 rounded-xl border border-white/5"><div><p className="font-bold">{u.id}</p><p className="text-xs text-gray-400">{u.clubName}</p></div><div className="flex items-center gap-3"><span className="text-yellow-400 font-mono font-bold">{u.balance} 💰</span><button onClick={()=>borrarPerfil(u.id)} className="text-red-500">🗑️</button></div></div>)}</div></div>
            </div>
        )}

        {activeTab === 'fifa' && (
            <section>
                {fifaMatches.length === 0 && (
                    <div className="bg-neutral-900/40 p-6 rounded-3xl border border-green-500/20 mb-8">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-green-400">Configuración</h2>
                            <div className="bg-black/40 p-1 rounded-lg flex gap-1">
                                <button onClick={()=>setGameMode('1vs1')} className={`px-3 py-1 rounded text-xs font-bold ${gameMode==='1vs1'?'bg-green-600 text-white':'text-gray-400'}`}>1 vs 1</button>
                                <button onClick={()=>setGameMode('2vs2')} className={`px-3 py-1 rounded text-xs font-bold ${gameMode==='2vs2'?'bg-green-600 text-white':'text-gray-400'}`}>2 vs 2</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">{users.map(u=><button key={u.id} onClick={()=>togglePlayerSelection(u.id)} className={`p-3 rounded-xl border text-sm font-bold transition ${selectedPlayers.includes(u.id)?'bg-green-600 border-green-400 text-white':'bg-black/40 border-gray-700 text-gray-400'}`}>{u.id}</button>)}</div>
                        <button onClick={handleCrearTorneo} className="w-full bg-green-600 text-white font-black py-4 rounded-xl shadow-lg">🏆 CREAR TORNEO {gameMode} ({selectedPlayers.length})</button>
                    </div>
                )}

                {fifaMatches.length > 0 && (
                    <div className="w-full">
                        {/* MOBILE */}
                        <div className="md:hidden flex flex-col gap-6">
                            <h3 className="text-center font-bold text-gray-500">Ronda 1</h3>
                            {(fifaMatches.length===4 ? [0,1] : [0,1,2,3]).map(id => <MatchCard key={id} m={fifaMatches[id]} onFinish={finalizarPartido} />)}
                            
                            {fifaMatches.length===8 && (<><h3 className="text-center font-bold text-gray-500 mt-4">Semis</h3>{[4,5].map(id => <MatchCard key={id} m={fifaMatches[id]} onFinish={finalizarPartido} />)}</>)}
                            
                            <h3 className="text-center font-bold text-yellow-500 mt-4">FINAL</h3>
                            <MatchCard m={fifaMatches[fifaMatches.length===4 ? 2 : 6]} onFinish={finalizarPartido} isFinal />
                            
                            <h3 className="text-center font-bold text-orange-400 mt-4 text-sm">3º y 4º Puesto</h3>
                            <MatchCard m={fifaMatches[fifaMatches.length===4 ? 3 : 7]} onFinish={finalizarPartido} />
                        </div>
                        
                        {/* DESKTOP */}
                        <div className="hidden md:block">
                            <div className="grid grid-cols-3 gap-8">
                                <div className="flex flex-col gap-4">
                                    <h3 className="text-center font-bold">Ronda 1</h3>
                                    {(fifaMatches.length===4 ? [0,1] : [0,1,2,3]).map(id => <MatchCard key={id} m={fifaMatches[id]} onFinish={finalizarPartido} />)}
                                </div>
                                <div className="flex flex-col justify-center gap-4">
                                    {fifaMatches.length===8 && (<><h3 className="text-center font-bold">Semis</h3>{[4,5].map(id => <MatchCard key={id} m={fifaMatches[id]} onFinish={finalizarPartido} />)}</>)}
                                </div>
                                <div className="flex flex-col justify-center gap-8">
                                    <div><h3 className="text-center font-bold text-yellow-500 mb-2">FINAL</h3><MatchCard m={fifaMatches[fifaMatches.length===4 ? 2 : 6]} onFinish={finalizarPartido} isFinal /></div>
                                    <div><h3 className="text-center font-bold text-orange-400 mb-2 text-xs">3º Puesto</h3><MatchCard m={fifaMatches[fifaMatches.length===4 ? 3 : 7]} onFinish={finalizarPartido} /></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </section>
        )}

        {/* --- APUESTAS --- */}
        {activeTab === 'apuestas' && (
            <div className="max-w-2xl mx-auto space-y-8">
                <div className="bg-black/60 border border-yellow-500/30 p-6 rounded-3xl">
                    <h2 className="text-xl font-bold text-yellow-400 mb-4">🎰 Casa de Apuestas</h2>
                    {fifaMatches.length > 0 ? (
                        <div className="flex flex-col gap-4">
                            <select className="bg-neutral-800 p-3 rounded-xl border border-gray-600" value={bettorName} onChange={e=>setBettorName(e.target.value)}><option value="">👤 ¿Quién eres?</option>{users.map(u => <option key={u.id} value={u.id}>{u.id} ({u.balance} 💰)</option>)}</select>
                            <select className="bg-neutral-800 p-3 rounded-xl border border-gray-600" onChange={e=>{const m=fifaMatches.find(x=>x.id===parseInt(e.target.value));setSelectedMatchId(parseInt(e.target.value));setBetTarget("");}}><option value="">⚽ Elige Partido</option>{fifaMatches.filter(m => !m.winner && !m.isBye).map(m => (<option key={m.id} value={m.id}>{m.p1} vs {m.p2}</option>))}</select>
                            {selectedMatchId !== null && (<div className="flex gap-2"><button onClick={()=>setBetTarget(fifaMatches[selectedMatchId!].p1)} className={`flex-1 p-3 rounded-xl border ${betTarget===fifaMatches[selectedMatchId!].p1?'bg-green-600 border-green-400':'bg-neutral-800 border-gray-600'}`}>Gana {fifaMatches[selectedMatchId!].p1}</button><button onClick={()=>setBetTarget(fifaMatches[selectedMatchId!].p2)} className={`flex-1 p-3 rounded-xl border ${betTarget===fifaMatches[selectedMatchId!].p2?'bg-green-600 border-green-400':'bg-neutral-800 border-gray-600'}`}>Gana {fifaMatches[selectedMatchId!].p2}</button></div>)}
                            <div className="flex items-center gap-2"><span className="text-xl">💰</span><input type="number" className="flex-1 bg-neutral-800 p-3 rounded-xl border border-gray-600" value={betAmount} onChange={e=>setBetAmount(parseInt(e.target.value))} /></div>
                            <button onClick={realizarApuesta} className="bg-yellow-600 text-black font-black p-4 rounded-xl shadow-lg mt-2">¡APOSTAR! (x2)</button>
                        </div>
                    ) : (<p className="text-center text-gray-500">No hay partidos activos.</p>)}
                </div>
                <div className="space-y-2"><h3 className="font-bold text-gray-400 uppercase text-xs">Apuestas en Juego</h3>{activeBets.filter(b => b.status === 'pending').map(b => (<div key={b.id} className="bg-neutral-900/50 p-3 rounded-xl border border-white/5 flex justify-between items-center"><div><span className="font-bold text-yellow-400">{b.bettor}</span> apuesta por <span className="font-bold text-blue-400">{b.chosenWinner}</span></div><span className="font-mono">{b.amount} 💰</span></div>))}{activeBets.filter(b => b.status === 'pending').length === 0 && <p className="text-gray-600 text-sm">Sin apuestas activas.</p>}</div>
            </div>
        )}

        {/* --- PACHANGA / CASTIGOS (Igual) --- */}
        {activeTab === 'pachanga' && (<section className="max-w-3xl mx-auto bg-neutral-900/40 border border-green-500/20 rounded-3xl p-6 backdrop-blur-sm"><h2 className="text-xl font-black text-green-400 mb-4">Equipos Random</h2><div className="flex flex-col gap-4 mb-8"><textarea className="w-full h-24 bg-black/40 border border-gray-700 rounded-xl p-4 text-white resize-none" placeholder="Nombres..." value={pachangaInput} onChange={e=>setPachangaInput(e.target.value)}></textarea><button onClick={handleSorteoPachanga} className="w-full bg-green-600 text-white font-black py-3 rounded-xl">MEZCLAR</button></div>{equipoA.length > 0 && (<div className="grid grid-cols-2 gap-4"><div className="bg-red-900/20 p-4 rounded-xl border border-red-500/30"><h3 className="text-red-400 font-bold mb-2">ROJOS</h3>{equipoA.map(p=><div key={p}>{p}</div>)}</div><div className="bg-blue-900/20 p-4 rounded-xl border border-blue-500/30"><h3 className="text-blue-400 font-bold mb-2">AZULES</h3>{equipoB.map(p=><div key={p}>{p}</div>)}</div></div>)}</section>)}
        {activeTab === 'castigos' && (<section className="max-w-md mx-auto text-center mt-4"><div className="bg-black/60 border-2 border-red-600 p-8 rounded-3xl mb-8"><h2 className="text-red-500 font-black uppercase tracking-[0.3em] mb-4">Sentencia</h2><p className={`text-2xl font-black ${isSpinning?'blur-md text-red-500/50':'text-white'}`}>{resultadoRuleta}</p></div><div className="mb-8"><div className="flex justify-center gap-2 mb-2"><button onClick={()=>startTimer(30)} className="bg-gray-800 px-3 py-1 rounded text-xs">30s</button><button onClick={()=>startTimer(60)} className="bg-gray-800 px-3 py-1 rounded text-xs">1min</button><button onClick={()=>setTimeLeft(0)} className="bg-red-900/50 px-3 py-1 rounded text-xs">Parar</button></div><div className="text-4xl font-mono">{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</div></div><div className="mb-4"><button onClick={generarExcusa} className="w-full bg-blue-900/30 text-blue-300 font-bold py-3 rounded-xl mb-2">😭 Excusa</button>{excusa && <div className="text-white italic">"{excusa}"</div>}</div><div className="grid grid-cols-2 gap-4"><button disabled={isSpinning} onClick={()=>girarRuleta('soft')} className="bg-neutral-800 p-4 rounded-xl">🤡 Soft</button><button disabled={isSpinning} onClick={()=>girarRuleta('chupito')} className="bg-red-950 p-4 rounded-xl text-red-200">🥃 Chupito</button></div></section>)}

        {/* --- EXTRAS FLOTANTES --- */}
        {mayorPaliza && (<div className="max-w-xl mx-auto mt-8 bg-gradient-to-r from-pink-950/60 to-red-950/60 border border-pink-500/30 p-4 rounded-2xl flex items-center justify-between animate-pulse"><div className="flex items-center gap-4"><div className="text-4xl">🤕</div><div><h3 className="text-pink-400 font-black text-xs uppercase tracking-widest">Paliza (3+ Goles)</h3><p className="font-bold text-white text-sm"><span className="text-green-400">{mayorPaliza.winner}</span> humilló a <span className="text-red-400">{mayorPaliza.loser}</span></p></div></div><span className="font-black text-2xl text-pink-200">{mayorPaliza.result}</span></div>)}
        <div className="fixed bottom-12 right-4 z-50 flex flex-col items-end gap-2"><button onClick={() => setShowDJ(!showDJ)} className="bg-purple-600 text-white p-3 rounded-full shadow-2xl border-2 border-white/20">{showDJ ? '✖️' : '🔊'}</button>{showDJ && (<div className="bg-black/90 p-4 rounded-2xl border border-purple-500/30 backdrop-blur-md mb-2 flex flex-col gap-2"><SoundBtn label="📢 BOCINA" url="https://www.myinstants.com/media/sounds/mlg-airhorn.mp3" color="bg-red-600" /><SoundBtn label="🎻 VIOLÍN" url="https://www.myinstants.com/media/sounds/sad-violin-airhorn.mp3" color="bg-blue-600" /><SoundBtn label="🦗 GRILLOS" url="https://www.myinstants.com/media/sounds/cricket_1.mp3" color="bg-green-600" /><SoundBtn label="👏 APLAUSO" url="https://www.myinstants.com/media/sounds/aplausos_1.mp3" color="bg-yellow-600" /><SoundBtn label="😡 BUUU" url="https://www.myinstants.com/media/sounds/boo.mp3" color="bg-gray-600" /><SoundBtn label="🐐 SIUUU" url="https://www.myinstants.com/media/sounds/siu.mp3" color="bg-neutral-800" /></div>)}</div>
      </div>
    </main>
  );
}

function SoundBtn({ label, url, color }: { label: string, url: string, color: string }) {
    const play = () => { const audio = new Audio(url); audio.play().catch(e => console.log("Error audio:", e)); };
    return (<button onClick={play} className={`${color} hover:brightness-110 text-white text-[10px] font-bold py-2 px-3 rounded shadow active:scale-95 whitespace-nowrap`}>{label}</button>);
}

function MatchCard({ m, onFinish, isFinal }: { m?: Match, onFinish: (id: number, s1: number, s2: number) => void, isFinal?: boolean }) {
    const [s1, setS1] = useState("");
    const [s2, setS2] = useState("");
    if (!m) return <div className="bg-gray-900/50 p-2 rounded h-16 w-full animate-pulse"></div>;
    const isWaiting = m.p1 === "Esperando..." || m.p2 === "Esperando...";
    if (m.isBye) return <div className="bg-neutral-900/30 p-2 rounded border border-white/5 text-center"><p className="text-green-500 font-bold text-xs">✅ {m.winner}</p><p className="text-[9px] text-gray-500">Pase Directo</p></div>;

    return (
        <div className={`p-2 rounded-xl border border-white/10 ${m.winner ? 'bg-blue-900/20' : 'bg-neutral-900/80'} relative`}>
            {m.round === '3rd' && <div className="absolute -top-2 right-2 bg-orange-700 text-[8px] px-2 rounded font-bold border border-orange-500">3er PUESTO</div>}
            {m.winner ? (
                <div className="flex justify-between items-center gap-1">
                    <div className="w-1/3 text-right overflow-hidden"><span className={`text-xs font-bold block truncate ${m.winner===m.p1?'text-green-400':'text-gray-500 line-through'}`}>{m.p1}</span><span className="text-[8px] text-gray-400 block truncate">{m.p1Team}</span></div>
                    <div className="bg-black/60 px-2 py-1 rounded text-xs font-bold">{m.score1}-{m.score2}</div>
                    <div className="w-1/3 text-left overflow-hidden"><span className={`text-xs font-bold block truncate ${m.winner===m.p2?'text-green-400':'text-gray-500 line-through'}`}>{m.p2}</span><span className="text-[8px] text-gray-400 block truncate">{m.p2Team}</span></div>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center gap-1">
                        <div className="w-20 text-right overflow-hidden"><span className="text-xs font-bold block truncate text-gray-300">{m.p1}</span><span className="text-[8px] text-blue-400 block truncate">{m.p1Team}</span><span className="text-[8px] text-yellow-500 block truncate">{m.p1Club}</span></div>
                        <input type="number" className="w-6 h-6 bg-black/50 text-center rounded text-xs" value={s1} onChange={e => setS1(e.target.value)} disabled={isWaiting}/>
                        <span className="text-[8px] text-gray-600">VS</span>
                        <input type="number" className="w-6 h-6 bg-black/50 text-center rounded text-xs" value={s2} onChange={e => setS2(e.target.value)} disabled={isWaiting}/>
                        <div className="w-20 text-left overflow-hidden"><span className="text-xs font-bold block truncate text-gray-300">{m.p2}</span><span className="text-[8px] text-blue-400 block truncate">{m.p2Team}</span><span className="text-[8px] text-yellow-500 block truncate">{m.p2Club}</span></div>
                    </div>
                    {!isWaiting && <button onClick={()=>s1&&s2&&onFinish(m.id, +s1, +s2)} className="w-full bg-blue-600/20 hover:bg-blue-600 text-blue-200 text-[9px] py-1 rounded font-bold">TERMINAR</button>}
                </div>
            )}
        </div>
    );
}