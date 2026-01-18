"use client";
import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { 
  doc, onSnapshot, setDoc, collection, query, orderBy, increment, 
  addDoc, serverTimestamp, getDocs, writeBatch 
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

type Player = { nombre: string; puntos: number; victorias: number };
type HistoryItem = { winner: string; winnerTeam?: string; date: any; type: string };
type Tab = 'home' | 'pachanga' | 'fifa' | 'castigos';

const BYE_NAME = "Pase Directo ➡️";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [pachangaInput, setPachangaInput] = useState("");
  const [fifaInput, setFifaInput] = useState("");
  
  // DATOS
  const [equipoA, setEquipoA] = useState<string[]>([]);
  const [equipoB, setEquipoB] = useState<string[]>([]);
  const [fifaMatches, setFifaMatches] = useState<Match[]>([]);
  const [ranking, setRanking] = useState<Player[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [mayorPaliza, setMayorPaliza] = useState<{winner: string, loser: string, diff: number, result: string} | null>(null);
  
  // CASTIGOS & DJ
  const [resultadoRuleta, setResultadoRuleta] = useState<string>("☠️ Esperando víctima...");
  const [excusa, setExcusa] = useState<string | null>(null); // Nueva Excusa
  const [isSpinning, setIsSpinning] = useState(false);
  const [showDJ, setShowDJ] = useState(false);

  // CRONÓMETRO
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // --- LISTAS ---
  const TEAMS_REAL = [
    "Man. City 🔵", "Real Madrid 👑", "Bayern Múnich 🔴", "Liverpool 🔴", 
    "Arsenal 🔴", "Inter Milán ⚫🔵", "PSG 🗼", "FC Barcelona 🔵🔴",
    "Atlético Madrid 🔴⚪", "B. Leverkusen ⚫🔴", "AC Milan ⚫🔴", "Juventus ⚫⚪",
    "Dortmund 🟡⚫", "Chelsea 🔵", "Napoli 🔵", "Tottenham ⚪"
  ];

  const TEAMS_FUNNY = [
    "Aston Birra", "Nottingham Prisa", "Inter de Mitente", "Vodka Juniors",
    "Rayo Vayacaño", "Coca Juniors", "Maccabi de Levantar", "Steaua del Grifo",
    "Schalke Te Meto", "Abuelos FC", "Patético de Madrid", "Bajern de Munich",
    "Real Suciedad", "Olimpique de Marsopa", "West Jamón", "Levante en Barra",
    "Borussia de la Birra", "Peshownal", "Estrella Coja", "Fenerbache el Vaso"
  ];
  
  const listaSoft = ["Haz 10 flexiones 💪", "Manda un audio cantando 🎤", "Baila sin música 30seg 💃", "No puedes hablar 1 ronda 🤐", "Comentarista next game 🎙️", "Enseña última foto carrete 📱", "Sirve bebida a todos 🥤"];
  const listaChupitos = ["🥃 1 Chupito", "🥃🥃 2 Chupitos", "🌊 ¡Cascada!", "🤝 Elige compañero", "🚫 Te libras", "💀 CHUPITO MORTAL"];

  const EXCUSAS = [
      "El mando tiene el R2 pillado...", "Es que había lag.", "El handicap de este juego es increíble.",
      "Me daba el sol en la cara.", "Estaba probando tácticas.", "No quería humillarte.",
      "El árbitro está comprado.", "Mi jugador se quedó bugueado.", "No es mi mando habitual.",
      "Tengo los dedos fríos.", "Es que tú juegas con 5 defensas, rata.", "El portero no tiene manos."
  ];

  const NEWS_TICKER = [
      "🚨 ÚLTIMA HORA: Se busca la dignidad de los perdedores en objetos perdidos.",
      "⚽ MERCADO: El Aston Birra ofrece 2 pipas por el fichaje estrella.",
      "⚠️ ATENCIÓN: Jugar con 5 defensas está penado con cárcel.",
      "👀 OJO: Se rumorea que el líder del ranking hace trampas.",
      "🎙️ DECLARACIONES: 'El FIFA está roto', asegura el que acaba de perder 5-0.",
      "🏆 CHAMPIONS: La orejona busca dueño (y no eres tú).",
      "🚑 PARTE MÉDICO: Varios pulgares lesionados tras el último partido."
  ];

  const lanzarFiesta = () => {
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#a864fd', '#29cdff', '#78ff44', '#ff718d', '#fdff6a'] });
    const audio = new Audio("/gol.mp3");
    audio.volume = 0.5;
    audio.play().catch(() => {});
  };

  // --- LISTENERS ---
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "sala", "principal"), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setEquipoA(data.equipoA || []);
        setEquipoB(data.equipoB || []);
        setFifaMatches(Array.isArray(data.fifaMatches) ? data.fifaMatches : []);
        if (data.ultimoCastigo) setResultadoRuleta(data.ultimoCastigo);
        if (data.fifaMatches && Array.isArray(data.fifaMatches)) calcularPaliza(data.fifaMatches);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "ranking"), orderBy("puntos", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRanking(snapshot.docs.map(doc => ({ nombre: doc.id, ...doc.data() })) as Player[]);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "history"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHistory(snapshot.docs.map(doc => ({ ...doc.data() })) as HistoryItem[]);
    });
    return () => unsubscribe();
  }, []);

  // --- CRONÓMETRO LOGIC ---
  useEffect(() => {
      if (timerActive && timeLeft > 0) {
          timerRef.current = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      } else if (timeLeft === 0 && timerActive) {
          setTimerActive(false);
          new Audio("https://www.myinstants.com/media/sounds/ding-sound-effect_2.mp3").play().catch(()=>{});
          confetti({ particleCount: 50, colors: ['#ffffff'] });
      }
      return () => clearTimeout(timerRef.current!);
  }, [timeLeft, timerActive]);

  const startTimer = (seconds: number) => {
      setTimeLeft(seconds);
      setTimerActive(true);
  };

  const calcularPaliza = (matches: Match[]) => {
      let maxDiff = 0;
      let palizaData = null;
      matches.forEach(m => {
          if (m && !m.isBye && m.winner && m.score1 !== undefined && m.score2 !== undefined) {
              const diff = Math.abs(m.score1 - m.score2);
              if (diff > maxDiff) {
                  maxDiff = diff;
                  const isP1Winner = m.score1 > m.score2;
                  palizaData = { winner: isP1Winner ? m.p1 : m.p2, loser: isP1Winner ? m.p2 : m.p1, diff: diff, result: `${m.score1}-${m.score2}` };
              }
          }
      });
      setMayorPaliza(palizaData);
  };

  const handleCrearTorneoAuto = async () => {
    try {
        let nombres = fifaInput.split(/[\n,]+/).map((n) => n.trim()).filter((n) => n);
        if (nombres.length < 2) return alert("❌ Mínimo 2 jugadores.");
        if (nombres.length > 8) return alert("❌ Máximo 8 jugadores.");

        let size = 8;
        if (nombres.length <= 4) size = 4;
        
        while (nombres.length < size) nombres.push(BYE_NAME);
        
        const shuffledPlayers = [...nombres].sort(() => Math.random() - 0.5);
        const shuffledTeams = [...TEAMS_REAL].sort(() => Math.random() - 0.5);
        const shuffledClubs = [...TEAMS_FUNNY].sort(() => Math.random() - 0.5);

        const getP = (idx: number) => {
            const isBye = shuffledPlayers[idx] === BYE_NAME;
            return {
                name: shuffledPlayers[idx],
                team: isBye ? null : (shuffledTeams[idx] || "Random"),
                club: isBye ? null : (shuffledClubs[idx] || "Random")
            };
        };

        let matches: Match[] = [];

        if (size === 4) {
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

        if (size === 4) {
            if (matches[0].winner) propagate(2, 'p1', matches[0]);
            if (matches[1].winner) propagate(2, 'p2', matches[1]);
        } else {
            if (matches[0].winner) propagate(4, 'p1', matches[0]);
            if (matches[1].winner) propagate(4, 'p2', matches[1]);
            if (matches[2].winner) propagate(5, 'p1', matches[2]);
            if (matches[3].winner) propagate(5, 'p2', matches[3]);
        }

        const cleanMatches = matches.map(m => JSON.parse(JSON.stringify(m, (k, v) => v === undefined ? null : v)));
        await setDoc(doc(db, "sala", "principal"), { fifaMatches: cleanMatches }, { merge: true });
        setFifaInput("");

    } catch (error) {
        console.error(error);
        alert("⚠️ Error: " + error);
    }
  };

  const finalizarPartido = async (matchId: number, s1: number, s2: number) => {
    if (s1 === s2) return alert("❌ En eliminatorias no puede haber empate.");
    const currentMatch = fifaMatches.find(m => m && m.id === matchId);
    if (!currentMatch) return;
    
    const isP1Winner = s1 > s2;
    const winner = isP1Winner ? currentMatch.p1 : currentMatch.p2;
    const winnerTeam = (isP1Winner ? currentMatch.p1Team : currentMatch.p2Team) || null;
    const winnerClub = (isP1Winner ? currentMatch.p1Club : currentMatch.p2Club) || null;

    try {
      if(!currentMatch.isBye && winner !== "Esperando...") {
        const playerRef = doc(db, "ranking", winner);
        await setDoc(playerRef, { puntos: increment(3), victorias: increment(1) }, { merge: true });
      }
      
      let nuevosPartidos = [...fifaMatches];
      nuevosPartidos = nuevosPartidos.map(m => m.id === matchId ? { ...m, score1: s1, score2: s2, winner: winner } : m);

      const avanzar = (targetId: number, slot: 'p1' | 'p2') => {
          if (!nuevosPartidos[targetId]) return;
          nuevosPartidos[targetId][slot] = winner;
          nuevosPartidos[targetId][slot === 'p1' ? 'p1Team' : 'p2Team'] = winnerTeam;
          nuevosPartidos[targetId][slot === 'p1' ? 'p1Club' : 'p2Club'] = winnerClub;
      };

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
          await addDoc(collection(db, "history"), {
              winner: winner,
              winnerTeam: winnerTeam || "Sin Equipo",
              date: serverTimestamp(),
              type: isSmall ? "Express (4p)" : "Oficial (8p)"
          });
      } else {
          lanzarFiesta();
      }

    } catch (e) { console.error(e); }
  };

  const girarRuleta = async (tipo: 'soft' | 'chupito') => {
    setIsSpinning(true);
    const lista = tipo === 'soft' ? listaSoft : listaChupitos;
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

  const generarExcusa = () => {
      const randomExcusa = EXCUSAS[Math.floor(Math.random() * EXCUSAS.length)];
      setExcusa(randomExcusa);
  };

  const handleSorteoPachanga = () => {
    const nombres = pachangaInput.split(/[\n,]+/).map((n) => n.trim()).filter((n) => n);
    if (nombres.length < 2) return alert("Mínimo 2");
    const shuffled = [...nombres].sort(() => Math.random() - 0.5);
    const mid = Math.ceil(shuffled.length / 2);
    setDoc(doc(db, "sala", "principal"), { equipoA: shuffled.slice(0, mid), equipoB: shuffled.slice(mid) }, { merge: true });
    setPachangaInput(""); 
  };

  const limpiarPizarra = async () => {
      const batch = writeBatch(db);
      batch.set(doc(db, "sala", "principal"), { equipoA: [], equipoB: [], fifaMatches: [], ultimoCastigo: "Esperando..." });
      await batch.commit();
  };

  const borrarTodaTemporada = async () => {
    if(!confirm("⛔ ¡PELIGRO! ¿Borrar Ranking y Palmarés?")) return;
    const batch = writeBatch(db);
    const rankingSnap = await getDocs(query(collection(db, "ranking")));
    rankingSnap.forEach((doc) => batch.delete(doc.ref));
    const historySnap = await getDocs(query(collection(db, "history")));
    historySnap.forEach((doc) => batch.delete(doc.ref));
    batch.set(doc(db, "sala", "principal"), { equipoA: [], equipoB: [], fifaMatches: [], ultimoCastigo: "..." });
    await batch.commit();
    alert("Temporada borrada.");
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-white font-sans pb-32 overflow-x-hidden select-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-900 via-neutral-950 to-black">
      <header className="bg-neutral-900/80 backdrop-blur-md sticky top-0 z-50 border-b border-white/10 p-4 shadow-lg shadow-purple-900/10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 uppercase tracking-tighter cursor-pointer drop-shadow-[0_2px_2px_rgba(255,255,255,0.3)]" onClick={() => setActiveTab('home')}>
                Proyecto Teletubies
            </h1>
            <nav className="flex bg-black/60 p-1 rounded-2xl gap-1 overflow-x-auto max-w-full border border-white/5">
                {['home', 'pachanga', 'fifa', 'castigos'].map((tab) => (
                    <button key={tab} onClick={() => setActiveTab(tab as Tab)} className={`px-4 py-2 rounded-xl font-bold text-xs uppercase transition-all duration-300 ${activeTab === tab ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.5)]' : 'text-gray-400 hover:text-white'}`}>
                        {tab}
                    </button>
                ))}
            </nav>
            <div className="flex gap-2">
                <button onClick={limpiarPizarra} className="hidden md:flex items-center gap-1 bg-neutral-800 hover:bg-neutral-700 border border-gray-600 text-xs text-white font-bold px-3 py-2 rounded-lg transition">🔄 Limpiar</button>
                <button onClick={borrarTodaTemporada} className="hidden md:block text-[10px] text-gray-600 hover:text-red-500 hover:bg-red-950/30 border border-transparent hover:border-red-900 rounded px-2 py-1 transition">⛔ Hard Reset</button>
            </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 md:p-8">
        
        {activeTab === 'home' && (
          <div className="grid md:grid-cols-2 gap-8">
             <section className="bg-neutral-900/40 border border-purple-500/20 rounded-3xl p-6 backdrop-blur-sm shadow-[0_0_30px_rgba(168,85,247,0.1)]">
                <h2 className="text-3xl font-black text-center mb-6 text-white">🏆 Ranking Actual</h2>
                <div className="space-y-3">
                    {ranking.map((p, i) => (
                        <div key={p.nombre} className="flex justify-between items-center bg-black/40 p-4 rounded-xl border border-white/5">
                            <div className="flex items-center gap-4">
                                <span className={`font-black text-2xl w-8 text-center ${i===0?'text-yellow-400':i===1?'text-gray-300':i===2?'text-orange-400':'text-gray-600'}`}>{i+1}</span>
                                <span className="font-bold text-lg">{p.nombre}</span>
                            </div>
                            <span className="font-black text-purple-400 text-xl">{p.puntos} pts</span>
                        </div>
                    ))}
                    {ranking.length === 0 && <p className="text-center text-gray-500">Sin puntos...</p>}
                </div>
             </section>
             <section className="bg-neutral-900/40 border border-yellow-500/20 rounded-3xl p-6 backdrop-blur-sm shadow-[0_0_30px_rgba(234,179,8,0.1)]">
                <h2 className="text-3xl font-black text-center mb-6 text-yellow-500">📜 Palmarés</h2>
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {history.map((h, i) => (
                        <div key={i} className="flex justify-between items-center bg-yellow-900/10 p-4 rounded-xl border border-yellow-500/20">
                            <div><p className="font-bold text-white text-lg">🏆 {h.winner}</p><p className="text-[10px] text-yellow-300">{h.winnerTeam}</p></div>
                            <span className="text-xs text-gray-500">{h.date ? new Date(h.date.seconds * 1000).toLocaleDateString() : 'Hoy'}</span>
                        </div>
                    ))}
                    {history.length === 0 && <p className="text-center text-gray-500">Aún no hay campeones.</p>}
                </div>
             </section>
          </div>
        )}

        {activeTab === 'pachanga' && (
          <section className="max-w-3xl mx-auto bg-neutral-900/40 border border-green-500/20 rounded-3xl p-6 backdrop-blur-sm shadow-[0_0_30px_rgba(34,197,94,0.1)]">
             <h2 className="text-3xl font-black text-green-400 mb-6 drop-shadow-md">⚽ Equipos Random</h2>
             <div className="flex flex-col gap-4 mb-8">
                <textarea className="w-full h-32 bg-black/40 border border-gray-700 rounded-xl p-4 text-white resize-none focus:outline-none focus:border-green-500 transition" placeholder="Escribe nombres y pulsa ENTER..." value={pachangaInput} onChange={e=>setPachangaInput(e.target.value)}></textarea>
                <button onClick={handleSorteoPachanga} className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-black py-4 rounded-xl shadow-lg">MEZCLAR</button>
             </div>
             {equipoA.length > 0 && (
                <div className="grid grid-cols-2 gap-6 animate-in fade-in">
                    <div className="bg-black/50 border border-red-500/30 p-6 rounded-2xl"><h3 className="text-red-400 font-black text-center mb-4">🔴 ROJOS</h3>{equipoA.map((p,i)=><div key={i} className="text-center text-gray-300 py-1">{p}</div>)}</div>
                    <div className="bg-black/50 border border-blue-500/30 p-6 rounded-2xl"><h3 className="text-blue-400 font-black text-center mb-4">🔵 AZULES</h3>{equipoB.map((p,i)=><div key={i} className="text-center text-gray-300 py-1">{p}</div>)}</div>
                </div>
             )}
          </section>
        )}

        {activeTab === 'fifa' && (
          <section className="animate-in fade-in duration-500">
             <div className="bg-neutral-900/40 p-6 rounded-3xl border border-blue-500/20 mb-8 max-w-2xl mx-auto backdrop-blur-sm">
                <h2 className="text-2xl font-black text-blue-400 mb-4">🏆 Nuevo Torneo</h2>
                <textarea className="w-full h-32 bg-black/40 border border-gray-700 rounded-xl p-4 text-white resize-none mb-4 focus:outline-none focus:border-blue-500 transition" placeholder="Pega lista..." value={fifaInput} onChange={e=>setFifaInput(e.target.value)}></textarea>
                <button onClick={handleCrearTorneoAuto} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl shadow-lg">⚡ GENERAR CUADRO + EQUIPOS</button>
             </div>

             {mayorPaliza && (
                 <div className="max-w-xl mx-auto mb-8 bg-gradient-to-r from-pink-950/60 to-red-950/60 border border-pink-500/30 p-4 rounded-2xl flex items-center justify-between animate-pulse">
                     <div className="flex items-center gap-4"><div className="text-4xl">🤕</div><div><h3 className="text-pink-400 font-black text-xs uppercase tracking-widest">Paliza</h3><p className="font-bold text-white text-sm"><span className="text-green-400">{mayorPaliza.winner}</span> humilló a <span className="text-red-400">{mayorPaliza.loser}</span></p></div></div>
                     <span className="font-black text-2xl text-pink-200">{mayorPaliza.result}</span>
                 </div>
             )}

             {fifaMatches.length > 0 && (
                <div className="w-full">
                     <div className="md:hidden flex flex-col gap-10">
                        <div><h3 className="text-blue-500 font-black text-center mb-4 tracking-widest bg-black/30 py-1 rounded">R1: {fifaMatches.length === 3 ? 'SEMIS' : 'CUARTOS'}</h3><div className="flex flex-col gap-3">{fifaMatches.length === 3 ? [0,1].map(id => <MatchCard key={id} m={fifaMatches[id]} onFinish={finalizarPartido} />) : [0,1,2,3].map(id => <MatchCard key={id} m={fifaMatches[id]} onFinish={finalizarPartido} />)}</div></div>
                        {fifaMatches.length === 7 && (<div><h3 className="text-purple-500 font-black text-center mb-4 tracking-widest bg-black/30 py-1 rounded">R2: SEMIFINALES</h3><div className="flex flex-col gap-3"><MatchCard m={fifaMatches[4]} onFinish={finalizarPartido} /><MatchCard m={fifaMatches[5]} onFinish={finalizarPartido} /></div></div>)}
                        <div><h3 className="text-yellow-500 font-black text-center mb-4 tracking-widest bg-black/30 py-1 rounded">🏆 GRAN FINAL 🏆</h3><div className="scale-105 shadow-2xl shadow-yellow-500/20 rounded-xl"><MatchCard m={fifaMatches[fifaMatches.length === 3 ? 2 : 6]} onFinish={finalizarPartido} isFinal /></div></div>
                     </div>

                     <div className="hidden md:block overflow-x-auto pb-10">
                        {fifaMatches.length === 3 ? (
                             <div className="grid grid-cols-2 gap-8 items-center max-w-4xl mx-auto">
                                 <div className="flex flex-col gap-6"><MatchCard m={fifaMatches[0]} onFinish={finalizarPartido} /><MatchCard m={fifaMatches[1]} onFinish={finalizarPartido} /></div>
                                 <div className="scale-110"><div className="text-4xl text-center mb-2">🏆</div><MatchCard m={fifaMatches[2]} onFinish={finalizarPartido} isFinal /></div>
                             </div>
                        ) : (
                            <div className="grid grid-cols-5 gap-4 items-center min-w-[1000px]">
                                <div className="flex flex-col justify-center gap-20"><div className="text-center"><p className="text-xs text-blue-500 font-bold mb-2">CUARTOS A</p><MatchCard m={fifaMatches[0]} onFinish={finalizarPartido} /></div><div className="text-center"><p className="text-xs text-blue-500 font-bold mb-2">CUARTOS B</p><MatchCard m={fifaMatches[1]} onFinish={finalizarPartido} /></div></div>
                                <div className="flex flex-col justify-center h-full relative"><div className="absolute left-0 top-1/4 w-8 h-1/2 border-l-2 border-t-2 border-b-2 border-white/10 rounded-l-xl opacity-30"></div><div className="text-center"><p className="text-xs text-purple-400 font-bold mb-2">SEMIFINAL 1</p><MatchCard m={fifaMatches[4]} onFinish={finalizarPartido} /></div></div>
                                <div className="flex flex-col items-center justify-center scale-110 z-10"><div className="text-6xl animate-bounce drop-shadow-glow mb-4">🏆</div><div className="bg-gradient-to-br from-yellow-600 to-orange-600 p-1 rounded-xl shadow-[0_0_50px_rgba(234,179,8,0.4)]"><div className="bg-black rounded-lg p-1"><MatchCard m={fifaMatches[6]} onFinish={finalizarPartido} isFinal /></div></div></div>
                                <div className="flex flex-col justify-center h-full relative"><div className="absolute right-0 top-1/4 w-8 h-1/2 border-r-2 border-t-2 border-b-2 border-white/10 rounded-r-xl opacity-30"></div><div className="text-center"><p className="text-xs text-purple-400 font-bold mb-2">SEMIFINAL 2</p><MatchCard m={fifaMatches[5]} onFinish={finalizarPartido} /></div></div>
                                <div className="flex flex-col justify-center gap-20"><div className="text-center"><p className="text-xs text-blue-500 font-bold mb-2">CUARTOS C</p><MatchCard m={fifaMatches[2]} onFinish={finalizarPartido} /></div><div className="text-center"><p className="text-xs text-blue-500 font-bold mb-2">CUARTOS D</p><MatchCard m={fifaMatches[3]} onFinish={finalizarPartido} /></div></div>
                            </div>
                        )}
                     </div>
                </div>
             )}
          </section>
        )}

        {activeTab === 'castigos' && (
           <section className="max-w-md mx-auto text-center mt-10 animate-in zoom-in duration-300">
              <div className="bg-black/60 border-2 border-red-600 p-8 rounded-3xl shadow-[0_0_50px_rgba(220,38,38,0.5)] mb-8">
                  <h2 className="text-red-500 font-black uppercase tracking-[0.3em] mb-4">Sentencia</h2>
                  <p className={`text-3xl font-black ${isSpinning?'blur-md text-red-500/50':'text-white scale-110 drop-shadow-glow'}`}>{resultadoRuleta}</p>
              </div>
              
              {/* CRONÓMETRO */}
              <div className="mb-8">
                  <div className="flex justify-center gap-2 mb-2">
                      <button onClick={()=>startTimer(30)} className="bg-gray-800 px-3 py-1 rounded text-xs font-bold hover:bg-gray-700">30s</button>
                      <button onClick={()=>startTimer(60)} className="bg-gray-800 px-3 py-1 rounded text-xs font-bold hover:bg-gray-700">1min</button>
                      <button onClick={()=>setTimeLeft(0)} className="bg-red-900/50 px-3 py-1 rounded text-xs font-bold hover:bg-red-800">Parar</button>
                  </div>
                  <div className="text-5xl font-mono font-black text-white bg-black/40 py-4 rounded-xl border border-white/10 shadow-inner">
                      {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                  </div>
              </div>

              {/* EXCUSÓMETRO (NUEVO) */}
              <div className="mb-8">
                  <button onClick={generarExcusa} className="w-full bg-blue-900/30 hover:bg-blue-900/50 border border-blue-500/30 text-blue-300 font-bold py-3 rounded-xl transition mb-2">
                      😭 He perdido... Dame una excusa
                  </button>
                  {excusa && <div className="bg-blue-950 p-3 rounded-lg border border-blue-500/50 text-white italic animate-in fade-in">"{excusa}"</div>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <button disabled={isSpinning} onClick={()=>girarRuleta('soft')} className="bg-neutral-800 p-6 rounded-2xl border border-gray-600 hover:bg-neutral-700 font-bold hover:scale-105 transition shadow-lg">🤡 Reto Soft</button>
                  <button disabled={isSpinning} onClick={()=>girarRuleta('chupito')} className="bg-red-950 p-6 rounded-2xl border border-red-600 hover:bg-red-900 font-bold text-red-200 hover:scale-105 transition shadow-lg shadow-red-900/40">🥃 Chupito</button>
              </div>
           </section>
        )}

        {/* --- NEWS TICKER (NUEVO) --- */}
        <div className="fixed bottom-0 left-0 w-full bg-black/90 border-t border-purple-500/30 overflow-hidden z-40 py-1">
            <div className="animate-marquee whitespace-nowrap flex gap-10">
                {[...NEWS_TICKER, ...NEWS_TICKER].map((news, i) => (
                    <span key={i} className="text-xs md:text-sm font-bold text-purple-300 uppercase tracking-wider">{news}</span>
                ))}
            </div>
        </div>

        {/* --- BOTONERA TÓXICA (DJ) --- */}
        <div className="fixed bottom-10 right-4 z-50 flex flex-col items-end gap-2">
           <button onClick={() => setShowDJ(!showDJ)} className="bg-purple-600 hover:bg-purple-500 text-white p-4 rounded-full shadow-2xl border-2 border-white/20 animate-pulse active:scale-95 transition">
             🔊
           </button>
           {showDJ && (
             <div className="bg-black/90 p-4 rounded-2xl border border-purple-500/30 backdrop-blur-md shadow-2xl flex flex-col gap-2 animate-in slide-in-from-bottom-5 mb-2">
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
      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </main>
  );
}

function SoundBtn({ label, url, color }: { label: string, url: string, color: string }) {
    const play = () => {
        const audio = new Audio(url);
        audio.play().catch(e => console.log("Error audio:", e));
    };
    return (
        <button onClick={play} className={`${color} hover:brightness-110 text-white text-[10px] font-bold py-3 px-4 rounded-xl shadow-lg active:scale-95 transition whitespace-nowrap`}>
            {label}
        </button>
    );
}

function MatchCard({ m, onFinish, isFinal }: { m?: Match, onFinish: (id: number, s1: number, s2: number) => void, isFinal?: boolean }) {
    const [s1, setS1] = useState("");
    const [s2, setS2] = useState("");
    if (!m) return <div className="bg-gray-900/50 p-2 rounded border border-gray-800 h-16 animate-pulse w-full"></div>;
    const isWaiting = m.p1 === "Esperando..." || m.p2 === "Esperando...";
    if (m.isBye) return <div className="relative p-3 rounded-xl border border-white/5 bg-neutral-900/30 w-full min-w-[180px] opacity-70"><div className="text-center py-2"><p className="text-green-500 font-bold mb-1">✅ {m.winner}</p><p className="text-[9px] text-gray-500 uppercase">Pase Directo</p></div></div>;

    return (
        <div className={`relative p-3 rounded-xl border-t border-l border-white/10 shadow-xl w-full min-w-[180px] transition-all backdrop-blur-md ${m.winner ? 'bg-blue-900/20 border-blue-500/50' : 'bg-neutral-900/80 border-gray-800'}`}>
            {m.winner ? (
                <div className="flex justify-between items-center gap-1 pt-1">
                    <div className="w-1/3 text-right overflow-hidden"><span className={`text-xs font-bold block truncate ${m.winner===m.p1?'text-green-400':'text-gray-500 line-through'}`}>{m.p1}</span><span className="text-[9px] text-gray-400 block truncate">{m.p1Team}</span></div>
                    <div className="bg-black/60 px-2 py-1 rounded text-xs font-black text-white border border-white/10">{m.score1}-{m.score2}</div>
                    <div className="w-1/3 text-left overflow-hidden"><span className={`text-xs font-bold block truncate ${m.winner===m.p2?'text-green-400':'text-gray-500 line-through'}`}>{m.p2}</span><span className="text-[9px] text-gray-400 block truncate">{m.p2Team}</span></div>
                </div>
            ) : (
                <div className="flex flex-col gap-2 mt-1">
                    <div className="flex justify-between items-center gap-1">
                        <div className="w-16 text-right overflow-hidden"><span className="text-xs font-bold block truncate text-gray-300">{m.p1}</span><span className="text-[8px] text-blue-400 block truncate">{m.p1Team}</span><span className="text-[8px] text-gray-500 block truncate">{m.p1Club}</span></div>
                        <input type="number" className="w-7 h-7 bg-black/50 text-center rounded text-white border border-gray-700 text-xs focus:outline-none" value={s1} onChange={e => setS1(e.target.value)} disabled={isWaiting}/>
                        <span className="text-[8px] text-gray-600 font-bold">VS</span>
                        <input type="number" className="w-7 h-7 bg-black/50 text-center rounded text-white border border-gray-700 text-xs focus:outline-none" value={s2} onChange={e => setS2(e.target.value)} disabled={isWaiting}/>
                        <div className="w-16 text-left overflow-hidden"><span className="text-xs font-bold block truncate text-gray-300">{m.p2}</span><span className="text-[8px] text-blue-400 block truncate">{m.p2Team}</span><span className="text-[8px] text-gray-500 block truncate">{m.p2Club}</span></div>
                    </div>
                    {!isWaiting && <button onClick={()=>s1&&s2&&onFinish(m.id, +s1, +s2)} className="w-full bg-blue-600/20 hover:bg-blue-600 text-blue-200 hover:text-white text-[9px] py-1 rounded uppercase font-black tracking-widest transition">FIN</button>}
                </div>
            )}
        </div>
    );
}