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
  
  // ESTADO
  const [gameMode, setGameMode] = useState<'1vs1' | '2vs2'>('1vs1');
  const [mayorPaliza, setMayorPaliza] = useState<{winner: string, loser: string, diff: number, result: string} | null>(null);
  
  // FORMULARIOS
  const [loginName, setLoginName] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [regName, setRegName] = useState("");
  const [regClub, setRegClub] = useState("");
  const [regPass, setRegPass] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [betAmount, setBetAmount] = useState<number>(100);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [betTarget, setBetTarget] = useState<string>("");

  // EXTRA
  const [resultadoRuleta, setResultadoRuleta] = useState<string>("☠️ Gira la ruleta...");
  const [excusa, setExcusa] = useState<string | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [showDJ, setShowDJ] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [pachangaInput, setPachangaInput] = useState("");
  const [equipoA, setEquipoA] = useState<string[]>([]);
  const [equipoB, setEquipoB] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // LISTAS
  const TEAMS_REAL = ["Man. City", "Real Madrid", "Bayern", "Liverpool", "Arsenal", "Inter", "PSG", "Barça", "Atleti", "Leverkusen", "Milan", "Juve", "Dortmund", "Chelsea", "Napoli", "Spurs", "Villa", "Newcastle"];
  const TEAMS_FUNNY = ["Aston Birra", "Nottingham Prisa", "Inter de Mitente", "Vodka Juniors", "Rayo Vayacaño", "Coca Juniors", "Maccabi de Levantar", "Steaua del Grifo", "Schalke Te Meto", "Abuelos FC", "Patético de Madrid", "Bajern de Munich", "Real Suciedad", "Olimpique de Marsopa", "West Jamón", "Levante en Barra", "Borussia de la Birra", "Peshownal", "Estrella Coja", "Fenerbache el Vaso"];
  const EXCUSAS = ["Mando roto", "Lag", "Handicap", "Sol en la cara", "Probando tácticas", "Árbitro comprado", "Jugador bugueado", "Dedos fríos", "5 defensas", "Portero manco"];
  const LISTA_SOFT = ["10 Flexiones", "Audio cantando", "Baila 30s", "Silencio 1 ronda", "Comentarista", "Enseña última foto", "Sirve bebida"];
  const LISTA_CHUPITOS = ["1 Chupito", "2 Chupitos", "Cascada", "Elige compañero", "Te libras", "CHUPITO MORTAL"];

  // LISTENERS
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
        if (currentUser) { const updated = usersList.find(u => u.id === currentUser.id); if (updated) setCurrentUser(updated); }
    });
    const unsubBets = onSnapshot(query(collection(db, "bets")), (snap) => setActiveBets(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Bet[]));
    const unsubRank = onSnapshot(query(collection(db, "ranking"), orderBy("puntos", "desc")), (snap) => setRanking(snap.docs.map(d => ({ nombre: d.id, ...d.data() } as any))));
    const unsubHist = onSnapshot(query(collection(db, "history"), orderBy("date", "desc")), (snap) => setHistory(snap.docs.map(d => d.data()) as HistoryItem[]));
    return () => { unsubSala(); unsubUsers(); unsubBets(); unsubRank(); unsubHist(); };
  }, [currentUser?.id]);

  // AUTH
  const handleLogin = () => {
      const user = users.find(u => u.id.toLowerCase() === loginName.toLowerCase());
      if (!user || user.password !== loginPass) return alert("Error de credenciales");
      setCurrentUser(user); setLoginName(""); setLoginPass("");
  };
  const handleRegister = async () => {
      if (!regName || !regClub || !regPass) return alert("Rellena todo");
      if (users.find(u => u.id.toLowerCase() === regName.toLowerCase())) return alert("Nombre ocupado");
      const newUser = { clubName: regClub, balance: STARTING_BALANCE, password: regPass };
      await setDoc(doc(db, "users", regName), newUser);
      setCurrentUser({ id: regName, ...newUser }); setIsRegistering(false);
  };
  const logout = () => { setCurrentUser(null); setShowSettings(false); };

  // LOGICA JUEGO
  const togglePlayerSelection = (name: string) => {
      if (selectedPlayers.includes(name)) setSelectedPlayers(selectedPlayers.filter(p => p !== name));
      else { if (selectedPlayers.length >= 16) return alert("Máximo 16"); setSelectedPlayers([...selectedPlayers, name]); }
  };

  const handleCrearTorneo = async () => {
      if (selectedPlayers.length < 2) return alert("Mínimo 2 jugadores");
      let players = [...selectedPlayers];
      let targetSize = players.length <= 4 ? 4 : 8;
      if (players.length > 8) return alert("Máx 8 jugadores (próximamente más)");
      while (players.length < targetSize) players.push(BYE_NAME);

      const shuffledP = [...players].sort(() => Math.random() - 0.5);
      const shuffledT = [...TEAMS_REAL].sort(() => Math.random() - 0.5);

      const getMatchData = (idx: number) => {
          const name = shuffledP[idx];
          const isBye = name === BYE_NAME;
          const u = users.find(user => user.id === name);
          return { name: name, team: isBye ? null : shuffledT[idx], club: isBye ? null : (u?.clubName || "Invitado") };
      };

      let matches: Match[] = [];
      // Generar Cuadro
      if (targetSize === 4) {
          matches = [
              { id: 0, p1: getMatchData(0).name, p1Team: getMatchData(0).team, p1Club: getMatchData(0).club, p2: getMatchData(1).name, p2Team: getMatchData(1).team, p2Club: getMatchData(1).club, round: 'S' },
              { id: 1, p1: getMatchData(2).name, p1Team: getMatchData(2).team, p1Club: getMatchData(2).club, p2: getMatchData(3).name, p2Team: getMatchData(3).team, p2Club: getMatchData(3).club, round: 'S' },
              { id: 2, p1: "Esperando...", p2: "Esperando...", round: 'F' }, { id: 3, p1: "Esperando...", p2: "Esperando...", round: '3rd' }
          ];
      } else {
          matches = [
              { id: 0, p1: getMatchData(0).name, p1Team: getMatchData(0).team, p1Club: getMatchData(0).club, p2: getMatchData(1).name, p2Team: getMatchData(1).team, p2Club: getMatchData(1).club, round: 'Q' },
              { id: 1, p1: getMatchData(2).name, p1Team: getMatchData(2).team, p1Club: getMatchData(2).club, p2: getMatchData(3).name, p2Team: getMatchData(3).team, p2Club: getMatchData(3).club, round: 'Q' },
              { id: 2, p1: getMatchData(4).name, p1Team: getMatchData(4).team, p1Club: getMatchData(4).club, p2: getMatchData(5).name, p2Team: getMatchData(5).team, p2Club: getMatchData(5).club, round: 'Q' },
              { id: 3, p1: getMatchData(6).name, p1Team: getMatchData(6).team, p1Club: getMatchData(6).club, p2: getMatchData(7).name, p2Team: getMatchData(7).team, p2Club: getMatchData(7).club, round: 'Q' },
              { id: 4, p1: "Esperando...", p2: "Esperando...", round: 'S' }, { id: 5, p1: "Esperando...", p2: "Esperando...", round: 'S' },
              { id: 6, p1: "Esperando...", p2: "Esperando...", round: 'F' }, { id: 7, p1: "Esperando...", p2: "Esperando...", round: '3rd' }
          ];
      }

      // Propagar BYEs
      matches.forEach(m => { if(m.p2===BYE_NAME){m.winner=m.p1;m.isBye=true} else if(m.p1===BYE_NAME){m.winner=m.p2;m.isBye=true} });
      const propagate = (tIdx: number, slot: 'p1'|'p2', s: Match) => {
        const wKey = s.winner===s.p1?'p1':'p2';
        matches[tIdx][slot] = s.winner!;
        matches[tIdx][slot==='p1'?'p1Team':'p2Team'] = s[wKey==='p1'?'p1Team':'p2Team'] || null;
        matches[tIdx][slot==='p1'?'p1Club':'p2Club'] = s[wKey==='p1'?'p1Club':'p2Club'] || null;
      };
      if(targetSize===4) { if(matches[0].winner) propagate(2,'p1',matches[0]); if(matches[1].winner) propagate(2,'p2',matches[1]); }
      else { if(matches[0].winner) propagate(4,'p1',matches[0]); if(matches[1].winner) propagate(4,'p2',matches[1]); if(matches[2].winner) propagate(5,'p1',matches[2]); if(matches[3].winner) propagate(5,'p2',matches[3]); }

      const clean = matches.map(m => JSON.parse(JSON.stringify(m, (k, v) => v === undefined ? null : v)));
      await setDoc(doc(db, "sala", "principal"), { fifaMatches: clean }, { merge: true });
      setActiveTab('fifa');
  };

  const finalizarPartido = async (matchId: number, s1: number, s2: number) => {
    if (s1 === s2) return alert("No valen empates");
    const m = fifaMatches.find(x => x.id === matchId);
    if (!m) return;
    
    const isP1 = s1 > s2;
    const winner = isP1 ? m.p1 : m.p2; const loser = isP1 ? m.p2 : m.p1;
    const wTeam = isP1 ? m.p1Team : m.p2Team; const wClub = isP1 ? m.p1Club : m.p2Club;
    const lTeam = isP1 ? m.p2Team : m.p1Team; const lClub = isP1 ? m.p2Club : m.p1Club;

    try {
      // Apuestas
      const pending = activeBets.filter(b => b.matchId === matchId && b.status === 'pending');
      const batch = writeBatch(db);
      pending.forEach(b => {
          const ref = doc(db, "bets", b.id);
          if (b.chosenWinner === winner) { batch.update(doc(db, "users", b.bettor), { balance: increment(b.amount * 2) }); batch.update(ref, { status: 'won' }); }
          else batch.update(ref, { status: 'lost' });
      });
      await batch.commit();

      if (gameMode === '1vs1' && !m.isBye && winner !== "Esperando...") { await setDoc(doc(db, "ranking", winner), { puntos: increment(3), victorias: increment(1) }, { merge: true }); }
      
      let next = [...fifaMatches];
      next = next.map(x => x.id === matchId ? { ...x, score1: s1, score2: s2, winner: winner } : x);

      const send = (tId: number, slot: 'p1'|'p2', n: string, t: any, c: any) => { if(next[tId]){ next[tId][slot]=n; next[tId][slot==='p1'?'p1Team':'p2Team']=t; next[tId][slot==='p1'?'p1Club':'p2Club']=c; }};
      const isSmall = fifaMatches.length === 4;
      if (isSmall) { if(matchId===0) { send(2,'p1',winner,wTeam,wClub); send(3,'p1',loser,lTeam,lClub); } if(matchId===1) { send(2,'p2',winner,wTeam,wClub); send(3,'p2',loser,lTeam,lClub); } }
      else { if(matchId<=3) send(matchId < 2 ? 4 : 5, matchId % 2 === 0 ? 'p1' : 'p2', winner, wTeam, wClub); if(matchId===4) { send(6,'p1',winner,wTeam,wClub); send(7,'p1',loser,lTeam,lClub); } if(matchId===5) { send(6,'p2',winner,wTeam,wClub); send(7,'p2',loser,lTeam,lClub); } }

      await setDoc(doc(db, "sala", "principal"), { fifaMatches: next }, { merge: true });
      const finalId = isSmall ? 2 : 6;
      if(matchId===finalId) { confetti({particleCount:500}); await addDoc(collection(db,"history"),{winner,winnerTeam:wTeam||"-",date:serverTimestamp(),type:gameMode}); }
      else lanzarFiesta();
    } catch (e) { console.error(e); }
  };

  const realizarApuesta = async () => {
      if (!currentUser || selectedMatchId===null || !betTarget || betAmount<=0) return alert("Datos inválidos");
      if (currentUser.balance < betAmount) return alert("Sin fondos");
      await setDoc(doc(db, "users", currentUser.id), { balance: increment(-betAmount) }, { merge: true });
      await addDoc(collection(db, "bets"), { matchId: selectedMatchId, bettor: currentUser.id, chosenWinner: betTarget, amount: betAmount, status: 'pending' });
      alert("Apuesta realizada");
  };

  // HELPERS
  const calcularPaliza = (matches: Match[]) => { let max=0; let p=null; matches.forEach(m=>{if(m.winner && m.score1!==undefined && m.score2!==undefined){const d=Math.abs(m.score1-m.score2);if(d>=3 && d>max){max=d;const w=m.score1>m.score2;p={winner:w?m.p1:m.p2,loser:w?m.p2:m.p1,diff:d,result:`${m.score1}-${m.score2}`}}}}); setMayorPaliza(p); };
  const girarRuleta = async (t: 'soft'|'chupito') => { setIsSpinning(true); const l=t==='soft'?LISTA_SOFT:LISTA_CHUPITOS; let i=0; const int=setInterval(()=>{setResultadoRuleta(l[i%l.length]);i++},80); setTimeout(async()=>{clearInterval(int);const f=l[Math.floor(Math.random()*l.length)];setResultadoRuleta(f);setIsSpinning(false);await setDoc(doc(db,"sala","principal"),{ultimoCastigo:f},{merge:true});if(t==='chupito')confetti({particleCount:50,colors:['#ff0000']})},2000); };
  const handleSorteoPachanga = () => { const n=pachangaInput.split(/[\n,]+/).map(x=>x.trim()).filter(x=>x); if(n.length<2)return alert("Mínimo 2"); const s=[...n].sort(()=>Math.random()-0.5); const m=Math.ceil(s.length/2); setDoc(doc(db,"sala","principal"),{equipoA:s.slice(0,m),equipoB:s.slice(m)},{merge:true}); };
  const lanzarFiesta = () => { confetti({particleCount:150}); const a=new Audio("/gol.mp3"); a.volume=0.5; a.play().catch(()=>{}); };
  const startTimer = (s: number) => { setTimeLeft(s); setTimerActive(true); };
  const limpiarPizarra = async () => { if(confirm("¿Empezar torneo nuevo?")) { const b=writeBatch(db); b.set(doc(db,"sala","principal"),{equipoA:[],equipoB:[],fifaMatches:[],ultimoCastigo:"..."}); (await getDocs(query(collection(db,"bets")))).forEach(d=>b.delete(d.ref)); await b.commit(); setShowSettings(false); }};
  
  useEffect(() => { if(timerActive && timeLeft>0){timerRef.current=setTimeout(()=>setTimeLeft(timeLeft-1),1000)}else if(timeLeft===0&&timerActive){setTimerActive(false);new Audio("https://www.myinstants.com/media/sounds/ding-sound-effect_2.mp3").play().catch(()=>{})}; return()=>clearTimeout(timerRef.current!)},[timeLeft,timerActive]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0a192f] to-[#020c1b] text-white font-sans overflow-x-hidden select-none pb-32">
      
      {/* HEADER APP-LIKE */}
      <header className="sticky top-0 z-50 bg-[#0a192f]/90 backdrop-blur-md border-b border-cyan-500/20 px-4 h-16 flex items-center justify-between shadow-lg shadow-cyan-900/10">
        <div className="flex items-center gap-2">
            <span className="text-2xl drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">🏆</span>
            <h1 className="text-xl font-black italic tracking-tighter text-white drop-shadow-[2px_2px_0px_#000]">
                TOURNAMENT <span className="text-cyan-400">CUP</span>
            </h1>
        </div>
        <div className="flex items-center gap-3">
            {currentUser && <div className="text-right leading-tight"><p className="font-bold text-white text-xs">{currentUser.id}</p><p className="text-yellow-400 font-mono text-xs">{currentUser.balance} $</p></div>}
            <button onClick={() => setShowSettings(true)} className="p-2 bg-slate-800 rounded-full text-cyan-400 hover:bg-cyan-900/50 transition">⚙️</button>
        </div>
      </header>

      {/* SETTINGS MODAL */}
      {showSettings && (
          <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 animate-in fade-in" onClick={()=>setShowSettings(false)}>
              <div className="bg-[#112240] border border-cyan-500/30 p-6 rounded-2xl w-full max-w-xs space-y-3 shadow-[0_0_30px_rgba(6,182,212,0.2)]" onClick={e=>e.stopPropagation()}>
                  <h3 className="text-lg font-bold text-cyan-400 mb-2 text-center uppercase tracking-widest">Admin Zone</h3>
                  <button onClick={limpiarPizarra} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white p-3 rounded-xl font-bold shadow-lg uppercase text-sm">🔄 Nuevo Torneo</button>
                  {currentUser && <button onClick={logout} className="w-full bg-slate-800 text-gray-300 p-3 rounded-xl uppercase text-sm">Cerrar Sesión</button>}
                  <button onClick={()=>setShowSettings(false)} className="w-full text-center text-gray-500 text-xs mt-2 p-2">Cancelar</button>
              </div>
          </div>
      )}

      <div className="max-w-4xl mx-auto p-4 md:p-6">
        {/* TABS CONTENT */}
        
        {/* PERFIL */}
        {activeTab === 'perfil' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4">
                {!currentUser ? (
                    <div className="max-w-sm mx-auto bg-[#112240] p-8 rounded-2xl border border-cyan-500/20 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-600"></div>
                        {!isRegistering ? (
                            <>
                                <h2 className="text-2xl font-black text-center mb-6 text-white uppercase italic">Login</h2>
                                <input type="text" placeholder="Usuario" className="w-full bg-[#0a192f] p-4 rounded-lg border border-slate-700 mb-3 text-white focus:border-cyan-500 outline-none" value={loginName} onChange={e=>setLoginName(e.target.value)} />
                                <input type="password" placeholder="Contraseña" className="w-full bg-[#0a192f] p-4 rounded-lg border border-slate-700 mb-6 text-white focus:border-cyan-500 outline-none" value={loginPass} onChange={e=>setLoginPass(e.target.value)} />
                                <button onClick={handleLogin} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold p-4 rounded-lg uppercase tracking-wider shadow-lg">Entrar</button>
                                <p className="text-center text-gray-500 text-sm mt-4 cursor-pointer hover:text-white" onClick={()=>setIsRegistering(true)}>Crear cuenta</p>
                            </>
                        ) : (
                            <>
                                <h2 className="text-2xl font-black text-center mb-6 text-white uppercase italic">Registro</h2>
                                <input className="w-full bg-[#0a192f] p-4 rounded-lg border border-slate-700 mb-3 text-white" placeholder="Nombre" value={regName} onChange={e=>setRegName(e.target.value)} />
                                <input className="w-full bg-[#0a192f] p-4 rounded-lg border border-slate-700 mb-3 text-white" placeholder="Club (ej: Aston Birra)" value={regClub} onChange={e=>setRegClub(e.target.value)} />
                                <input className="w-full bg-[#0a192f] p-4 rounded-lg border border-slate-700 mb-6 text-white" type="password" placeholder="Contraseña" value={regPass} onChange={e=>setRegPass(e.target.value)} />
                                <button onClick={handleRegister} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold p-4 rounded-lg uppercase tracking-wider">Crear</button>
                                <p className="text-center text-gray-500 text-sm mt-4 cursor-pointer hover:text-white" onClick={()=>setIsRegistering(false)}>Volver</p>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-gradient-to-r from-cyan-900/20 to-blue-900/20 p-6 rounded-2xl border border-cyan-500/30 flex items-center justify-between">
                            <div><h2 className="text-3xl font-black text-white italic">{currentUser.id}</h2><p className="text-cyan-400 font-bold uppercase text-sm">{currentUser.clubName}</p></div>
                            <div className="text-right"><p className="text-xs text-gray-400 uppercase tracking-widest">Saldo</p><p className="text-4xl font-mono font-black text-yellow-400">{currentUser.balance}</p></div>
                        </div>
                        <div className="bg-[#112240] p-6 rounded-2xl border border-white/5">
                            <h3 className="font-bold text-gray-400 mb-4 uppercase text-xs tracking-wider">Tus Apuestas</h3>
                            <div className="space-y-2">
                                {activeBets.filter(b => b.bettor === currentUser.id).map(b => (
                                    <div key={b.id} className="flex justify-between items-center text-sm p-3 bg-[#0a192f] rounded-lg border-l-4 border-cyan-500">
                                        <span>Apostaste a <span className="text-white font-bold">{b.chosenWinner}</span></span>
                                        <span className={`font-bold ${b.status==='won'?'text-green-400':b.status==='lost'?'text-red-500':'text-yellow-500'}`}>{b.status==='won' ? `+${b.amount*2}` : b.status==='lost' ? `-${b.amount}` : 'Pendiente'}</span>
                                    </div>
                                ))}
                                {activeBets.filter(b => b.bettor === currentUser.id).length === 0 && <p className="text-gray-500 text-xs text-center">Sin actividad reciente.</p>}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* FIFA */}
        {activeTab === 'fifa' && (
            <section className="animate-in fade-in">
                {fifaMatches.length === 0 && (
                    <div className="bg-[#112240] p-6 rounded-2xl border border-cyan-500/20 shadow-lg">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white uppercase italic">Setup</h2>
                            <div className="bg-[#0a192f] p-1 rounded-lg flex gap-1">
                                <button onClick={()=>setGameMode('1vs1')} className={`px-4 py-1 rounded text-xs font-bold ${gameMode==='1vs1'?'bg-cyan-600 text-white':'text-gray-400'}`}>1v1</button>
                                <button onClick={()=>setGameMode('2vs2')} className={`px-4 py-1 rounded text-xs font-bold ${gameMode==='2vs2'?'bg-cyan-600 text-white':'text-gray-400'}`}>2v2</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-6">
                            {users.map(u => (
                                <button key={u.id} onClick={()=>togglePlayerSelection(u.id)} className={`p-3 rounded-lg border text-xs font-bold truncate transition ${selectedPlayers.includes(u.id)?'bg-cyan-600/20 border-cyan-500 text-white':'bg-[#0a192f] border-slate-700 text-gray-400'}`}>
                                    {u.id}
                                </button>
                            ))}
                        </div>
                        <button onClick={handleCrearTorneo} className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:brightness-110 text-white font-black py-4 rounded-xl shadow-lg uppercase tracking-wider">
                            🚀 Iniciar Torneo
                        </button>
                    </div>
                )}

                {fifaMatches.length > 0 && (
                    <div className="w-full pb-20">
                        <div className="md:hidden flex flex-col gap-8">
                            <div><h3 className="text-center font-black text-cyan-500 text-sm tracking-[0.2em] mb-4 uppercase bg-[#112240] py-2 rounded-lg">Ronda 1</h3><div className="flex flex-col gap-4">{(fifaMatches.length===4 ? [0,1] : [0,1,2,3]).map(id => <MatchCard key={id} m={fifaMatches[id]} onFinish={finalizarPartido} />)}</div></div>
                            {fifaMatches.length===8 && (<div><h3 className="text-center font-black text-purple-500 text-sm tracking-[0.2em] mb-4 uppercase bg-[#112240] py-2 rounded-lg">Semis</h3><div className="flex flex-col gap-4">{[4,5].map(id => <MatchCard key={id} m={fifaMatches[id]} onFinish={finalizarPartido} />)}</div></div>)}
                            <div>
                                <h3 className="text-center font-black text-yellow-500 text-sm tracking-[0.2em] mb-4 uppercase bg-[#112240] py-2 rounded-lg">Final</h3>
                                <div className="scale-105 shadow-[0_0_30px_rgba(234,179,8,0.2)] rounded-xl"><MatchCard m={fifaMatches[fifaMatches.length===4 ? 2 : 6]} onFinish={finalizarPartido} isFinal /></div>
                            </div>
                            <div className="opacity-75 scale-90"><h3 className="text-center font-bold text-orange-400 text-xs mb-2 uppercase">Bronce</h3><MatchCard m={fifaMatches[fifaMatches.length===4 ? 3 : 7]} onFinish={finalizarPartido} /></div>
                        </div>
                        <div className="hidden md:grid grid-cols-3 gap-8 items-center">
                            <div className="space-y-4">{(fifaMatches.length===4 ? [0,1] : [0,1,2,3]).map(id => <MatchCard key={id} m={fifaMatches[id]} onFinish={finalizarPartido} />)}</div>
                            <div className="space-y-4">{fifaMatches.length===8 && [4,5].map(id => <MatchCard key={id} m={fifaMatches[id]} onFinish={finalizarPartido} />)}</div>
                            <div className="space-y-8"><MatchCard m={fifaMatches[fifaMatches.length===4 ? 2 : 6]} onFinish={finalizarPartido} isFinal /><MatchCard m={fifaMatches[fifaMatches.length===4 ? 3 : 7]} onFinish={finalizarPartido} /></div>
                        </div>
                    </div>
                )}
            </section>
        )}

        {/* APUESTAS */}
        {activeTab === 'apuestas' && (
            <div className="max-w-xl mx-auto space-y-6 animate-in slide-in-from-bottom-4">
                {!currentUser ? <div className="text-center p-8 text-gray-400 bg-[#112240] rounded-2xl border border-white/5">🔒 Identifícate primero</div> : (
                    <>
                        <div className="bg-[#112240] border border-yellow-500/20 p-6 rounded-2xl shadow-lg relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-yellow-500"></div>
                            <h2 className="text-xl font-bold text-white mb-4 uppercase italic">Place Your Bet</h2>
                            {fifaMatches.length > 0 ? (
                                <div className="space-y-4">
                                    <select className="w-full bg-[#0a192f] p-3 rounded-lg border border-slate-700 text-white outline-none focus:border-yellow-500 transition" onChange={e=>{const m=fifaMatches.find(x=>x.id===parseInt(e.target.value));setSelectedMatchId(parseInt(e.target.value));setBetTarget("");}}>
                                        <option value="">Selecciona Partido</option>
                                        {fifaMatches.filter(m => !m.winner && !m.isBye).map(m => (<option key={m.id} value={m.id}>{m.p1} vs {m.p2}</option>))}
                                    </select>
                                    {selectedMatchId !== null && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <button onClick={()=>setBetTarget(fifaMatches[selectedMatchId!].p1)} className={`p-3 rounded-lg border text-sm font-bold transition ${betTarget===fifaMatches[selectedMatchId!].p1?'bg-green-600/20 border-green-500 text-green-400':'bg-[#0a192f] border-slate-700 text-gray-400'}`}>{fifaMatches[selectedMatchId!].p1}</button>
                                            <button onClick={()=>setBetTarget(fifaMatches[selectedMatchId!].p2)} className={`p-3 rounded-lg border text-sm font-bold transition ${betTarget===fifaMatches[selectedMatchId!].p2?'bg-green-600/20 border-green-500 text-green-400':'bg-[#0a192f] border-slate-700 text-gray-400'}`}>{fifaMatches[selectedMatchId!].p2}</button>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3 bg-[#0a192f] p-3 rounded-lg border border-slate-700"><span className="text-lg">💰</span><input type="number" className="bg-transparent w-full outline-none text-white font-mono" value={betAmount} onChange={e=>setBetAmount(parseInt(e.target.value))} /></div>
                                    <button onClick={realizarApuesta} className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-black p-3 rounded-lg shadow-lg uppercase tracking-wider">Apostar</button>
                                </div>
                            ) : (<p className="text-gray-500 text-center">No hay partidos disponibles.</p>)}
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-500 uppercase text-xs tracking-widest mb-3 pl-2">Actividad Reciente</h3>
                            <div className="space-y-2">{activeBets.filter(b => b.status === 'pending').map(b => (<div key={b.id} className="bg-[#112240] p-3 rounded-lg border-l-2 border-yellow-500 flex justify-between items-center text-sm"><div><span className="font-bold text-white">{b.bettor}</span> <span className="text-gray-400">vs</span> <span className="text-cyan-400">{b.chosenWinner}</span></div><span className="font-mono text-yellow-400">{b.amount} $</span></div>))}{activeBets.filter(b => b.status === 'pending').length === 0 && <p className="text-gray-600 text-xs text-center italic">El mercado está tranquilo...</p>}</div>
                        </div>
                    </>
                )}
            </div>
        )}

        {/* PACHANGA & CASTIGOS */}
        {activeTab === 'pachanga' && (<section className="max-w-xl mx-auto space-y-4"><h2 className="text-xl font-black text-white italic uppercase">Mixer</h2><textarea className="w-full h-32 bg-[#112240] border border-slate-700 rounded-xl p-4 text-white resize-none" placeholder="Nombres..." value={pachangaInput} onChange={e=>setPachangaInput(e.target.value)}></textarea><button onClick={handleSorteoPachanga} className="w-full bg-cyan-600 text-white font-black py-3 rounded-xl uppercase">Mezclar</button>{equipoA.length > 0 && (<div className="grid grid-cols-2 gap-4"><div className="bg-red-900/20 p-4 rounded-xl border border-red-500/30 text-center"><h3 className="text-red-400 font-bold mb-2">TEAM A</h3>{equipoA.map(p=><div key={p} className="text-sm">{p}</div>)}</div><div className="bg-blue-900/20 p-4 rounded-xl border border-blue-500/30 text-center"><h3 className="text-blue-400 font-bold mb-2">TEAM B</h3>{equipoB.map(p=><div key={p} className="text-sm">{p}</div>)}</div></div>)}</section>)}
        {activeTab === 'castigos' && (<section className="max-w-md mx-auto text-center space-y-6"><div className="bg-[#112240] border border-red-500/30 p-8 rounded-2xl shadow-[0_0_30px_rgba(239,68,68,0.1)]"><h2 className="text-red-500 font-black uppercase tracking-[0.2em] mb-4 text-sm">Castigo</h2><p className={`text-2xl font-black ${isSpinning?'blur-sm text-gray-500':'text-white'}`}>{resultadoRuleta}</p></div><div className="flex justify-center gap-2 font-mono text-xs"><button onClick={()=>startTimer(30)} className="bg-slate-800 px-3 py-1 rounded">30s</button><button onClick={()=>startTimer(60)} className="bg-slate-800 px-3 py-1 rounded">60s</button><button onClick={()=>setTimeLeft(0)} className="bg-red-900/50 px-3 py-1 rounded text-red-300">Stop</button></div><div className="text-5xl font-mono text-white tracking-widest">{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</div><button onClick={()=>setExcusa(EXCUSAS[Math.floor(Math.random()*EXCUSAS.length)])} className="text-blue-400 text-xs hover:text-blue-300 underline">Generar Excusa</button>{excusa && <p className="text-white italic text-sm">"{excusa}"</p>}<div className="grid grid-cols-2 gap-3"><button disabled={isSpinning} onClick={()=>girarRuleta('soft')} className="bg-slate-700 p-4 rounded-xl font-bold text-white hover:bg-slate-600">Soft</button><button disabled={isSpinning} onClick={()=>girarRuleta('chupito')} className="bg-red-600 p-4 rounded-xl font-bold text-white hover:bg-red-500 shadow-lg shadow-red-900/20">SHOT 🥃</button></div></section>)}

      </div>

      {/* EXTRAS */}
      {mayorPaliza && (<div className="fixed top-20 left-1/2 -translate-x-1/2 w-11/12 max-w-sm bg-[#112240] border border-pink-500/50 p-4 rounded-xl flex items-center justify-between shadow-2xl z-40 animate-in slide-in-from-top-4"><div className="text-xs"><p className="text-pink-400 font-bold uppercase tracking-widest">Humillación</p><p className="text-white">{mayorPaliza.winner} <span className="text-gray-500">vs</span> {mayorPaliza.loser}</p></div><span className="text-2xl font-black text-pink-500 italic">{mayorPaliza.result}</span></div>)}
      <div className="fixed bottom-24 right-4 z-40 flex flex-col items-end gap-2"><button onClick={() => setShowDJ(!showDJ)} className="bg-purple-600 text-white p-3 rounded-full shadow-lg hover:bg-purple-500 transition">{showDJ ? '✖️' : '🎵'}</button>{showDJ && (<div className="bg-[#112240] p-4 rounded-2xl border border-white/10 shadow-2xl flex flex-col gap-2 animate-in slide-in-from-bottom-2 w-32"><SoundBtn label="📢 HORN" url="https://www.myinstants.com/media/sounds/mlg-airhorn.mp3" color="bg-red-600" /><SoundBtn label="🎻 SAD" url="https://www.myinstants.com/media/sounds/sad-violin-airhorn.mp3" color="bg-blue-600" /><SoundBtn label="🦗 CRICKET" url="https://www.myinstants.com/media/sounds/cricket_1.mp3" color="bg-green-600" /><SoundBtn label="🤬 BOO" url="https://www.myinstants.com/media/sounds/boo.mp3" color="bg-gray-600" /><SoundBtn label="🐐 SIUU" url="https://www.myinstants.com/media/sounds/siu.mp3" color="bg-yellow-600" /></div>)}</div>

      {/* DOCK */}
      <nav className="fixed bottom-4 left-4 right-4 bg-[#112240]/90 backdrop-blur-xl border border-white/5 rounded-2xl flex justify-around p-2 shadow-2xl z-50">
          <NavBtn icon="👤" label="Perfil" active={activeTab==='perfil'} onClick={()=>setActiveTab('perfil')} />
          <NavBtn icon="🏆" label="Torneo" active={activeTab==='fifa'} onClick={()=>setActiveTab('fifa')} />
          <NavBtn icon="💸" label="Bet" active={activeTab==='apuestas'} onClick={()=>setActiveTab('apuestas')} />
          <NavBtn icon="🎲" label="Mix" active={activeTab==='pachanga'} onClick={()=>setActiveTab('pachanga')} />
          <NavBtn icon="☠️" label="Ruleta" active={activeTab==='castigos'} onClick={()=>setActiveTab('castigos')} />
      </nav>

    </main>
  );
}

function NavBtn({icon, label, active, onClick}:any) {
    return (<button onClick={onClick} className={`flex flex-col items-center justify-center w-full py-1 rounded-xl transition ${active ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}><span className="text-xl mb-0.5">{icon}</span><span className="text-[8px] font-bold uppercase tracking-widest">{label}</span></button>)
}

function SoundBtn({ label, url, color }: { label: string, url: string, color: string }) {
    const play = () => { const audio = new Audio(url); audio.play().catch(e => console.log(e)); };
    return (<button onClick={play} className={`${color} text-white text-[10px] font-bold py-2 px-3 rounded shadow hover:brightness-110 active:scale-95`}>{label}</button>);
}

function MatchCard({ m, onFinish, isFinal }: { m?: Match, onFinish: (id: number, s1: number, s2: number) => void, isFinal?: boolean }) {
    const [s1, setS1] = useState(""); const [s2, setS2] = useState("");
    if (!m) return <div className="bg-[#112240] p-2 rounded h-20 w-full animate-pulse"></div>;
    const isWaiting = m.p1 === "Esperando..." || m.p2 === "Esperando...";
    if (m.isBye) return <div className="bg-[#112240] p-3 rounded-lg border border-white/5 text-center opacity-50"><p className="text-green-500 font-bold text-xs uppercase">✅ {m.winner}</p><p className="text-[9px] text-gray-500 uppercase tracking-widest">Bye Round</p></div>;

    return (
        <div className={`relative p-1 rounded-xl overflow-hidden group transition-all ${m.winner ? 'opacity-80' : 'opacity-100'}`}>
            <div className={`absolute inset-0 ${m.winner ? 'bg-slate-800' : 'bg-gradient-to-br from-cyan-500/20 to-blue-600/20'} opacity-50`}></div>
            <div className={`relative bg-[#112240] p-3 rounded-lg border ${m.winner ? 'border-slate-700' : 'border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.1)]'}`}>
                {/* Etiqueta Ronda */}
                <div className="absolute -top-2 left-3 bg-[#0a192f] px-2 py-0.5 rounded border border-white/10 text-[8px] text-gray-400 font-bold uppercase tracking-widest">{m.round==='F'?'FINAL':m.round==='S'?'SEMI':m.round==='3rd'?'BRONCE':'CUARTOS'}</div>
                
                {/* Equipo 1 */}
                <div className="flex justify-between items-center mb-2 mt-2">
                    <div className="overflow-hidden">
                        <p className={`font-bold text-sm truncate ${m.winner===m.p1?'text-green-400':m.winner?'text-gray-500 line-through':'text-white'}`}>{m.p1}</p>
                        <div className="flex gap-1 text-[9px] uppercase font-bold tracking-wider">
                            <span className="text-cyan-300 truncate max-w-[80px]">{m.p1Team}</span>
                            <span className="text-yellow-500/80 truncate max-w-[80px]">{m.p1Club}</span>
                        </div>
                    </div>
                    {m.winner ? <span className="font-mono font-black text-lg text-white">{m.score1}</span> : <input type="number" className="w-8 h-8 bg-[#0a192f] text-center rounded border border-slate-700 text-white font-bold outline-none focus:border-cyan-500 transition" value={s1} onChange={e=>setS1(e.target.value)} disabled={isWaiting} />}
                </div>

                {/* VS Divider */}
                <div className="h-px w-full bg-white/5 my-1"></div>

                {/* Equipo 2 */}
                <div className="flex justify-between items-center">
                    <div className="overflow-hidden">
                        <p className={`font-bold text-sm truncate ${m.winner===m.p2?'text-green-400':m.winner?'text-gray-500 line-through':'text-white'}`}>{m.p2}</p>
                        <div className="flex gap-1 text-[9px] uppercase font-bold tracking-wider">
                            <span className="text-cyan-300 truncate max-w-[80px]">{m.p2Team}</span>
                            <span className="text-yellow-500/80 truncate max-w-[80px]">{m.p2Club}</span>
                        </div>
                    </div>
                    {m.winner ? <span className="font-mono font-black text-lg text-white">{m.score2}</span> : <input type="number" className="w-8 h-8 bg-[#0a192f] text-center rounded border border-slate-700 text-white font-bold outline-none focus:border-cyan-500 transition" value={s2} onChange={e=>setS2(e.target.value)} disabled={isWaiting} />}
                </div>

                {!m.winner && !isWaiting && (
                    <button onClick={()=>s1&&s2&&onFinish(m.id, +s1, +s2)} className="w-full mt-3 bg-slate-800 hover:bg-green-600 hover:text-white text-gray-400 text-[9px] font-bold py-1.5 rounded uppercase tracking-widest transition">Finalizar</button>
                )}
            </div>
        </div>
    );
}