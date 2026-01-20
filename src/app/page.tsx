"use client";
import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { 
  doc, onSnapshot, setDoc, collection, query, orderBy, increment, 
  addDoc, serverTimestamp, getDocs, writeBatch, deleteDoc, getDoc 
} from "firebase/firestore";
import confetti from "canvas-confetti";

// --- TIPOS ---
type Match = { 
  id: number; 
  p1: string; p1Team?: string | null; p1Club?: string | null;
  p2: string; p2Team?: string | null; p2Club?: string | null;
  score1?: number; score2?: number; 
  winner?: string; 
  round: 'Q' | 'S' | 'F' | '3rd'; 
  isBye?: boolean;
};

type UserProfile = { id: string; clubName: string; balance: number; password?: string; };
type Bet = { id: string; matchId: number; bettor: string; chosenWinner: string; amount: number; status: 'pending' | 'won' | 'lost'; };
type HistoryItem = { winner: string; winnerTeam?: string; date: any; type: string };
type Tab = 'perfil' | 'fifa' | 'apuestas' | 'pachanga' | 'castigos';

const BYE_NAME = "Pase Directo ➡️";
const STARTING_BALANCE = 1000;

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('fifa');
  
  // DATOS
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [fifaMatches, setFifaMatches] = useState<Match[]>([]);
  const [activeBets, setActiveBets] = useState<Bet[]>([]);
  const [ranking, setRanking] = useState<{nombre: string, puntos: number, victorias: number}[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // ESTADO JUEGO
  const [gameMode, setGameMode] = useState<'1vs1' | '2vs2'>('1vs1');
  const [mayorPaliza, setMayorPaliza] = useState<{winner: string, loser: string, diff: number, result: string} | null>(null);
  
  // FORMULARIOS
  const [loginName, setLoginName] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [regName, setRegName] = useState("");
  const [regClub, setRegClub] = useState("");
  const [regPass, setRegPass] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  // APUESTAS
  const [betAmount, setBetAmount] = useState<number>(100);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [betTarget, setBetTarget] = useState<string>("");

  // EXTRA
  const [resultadoRuleta, setResultadoRuleta] = useState<string>("☠️ Esperando víctima...");
  const [excusa, setExcusa] = useState<string | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [showDJ, setShowDJ] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
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
    const unsubUsers = onSnapshot(query(collection(db, "users"), orderBy("balance", "desc")), (snap) => {
        const usersList = snap.docs.map(d => ({ id: d.id, ...d.data() })) as UserProfile[];
        setUsers(usersList);
        if (currentUser) {
            const updated = usersList.find(u => u.id === currentUser.id);
            if (updated) setCurrentUser(updated);
        }
    });
    const unsubBets = onSnapshot(query(collection(db, "bets")), (snap) => setActiveBets(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Bet[]));
    const unsubRank = onSnapshot(query(collection(db, "ranking"), orderBy("puntos", "desc")), (snap) => setRanking(snap.docs.map(d => ({ nombre: d.id, ...d.data() } as any))));
    const unsubHist = onSnapshot(query(collection(db, "history"), orderBy("date", "desc")), (snap) => setHistory(snap.docs.map(d => d.data()) as HistoryItem[]));
    return () => { unsubSala(); unsubUsers(); unsubBets(); unsubRank(); unsubHist(); };
  }, [currentUser?.id]);

  // --- AUTH ---
  const handleLogin = () => {
      const user = users.find(u => u.id.toLowerCase() === loginName.toLowerCase());
      if (!user) return alert("Usuario no encontrado.");
      if (user.password !== loginPass) return alert("Contraseña incorrecta.");
      setCurrentUser(user);
      setLoginName(""); setLoginPass("");
  };

  const handleRegister = async () => {
      if (!regName || !regClub || !regPass) return alert("Rellena todo.");
      const exists = users.find(u => u.id.toLowerCase() === regName.toLowerCase());
      if (exists) return alert("Ese nombre ya existe.");
      const newUser = { clubName: regClub, balance: STARTING_BALANCE, password: regPass };
      await setDoc(doc(db, "users", regName), newUser);
      setCurrentUser({ id: regName, ...newUser });
      setIsRegistering(false);
      setRegName(""); setRegClub(""); setRegPass("");
  };

  const logout = () => { setCurrentUser(null); setShowSettings(false); };

  // --- TORNEO ---
  const togglePlayerSelection = (name: string) => {
      if (selectedPlayers.includes(name)) setSelectedPlayers(selectedPlayers.filter(p => p !== name));
      else { if (selectedPlayers.length >= 16) return alert("Máximo 16."); setSelectedPlayers([...selectedPlayers, name]); }
  };

  const handleCrearTorneo = async () => {
      if (selectedPlayers.length < 2) return alert("Mínimo 2 jugadores.");
      let players = [...selectedPlayers];
      let targetSize = players.length <= 4 ? 4 : 8;
      if (players.length > 8) return alert("Máx 8 jugadores.");
      while (players.length < targetSize) players.push(BYE_NAME);

      const shuffledP = [...players].sort(() => Math.random() - 0.5);
      const shuffledT = [...TEAMS_REAL].sort(() => Math.random() - 0.5);

      const getMatchData = (idx: number) => {
          const name = shuffledP[idx];
          const isBye = name === BYE_NAME;
          const u = users.find(user => user.id === name);
          return {
              name: name,
              team: isBye ? null : shuffledT[idx],
              club: isBye ? null : (u?.clubName || "Invitado")
          };
      };

      let matches: Match[] = [];
      const propagate = (targetIdx: number, slot: 'p1'|'p2', s: Match) => {
        const wKey = s.winner===s.p1?'p1':'p2';
        matches[targetIdx][slot] = s.winner!;
        matches[targetIdx][slot==='p1'?'p1Team':'p2Team'] = s[wKey==='p1'?'p1Team':'p2Team'] || null;
        matches[targetIdx][slot==='p1'?'p1Club':'p2Club'] = s[wKey==='p1'?'p1Club':'p2Club'] || null;
      };

      if (targetSize === 4) {
          matches = [
              { id: 0, p1: getMatchData(0).name, p1Team: getMatchData(0).team, p1Club: getMatchData(0).club, p2: getMatchData(1).name, p2Team: getMatchData(1).team, p2Club: getMatchData(1).club, round: 'S' },
              { id: 1, p1: getMatchData(2).name, p1Team: getMatchData(2).team, p1Club: getMatchData(2).club, p2: getMatchData(3).name, p2Team: getMatchData(3).team, p2Club: getMatchData(3).club, round: 'S' },
              { id: 2, p1: "Esperando...", p2: "Esperando...", round: 'F' },
              { id: 3, p1: "Esperando...", p2: "Esperando...", round: '3rd' }
          ];
      } else {
          matches = [
              { id: 0, p1: getMatchData(0).name, p1Team: getMatchData(0).team, p1Club: getMatchData(0).club, p2: getMatchData(1).name, p2Team: getMatchData(1).team, p2Club: getMatchData(1).club, round: 'Q' },
              { id: 1, p1: getMatchData(2).name, p1Team: getMatchData(2).team, p1Club: getMatchData(2).club, p2: getMatchData(3).name, p2Team: getMatchData(3).team, p2Club: getMatchData(3).club, round: 'Q' },
              { id: 2, p1: getMatchData(4).name, p1Team: getMatchData(4).team, p1Club: getMatchData(4).club, p2: getMatchData(5).name, p2Team: getMatchData(5).team, p2Club: getMatchData(5).club, round: 'Q' },
              { id: 3, p1: getMatchData(6).name, p1Team: getMatchData(6).team, p1Club: getMatchData(6).club, p2: getMatchData(7).name, p2Team: getMatchData(7).team, p2Club: getMatchData(7).club, round: 'Q' },
              { id: 4, p1: "Esperando...", p2: "Esperando...", round: 'S' },
              { id: 5, p1: "Esperando...", p2: "Esperando...", round: 'S' },
              { id: 6, p1: "Esperando...", p2: "Esperando...", round: 'F' },
              { id: 7, p1: "Esperando...", p2: "Esperando...", round: '3rd' }
          ];
      }

      matches.forEach(m => { if(m.p2===BYE_NAME){m.winner=m.p1;m.isBye=true} else if(m.p1===BYE_NAME){m.winner=m.p2;m.isBye=true} });
      
      if(targetSize===4) { if(matches[0].winner) propagate(2,'p1',matches[0]); if(matches[1].winner) propagate(2,'p2',matches[1]); }
      else { if(matches[0].winner) propagate(4,'p1',matches[0]); if(matches[1].winner) propagate(4,'p2',matches[1]); if(matches[2].winner) propagate(5,'p1',matches[2]); if(matches[3].winner) propagate(5,'p2',matches[3]); }

      const clean = matches.map(m => JSON.parse(JSON.stringify(m, (k, v) => v === undefined ? null : v)));
      await setDoc(doc(db, "sala", "principal"), { fifaMatches: clean }, { merge: true });
      setActiveTab('fifa');
  };

  const realizarApuesta = async () => {
      if (!currentUser) return alert("Inicia sesión para apostar.");
      if (selectedMatchId === null || !betTarget || betAmount <= 0) return alert("Rellena todo.");
      if (currentUser.balance < betAmount) return alert("No tienes pasta.");

      await setDoc(doc(db, "users", currentUser.id), { balance: increment(-betAmount) }, { merge: true });
      await addDoc(collection(db, "bets"), { matchId: selectedMatchId, bettor: currentUser.id, chosenWinner: betTarget, amount: betAmount, status: 'pending' });
      alert("✅ Apuesta realizada.");
  };

  const finalizarPartido = async (matchId: number, s1: number, s2: number) => {
    if (s1 === s2) return alert("❌ Empate prohibido.");
    const m = fifaMatches.find(x => x.id === matchId);
    if (!m) return;
    
    const isP1 = s1 > s2;
    const winner = isP1 ? m.p1 : m.p2;
    const loser = isP1 ? m.p2 : m.p1;
    const wTeam = isP1 ? m.p1Team : m.p2Team; const wClub = isP1 ? m.p1Club : m.p2Club;
    const lTeam = isP1 ? m.p2Team : m.p1Team; const lClub = isP1 ? m.p2Club : m.p1Club;

    try {
      const pending = activeBets.filter(b => b.matchId === matchId && b.status === 'pending');
      const batch = writeBatch(db);
      pending.forEach(b => {
          const ref = doc(db, "bets", b.id);
          if (b.chosenWinner === winner) {
              batch.update(doc(db, "users", b.bettor), { balance: increment(b.amount * 2) });
              batch.update(ref, { status: 'won' });
          } else batch.update(ref, { status: 'lost' });
      });
      await batch.commit();

      if (gameMode === '1vs1' && !m.isBye && winner !== "Esperando...") {
        await setDoc(doc(db, "ranking", winner), { puntos: increment(3), victorias: increment(1) }, { merge: true });
      }
      
      let next = [...fifaMatches];
      next = next.map(x => x.id === matchId ? { ...x, score1: s1, score2: s2, winner: winner } : x);

      const send = (tId: number, slot: 'p1'|'p2', n: string, t: any, c: any) => { if(next[tId]){ next[tId][slot]=n; next[tId][slot==='p1'?'p1Team':'p2Team']=t; next[tId][slot==='p1'?'p1Club':'p2Club']=c; }};
      const isSmall = fifaMatches.length === 4;
      if (isSmall) {
          if(matchId===0) { send(2,'p1',winner,wTeam,wClub); send(3,'p1',loser,lTeam,lClub); }
          if(matchId===1) { send(2,'p2',winner,wTeam,wClub); send(3,'p2',loser,lTeam,lClub); }
      } else {
          if(matchId<=3) send(matchId < 2 ? 4 : 5, matchId % 2 === 0 ? 'p1' : 'p2', winner, wTeam, wClub);
          if(matchId===4) { send(6,'p1',winner,wTeam,wClub); send(7,'p1',loser,lTeam,lClub); }
          if(matchId===5) { send(6,'p2',winner,wTeam,wClub); send(7,'p2',loser,lTeam,lClub); }
      }

      await setDoc(doc(db, "sala", "principal"), { fifaMatches: next }, { merge: true });
      const finalId = isSmall ? 2 : 6;
      if(matchId===finalId) { confetti({particleCount:500}); await addDoc(collection(db,"history"),{winner,winnerTeam:wTeam||"-",date:serverTimestamp(),type:gameMode}); }
      else lanzarFiesta();

    } catch (e) { console.error(e); }
  };

  // HELPERS
  const calcularPaliza = (matches: Match[]) => { 
      let maxDiff=0; let p=null; 
      matches.forEach(m=>{
          if(m.winner && m.score1!==undefined && m.score2!==undefined){
              const d=Math.abs(m.score1-m.score2);
              if(d>=3 && d>maxDiff){
                  maxDiff=d;
                  const w=m.score1>m.score2;
                  p={winner:w?m.p1:m.p2,loser:w?m.p2:m.p1,diff:d,result:`${m.score1}-${m.score2}`};
              }
          }
      }); 
      setMayorPaliza(p); 
  };
  const girarRuleta = async (tipo: 'soft'|'chupito') => { setIsSpinning(true); const l=tipo==='soft'?LISTA_SOFT:LISTA_CHUPITOS; let i=0; const int=setInterval(()=>{setResultadoRuleta(l[i%l.length]);i++},80); setTimeout(async()=>{clearInterval(int);const f=l[Math.floor(Math.random()*l.length)];setResultadoRuleta(f);setIsSpinning(false);await setDoc(doc(db,"sala","principal"),{ultimoCastigo:f},{merge:true});if(tipo==='chupito')confetti({particleCount:50,colors:['#ff0000']})},2000); };
  const handleSorteoPachanga = () => { const n=pachangaInput.split(/[\n,]+/).map(x=>x.trim()).filter(x=>x); if(n.length<2)return alert("Mínimo 2"); const s=[...n].sort(()=>Math.random()-0.5); const m=Math.ceil(s.length/2); setDoc(doc(db,"sala","principal"),{equipoA:s.slice(0,m),equipoB:s.slice(m)},{merge:true}); };
  const lanzarFiesta = () => { confetti({particleCount:150}); const a=new Audio("/gol.mp3"); a.volume=0.5; a.play().catch(()=>{}); };
  const startTimer = (s: number) => { setTimeLeft(s); setTimerActive(true); };
  const generarExcusa = () => setExcusa(EXCUSAS[Math.floor(Math.random() * EXCUSAS.length)]);
  
  const limpiarPizarra = async () => { 
      if(!confirm("¿Seguro que quieres empezar un torneo nuevo? Se borrará el cuadro actual.")) return;
      const batch = writeBatch(db);
      // Limpiamos los equipos, el cuadro y los castigos, PERO NO EL RANKING NI USUARIOS
      batch.set(doc(db,"sala","principal"),{equipoA:[],equipoB:[],fifaMatches:[],ultimoCastigo:"..."}); 
      
      // Limpiamos solo las apuestas pendientes, para que no se queden colgadas
      const qBets = query(collection(db, "bets"));
      const betsSnap = await getDocs(qBets);
      betsSnap.forEach((d) => batch.delete(d.ref));

      await batch.commit(); 
      alert("¡Torneo Nuevo Listo!"); 
      setShowSettings(false); 
  };

  useEffect(() => { if(timerActive && timeLeft>0){timerRef.current=setTimeout(()=>setTimeLeft(timeLeft-1),1000)}else if(timeLeft===0&&timerActive){setTimerActive(false);new Audio("https://www.myinstants.com/media/sounds/ding-sound-effect_2.mp3").play().catch(()=>{})}; return()=>clearTimeout(timerRef.current!)},[timeLeft,timerActive]);

  return (
    <main className="min-h-screen bg-neutral-950 text-white font-sans pb-32 overflow-x-hidden select-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-900 via-neutral-950 to-black">
      
      {/* --- APP HEADER COMPACTO --- */}
      <header className="fixed top-0 w-full bg-black/90 backdrop-blur-md z-50 border-b border-white/10 px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            <h1 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 italic tracking-tighter">
                TELETUBIES
            </h1>
        </div>
        
        <div className="flex items-center gap-3">
            {currentUser && (
                <div className="text-right leading-tight">
                    <p className="font-bold text-white text-xs">{currentUser.id}</p>
                    <p className="text-yellow-400 font-mono text-xs">{currentUser.balance} 💰</p>
                </div>
            )}
            {/* BOTÓN SETTINGS (SOLO ENGRANAJE) */}
            <button onClick={() => setShowSettings(!showSettings)} className="p-2 bg-neutral-800 rounded-full text-gray-400 hover:text-white transition">⚙️</button>
        </div>
      </header>

      {/* --- MENÚ AJUSTES (MODAL) --- */}
      {showSettings && (
          <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 animate-in fade-in" onClick={()=>setShowSettings(false)}>
              <div className="bg-neutral-900 border border-gray-700 p-6 rounded-2xl w-full max-w-xs space-y-3 shadow-2xl" onClick={e=>e.stopPropagation()}>
                  <h3 className="text-lg font-bold text-white mb-2 text-center">Menú de Gestión</h3>
                  
                  {/* SOLO UN BOTÓN DE RESET */}
                  <button onClick={limpiarPizarra} className="w-full bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-xl flex items-center justify-center gap-2 font-bold shadow-lg">
                      🔄 Empezar Nuevo Torneo
                  </button>
                  
                  {currentUser && (
                      <button onClick={logout} className="w-full bg-neutral-800 border border-gray-600 text-gray-300 hover:text-white p-3 rounded-xl flex items-center justify-center gap-2 mt-4">
                          Cerrar Sesión
                      </button>
                  )}
                  
                  <button onClick={()=>setShowSettings(false)} className="w-full text-center text-gray-500 text-sm mt-2 p-2">Cancelar</button>
              </div>
          </div>
      )}

      {/* PADDING TOP AJUSTADO (pt-24) PARA QUE NO SE CORTE NADA */}
      <div className="pt-24 max-w-4xl mx-auto p-4 md:p-6 min-h-screen">
        
        {/* PERFIL */}
        {activeTab === 'perfil' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4">
                {!currentUser ? (
                    <div className="max-w-sm mx-auto bg-neutral-900/50 p-8 rounded-3xl border border-white/10 shadow-2xl">
                        {!isRegistering ? (
                            <>
                                <h2 className="text-2xl font-black text-center mb-6 text-blue-400">INICIAR SESIÓN</h2>
                                <input type="text" placeholder="Usuario" className="w-full bg-black/50 p-4 rounded-xl border border-gray-700 mb-3 text-white focus:outline-none focus:border-blue-500 transition" value={loginName} onChange={e=>setLoginName(e.target.value)} />
                                <input type="password" placeholder="Contraseña" className="w-full bg-black/50 p-4 rounded-xl border border-gray-700 mb-6 text-white focus:outline-none focus:border-blue-500 transition" value={loginPass} onChange={e=>setLoginPass(e.target.value)} />
                                <button onClick={handleLogin} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold p-4 rounded-xl shadow-lg shadow-blue-900/20 mb-4 transition transform active:scale-95">ENTRAR</button>
                                <p className="text-center text-gray-500 text-sm">¿No tienes cuenta? <button onClick={()=>setIsRegistering(true)} className="text-white underline">Regístrate</button></p>
                            </>
                        ) : (
                            <>
                                <h2 className="text-2xl font-black text-center mb-6 text-purple-400">CREAR FICHAJE</h2>
                                <input type="text" placeholder="Nombre" className="w-full bg-black/50 p-4 rounded-xl border border-gray-700 mb-3 text-white" value={regName} onChange={e=>setRegName(e.target.value)} />
                                <input type="text" placeholder="Nombre Club (ej: Aston Birra)" className="w-full bg-black/50 p-4 rounded-xl border border-gray-700 mb-3 text-white" value={regClub} onChange={e=>setRegClub(e.target.value)} />
                                <input type="password" placeholder="Contraseña" className="w-full bg-black/50 p-4 rounded-xl border border-gray-700 mb-6 text-white" value={regPass} onChange={e=>setRegPass(e.target.value)} />
                                <button onClick={handleRegister} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold p-4 rounded-xl shadow-lg mb-4 transition transform active:scale-95">FIRMAR CONTRATO</button>
                                <p className="text-center text-gray-500 text-sm"><button onClick={()=>setIsRegistering(false)} className="text-white">Volver al login</button></p>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-gradient-to-br from-blue-900/40 to-purple-900/40 p-6 rounded-3xl border border-white/10 flex items-center justify-between shadow-lg">
                            <div><h2 className="text-3xl font-black text-white">{currentUser.id}</h2><p className="text-blue-300 font-bold">{currentUser.clubName}</p></div>
                            <div className="text-right"><p className="text-xs text-gray-400 uppercase tracking-widest">Saldo Actual</p><p className="text-4xl font-mono font-black text-yellow-400">{currentUser.balance}</p></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-neutral-900/50 p-4 rounded-2xl border border-white/5 text-center"><p className="text-2xl font-black text-green-400">{ranking.find(r=>r.nombre===currentUser.id)?.victorias || 0}</p><p className="text-xs text-gray-500 uppercase">Victorias</p></div>
                            <div className="bg-neutral-900/50 p-4 rounded-2xl border border-white/5 text-center"><p className="text-2xl font-black text-purple-400">{ranking.find(r=>r.nombre===currentUser.id)?.puntos || 0}</p><p className="text-xs text-gray-500 uppercase">Puntos</p></div>
                        </div>
                        <div className="bg-neutral-900/30 p-6 rounded-3xl border border-white/5">
                            <h3 className="font-bold text-gray-400 mb-4">Tus Últimas Apuestas</h3>
                            <div className="space-y-2">
                                {activeBets.filter(b => b.bettor === currentUser.id).map(b => (
                                    <div key={b.id} className="flex justify-between items-center text-sm p-3 bg-black/20 rounded-xl border border-white/5">
                                        <span>Apuesta a <span className="text-blue-300 font-bold">{b.chosenWinner}</span></span>
                                        <span className={`font-bold ${b.status==='won'?'text-green-400':b.status==='lost'?'text-red-500':'text-yellow-500'}`}>{b.status==='won' ? `+${b.amount*2}` : b.status==='lost' ? `-${b.amount}` : 'Pendiente'}</span>
                                    </div>
                                ))}
                                {activeBets.filter(b => b.bettor === currentUser.id).length === 0 && <p className="text-gray-500 text-xs text-center py-4">No has apostado aún.</p>}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* FIFA */}
        {activeTab === 'fifa' && (
            <section className="animate-in slide-in-from-bottom-4">
                {fifaMatches.length === 0 && (
                    <div className="bg-neutral-900/40 p-6 rounded-3xl border border-green-500/20 mb-8">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-green-400">Configurar Torneo</h2>
                            <div className="bg-black/40 p-1 rounded-lg flex gap-1">
                                <button onClick={()=>setGameMode('1vs1')} className={`px-3 py-1 rounded text-xs font-bold ${gameMode==='1vs1'?'bg-green-600 text-white':'text-gray-400'}`}>1v1</button>
                                <button onClick={()=>setGameMode('2vs2')} className={`px-3 py-1 rounded text-xs font-bold ${gameMode==='2vs2'?'bg-green-600 text-white':'text-gray-400'}`}>2v2</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-6">
                            {users.map(u => (
                                <button key={u.id} onClick={()=>togglePlayerSelection(u.id)} className={`p-2 rounded-lg border text-xs font-bold truncate transition ${selectedPlayers.includes(u.id)?'bg-green-600 border-green-400 text-white':'bg-black/40 border-gray-700 text-gray-400'}`}>
                                    {u.id}
                                </button>
                            ))}
                        </div>
                        <button onClick={handleCrearTorneo} className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-4 rounded-xl shadow-lg transition transform active:scale-95">🏆 CREAR CUADRO ({selectedPlayers.length})</button>
                    </div>
                )}

                {fifaMatches.length > 0 && (
                    <div className="w-full pb-24">
                        <div className="md:hidden flex flex-col gap-6">
                            <h3 className="text-center font-bold text-gray-500 text-xs tracking-widest uppercase">Ronda 1</h3>
                            {(fifaMatches.length===4 ? [0,1] : [0,1,2,3]).map(id => <MatchCard key={id} m={fifaMatches[id]} onFinish={finalizarPartido} />)}
                            {fifaMatches.length===8 && (<><h3 className="text-center font-bold text-gray-500 text-xs tracking-widest uppercase mt-4">Semis</h3>{[4,5].map(id => <MatchCard key={id} m={fifaMatches[id]} onFinish={finalizarPartido} />)}</>)}
                            <h3 className="text-center font-bold text-yellow-500 text-xs tracking-widest uppercase mt-4">FINAL</h3>
                            <MatchCard m={fifaMatches[fifaMatches.length===4 ? 2 : 6]} onFinish={finalizarPartido} isFinal />
                            <h3 className="text-center font-bold text-orange-400 text-xs tracking-widest uppercase mt-4">3º Puesto</h3>
                            <MatchCard m={fifaMatches[fifaMatches.length===4 ? 3 : 7]} onFinish={finalizarPartido} />
                        </div>
                        <div className="hidden md:block grid grid-cols-3 gap-8">
                            <div className="flex flex-col gap-4">{(fifaMatches.length===4 ? [0,1] : [0,1,2,3]).map(id => <MatchCard key={id} m={fifaMatches[id]} onFinish={finalizarPartido} />)}</div>
                            <div className="flex flex-col justify-center gap-4">{fifaMatches.length===8 && [4,5].map(id => <MatchCard key={id} m={fifaMatches[id]} onFinish={finalizarPartido} />)}</div>
                            <div className="flex flex-col justify-center gap-4"><MatchCard m={fifaMatches[fifaMatches.length===4 ? 2 : 6]} onFinish={finalizarPartido} isFinal /><MatchCard m={fifaMatches[fifaMatches.length===4 ? 3 : 7]} onFinish={finalizarPartido} /></div>
                        </div>
                    </div>
                )}
            </section>
        )}

        {/* APUESTAS */}
        {activeTab === 'apuestas' && (
            <div className="max-w-xl mx-auto space-y-6 animate-in slide-in-from-bottom-4">
                {!currentUser ? <div className="text-center p-10 text-gray-500 bg-neutral-900/30 rounded-3xl border border-white/5">🔒 Inicia sesión en tu perfil para apostar.</div> : (
                    <>
                        <div className="bg-black/60 border border-yellow-500/30 p-6 rounded-3xl">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold text-yellow-400">Nueva Apuesta</h2>
                                <span className="text-xs text-gray-400">Saldo: {currentUser.balance}</span>
                            </div>
                            {fifaMatches.length > 0 ? (
                                <div className="space-y-4">
                                    <select className="w-full bg-neutral-800 p-3 rounded-xl border border-gray-600 text-white" onChange={e=>{const m=fifaMatches.find(x=>x.id===parseInt(e.target.value));setSelectedMatchId(parseInt(e.target.value));setBetTarget("");}}>
                                        <option value="">⚽ Selecciona Partido</option>
                                        {fifaMatches.filter(m => !m.winner && !m.isBye).map(m => (<option key={m.id} value={m.id}>{m.p1} vs {m.p2}</option>))}
                                    </select>
                                    {selectedMatchId !== null && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <button onClick={()=>setBetTarget(fifaMatches[selectedMatchId!].p1)} className={`p-3 rounded-xl border text-sm font-bold ${betTarget===fifaMatches[selectedMatchId!].p1?'bg-green-600 border-green-400':'bg-neutral-800 border-gray-600'}`}>{fifaMatches[selectedMatchId!].p1}</button>
                                            <button onClick={()=>setBetTarget(fifaMatches[selectedMatchId!].p2)} className={`p-3 rounded-xl border text-sm font-bold ${betTarget===fifaMatches[selectedMatchId!].p2?'bg-green-600 border-green-400':'bg-neutral-800 border-gray-600'}`}>{fifaMatches[selectedMatchId!].p2}</button>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2"><span className="text-xl">💰</span><input type="number" className="flex-1 bg-neutral-800 p-3 rounded-xl border border-gray-600 text-white" value={betAmount} onChange={e=>setBetAmount(parseInt(e.target.value))} /></div>
                                    <button onClick={realizarApuesta} className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-black p-4 rounded-xl shadow-lg transition transform active:scale-95">CONFIRMAR APUESTA</button>
                                </div>
                            ) : (<p className="text-center text-gray-500">No hay partidos activos.</p>)}
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-400 uppercase text-xs mb-2">Apuestas Globales</h3>
                            <div className="space-y-2">{activeBets.filter(b => b.status === 'pending').map(b => (<div key={b.id} className="bg-neutral-900/50 p-3 rounded-xl border border-white/5 flex justify-between items-center"><div><span className="font-bold text-yellow-400">{b.bettor}</span> vs <span className="font-bold text-blue-400">{b.chosenWinner}</span></div><span className="font-mono">{b.amount} 💰</span></div>))}{activeBets.filter(b => b.status === 'pending').length === 0 && <p className="text-gray-600 text-sm text-center">Sin apuestas activas.</p>}</div>
                        </div>
                    </>
                )}
            </div>
        )}

        {/* PACHANGA */}
        {activeTab === 'pachanga' && (<section className="max-w-xl mx-auto"><h2 className="text-xl font-bold text-green-400 mb-4">Generador Equipos</h2><textarea className="w-full h-24 bg-black/40 border border-gray-700 rounded-xl p-4 text-white mb-4" placeholder="Lista de nombres..." value={pachangaInput} onChange={e=>setPachangaInput(e.target.value)}></textarea><button onClick={handleSorteoPachanga} className="w-full bg-green-600 text-white font-black py-3 rounded-xl mb-6">MEZCLAR</button>{equipoA.length > 0 && (<div className="grid grid-cols-2 gap-4"><div className="bg-red-900/20 p-4 rounded-xl border border-red-500/30"><h3 className="text-red-400 font-bold mb-2 text-center">ROJOS</h3>{equipoA.map(p=><div key={p} className="text-center text-sm">{p}</div>)}</div><div className="bg-blue-900/20 p-4 rounded-xl border border-blue-500/30"><h3 className="text-blue-400 font-bold mb-2 text-center">AZULES</h3>{equipoB.map(p=><div key={p} className="text-center text-sm">{p}</div>)}</div></div>)}</section>)}

        {/* CASTIGOS */}
        {activeTab === 'castigos' && (<section className="max-w-md mx-auto text-center"><div className="bg-black/60 border-2 border-red-600 p-8 rounded-3xl mb-8"><h2 className="text-red-500 font-black uppercase tracking-widest mb-4">Sentencia</h2><p className={`text-2xl font-black ${isSpinning?'blur-md text-red-500/50':'text-white'}`}>{resultadoRuleta}</p></div><div className="mb-8"><div className="flex justify-center gap-2 mb-2"><button onClick={()=>startTimer(30)} className="bg-gray-800 px-3 py-1 rounded text-xs">30s</button><button onClick={()=>startTimer(60)} className="bg-gray-800 px-3 py-1 rounded text-xs">1min</button><button onClick={()=>setTimeLeft(0)} className="bg-red-900/50 px-3 py-1 rounded text-xs">Parar</button></div><div className="text-4xl font-mono">{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</div></div><button onClick={generarExcusa} className="w-full bg-blue-900/30 text-blue-300 font-bold py-3 rounded-xl mb-6">😭 Excusa</button>{excusa && <div className="text-white italic mb-6">"{excusa}"</div>}<div className="grid grid-cols-2 gap-4"><button disabled={isSpinning} onClick={()=>girarRuleta('soft')} className="bg-neutral-800 p-4 rounded-xl">🤡 Soft</button><button disabled={isSpinning} onClick={()=>girarRuleta('chupito')} className="bg-red-950 p-4 rounded-xl text-red-200">🥃 Chupito</button></div></section>)}

      </div>

      {/* EXTRAS */}
      {mayorPaliza && (<div className="fixed top-24 left-1/2 -translate-x-1/2 w-11/12 max-w-sm bg-gradient-to-r from-pink-950 to-red-950 border border-pink-500 p-4 rounded-xl flex items-center justify-between shadow-2xl z-40 animate-in zoom-in"><div className="text-xs"><p className="text-pink-400 font-bold">PALIZA</p><p>{mayorPaliza.winner} humilló a {mayorPaliza.loser}</p></div><span className="text-xl font-black">{mayorPaliza.result}</span></div>)}
      <div className="fixed bottom-24 right-4 z-40 flex flex-col items-end gap-2"><button onClick={() => setShowDJ(!showDJ)} className="bg-purple-600 text-white p-3 rounded-full shadow-2xl border-2 border-white/20">{showDJ ? '✖️' : '🔊'}</button>{showDJ && (<div className="bg-black/90 p-4 rounded-2xl border border-purple-500/30 backdrop-blur-md mb-2 flex flex-col gap-2"><SoundBtn label="📢 BOCINA" url="https://www.myinstants.com/media/sounds/mlg-airhorn.mp3" color="bg-red-600" /><SoundBtn label="🎻 VIOLÍN" url="https://www.myinstants.com/media/sounds/sad-violin-airhorn.mp3" color="bg-blue-600" /><SoundBtn label="🦗 GRILLOS" url="https://www.myinstants.com/media/sounds/cricket_1.mp3" color="bg-green-600" /><SoundBtn label="👏 APLAUSO" url="https://www.myinstants.com/media/sounds/aplausos_1.mp3" color="bg-yellow-600" /><SoundBtn label="😡 BUUU" url="https://www.myinstants.com/media/sounds/boo.mp3" color="bg-gray-600" /><SoundBtn label="🐐 SIUUU" url="https://www.myinstants.com/media/sounds/siu.mp3" color="bg-neutral-800" /></div>)}</div>

      {/* DOCK */}
      <nav className="fixed bottom-4 left-4 right-4 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl flex justify-around p-1 shadow-2xl z-50">
          <NavBtn icon="👤" label="Perfil" active={activeTab==='perfil'} onClick={()=>setActiveTab('perfil')} />
          <NavBtn icon="🏆" label="FIFA" active={activeTab==='fifa'} onClick={()=>setActiveTab('fifa')} />
          <NavBtn icon="💸" label="Apostar" active={activeTab==='apuestas'} onClick={()=>setActiveTab('apuestas')} />
          <NavBtn icon="⚽" label="Mix" active={activeTab==='pachanga'} onClick={()=>setActiveTab('pachanga')} />
          <NavBtn icon="💀" label="Ruleta" active={activeTab==='castigos'} onClick={()=>setActiveTab('castigos')} />
      </nav>

    </main>
  );
}

function NavBtn({icon, label, active, onClick}:any) {
    return (
        <button onClick={onClick} className={`flex flex-col items-center justify-center w-full py-2 rounded-xl transition ${active ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            <span className="text-xl mb-0.5">{icon}</span>
            <span className="text-[9px] font-bold uppercase tracking-wide">{label}</span>
        </button>
    )
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
                    <div className="w-1/3 text-right overflow-hidden"><span className={`text-xs font-bold block truncate ${m.winner===m.p1?'text-green-400':'text-gray-500 line-through'}`}>{m.p1}</span><span className="text-[9px] text-gray-400 block truncate">{m.p1Team}</span></div>
                    <div className="bg-black/60 px-2 py-1 rounded text-xs font-bold">{m.score1}-{m.score2}</div>
                    <div className="w-1/3 text-left overflow-hidden"><span className={`text-xs font-bold block truncate ${m.winner===m.p2?'text-green-400':'text-gray-500 line-through'}`}>{m.p2}</span><span className="text-[9px] text-gray-400 block truncate">{m.p2Team}</span></div>
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