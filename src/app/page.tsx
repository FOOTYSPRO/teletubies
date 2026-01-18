"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  doc, onSnapshot, setDoc, collection, query, orderBy, increment, 
  getDocs, writeBatch 
} from "firebase/firestore";
import confetti from "canvas-confetti";

// --- TIPOS ---
type Match = { 
  id: number; 
  p1: string; 
  p2: string; 
  score1?: number; 
  score2?: number; 
  winner?: string; 
  round: 'Q' | 'S' | 'F'; 
};

type Player = { nombre: string; puntos: number; victorias: number };
type Tab = 'home' | 'pachanga' | 'fifa' | 'castigos';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [pachangaInput, setPachangaInput] = useState("");
  const [fifaInput, setFifaInput] = useState("");
  
  // DATOS
  const [equipoA, setEquipoA] = useState<string[]>([]);
  const [equipoB, setEquipoB] = useState<string[]>([]);
  const [fifaMatches, setFifaMatches] = useState<Match[]>([]);
  const [ranking, setRanking] = useState<Player[]>([]);
  const [mayorPaliza, setMayorPaliza] = useState<{winner: string, loser: string, diff: number, result: string} | null>(null);
  
  // RULETA
  const [resultadoRuleta, setResultadoRuleta] = useState<string>("☠️ Esperando víctima...");
  const [isSpinning, setIsSpinning] = useState(false);

  // LISTAS
  const listaSoft = ["Haz 10 flexiones 💪", "Manda un audio cantando 🎤", "Baila sin música 30seg 💃", "No puedes hablar 1 ronda 🤐", "Comentarista next game 🎙️", "Enseña última foto carrete 📱", "Sirve bebida a todos 🥤"];
  const listaChupitos = ["🥃 1 Chupito", "🥃🥃 2 Chupitos", "🌊 ¡Cascada!", "🤝 Elige compañero", "🚫 Te libras", "💀 CHUPITO MORTAL"];

  const lanzarFiesta = () => {
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#a864fd', '#29cdff', '#78ff44', '#ff718d', '#fdff6a'] });
    const audio = new Audio("/gol.mp3");
    audio.volume = 0.5;
    audio.play().catch(() => {});
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "sala", "principal"), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setEquipoA(data.equipoA || []);
        setEquipoB(data.equipoB || []);
        // Protección para evitar errores si la estructura cambia
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

  const calcularPaliza = (matches: Match[]) => {
      let maxDiff = 0;
      let palizaData = null;
      matches.forEach(m => {
          if (m && m.winner && m.score1 !== undefined && m.score2 !== undefined) {
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

  const finalizarPartido = async (matchId: number, s1: number, s2: number) => {
    if (s1 === s2) return alert("❌ En eliminatorias no puede haber empate.");
    const currentMatch = fifaMatches.find(m => m && m.id === matchId);
    if (!currentMatch) return;
    const winner = s1 > s2 ? currentMatch.p1 : currentMatch.p2;

    try {
      if(!winner.includes("Bot") && winner !== "Esperando...") {
        const playerRef = doc(db, "ranking", winner);
        await setDoc(playerRef, { puntos: increment(3), victorias: increment(1) }, { merge: true });
      }
      
      let nuevosPartidos = [...fifaMatches];
      nuevosPartidos = nuevosPartidos.map(m => m.id === matchId ? { ...m, score1: s1, score2: s2, winner: winner } : m);

      // LÓGICA DE AVANCE INTELIGENTE
      const isSmallTournament = fifaMatches.length === 3; // Torneo de 4
      const isBigTournament = fifaMatches.length === 7;   // Torneo de 8

      if (isSmallTournament) {
          if (matchId === 0) nuevosPartidos[2].p1 = winner;
          if (matchId === 1) nuevosPartidos[2].p2 = winner;
      } 
      else if (isBigTournament) {
          if (matchId === 0) nuevosPartidos[4].p1 = winner;
          if (matchId === 1) nuevosPartidos[4].p2 = winner;
          if (matchId === 2) nuevosPartidos[5].p1 = winner;
          if (matchId === 3) nuevosPartidos[5].p2 = winner;
          if (matchId === 4) nuevosPartidos[6].p1 = winner;
          if (matchId === 5) nuevosPartidos[6].p2 = winner;
      }

      await setDoc(doc(db, "sala", "principal"), { fifaMatches: nuevosPartidos }, { merge: true });
      
      const lastId = isSmallTournament ? 2 : 6;
      if (matchId === lastId) confetti({ particleCount: 500, spread: 100 });
      else lanzarFiesta();

    } catch (e) { console.error(e); }
  };

  // --- GENERADOR INTELIGENTE ---
  const handleCrearTorneoAuto = () => {
    // 1. Limpiar lista
    let nombres = fifaInput.split(/[\n,]+/).map((n) => n.trim()).filter((n) => n);
    
    if (nombres.length < 2) return alert("Mínimo 2 jugadores.");
    if (nombres.length > 8) return alert("Máximo 8 jugadores por ahora (¡no caben en la pantalla!).");

    // 2. Decidir tamaño automáticamente
    let size = 8; // Por defecto grande
    if (nombres.length <= 4) size = 4; // Si son poquitos, pequeño

    // 3. Rellenar con bots lo que falte
    while (nombres.length < size) nombres.push(`Bot ${nombres.length + 1} 🤖`);
    
    // 4. Barajar y Crear
    const shuffled = [...nombres].sort(() => Math.random() - 0.5);
    let matches: Match[] = [];

    if (size === 4) {
        matches = [
            { id: 0, p1: shuffled[0], p2: shuffled[1], round: 'S' },
            { id: 1, p1: shuffled[2], p2: shuffled[3], round: 'S' },
            { id: 2, p1: "Esperando...", p2: "Esperando...", round: 'F' }
        ];
    } else {
        matches = [
            { id: 0, p1: shuffled[0], p2: shuffled[1], round: 'Q' },
            { id: 1, p1: shuffled[2], p2: shuffled[3], round: 'Q' },
            { id: 2, p1: shuffled[4], p2: shuffled[5], round: 'Q' },
            { id: 3, p1: shuffled[6], p2: shuffled[7], round: 'Q' },
            { id: 4, p1: "Esperando...", p2: "Esperando...", round: 'S' },
            { id: 5, p1: "Esperando...", p2: "Esperando...", round: 'S' },
            { id: 6, p1: "Esperando...", p2: "Esperando...", round: 'F' }
        ];
    }

    setDoc(doc(db, "sala", "principal"), { fifaMatches: matches }, { merge: true });
    setFifaInput("");
  };

  // OTRAS FUNCIONES
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

  const handleSorteoPachanga = () => {
    const nombres = pachangaInput.split(/[\n,]+/).map((n) => n.trim()).filter((n) => n);
    if (nombres.length < 2) return alert("Mínimo 2");
    const shuffled = [...nombres].sort(() => Math.random() - 0.5);
    const mid = Math.ceil(shuffled.length / 2);
    setDoc(doc(db, "sala", "principal"), { equipoA: shuffled.slice(0, mid), equipoB: shuffled.slice(mid) }, { merge: true });
    setPachangaInput(""); 
  };

  const resetearTemporada = async () => {
    if(!confirm("⚠️ ¿Resetear TODO?")) return;
    const batch = writeBatch(db);
    const snapshot = await getDocs(query(collection(db, "ranking")));
    snapshot.forEach((doc) => batch.delete(doc.ref));
    batch.set(doc(db, "sala", "principal"), { equipoA: [], equipoB: [], fifaMatches: [], ultimoCastigo: "..." });
    await batch.commit();
    alert("Temporada nueva 🏁");
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-white font-sans pb-24 overflow-x-hidden select-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-900 via-neutral-950 to-black">
      {/* HEADER */}
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
            <button onClick={resetearTemporada} className="hidden md:block text-[10px] text-gray-500 hover:text-red-500 border border-gray-800 hover:border-red-900 rounded px-2 py-1 transition">Reset</button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 md:p-8">
        
        {/* RANKING */}
        {activeTab === 'home' && (
          <section className="max-w-2xl mx-auto bg-neutral-900/40 border border-purple-500/20 rounded-3xl p-6 backdrop-blur-sm shadow-[0_0_30px_rgba(168,85,247,0.1)]">
             <h2 className="text-4xl font-black text-center mb-8 text-white drop-shadow-lg">🏆 Ranking Oficial</h2>
             <div className="space-y-3">
                {ranking.map((p, i) => (
                    <div key={p.nombre} className="flex justify-between items-center bg-black/40 p-4 rounded-xl border border-white/5 hover:border-purple-500/50 transition group">
                        <div className="flex items-center gap-4">
                            <span className={`font-black text-2xl w-8 text-center ${i===0?'text-yellow-400 drop-shadow-glow':i===1?'text-gray-300':i===2?'text-orange-400':'text-gray-600'}`}>{i+1}</span>
                            <span className="font-bold text-lg text-gray-200 group-hover:text-white transition">{p.nombre}</span>
                        </div>
                        <div className="bg-purple-900/20 px-3 py-1 rounded-lg border border-purple-500/30">
                            <span className="font-black text-purple-300 text-xl">{p.puntos}</span> <span className="text-[10px] text-purple-400">PTS</span>
                        </div>
                    </div>
                ))}
                {ranking.length === 0 && <p className="text-center text-gray-500 py-10">Sin datos aún... ¡A jugar!</p>}
             </div>
          </section>
        )}

        {/* PACHANGA */}
        {activeTab === 'pachanga' && (
          <section className="max-w-3xl mx-auto bg-neutral-900/40 border border-green-500/20 rounded-3xl p-6 backdrop-blur-sm shadow-[0_0_30px_rgba(34,197,94,0.1)]">
             <h2 className="text-3xl font-black text-green-400 mb-6 drop-shadow-md">⚽ Generador de Equipos</h2>
             <div className="flex flex-col gap-4 mb-8">
                <textarea 
                    className="w-full h-32 bg-black/40 border border-gray-700 rounded-xl p-4 text-base text-white resize-none focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition placeholder-gray-600" 
                    placeholder="Escribe nombres y pulsa ENTER para nueva línea..." 
                    value={pachangaInput} 
                    onChange={e=>setPachangaInput(e.target.value)}
                ></textarea>
                <button onClick={handleSorteoPachanga} className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-black py-4 rounded-xl shadow-lg shadow-green-900/20 transition transform hover:scale-[1.02] active:scale-95">
                    ¡MEZCLAR EQUIPOS!
                </button>
             </div>
             {equipoA.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-gradient-to-br from-red-950 to-black border border-red-500/30 p-6 rounded-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
                        <h3 className="text-red-400 font-black text-center mb-4 text-xl tracking-widest">🔴 ROJOS</h3>
                        {equipoA.map((p,i)=><div key={i} className="text-center text-gray-300 font-bold border-b border-red-500/10 py-2 last:border-0">{p}</div>)}
                    </div>
                    <div className="bg-gradient-to-br from-blue-950 to-black border border-blue-500/30 p-6 rounded-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                        <h3 className="text-blue-400 font-black text-center mb-4 text-xl tracking-widest">🔵 AZULES</h3>
                        {equipoB.map((p,i)=><div key={i} className="text-center text-gray-300 font-bold border-b border-blue-500/10 py-2 last:border-0">{p}</div>)}
                    </div>
                </div>
             )}
          </section>
        )}

        {/* FIFA */}
        {activeTab === 'fifa' && (
          <section className="animate-in fade-in duration-500">
             <div className="bg-neutral-900/40 p-6 rounded-3xl border border-blue-500/20 mb-8 max-w-2xl mx-auto backdrop-blur-sm shadow-[0_0_30px_rgba(59,130,246,0.1)]">
                <h2 className="text-2xl font-black text-blue-400 mb-4 drop-shadow-md">🏆 Nuevo Torneo</h2>
                <textarea 
                    className="w-full h-32 bg-black/40 border border-gray-700 rounded-xl p-4 text-base text-white resize-none mb-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition placeholder-gray-600" 
                    placeholder="Pega la lista de jugadores aquí..." 
                    value={fifaInput} 
                    onChange={e=>setFifaInput(e.target.value)}
                ></textarea>
                
                {/* BOTÓN ÚNICO AUTOMÁTICO */}
                <button onClick={handleCrearTorneoAuto} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black py-4 rounded-xl border-b-4 border-blue-800 active:border-0 active:translate-y-1 transition shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2">
                    <span>⚡ GENERAR CUADRO AUTOMÁTICO</span>
                </button>
                <p className="text-xs text-gray-500 mt-3 text-center">*Detecta automáticamente si es torneo de 4 o de 8. Si faltan jugadores, añade Bots.</p>
             </div>

             {/* PALIZA CARD */}
             {mayorPaliza && (
                 <div className="max-w-xl mx-auto mb-8 bg-gradient-to-r from-pink-950/60 to-red-950/60 border border-pink-500/30 p-4 rounded-2xl flex items-center justify-between animate-pulse shadow-[0_0_20px_rgba(236,72,153,0.2)]">
                     <div className="flex items-center gap-4">
                         <div className="text-4xl">🤕</div>
                         <div>
                             <h3 className="text-pink-400 font-black text-xs uppercase tracking-widest mb-1">Paliza del Torneo</h3>
                             <p className="font-bold text-white text-sm">
                                <span className="text-green-400">{mayorPaliza.winner}</span> humilló a <span className="text-red-400">{mayorPaliza.loser}</span>
                             </p>
                         </div>
                     </div>
                     <div className="bg-black/40 px-4 py-2 rounded-xl border border-pink-500/20">
                         <span className="font-black text-2xl text-pink-200">{mayorPaliza.result}</span>
                     </div>
                 </div>
             )}

             {/* CUADRO */}
             {fifaMatches.length > 0 && (
                <div className="w-full overflow-x-auto pb-10">
                     {/* TORNEO PEQUEÑO (4) */}
                     {fifaMatches.length === 3 && (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center max-w-4xl mx-auto">
                             <div className="flex flex-col gap-6">
                                 <h3 className="text-blue-500 text-xs font-bold uppercase text-center tracking-[0.2em]">Semifinales</h3>
                                 <MatchCard m={fifaMatches[0]} onFinish={finalizarPartido} />
                                 <MatchCard m={fifaMatches[1]} onFinish={finalizarPartido} />
                             </div>
                             <div className="scale-105 md:scale-110 border-l-0 md:border-l border-white/5 pl-0 md:pl-8">
                                 <div className="flex flex-col items-center">
                                     <div className="text-4xl animate-bounce mb-2">🏆</div>
                                     <MatchCard m={fifaMatches[2]} onFinish={finalizarPartido} isFinal />
                                 </div>
                             </div>
                         </div>
                     )}

                     {/* TORNEO GRANDE (8) */}
                     {fifaMatches.length === 7 && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-12 items-center min-w-[800px] md:min-w-0">
                            {/* COLUMNA 1 */}
                            <div className="flex flex-col justify-around gap-4 h-full">
                                <h3 className="text-blue-500 text-xs font-bold uppercase text-center mb-2 tracking-widest md:hidden">Cuartos</h3>
                                {[0,1,2,3].map(id => <MatchCard key={id} m={fifaMatches[id]} onFinish={finalizarPartido} />)}
                            </div>
                            
                            {/* COLUMNA 2 */}
                            <div className="flex flex-col justify-center gap-16 h-full relative">
                                <h3 className="text-blue-500 text-xs font-bold uppercase text-center mb-2 tracking-widest md:hidden">Semis</h3>
                                <div className="hidden md:block absolute left-0 top-1/4 w-4 h-1/2 border-l-2 border-t-2 border-b-2 border-white/10 rounded-l-xl -translate-x-full"></div>
                                <div className="hidden md:block absolute left-0 bottom-1/4 w-4 h-1/2 border-l-2 border-t-2 border-b-2 border-white/10 rounded-l-xl -translate-x-full translate-y-full"></div>
                                
                                <MatchCard m={fifaMatches[4]} onFinish={finalizarPartido} />
                                <MatchCard m={fifaMatches[5]} onFinish={finalizarPartido} />
                            </div>

                            {/* COLUMNA 3 */}
                            <div className="flex flex-col items-center justify-center">
                                <h3 className="text-yellow-500 text-xs font-bold uppercase text-center mb-4 tracking-widest md:hidden">FINAL</h3>
                                <div className="scale-110 z-10 p-1 bg-gradient-to-br from-yellow-600 to-orange-600 rounded-xl shadow-[0_0_40px_rgba(234,179,8,0.3)]">
                                     <div className="bg-black rounded-lg p-1">
                                         <MatchCard m={fifaMatches[6]} onFinish={finalizarPartido} isFinal />
                                     </div>
                                </div>
                            </div>
                        </div>
                     )}
                </div>
             )}
          </section>
        )}

        {/* RULETA */}
        {activeTab === 'castigos' && (
           <section className="max-w-md mx-auto text-center mt-10 animate-in zoom-in duration-300">
              <div className="bg-black/60 border-2 border-red-600 p-8 rounded-3xl shadow-[0_0_50px_rgba(220,38,38,0.5)] mb-8 relative overflow-hidden">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30"></div>
                  <h2 className="text-red-500 font-black uppercase tracking-[0.3em] mb-4 relative z-10">Sentencia</h2>
                  <p className={`text-2xl md:text-3xl font-black relative z-10 transition-all ${isSpinning?'blur-md text-red-500/50':'text-white scale-110 drop-shadow-glow'}`}>{resultadoRuleta}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <button disabled={isSpinning} onClick={()=>girarRuleta('soft')} className="bg-neutral-800 p-6 rounded-2xl border border-gray-600 hover:bg-neutral-700 font-bold hover:scale-105 transition shadow-lg">🤡 Reto Soft</button>
                  <button disabled={isSpinning} onClick={()=>girarRuleta('chupito')} className="bg-red-950 p-6 rounded-2xl border border-red-600 hover:bg-red-900 font-bold text-red-200 hover:scale-105 transition shadow-lg shadow-red-900/40">🥃 Chupito</button>
              </div>
           </section>
        )}
      </div>
    </main>
  );
}

// MATCHCARD (Diseño Neon Restaurado)
function MatchCard({ m, onFinish, isFinal }: { m?: Match, onFinish: (id: number, s1: number, s2: number) => void, isFinal?: boolean }) {
    const [s1, setS1] = useState("");
    const [s2, setS2] = useState("");

    if (!m) return <div className="bg-gray-900/50 p-2 rounded border border-gray-800 h-16 animate-pulse w-48"></div>;

    const handleConfirm = () => {
        if (s1 === "" || s2 === "") return;
        onFinish(m.id, parseInt(s1), parseInt(s2));
    };

    const isWaiting = m.p1 === "Esperando..." || m.p2 === "Esperando...";

    return (
        <div className={`relative p-3 rounded-xl border-t border-l border-white/10 shadow-xl w-full min-w-[200px] transition-all duration-300 backdrop-blur-md ${m.winner ? 'bg-blue-900/20 border-blue-500/50 shadow-blue-500/10' : 'bg-neutral-900/60 border-gray-800'}`}>
            
            {/* ETIQUETA RONDA */}
            <div className={`absolute -top-2.5 left-3 px-2 py-0.5 text-[9px] uppercase font-black tracking-wider rounded border ${isFinal ? 'bg-yellow-500 text-black border-yellow-400' : 'bg-black text-gray-500 border-gray-800'}`}>
                {m.round === 'Q' ? 'Cuartos' : m.round === 'S' ? 'Semi' : 'FINAL'}
            </div>

            {m.winner ? (
                // RESULTADO FINAL
                <div className="flex justify-between items-center gap-2 pt-1">
                    <span className={`text-xs font-bold w-1/3 truncate text-right ${m.winner===m.p1 ? 'text-green-400 drop-shadow-glow' : 'text-gray-500 line-through'}`}>{m.p1}</span>
                    <div className="bg-black/60 px-2 py-1 rounded text-sm font-black text-white border border-white/10 shadow-inner">{m.score1}-{m.score2}</div>
                    <span className={`text-xs font-bold w-1/3 truncate text-left ${m.winner===m.p2 ? 'text-green-400 drop-shadow-glow' : 'text-gray-500 line-through'}`}>{m.p2}</span>
                </div>
            ) : (
                // INPUTS JUEGO
                <div className="flex flex-col gap-2 mt-1">
                    <div className="flex justify-between items-center gap-2">
                        <span className="text-xs font-bold w-16 truncate text-right text-gray-300">{m.p1}</span>
                        <input type="number" className="w-8 h-8 bg-black/50 text-center rounded text-white border border-gray-700 focus:border-blue-500 text-sm focus:outline-none transition" value={s1} onChange={e => setS1(e.target.value)} disabled={isWaiting}/>
                        <span className="text-[8px] text-gray-600 font-bold">VS</span>
                        <input type="number" className="w-8 h-8 bg-black/50 text-center rounded text-white border border-gray-700 focus:border-blue-500 text-sm focus:outline-none transition" value={s2} onChange={e => setS2(e.target.value)} disabled={isWaiting}/>
                        <span className="text-xs font-bold w-16 truncate text-left text-gray-300">{m.p2}</span>
                    </div>
                    {!isWaiting && (
                        <button onClick={handleConfirm} className="w-full bg-blue-600/20 hover:bg-blue-600 text-blue-200 hover:text-white text-[9px] py-1 rounded uppercase font-black tracking-widest transition border border-blue-500/20 hover:border-blue-400">
                            TERMINAR PARTIDO
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}