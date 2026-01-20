'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { db } from '@/lib/firebase';
import { 
  doc, onSnapshot, setDoc, collection, query, orderBy, increment, 
  addDoc, serverTimestamp, getDocs, writeBatch, deleteDoc 
} from 'firebase/firestore';
import confetti from 'canvas-confetti';
import { Trophy, Banknote, Dices, Skull, UserCircle, LogOut, Settings, ChevronRight, Lock } from 'lucide-react';

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
type Tab = 'fifa' | 'apuestas' | 'pachanga' | 'castigos' | 'perfil';

const BYE_NAME = "Pase Directo ➡️";
const STARTING_BALANCE = 1000;

// --- DATOS FIJOS ---
const TEAMS_REAL = ["Man. City 🔵", "Real Madrid 👑", "Bayern 🔴", "Liverpool 🔴", "Arsenal 🔴", "Inter ⚫🔵", "PSG 🗼", "Barça 🔵🔴", "Atleti 🔴⚪", "Leverkusen ⚫🔴", "Milan ⚫🔴", "Juve ⚫⚪", "Dortmund 🟡⚫", "Chelsea 🔵", "Napoli 🔵", "Spurs ⚪", "Villa 🦁", "Newcastle ⚫⚪"];
const TEAMS_FUNNY = ["Aston Birra", "Vodka Juniors", "Rayo Vayacaño", "Coca Juniors", "Maccabi de Levantar", "Steaua del Grifo", "Schalke Te Meto", "Abuelos FC", "Patético", "Bajern", "Real Suciedad", "Olimpique", "West Jamón", "Levante en Barra", "Borussia Birra", "Peshownal", "Estrella Coja", "Fenerbache"];
const EXCUSAS = ["Mando roto", "Lag", "Handicap", "Sol en la cara", "Probando tácticas", "Árbitro comprado", "Jugador bugueado", "Dedos fríos", "5 defensas", "Portero manco"];
const NEWS_TICKER = ["🚨 ÚLTIMA HORA: Se busca la dignidad de los perdedores en objetos perdidos.", "⚽ MERCADO: El Aston Birra ofrece 2 pipas por el fichaje estrella.", "⚠️ ATENCIÓN: Jugar con 5 defensas está penado con cárcel.", "👀 OJO: Se rumorea que el líder del ranking hace trampas.", "🏆 CHAMPIONS: La orejona busca dueño.", "🚑 PARTE MÉDICO: Varios pulgares lesionados tras el último partido."];

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-black font-bold">Cargando Liga...</div>}>
      <AppContent />
    </Suspense>
  );
}

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>('fifa');
  
  // DATOS
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [fifaMatches, setFifaMatches] = useState<Match[]>([]);
  const [activeBets, setActiveBets] = useState<Bet[]>([]);
  const [ranking, setRanking] = useState<{nombre: string, puntos: number, victorias: number}[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // ESTADO INTERFAZ
  const [showSettings, setShowSettings] = useState(false);
  const [gameMode, setGameMode] = useState<'1vs1' | '2vs2'>('1vs1');
  const [mayorPaliza, setMayorPaliza] = useState<{winner: string, loser: string, diff: number, result: string} | null>(null);
  const [resultadoRuleta, setResultadoRuleta] = useState<string>("Gira la ruleta...");
  const [isSpinning, setIsSpinning] = useState(false);
  const [excusa, setExcusa] = useState<string | null>(null);
  
  // FORMS
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
  const [pachangaInput, setPachangaInput] = useState("");
  const [equipoA, setEquipoA] = useState<string[]>([]);
  const [equipoB, setEquipoB] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as UserProfile[];
        setUsers(list);
        if (currentUser) { const updated = list.find(u => u.id === currentUser.id); if (updated) setCurrentUser(updated); }
    });
    const unsubBets = onSnapshot(query(collection(db, "bets")), (snap) => setActiveBets(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Bet[]));
    const unsubRank = onSnapshot(query(collection(db, "ranking"), orderBy("puntos", "desc")), (snap) => setRanking(snap.docs.map(d => ({ nombre: d.id, ...d.data() } as any))));
    const unsubHist = onSnapshot(query(collection(db, "history"), orderBy("date", "desc")), (snap) => setHistory(snap.docs.map(d => d.data()) as HistoryItem[]));
    
    return () => { unsubSala(); unsubUsers(); unsubBets(); unsubRank(); unsubHist(); };
  }, [currentUser?.id]);

  // LOGICA AUTH
  const handleLogin = () => {
      const user = users.find(u => u.id.toLowerCase() === loginName.toLowerCase());
      if (!user || user.password !== loginPass) return alert("Credenciales incorrectas");
      setCurrentUser(user); setLoginName(""); setLoginPass("");
  };
  const handleRegister = async () => {
      if (!regName || !regClub || !regPass) return alert("Rellena todo");
      if (users.find(u => u.id.toLowerCase() === regName.toLowerCase())) return alert("Nombre ocupado");
      const newUser = { clubName: regClub, balance: STARTING_BALANCE, password: regPass };
      await setDoc(doc(db, "users", regName), newUser);
      setCurrentUser({ id: regName, ...newUser }); setIsRegistering(false);
  };
  const logout = () => { setCurrentUser(null); setShowSettings(false); setActiveTab('fifa'); };

  // LOGICA TORNEO
  const togglePlayerSelection = (name: string) => {
      if (selectedPlayers.includes(name)) setSelectedPlayers(selectedPlayers.filter(p => p !== name));
      else { if (selectedPlayers.length >= 16) return alert("Máximo 16"); setSelectedPlayers([...selectedPlayers, name]); }
  };

  const handleCrearTorneo = async () => {
      if (selectedPlayers.length < 2) return alert("Mínimo 2 jugadores");
      let players = [...selectedPlayers];
      let targetSize = players.length <= 4 ? 4 : 8;
      if (players.length > 8) return alert("Máx 8 por ahora"); // Limite cuadro
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
      // Generar cuadro simple
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
    if (s1 === s2) return alert("❌ Empate prohibido.");
    const m = fifaMatches.find(x => x.id === matchId);
    if (!m) return;
    
    const isP1 = s1 > s2;
    const winner = isP1 ? m.p1 : m.p2; const loser = isP1 ? m.p2 : m.p1;
    const wTeam = isP1 ? m.p1Team : m.p2Team; const wClub = isP1 ? m.p1Club : m.p2Club;
    const lTeam = isP1 ? m.p2Team : m.p1Team; const lClub = isP1 ? m.p2Club : m.p1Club;

    try {
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
      
    } catch (e) { console.error(e); }
  };

  const realizarApuesta = async () => {
      if (!currentUser || selectedMatchId===null || !betTarget || betAmount<=0) return alert("Rellena todo");
      if (currentUser.balance < betAmount) return alert("Saldo insuficiente");
      await setDoc(doc(db, "users", currentUser.id), { balance: increment(-betAmount) }, { merge: true });
      await addDoc(collection(db, "bets"), { matchId: selectedMatchId, bettor: currentUser.id, chosenWinner: betTarget, amount: betAmount, status: 'pending' });
      alert("✅ Apuesta realizada");
  };

  const calcularPaliza = (matches: Match[]) => { 
      let max=0; let p=null; 
      matches.forEach(m=>{
          if(m.winner && m.score1!==undefined && m.score2!==undefined){
              const d=Math.abs(m.score1-m.score2);
              if(d>=3 && d>max){ max=d; const w=m.score1>m.score2; p={winner:w?m.p1:m.p2,loser:w?m.p2:m.p1,diff:d,result:`${m.score1}-${m.score2}`}; }
          }
      }); 
      setMayorPaliza(p); 
  };

  const girarRuleta = async (t: 'soft'|'chupito') => {
      setIsSpinning(true); const list = t==='soft' ? ["10 Flexiones", "Baila 30s", "Silencio", "Verdad o Reto", "Haz el pino", "Invita"] : ["1 Chupito", "2 Chupitos", "Cascada", "Elige compañero", "Te libras", "CHUPITO MORTAL"];
      let i=0; const int=setInterval(()=>{setResultadoRuleta(list[i%list.length]);i++},80);
      setTimeout(async()=>{clearInterval(int);const f=list[Math.floor(Math.random()*list.length)];setResultadoRuleta(f);setIsSpinning(false);await setDoc(doc(db,"sala","principal"),{ultimoCastigo:f},{merge:true});},2000);
  };

  const handleSorteoPachanga = () => {
      const n=pachangaInput.split(/[\n,]+/).map(x=>x.trim()).filter(x=>x);
      if(n.length<2)return alert("Min 2");
      const s=[...n].sort(()=>Math.random()-0.5); const m=Math.ceil(s.length/2);
      setDoc(doc(db,"sala","principal"),{equipoA:s.slice(0,m),equipoB:s.slice(m)},{merge:true});
  };

  const limpiarPizarra = async () => {
      if(!confirm("¿Resetear cuadro actual?")) return;
      const b=writeBatch(db); b.set(doc(db,"sala","principal"),{equipoA:[],equipoB:[],fifaMatches:[],ultimoCastigo:"..."}); 
      (await getDocs(query(collection(db,"bets")))).forEach(d=>b.delete(d.ref));
      await b.commit(); setShowSettings(false);
  };

  const startTimer = (s: number) => { setTimeLeft(s); setTimerActive(true); };
  const generarExcusa = () => setExcusa(EXCUSAS[Math.floor(Math.random() * EXCUSAS.length)]);

  useEffect(() => { if(timerActive && timeLeft>0){timerRef.current=setTimeout(()=>setTimeLeft(timeLeft-1),1000)}else if(timeLeft===0&&timerActive){setTimerActive(false);new Audio("https://www.myinstants.com/media/sounds/ding-sound-effect_2.mp3").play().catch(()=>{})}; return()=>clearTimeout(timerRef.current!)},[timeLeft,timerActive]);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#f3f4f6', minHeight: '100vh', color: '#111' }}>
        
        {/* CSS GLOBAL */}
        <style dangerouslySetInnerHTML={{__html: `
            @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
            .animate-marquee { animation: marquee 20s linear infinite; }
            .hide-scrollbar::-webkit-scrollbar { display: none; }
            .fade-in { animation: fadeIn 0.5s ease-out forwards; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        `}} />

        {/* --- HEADER PROFESIONAL (ESTILO APP) --- */}
        <header className="sticky top-0 z-50 bg-white shadow-md border-b border-gray-200">
            <div className="flex items-center justify-between px-4 py-3 max-w-4xl mx-auto">
                {/* LOGO */}
                <div className="flex items-center gap-2 cursor-pointer" onClick={()=>setActiveTab('fifa')}>
                    <span className="text-2xl">🏆</span>
                    <h1 className="text-xl font-black italic tracking-tighter text-black">
                        FOOTYS <span className="text-blue-600">LIGA</span>
                    </h1>
                </div>

                {/* AREA DE USUARIO (DERECHA) */}
                <div className="flex items-center gap-3">
                    {currentUser ? (
                        <div 
                            className="flex items-center gap-2 bg-gray-100 pl-3 pr-2 py-1.5 rounded-full border border-gray-200 cursor-pointer hover:bg-gray-200 transition"
                            onClick={()=>setActiveTab('perfil')}
                        >
                            <div className="text-right leading-none">
                                <p className="font-bold text-xs uppercase text-black">{currentUser.id}</p>
                                <p className="font-mono text-[10px] text-green-600 font-black">{currentUser.balance} €</p>
                            </div>
                            <div className="bg-black text-white p-1.5 rounded-full"><UserCircle size={18} /></div>
                        </div>
                    ) : (
                        <button onClick={()=>setActiveTab('perfil')} className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-gray-800 transition">
                            <Lock size={12}/> ACCESO
                        </button>
                    )}
                    <button onClick={()=>setShowSettings(true)} className="p-2 text-gray-400 hover:text-black transition"><Settings size={20}/></button>
                </div>
            </div>
        </header>

        {/* --- TICKER DE NOTICIAS (EL BANNER QUE SE MUEVE) --- */}
        <div className="bg-black text-white overflow-hidden py-2 border-b border-blue-600">
            <div className="animate-marquee whitespace-nowrap flex gap-12">
                {[...NEWS_TICKER, ...NEWS_TICKER].map((txt, i) => (
                    <span key={i} className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                        <span className="text-blue-400">●</span> {txt}
                    </span>
                ))}
            </div>
        </div>

        {/* --- CONTENIDO PRINCIPAL --- */}
        <div className="max-w-4xl mx-auto p-4 pb-24">
            
            {/* TABS DE NAVEGACION */}
            <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-6 pb-2">
                {[
                    {id:'fifa', label:'Torneo', icon:<Trophy size={16}/>},
                    {id:'apuestas', label:'Apuestas', icon:<Banknote size={16}/>},
                    {id:'pachanga', label:'Mixer', icon:<Dices size={16}/>},
                    {id:'castigos', label:'Ruleta', icon:<Skull size={16}/>}
                ].map(t => (
                    <button key={t.id} onClick={()=>setActiveTab(t.id as Tab)} className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${activeTab===t.id ? 'bg-black text-white border-black shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* SECCIONES */}
            
            {/* PERFIL */}
            {activeTab === 'perfil' && (
                <div className="fade-in space-y-6">
                    {!currentUser ? (
                        <div className="max-w-sm mx-auto bg-white p-8 rounded-3xl border border-gray-200 shadow-xl">
                            <h2 className="text-2xl font-black text-center mb-6 text-black">{isRegistering ? 'NUEVO FICHAJE' : 'INICIAR SESIÓN'}</h2>
                            <div className="space-y-4">
                                <input className="w-full bg-gray-50 p-4 rounded-xl border border-gray-200 text-black font-medium focus:border-black focus:ring-0 outline-none transition" placeholder="Nombre de Usuario" value={isRegistering ? regName : loginName} onChange={e => isRegistering ? setRegName(e.target.value) : setLoginName(e.target.value)} />
                                {isRegistering && <input className="w-full bg-gray-50 p-4 rounded-xl border border-gray-200 text-black font-medium focus:border-black outline-none" placeholder="Nombre Club (Ej: Aston Birra)" value={regClub} onChange={e => setRegClub(e.target.value)} />}
                                <input className="w-full bg-gray-50 p-4 rounded-xl border border-gray-200 text-black font-medium focus:border-black outline-none" type="password" placeholder="Contraseña" value={isRegistering ? regPass : loginPass} onChange={e => isRegistering ? setRegPass(e.target.value) : setLoginPass(e.target.value)} />
                                <button onClick={isRegistering ? handleRegister : handleLogin} className="w-full bg-black text-white font-bold p-4 rounded-xl hover:bg-gray-800 transition shadow-lg">{isRegistering ? 'CREAR CUENTA' : 'ENTRAR'}</button>
                            </div>
                            <p className="text-center text-gray-500 text-sm mt-4 cursor-pointer hover:underline hover:text-black" onClick={() => setIsRegistering(!isRegistering)}>{isRegistering ? '¿Ya tienes cuenta? Entra aquí' : '¿No tienes cuenta? Regístrate'}</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* TARJETA DE USUARIO */}
                            <div className="bg-black text-white p-6 rounded-3xl shadow-xl flex justify-between items-center relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full -mr-10 -mt-10 blur-2xl opacity-50"></div>
                                <div className="relative z-10">
                                    <h2 className="text-3xl font-black italic uppercase">{currentUser.id}</h2>
                                    <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">{currentUser.clubName}</p>
                                </div>
                                <div className="text-right relative z-10">
                                    <p className="text-xs text-gray-400 uppercase tracking-widest">Saldo Disponible</p>
                                    <p className="text-4xl font-mono font-black text-green-400">{currentUser.balance} €</p>
                                </div>
                            </div>

                            {/* ESTADÍSTICAS */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm text-center">
                                    <p className="text-4xl font-black text-black">{ranking.find(r=>r.nombre===currentUser.id)?.victorias || 0}</p>
                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Victorias</p>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm text-center">
                                    <p className="text-4xl font-black text-blue-600">{ranking.find(r=>r.nombre===currentUser.id)?.puntos || 0}</p>
                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Puntos</p>
                                </div>
                            </div>

                            {/* ÚLTIMAS APUESTAS */}
                            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                                <h3 className="font-black text-sm uppercase mb-4 text-gray-400">Historial de Apuestas</h3>
                                <div className="space-y-2">
                                    {activeBets.filter(b => b.bettor === currentUser.id).length > 0 ? (
                                        activeBets.filter(b => b.bettor === currentUser.id).map(b => (
                                            <div key={b.id} className="flex justify-between items-center text-sm p-3 bg-gray-50 rounded-xl border border-gray-100">
                                                <span>Apostaste a <span className="text-black font-bold">{b.chosenWinner}</span></span>
                                                <span className={`font-bold ${b.status==='won'?'text-green-600':b.status==='lost'?'text-red-500':'text-yellow-600'}`}>
                                                    {b.status==='won' ? `+${b.amount*2}€` : b.status==='lost' ? `-${b.amount}€` : 'Pendiente'}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-400 text-sm text-center py-4 italic">No tienes apuestas activas.</p>
                                    )}
                                </div>
                            </div>

                            <button onClick={logout} className="w-full bg-white border-2 border-red-100 text-red-500 font-bold p-4 rounded-xl flex items-center justify-center gap-2 hover:bg-red-50 transition">
                                <LogOut size={18}/> CERRAR SESIÓN
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* FIFA */}
            {activeTab === 'fifa' && (
                <div className="fade-in">
                    {fifaMatches.length === 0 ? (
                        <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-lg text-center">
                            <h2 className="text-2xl font-black mb-2 text-black">Configurar Torneo</h2>
                            <p className="text-gray-500 text-sm mb-6">Selecciona los jugadores para empezar.</p>
                            
                            <div className="flex justify-center gap-2 mb-6">
                                <button onClick={()=>setGameMode('1vs1')} className={`px-6 py-2 rounded-full font-bold text-sm transition ${gameMode==='1vs1'?'bg-black text-white shadow-lg':'bg-gray-100 text-gray-500'}`}>1 vs 1</button>
                                <button onClick={()=>setGameMode('2vs2')} className={`px-6 py-2 rounded-full font-bold text-sm transition ${gameMode==='2vs2'?'bg-black text-white shadow-lg':'bg-gray-100 text-gray-500'}`}>2 vs 2</button>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 text-left">
                                {users.map(u => (
                                    <button key={u.id} onClick={()=>togglePlayerSelection(u.id)} className={`p-3 rounded-xl border text-sm font-bold truncate transition flex items-center gap-2 ${selectedPlayers.includes(u.id)?'bg-black text-white border-black shadow-md':'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                                        <div className={`w-2 h-2 rounded-full ${selectedPlayers.includes(u.id)?'bg-green-400':'bg-gray-300'}`}></div>
                                        {u.id}
                                    </button>
                                ))}
                            </div>
                            
                            <button onClick={handleCrearTorneo} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-blue-700 transition transform hover:scale-[1.02] active:scale-95">
                                COMENZAR TORNEO ({selectedPlayers.length})
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            <div className="grid gap-6 md:grid-cols-2">
                                {/* PARTIDOS */}
                                {(fifaMatches.length===4 ? [0,1] : [0,1,2,3]).map(id => <MatchCard key={id} m={fifaMatches[id]} onFinish={finalizarPartido} />)}
                                {fifaMatches.length===8 && [4,5].map(id => <MatchCard key={id} m={fifaMatches[id]} onFinish={finalizarPartido} label="SEMIFINAL" />)}
                                
                                {/* FINALES */}
                                <div className="md:col-span-2 space-y-4 pt-4 border-t border-gray-200">
                                    <h3 className="text-center font-black text-gray-400 text-xs tracking-[0.3em] uppercase">Finales</h3>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <MatchCard m={fifaMatches[fifaMatches.length===4 ? 2 : 6]} onFinish={finalizarPartido} isFinal label="🏆 GRAN FINAL" />
                                        <MatchCard m={fifaMatches[fifaMatches.length===4 ? 3 : 7]} onFinish={finalizarPartido} label="🥉 3er PUESTO" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* APUESTAS */}
            {activeTab === 'apuestas' && (
                <div className="fade-in space-y-6 max-w-xl mx-auto">
                    {!currentUser ? (
                        <div className="text-center p-12 bg-white rounded-3xl border border-gray-200 shadow-sm">
                            <Lock size={48} className="mx-auto mb-4 text-gray-300"/>
                            <h3 className="font-bold text-lg">Acceso Restringido</h3>
                            <p className="text-gray-500 text-sm mb-6">Inicia sesión en tu perfil para apostar.</p>
                            <button onClick={()=>setActiveTab('perfil')} className="bg-black text-white px-6 py-2 rounded-full font-bold text-sm">Ir al Perfil</button>
                        </div>
                    ) : (
                        <>
                            <div className="bg-white border border-yellow-400 p-6 rounded-3xl shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-2 bg-yellow-400"></div>
                                <h2 className="text-xl font-black text-black mb-6 uppercase italic flex items-center gap-2"><Banknote className="text-yellow-600"/> Casa de Apuestas</h2>
                                
                                {fifaMatches.length > 0 ? (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs font-bold text-gray-400 uppercase ml-1">Partido</label>
                                            <select className="w-full bg-gray-50 p-4 rounded-xl border border-gray-200 text-black font-bold outline-none mt-1" onChange={e=>{const m=fifaMatches.find(x=>x.id===parseInt(e.target.value));setSelectedMatchId(parseInt(e.target.value));setBetTarget("");}}>
                                                <option value="">Selecciona un enfrentamiento...</option>
                                                {fifaMatches.filter(m => !m.winner && !m.isBye).map(m => (<option key={m.id} value={m.id}>{m.p1} vs {m.p2}</option>))}
                                            </select>
                                        </div>

                                        {selectedMatchId !== null && (
                                            <div className="grid grid-cols-2 gap-3">
                                                <button onClick={()=>setBetTarget(fifaMatches[selectedMatchId!].p1)} className={`p-4 rounded-xl border-2 text-sm font-black transition ${betTarget===fifaMatches[selectedMatchId!].p1?'bg-black text-white border-black':'bg-white text-gray-500 border-gray-200 hover:border-black'}`}>{fifaMatches[selectedMatchId!].p1}</button>
                                                <button onClick={()=>setBetTarget(fifaMatches[selectedMatchId!].p2)} className={`p-4 rounded-xl border-2 text-sm font-black transition ${betTarget===fifaMatches[selectedMatchId!].p2?'bg-black text-white border-black':'bg-white text-gray-500 border-gray-200 hover:border-black'}`}>{fifaMatches[selectedMatchId!].p2}</button>
                                            </div>
                                        )}

                                        <div>
                                            <label className="text-xs font-bold text-gray-400 uppercase ml-1">Cantidad</label>
                                            <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200 mt-1">
                                                <span className="text-xl">💰</span>
                                                <input type="number" className="bg-transparent w-full outline-none text-black font-mono font-bold text-lg" value={betAmount} onChange={e=>setBetAmount(parseInt(e.target.value))} />
                                            </div>
                                        </div>

                                        <button onClick={realizarApuesta} className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-black p-4 rounded-xl shadow-lg uppercase tracking-wider transition transform active:scale-95 mt-2">CONFIRMAR APUESTA</button>
                                    </div>
                                ) : (<p className="text-gray-500 text-center py-6">No hay partidos disponibles para apostar.</p>)}
                            </div>
                            
                            <div>
                                <h3 className="font-bold text-gray-400 uppercase text-xs tracking-widest mb-3 ml-2">Mercado en Vivo</h3>
                                <div className="space-y-2">
                                    {activeBets.filter(b => b.status === 'pending').map(b => (
                                        <div key={b.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center text-sm">
                                            <div><span className="font-bold text-black">{b.bettor}</span> <span className="text-gray-400 text-xs">vs</span> <span className="text-blue-600 font-bold">{b.chosenWinner}</span></div>
                                            <span className="font-mono font-bold bg-gray-100 px-3 py-1 rounded-lg text-black">{b.amount} €</span>
                                        </div>
                                    ))}
                                    {activeBets.filter(b => b.status === 'pending').length === 0 && <p className="text-gray-400 text-xs text-center italic py-4">El mercado está tranquilo...</p>}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* PACHANGA */}
            {activeTab === 'pachanga' && (
                <div className="fade-in max-w-xl mx-auto space-y-6">
                    <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-lg">
                        <h2 className="text-xl font-black text-black mb-4 uppercase italic">Generador de Equipos</h2>
                        <textarea className="w-full h-32 bg-gray-50 border-2 border-gray-100 rounded-xl p-4 text-black font-medium resize-none outline-none focus:border-black transition" placeholder="Escribe los nombres aquí..." value={pachangaInput} onChange={e=>setPachangaInput(e.target.value)}></textarea>
                        <button onClick={handleSorteoPachanga} className="w-full bg-black text-white font-black py-4 rounded-xl uppercase mt-4 hover:bg-gray-800 transition">Mezclar Jugadores</button>
                    </div>
                    {equipoA.length > 0 && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-red-50 p-6 rounded-2xl border-2 border-red-100 text-center"><h3 className="text-red-600 font-black mb-4 text-lg">ROJOS</h3>{equipoA.map(p=><div key={p} className="text-sm font-bold text-red-900 mb-1">{p}</div>)}</div>
                            <div className="bg-blue-50 p-6 rounded-2xl border-2 border-blue-100 text-center"><h3 className="text-blue-600 font-black mb-4 text-lg">AZULES</h3>{equipoB.map(p=><div key={p} className="text-sm font-bold text-blue-900 mb-1">{p}</div>)}</div>
                        </div>
                    )}
                </div>
            )}

            {/* CASTIGOS */}
            {activeTab === 'castigos' && (
                <div className="fade-in max-w-md mx-auto text-center space-y-6">
                    <div className="bg-white border-2 border-red-100 p-8 rounded-3xl shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-red-500"></div>
                        <h2 className="text-red-500 font-black uppercase tracking-widest mb-4 text-xs">La Sentencia</h2>
                        <p className={`text-3xl font-black ${isSpinning?'blur-sm text-gray-300':'text-black'}`}>{resultadoRuleta}</p>
                    </div>
                    
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-400 uppercase">Cronómetro</span>
                        <div className="flex gap-2">
                            <button onClick={()=>startTimer(30)} className="bg-gray-100 px-3 py-1 rounded-lg text-xs font-bold hover:bg-gray-200">30s</button>
                            <button onClick={()=>startTimer(60)} className="bg-gray-100 px-3 py-1 rounded-lg text-xs font-bold hover:bg-gray-200">60s</button>
                            <button onClick={()=>setTimeLeft(0)} className="bg-red-50 text-red-500 px-3 py-1 rounded-lg text-xs font-bold hover:bg-red-100">Stop</button>
                        </div>
                    </div>
                    <div className="text-6xl font-mono font-black text-gray-200 tracking-widest text-center my-4">{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</div>
                    
                    <button onClick={()=>setExcusa(EXCUSAS[Math.floor(Math.random()*EXCUSAS.length)])} className="text-blue-500 text-xs font-bold hover:underline">Generar Excusa Aleatoria</button>
                    {excusa && <p className="text-gray-500 italic text-sm p-4 bg-gray-50 rounded-xl border border-gray-100">"{excusa}"</p>}
                    
                    <div className="grid grid-cols-2 gap-3">
                        <button disabled={isSpinning} onClick={()=>girarRuleta('soft')} className="bg-gray-800 p-4 rounded-xl font-bold text-white hover:bg-gray-700 transition">Soft</button>
                        <button disabled={isSpinning} onClick={()=>girarRuleta('chupito')} className="bg-red-600 p-4 rounded-xl font-bold text-white shadow-lg shadow-red-500/20 hover:bg-red-700 transition">SHOT 🥃</button>
                    </div>
                </div>
            )}

        </div>

        {/* MODAL SETTINGS */}
        {showSettings && (
            <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={()=>setShowSettings(false)}>
                <div className="bg-white p-6 rounded-3xl w-full max-w-xs space-y-3 shadow-2xl" onClick={e=>e.stopPropagation()}>
                    <h3 className="text-lg font-black text-center uppercase mb-4">Gestión</h3>
                    <button onClick={limpiarPizarra} className="w-full bg-blue-50 hover:bg-blue-100 text-blue-600 p-4 rounded-xl font-bold text-sm transition">🔄 Nuevo Torneo</button>
                    <button onClick={()=>setShowSettings(false)} className="w-full text-center text-gray-400 text-xs mt-2 p-2 hover:text-black">Cancelar</button>
                </div>
            </div>
        )}

        {/* EXTRAS FLOTANTES */}
        {mayorPaliza && (<div className="fixed top-24 left-1/2 -translate-x-1/2 w-11/12 max-w-sm bg-white text-black p-4 rounded-xl flex items-center justify-between shadow-2xl z-40 animate-in slide-in-from-top-4 border-l-4 border-pink-500"><div className="text-xs"><p className="text-pink-500 font-bold uppercase">Humillación</p><p className="font-bold">{mayorPaliza.winner} <span className="text-gray-400 font-normal">vs</span> {mayorPaliza.loser}</p></div><span className="text-2xl font-black italic">{mayorPaliza.result}</span></div>)}
    </div>
  );
}

// --- SUBCOMPONENTES ---

function MatchCard({ m, onFinish, isFinal, label }: { m?: Match, onFinish: (id: number, s1: number, s2: number) => void, isFinal?: boolean, label?: string }) {
    const [s1, setS1] = useState(""); const [s2, setS2] = useState("");
    if (!m) return <div className="bg-white border border-gray-100 h-36 rounded-2xl animate-pulse"></div>;
    const isWaiting = m.p1 === "Esperando..." || m.p2 === "Esperando...";
    if (m.isBye) return <div className="bg-green-50 border border-green-100 p-6 rounded-2xl flex flex-col items-center justify-center text-center h-full"><span className="text-green-600 font-bold text-xs uppercase mb-1">Pase Directo</span><p className="font-black text-lg text-green-900">{m.winner}</p></div>;

    return (
        <div className={`relative bg-white border ${m.winner ? 'border-gray-200 opacity-70' : 'border-gray-200 shadow-xl'} p-5 rounded-3xl overflow-hidden transition-all hover:shadow-2xl`}>
            {label && <div className="absolute top-0 right-0 bg-black text-white text-[9px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">{label}</div>}
            
            {/* EQUIPO 1 */}
            <div className="flex justify-between items-center mb-4 mt-2">
                <div className="overflow-hidden">
                    <p className={`font-black text-base truncate ${m.winner===m.p1 ? 'text-green-600' : 'text-black'}`}>{m.p1}</p>
                    <div className="flex gap-2 text-[10px] font-bold uppercase tracking-wide">
                        <span className="text-gray-400">{m.p1Club || 'Club'}</span>
                        <span className="text-blue-500">{m.p1Team}</span>
                    </div>
                </div>
                {m.winner ? <span className="font-mono font-black text-2xl text-black">{m.score1}</span> : <input type="number" className="w-12 h-12 bg-gray-50 text-center rounded-xl font-bold text-lg outline-none focus:ring-2 ring-black transition border border-gray-200" value={s1} onChange={e=>setS1(e.target.value)} disabled={isWaiting} />}
            </div>

            {/* DIVIDER */}
            <div className="w-full h-px bg-gray-100 mb-4 flex items-center justify-center"><span className="bg-white px-2 text-xs text-gray-300 font-bold">VS</span></div>

            {/* EQUIPO 2 */}
            <div className="flex justify-between items-center mb-4">
                <div className="overflow-hidden">
                    <p className={`font-black text-base truncate ${m.winner===m.p2 ? 'text-green-600' : 'text-black'}`}>{m.p2}</p>
                    <div className="flex gap-2 text-[10px] font-bold uppercase tracking-wide">
                        <span className="text-gray-400">{m.p2Club || 'Club'}</span>
                        <span className="text-blue-500">{m.p2Team}</span>
                    </div>
                </div>
                {m.winner ? <span className="font-mono font-black text-2xl text-black">{m.score2}</span> : <input type="number" className="w-12 h-12 bg-gray-50 text-center rounded-xl font-bold text-lg outline-none focus:ring-2 ring-black transition border border-gray-200" value={s2} onChange={e=>setS2(e.target.value)} disabled={isWaiting} />}
            </div>

            {!m.winner && !isWaiting && (
                <button onClick={()=>s1&&s2&&onFinish(m.id, +s1, +s2)} className="w-full bg-black text-white text-xs font-bold py-3 rounded-xl hover:bg-gray-800 transition shadow-lg transform active:scale-95">FINALIZAR PARTIDO</button>
            )}
        </div>
    );
}