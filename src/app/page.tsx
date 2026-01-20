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
  round: 'Q' | 'S' | 'F'; 
  isBye?: boolean;
};

type UserProfile = {
    id: string; // El nombre es el ID
    clubName: string;
    balance: number; // Dinero para apuestas
};

type Bet = {
    id: string;
    matchId: number;
    bettor: string; // Quién apuesta
    chosenWinner: string; // A quién apuesta
    amount: number;
    status: 'pending' | 'won' | 'lost';
};

type HistoryItem = { winner: string; winnerTeam?: string; date: any; type: string };
type Tab = 'perfiles' | 'fifa' | 'apuestas' | 'pachanga' | 'castigos';

const BYE_NAME = "Pase Directo ➡️";
const STARTING_BALANCE = 1000; // Dinero inicial

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('perfiles');
  
  // DATOS
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [fifaMatches, setFifaMatches] = useState<Match[]>([]);
  const [activeBets, setActiveBets] = useState<Bet[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // FORMULARIOS
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

  // LISTAS FIJAS
  const TEAMS_REAL = ["Man. City 🔵", "Real Madrid 👑", "Bayern 🔴", "Liverpool 🔴", "Arsenal 🔴", "Inter ⚫🔵", "PSG 🗼", "Barça 🔵🔴", "Atleti 🔴⚪", "Leverkusen ⚫🔴", "Milan ⚫🔴", "Juve ⚫⚪", "Dortmund 🟡⚫", "Chelsea 🔵", "Napoli 🔵", "Spurs ⚪", "Villa 🦁", "Newcastle ⚫⚪"];
  const EXCUSAS = ["Mando roto", "Lag", "Handicap", "Sol en la cara", "Probando tácticas", "Árbitro comprado", "Jugador bugueado", "Dedos fríos", "5 defensas", "Portero manco"];
  const LISTA_SOFT = ["10 Flexiones", "Audio cantando", "Baila 30s", "Silencio 1 ronda", "Comentarista", "Enseña última foto", "Sirve bebida"];
  const LISTA_CHUPITOS = ["1 Chupito", "2 Chupitos", "Cascada", "Elige compañero", "Te libras", "CHUPITO MORTAL"];

  // --- LISTENERS ---
  useEffect(() => {
    // Escuchar Sala (Torneo)
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

    // Escuchar Usuarios (Perfiles)
    const qUsers = query(collection(db, "users"), orderBy("balance", "desc"));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })) as UserProfile[]);
    });

    // Escuchar Apuestas
    const qBets = query(collection(db, "bets"));
    const unsubBets = onSnapshot(qBets, (snap) => {
        setActiveBets(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Bet[]);
    });

    // Escuchar Historial
    const qHist = query(collection(db, "history"), orderBy("date", "desc"));
    const unsubHist = onSnapshot(qHist, (snap) => setHistory(snap.docs.map(d => d.data()) as HistoryItem[]));

    return () => { unsubSala(); unsubUsers(); unsubBets(); unsubHist(); };
  }, []);

  // --- LOGICA USUARIOS ---
  const crearPerfil = async () => {
      if (!newName || !newClub) return alert("Pon nombre y club.");
      await setDoc(doc(db, "users", newName), { 
          clubName: newClub, 
          balance: STARTING_BALANCE 
      });
      setNewName(""); setNewClub("");
      alert("✅ Perfil Creado");
  };

  const borrarPerfil = async (id: string) => {
      if(confirm("¿Borrar a " + id + "?")) await deleteDoc(doc(db, "users", id));
  };

  const togglePlayerSelection = (name: string) => {
      if (selectedPlayers.includes(name)) {
          setSelectedPlayers(selectedPlayers.filter(p => p !== name));
      } else {
          if (selectedPlayers.length >= 8) return alert("Máximo 8 jugadores.");
          setSelectedPlayers([...selectedPlayers, name]);
      }
  };

  // --- LOGICA TORNEO ---
  const handleCrearTorneo = async () => {
      if (selectedPlayers.length < 2) return alert("Selecciona al menos 2 jugadores.");
      
      let players = [...selectedPlayers];
      // Rellenar con BYE hasta 4 u 8
      let targetSize = players.length <= 4 ? 4 : 8;
      while (players.length < targetSize) players.push(BYE_NAME);

      const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
      const shuffledTeams = [...TEAMS_REAL].sort(() => Math.random() - 0.5);

      // Mapear jugadores a sus datos reales (Club personalizado)
      const getP = (idx: number) => {
          const pName = shuffledPlayers[idx];
          const isBye = pName === BYE_NAME;
          const userProfile = users.find(u => u.id === pName);
          return {
              name: pName,
              team: isBye ? null : shuffledTeams[idx], // Equipo Real (Random)
              club: isBye ? null : (userProfile?.clubName || "Sin Club") // Club Personalizado
          };
      };

      let matches: Match[] = [];
      // Generar Cuadro (Lógica igual a versiones anteriores)
      if (targetSize === 4) {
          matches = [
              { id: 0, p1: getP(0).name, p1Team: getP(0).team, p1Club: getP(0).club, p2: getP(1).name, p2Team: getP(1).team, p2Club: getP(1).club, round: 'S' },
              { id: 1, p1: getP(2).name, p1Team: getP(2).team, p1Club: getP(2).club, p2: getP(3).name, p2Team: getP(3).team, p2Club: getP(3).club, round: 'S' },
              { id: 2, p1: "Esperando...", p2: "Esperando...", round: 'F' }
          ];
      } else {
          matches = [
              { id: 0, p1: getP(0).name, p1Team: getP(0).team, p1Club: getP(0).club, p2: getP(1).name, p2Team: getP(1).team, p2Club: getP(1).club, round: 'Q' },
              { id: 1, p1: getP(2).name, p1Team: getP(2).team, p1Club: getP(2).club, p2: getP(3).name, p2Team: getP(3).team, p2Club: getP(3).club, round: 'Q' },
              { id: 2, p1: getP(4).name, p1Team: getP(4).team, p1Club: getP(4).club, p2: getP(5).name, p2Team: getP(5).team, p2Club: getP(5).club, round: 'Q' },
              { id: 3, p1: getP(6).name, p1Team: getP(6).team, p1Club: getP(6).club, p2: getP(7).name, p2Team: getP(7).team, p2Club: getP(7).club, round: 'Q' },
              { id: 4, p1: "Esperando...", p2: "Esperando...", round: 'S' },
              { id: 5, p1: "Esperando...", p2: "Esperando...", round: 'S' },
              { id: 6, p1: "Esperando...", p2: "Esperando...", round: 'F' }
          ];
      }

      // Propagar BYEs
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
          if (matches[0].winner) propagate(2, 'p1', matches[0]);
          if (matches[1].winner) propagate(2, 'p2', matches[1]);
      } else {
          if (matches[0].winner) propagate(4, 'p1', matches[0]);
          if (matches[1].winner) propagate(4, 'p2', matches[1]);
          if (matches[2].winner) propagate(5, 'p1', matches[2]);
          if (matches[3].winner) propagate(5, 'p2', matches[3]);
      }

      // Sanitizar undefined
      const cleanMatches = matches.map(m => JSON.parse(JSON.stringify(m, (k, v) => v === undefined ? null : v)));
      await setDoc(doc(db, "sala", "principal"), { fifaMatches: cleanMatches }, { merge: true });
      setActiveTab('fifa');
  };

  // --- LOGICA APUESTAS ---
  const realizarApuesta = async () => {
      if (!bettorName || !selectedMatchId || !betTarget || betAmount <= 0) return alert("Rellena todo.");
      
      const user = users.find(u => u.id === bettorName);
      if (!user) return alert("Usuario no encontrado.");
      if (user.balance < betAmount) return alert("❌ No tienes suficiente dinero.");

      // Restar saldo
      await setDoc(doc(db, "users", bettorName), { balance: increment(-betAmount) }, { merge: true });
      
      // Guardar apuesta
      await addDoc(collection(db, "bets"), {
          matchId: selectedMatchId,
          bettor: bettorName,
          chosenWinner: betTarget,
          amount: betAmount,
          status: 'pending'
      });
      alert("💰 Apuesta realizada. ¡Suerte!");
  };

  const resolverApuestas = async (matchId: number, winner: string) => {
      // Buscar apuestas pendientes de este partido
      const pendingBets = activeBets.filter(b => b.matchId === matchId && b.status === 'pending');
      const batch = writeBatch(db);

      pendingBets.forEach(bet => {
          const betRef = doc(db, "bets", bet.id);
          if (bet.chosenWinner === winner) {
              // GANADOR: Recibe lo apostado * 2
              const profit = bet.amount * 2;
              const userRef = doc(db, "users", bet.bettor);
              batch.update(userRef, { balance: increment(profit) });
              batch.update(betRef, { status: 'won' });
          } else {
              // PERDEDOR
              batch.update(betRef, { status: 'lost' });
          }
      });
      await batch.commit();
  };

  // --- FINALIZAR PARTIDO ---
  const finalizarPartido = async (matchId: number, s1: number, s2: number) => {
    if (s1 === s2) return alert("❌ Empate no vale.");
    const currentMatch = fifaMatches.find(m => m && m.id === matchId);
    if (!currentMatch) return;
    
    const isP1Winner = s1 > s2;
    const winner = isP1Winner ? currentMatch.p1 : currentMatch.p2;
    const winnerTeam = (isP1Winner ? currentMatch.p1Team : currentMatch.p2Team) || null;
    const winnerClub = (isP1Winner ? currentMatch.p1Club : currentMatch.p2Club) || null;

    try {
      // Resolver apuestas
      await resolverApuestas(matchId, winner);

      let nuevosPartidos = [...fifaMatches];
      nuevosPartidos = nuevosPartidos.map(m => m.id === matchId ? { ...m, score1: s1, score2: s2, winner: winner } : m);

      const avanzar = (targetId: number, slot: 'p1' | 'p2') => {
          if (!nuevosPartidos[targetId]) return;
          nuevosPartidos[targetId][slot] = winner;
          nuevosPartidos[targetId][slot === 'p1' ? 'p1Team' : 'p2Team'] = winnerTeam;
          nuevosPartidos[targetId][slot === 'p1' ? 'p1Club' : 'p2Club'] = winnerClub;
      };

      // Lógica avance (igual que siempre)
      const isSmall = fifaMatches.length === 3;
      const isBig = fifaMatches.length === 7;
      if (isSmall) {
          if (matchId === 0) avanzar(2, 'p1');
          if (matchId === 1) avanzar(2, 'p2');
      } else if (isBig) {
          if (matchId === 0) avanzar(4, 'p1');
          if (matchId === 1) avanzar(4, 'p2');
          if (matchId === 2) avanzar(5, 'p1');
          if (matchId === 3) avanzar(5, 'p2');
          if (matchId === 4) avanzar(6, 'p1');
          if (matchId === 5) avanzar(6, 'p2');
      }

      await setDoc(doc(db, "sala", "principal"), { fifaMatches: nuevosPartidos }, { merge: true });
      
      const lastId = isSmall ? 2 : 6;
      if (matchId === lastId) {
          confetti({ particleCount: 500, spread: 100 });
          await addDoc(collection(db, "history"), { winner, winnerTeam: winnerTeam || "Sin Equipo", date: serverTimestamp(), type: isSmall ? "Express" : "Oficial" });
      } else {
          lanzarFiesta();
      }
    } catch (e) { console.error(e); }
  };

  // --- HELPERS ---
  const calcularPaliza = (matches: Match[]) => {
      let maxDiff = 0;
      let palizaData = null;
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

  const girarRuleta = async (tipo: 'soft' | 'chupito') => {
    setIsSpinning(true);
    const lista = tipo === 'soft' ? LISTA_SOFT : LISTA_CHUPITOS;
    let i = 0;
    const intervalo = setInterval(() => { setResultadoRuleta(lista[i % lista.length]); i++; }, 80);
    setTimeout(async () => {
        clearInterval(intervalo);
        const final = lista[Math.floor(Math.random() * lista.length)];
        setResultadoRuleta(final);
        setIsSpinning(false);
        await setDoc(doc(db, "sala", "principal"), { ultimoCastigo: final }, { merge: true });
        if(tipo === 'chupito') confetti({ particleCount: 50, colors: ['#ff0000'] }); 
    }, 2000);
  };

  const handleSorteoPachanga = () => {
    const nombres = pachangaInput.split(/[\n,]+/).map((n) => n.trim()).filter((n) => n);
    if (nombres.length < 2) return alert("Mínimo 2");
    const shuffled = [...nombres].sort(() => Math.random() - 0.5);
    const mid = Math.ceil(shuffled.length / 2);
    setDoc(doc(db, "sala", "principal"), { equipoA: shuffled.slice(0, mid), equipoB: shuffled.slice(mid) }, { merge: true });
  };

  const lanzarFiesta = () => { confetti({ particleCount: 150 }); const audio = new Audio("/gol.mp3"); audio.volume = 0.5; audio.play().catch(()=>{}); };
  const startTimer = (s: number) => { setTimeLeft(s); setTimerActive(true); };
  const generarExcusa = () => setExcusa(EXCUSAS[Math.floor(Math.random() * EXCUSAS.length)]);
  
  const limpiarPizarra = async () => {
      const batch = writeBatch(db);
      batch.set(doc(db, "sala", "principal"), { equipoA: [], equipoB: [], fifaMatches: [], ultimoCastigo: "..." });
      // Limpiar apuestas pendientes
      const q = query(collection(db, "bets")); 
      const snap = await getDocs(q);
      snap.forEach(d => batch.delete(d.ref));
      await batch.commit();
  };

  useEffect(() => {
      if (timerActive && timeLeft > 0) { timerRef.current = setTimeout(() => setTimeLeft(timeLeft - 1), 1000); }
      else if (timeLeft === 0 && timerActive) { setTimerActive(false); new Audio("https://www.myinstants.com/media/sounds/ding-sound-effect_2.mp3").play().catch(()=>{}); }
      return () => clearTimeout(timerRef.current!);
  }, [timeLeft, timerActive]);

  return (
    <main className="min-h-screen bg-neutral-950 text-white font-sans pb-32 overflow-x-hidden select-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-900 via-neutral-950 to-black">
      {/* HEADER */}
      <header className="bg-neutral-900/80 backdrop-blur-md sticky top-0 z-50 border-b border-white/10 p-4 shadow-lg">
        <div className="max-w-6xl mx-auto flex flex-col gap-4">
            <div className="flex justify-between items-center w-full">
                <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 uppercase tracking-tighter" onClick={() => setActiveTab('perfiles')}>Proyecto Teletubies</h1>
                <div className="flex gap-2">
                    <button onClick={limpiarPizarra} className="bg-neutral-800 border-gray-600 border text-white px-3 py-2 rounded-lg text-sm">🔄</button>
                </div>
            </div>
            <nav className="flex bg-black/60 p-1 rounded-2xl gap-1 overflow-x-auto border border-white/5">
                {['perfiles', 'fifa', 'apuestas', 'pachanga', 'castigos'].map((tab) => (
                    <button key={tab} onClick={() => setActiveTab(tab as Tab)} className={`px-4 py-2 rounded-xl font-bold text-xs uppercase transition-all ${activeTab === tab ? 'bg-white text-black' : 'text-gray-400'}`}>{tab}</button>
                ))}
            </nav>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 md:p-8">
        
        {/* --- PESTAÑA PERFILES --- */}
        {activeTab === 'perfiles' && (
            <div className="grid md:grid-cols-2 gap-8">
                {/* Creador */}
                <div className="bg-neutral-900/40 p-6 rounded-3xl border border-blue-500/20">
                    <h2 className="text-xl font-bold text-blue-400 mb-4">Nuevo Fichaje</h2>
                    <div className="flex flex-col gap-3">
                        <input className="bg-black/50 p-3 rounded-xl border border-gray-700" placeholder="Nombre (ej: Mario)" value={newName} onChange={e=>setNewName(e.target.value)} />
                        <input className="bg-black/50 p-3 rounded-xl border border-gray-700" placeholder="Club Gracioso (ej: Rayoo Vallecano)" value={newClub} onChange={e=>setNewClub(e.target.value)} />
                        <button onClick={crearPerfil} className="bg-blue-600 p-3 rounded-xl font-bold hover:bg-blue-500">Crear Perfil</button>
                    </div>
                </div>
                {/* Lista */}
                <div className="bg-neutral-900/40 p-6 rounded-3xl border border-purple-500/20">
                    <h2 className="text-xl font-bold text-purple-400 mb-4">Plantilla & Banca</h2>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {users.map(u => (
                            <div key={u.id} className="flex justify-between items-center bg-black/40 p-3 rounded-xl border border-white/5">
                                <div>
                                    <p className="font-bold">{u.id}</p>
                                    <p className="text-xs text-gray-400">{u.clubName}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-yellow-400 font-mono font-bold">{u.balance} 💰</span>
                                    <button onClick={()=>borrarPerfil(u.id)} className="text-red-500 text-xs">🗑️</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* --- PESTAÑA FIFA (SELECCIÓN + CUADRO) --- */}
        {activeTab === 'fifa' && (
            <section>
                {/* SELECTOR DE JUGADORES (Si no hay torneo activo) */}
                {fifaMatches.length === 0 && (
                    <div className="bg-neutral-900/40 p-6 rounded-3xl border border-green-500/20 mb-8">
                        <h2 className="text-xl font-bold text-green-400 mb-4">¿Quién juega hoy?</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                            {users.map(u => (
                                <button 
                                    key={u.id} 
                                    onClick={() => togglePlayerSelection(u.id)}
                                    className={`p-3 rounded-xl border text-sm font-bold transition ${selectedPlayers.includes(u.id) ? 'bg-green-600 border-green-400 text-white' : 'bg-black/40 border-gray-700 text-gray-400'}`}
                                >
                                    {u.id}
                                </button>
                            ))}
                        </div>
                        <button onClick={handleCrearTorneo} className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-4 rounded-xl shadow-lg">
                            🏆 COMENZAR TORNEO ({selectedPlayers.length})
                        </button>
                    </div>
                )}

                {/* CUADRO DEL TORNEO */}
                {fifaMatches.length > 0 && (
                    <div className="w-full">
                        {/* Mobile List */}
                        <div className="md:hidden flex flex-col gap-6">
                            <h3 className="text-center font-bold text-gray-500">Ronda 1</h3>
                            {(fifaMatches.length===3 ? [0,1] : [0,1,2,3]).map(id => <MatchCard key={id} m={fifaMatches[id]} onFinish={finalizarPartido} />)}
                            
                            {fifaMatches.length===7 && (
                                <>
                                    <h3 className="text-center font-bold text-gray-500 mt-4">Semifinales</h3>
                                    {[4,5].map(id => <MatchCard key={id} m={fifaMatches[id]} onFinish={finalizarPartido} />)}
                                </>
                            )}
                            
                            <h3 className="text-center font-bold text-yellow-500 mt-4">FINAL</h3>
                            <MatchCard m={fifaMatches[fifaMatches.length===3 ? 2 : 6]} onFinish={finalizarPartido} isFinal />
                        </div>
                        
                        {/* Desktop View */}
                        <div className="hidden md:block">
                            {/* Reutilizo la vista simple vertical para no complicar el código, se ve bien igual */}
                            <div className="grid grid-cols-3 gap-8">
                                <div className="flex flex-col gap-4">
                                    <h3 className="text-center font-bold">Ronda 1</h3>
                                    {(fifaMatches.length===3 ? [0,1] : [0,1,2,3]).map(id => <MatchCard key={id} m={fifaMatches[id]} onFinish={finalizarPartido} />)}
                                </div>
                                <div className="flex flex-col justify-center gap-4">
                                    {fifaMatches.length===7 && (
                                        <>
                                            <h3 className="text-center font-bold">Semis</h3>
                                            {[4,5].map(id => <MatchCard key={id} m={fifaMatches[id]} onFinish={finalizarPartido} />)}
                                        </>
                                    )}
                                </div>
                                <div className="flex flex-col justify-center">
                                    <h3 className="text-center font-bold text-yellow-500">FINAL</h3>
                                    <MatchCard m={fifaMatches[fifaMatches.length===3 ? 2 : 6]} onFinish={finalizarPartido} isFinal />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </section>
        )}

        {/* --- PESTAÑA APUESTAS --- */}
        {activeTab === 'apuestas' && (
            <div className="max-w-2xl mx-auto space-y-8">
                {/* Panel de Apuesta */}
                <div className="bg-black/60 border border-yellow-500/30 p-6 rounded-3xl">
                    <h2 className="text-xl font-bold text-yellow-400 mb-4">🎰 Casa de Apuestas</h2>
                    
                    {fifaMatches.length > 0 ? (
                        <div className="flex flex-col gap-4">
                            {/* 1. Quién eres */}
                            <select className="bg-neutral-800 p-3 rounded-xl border border-gray-600" value={bettorName} onChange={e=>setBettorName(e.target.value)}>
                                <option value="">👤 ¿Quién eres?</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.id} ({u.balance} 💰)</option>)}
                            </select>

                            {/* 2. Qué partido */}
                            <select className="bg-neutral-800 p-3 rounded-xl border border-gray-600" onChange={e=>{
                                const m = fifaMatches.find(x => x.id === parseInt(e.target.value));
                                setSelectedMatchId(parseInt(e.target.value));
                                setBetTarget(""); // Reset winner
                            }}>
                                <option value="">⚽ Elige Partido</option>
                                {fifaMatches.filter(m => !m.winner && !m.isBye).map(m => (
                                    <option key={m.id} value={m.id}>{m.p1} vs {m.p2}</option>
                                ))}
                            </select>

                            {/* 3. A quién apuestas (Solo si hay partido seleccionado) */}
                            {selectedMatchId !== null && (
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setBetTarget(fifaMatches[selectedMatchId!].p1)}
                                        className={`flex-1 p-3 rounded-xl border ${betTarget === fifaMatches[selectedMatchId!].p1 ? 'bg-green-600 border-green-400' : 'bg-neutral-800 border-gray-600'}`}
                                    >
                                        Gana {fifaMatches[selectedMatchId!].p1}
                                    </button>
                                    <button 
                                        onClick={() => setBetTarget(fifaMatches[selectedMatchId!].p2)}
                                        className={`flex-1 p-3 rounded-xl border ${betTarget === fifaMatches[selectedMatchId!].p2 ? 'bg-green-600 border-green-400' : 'bg-neutral-800 border-gray-600'}`}
                                    >
                                        Gana {fifaMatches[selectedMatchId!].p2}
                                    </button>
                                </div>
                            )}

                            {/* 4. Cantidad */}
                            <div className="flex items-center gap-2">
                                <span className="text-xl">💰</span>
                                <input type="number" className="flex-1 bg-neutral-800 p-3 rounded-xl border border-gray-600" value={betAmount} onChange={e=>setBetAmount(parseInt(e.target.value))} />
                            </div>

                            <button onClick={realizarApuesta} className="bg-yellow-600 hover:bg-yellow-500 text-black font-black p-4 rounded-xl shadow-lg mt-2">
                                ¡APOSTAR! (x2)
                            </button>
                        </div>
                    ) : (
                        <p className="text-center text-gray-500">No hay partidos activos para apostar.</p>
                    )}
                </div>

                {/* Apuestas Activas */}
                <div className="space-y-2">
                    <h3 className="font-bold text-gray-400 uppercase text-xs">Apuestas en Juego</h3>
                    {activeBets.filter(b => b.status === 'pending').map(b => (
                        <div key={b.id} className="bg-neutral-900/50 p-3 rounded-xl border border-white/5 flex justify-between items-center">
                            <div>
                                <span className="font-bold text-yellow-400">{b.bettor}</span> apuesta por <span className="font-bold text-blue-400">{b.chosenWinner}</span>
                            </div>
                            <span className="font-mono">{b.amount} 💰</span>
                        </div>
                    ))}
                    {activeBets.filter(b => b.status === 'pending').length === 0 && <p className="text-gray-600 text-sm">No hay apuestas activas.</p>}
                </div>
            </div>
        )}

        {/* --- PESTAÑA PACHANGA --- */}
        {activeTab === 'pachanga' && (
          <section className="max-w-3xl mx-auto bg-neutral-900/40 border border-green-500/20 rounded-3xl p-6 backdrop-blur-sm">
             <h2 className="text-xl font-black text-green-400 mb-4">Equipos Random</h2>
             <div className="flex flex-col gap-4 mb-8">
                <textarea className="w-full h-24 bg-black/40 border border-gray-700 rounded-xl p-4 text-white resize-none" placeholder="Nombres..." value={pachangaInput} onChange={e=>setPachangaInput(e.target.value)}></textarea>
                <button onClick={handleSorteoPachanga} className="w-full bg-green-600 text-white font-black py-3 rounded-xl">MEZCLAR</button>
             </div>
             {equipoA.length > 0 && (<div className="grid grid-cols-2 gap-4"><div className="bg-red-900/20 p-4 rounded-xl border border-red-500/30"><h3 className="text-red-400 font-bold mb-2">ROJOS</h3>{equipoA.map(p=><div key={p}>{p}</div>)}</div><div className="bg-blue-900/20 p-4 rounded-xl border border-blue-500/30"><h3 className="text-blue-400 font-bold mb-2">AZULES</h3>{equipoB.map(p=><div key={p}>{p}</div>)}</div></div>)}
          </section>
        )}

        {/* --- PESTAÑA CASTIGOS --- */}
        {activeTab === 'castigos' && (
           <section className="max-w-md mx-auto text-center mt-4">
              <div className="bg-black/60 border-2 border-red-600 p-8 rounded-3xl mb-8">
                  <h2 className="text-red-500 font-black uppercase tracking-[0.3em] mb-4">Sentencia</h2>
                  <p className={`text-2xl font-black ${isSpinning?'blur-md text-red-500/50':'text-white'}`}>{resultadoRuleta}</p>
              </div>
              <div className="mb-8">
                  <div className="flex justify-center gap-2 mb-2"><button onClick={()=>startTimer(30)} className="bg-gray-800 px-3 py-1 rounded text-xs">30s</button><button onClick={()=>startTimer(60)} className="bg-gray-800 px-3 py-1 rounded text-xs">1min</button><button onClick={()=>setTimeLeft(0)} className="bg-red-900/50 px-3 py-1 rounded text-xs">Parar</button></div>
                  <div className="text-4xl font-mono">{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</div>
              </div>
              <div className="mb-4"><button onClick={generarExcusa} className="w-full bg-blue-900/30 text-blue-300 font-bold py-3 rounded-xl mb-2">😭 Excusa</button>{excusa && <div className="text-white italic">"{excusa}"</div>}</div>
              <div className="grid grid-cols-2 gap-4"><button disabled={isSpinning} onClick={()=>girarRuleta('soft')} className="bg-neutral-800 p-4 rounded-xl">🤡 Soft</button><button disabled={isSpinning} onClick={()=>girarRuleta('chupito')} className="bg-red-950 p-4 rounded-xl text-red-200">🥃 Chupito</button></div>
           </section>
        )}

        {/* --- BOTONERA DJ --- */}
        <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
           <button onClick={() => setShowDJ(!showDJ)} className="bg-purple-600 text-white p-3 rounded-full shadow-2xl border-2 border-white/20">{showDJ ? '✖️' : '🔊'}</button>
           {showDJ && (
             <div className="bg-black/90 p-4 rounded-2xl border border-purple-500/30 backdrop-blur-md mb-2 flex flex-col gap-2">
               <SoundBtn label="📢 BOCINA" url="https://www.myinstants.com/media/sounds/mlg-airhorn.mp3" color="bg-red-600" />
               <SoundBtn label="🎻 VIOLÍN" url="https://www.myinstants.com/media/sounds/sad-violin-airhorn.mp3" color="bg-blue-600" />
               <SoundBtn label="🦗 GRILLOS" url="https://www.myinstants.com/media/sounds/cricket_1.mp3" color="bg-green-600" />
               <SoundBtn label="👏 APLAUSO" url="https://www.myinstants.com/media/sounds/aplausos_1.mp3" color="bg-yellow-600" />
               <SoundBtn label="😡 BUUU" url="https://www.myinstants.com/media/sounds/boo.mp3" color="bg-gray-600" />
               <SoundBtn label="🐐 SIUUU" url="https://www.myinstants.com/media/sounds/siu.mp3" color="bg-neutral-800" />
             </div>
           )}
        </div>

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
    if (!m) return <div className="bg-gray-900/50 p-2 rounded h-16 w-full"></div>;
    const isWaiting = m.p1 === "Esperando..." || m.p2 === "Esperando...";
    if (m.isBye) return <div className="bg-neutral-900/30 p-2 rounded border border-white/5 text-center"><p className="text-green-500 font-bold text-xs">✅ {m.winner}</p><p className="text-[9px] text-gray-500">Pase Directo</p></div>;

    return (
        <div className={`p-2 rounded-xl border border-white/10 ${m.winner ? 'bg-blue-900/20' : 'bg-neutral-900/80'}`}>
            {m.winner ? (
                <div className="flex justify-between items-center gap-1">
                    <div className="w-1/3 text-right overflow-hidden"><span className={`text-xs font-bold block truncate ${m.winner===m.p1?'text-green-400':'text-gray-500 line-through'}`}>{m.p1}</span><span className="text-[8px] text-gray-400 block truncate">{m.p1Team}</span></div>
                    <div className="bg-black/60 px-2 py-1 rounded text-xs font-bold">{m.score1}-{m.score2}</div>
                    <div className="w-1/3 text-left overflow-hidden"><span className={`text-xs font-bold block truncate ${m.winner===m.p2?'text-green-400':'text-gray-500 line-through'}`}>{m.p2}</span><span className="text-[8px] text-gray-400 block truncate">{m.p2Team}</span></div>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center gap-1">
                        <div className="w-20 text-right overflow-hidden">
                            <span className="text-xs font-bold block truncate text-gray-300">{m.p1}</span>
                            <span className="text-[8px] text-blue-400 block truncate">{m.p1Team}</span>
                            <span className="text-[8px] text-yellow-500 block truncate">{m.p1Club}</span>
                        </div>
                        <input type="number" className="w-6 h-6 bg-black/50 text-center rounded text-xs" value={s1} onChange={e => setS1(e.target.value)} disabled={isWaiting}/>
                        <span className="text-[8px] text-gray-600">VS</span>
                        <input type="number" className="w-6 h-6 bg-black/50 text-center rounded text-xs" value={s2} onChange={e => setS2(e.target.value)} disabled={isWaiting}/>
                        <div className="w-20 text-left overflow-hidden">
                            <span className="text-xs font-bold block truncate text-gray-300">{m.p2}</span>
                            <span className="text-[8px] text-blue-400 block truncate">{m.p2Team}</span>
                            <span className="text-[8px] text-yellow-500 block truncate">{m.p2Club}</span>
                        </div>
                    </div>
                    {!isWaiting && <button onClick={()=>s1&&s2&&onFinish(m.id, +s1, +s2)} className="w-full bg-blue-600/20 hover:bg-blue-600 text-blue-200 text-[9px] py-1 rounded font-bold">TERMINAR</button>}
                </div>
            )}
        </div>
    );
}