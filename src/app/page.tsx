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
  const [equipoA, setEquipoA] = useState<string[]>([]);
  const [equipoB, setEquipoB] = useState<string[]>([]);
  const [fifaMatches, setFifaMatches] = useState<Match[]>([]);
  const [ranking, setRanking] = useState<Player[]>([]);
  const [resultadoRuleta, setResultadoRuleta] = useState<string>("☠️ Esperando víctima...");
  const [isSpinning, setIsSpinning] = useState(false);

  // Listas
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
        // Protección array
        setFifaMatches(Array.isArray(data.fifaMatches) ? data.fifaMatches : []);
        if (data.ultimoCastigo) setResultadoRuleta(data.ultimoCastigo);
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

  // --- LÓGICA TORNEO ---
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

      // LÓGICA DE AVANCE SEGÚN TAMAÑO DEL TORNEO
      const isSmallTournament = fifaMatches.length === 3; // Torneo de 4
      const isBigTournament = fifaMatches.length === 7;   // Torneo de 8

      if (isSmallTournament) {
          // IDs 0 y 1 son Semis -> Van a ID 2 (Final)
          if (matchId === 0) nuevosPartidos[2].p1 = winner;
          if (matchId === 1) nuevosPartidos[2].p2 = winner;
      } 
      else if (isBigTournament) {
          // IDs 0-3 Cuartos -> Van a 4-5 Semis -> Van a 6 Final
          if (matchId === 0) nuevosPartidos[4].p1 = winner;
          if (matchId === 1) nuevosPartidos[4].p2 = winner;
          if (matchId === 2) nuevosPartidos[5].p1 = winner;
          if (matchId === 3) nuevosPartidos[5].p2 = winner;
          if (matchId === 4) nuevosPartidos[6].p1 = winner;
          if (matchId === 5) nuevosPartidos[6].p2 = winner;
      }

      await setDoc(doc(db, "sala", "principal"), { fifaMatches: nuevosPartidos }, { merge: true });
      
      // Si es el último partido (Final), fiesta grande
      const lastId = isSmallTournament ? 2 : 6;
      if (matchId === lastId) confetti({ particleCount: 500, spread: 100 });
      else lanzarFiesta();

    } catch (e) { console.error(e); }
  };

  const crearTorneo = (size: 4 | 8) => {
    let nombres = fifaInput.split(/[\n,]+/).map((n) => n.trim()).filter((n) => n);
    
    if (nombres.length < 2) return alert("Mínimo 2 jugadores.");
    if (nombres.length > size) return alert(`Has puesto demasiados nombres para un torneo de ${size}. Usa el botón de ${size === 4 ? '8' : 'más'} jugadores.`);

    // Rellenar con bots
    while (nombres.length < size) nombres.push(`Bot ${nombres.length + 1} 🤖`);
    
    const shuffled = [...nombres].sort(() => Math.random() - 0.5);
    let matches: Match[] = [];

    if (size === 4) {
        // TORNEO PEQUEÑO: 3 Partidos (2 Semis + 1 Final)
        matches = [
            { id: 0, p1: shuffled[0], p2: shuffled[1], round: 'S' },
            { id: 1, p1: shuffled[2], p2: shuffled[3], round: 'S' },
            { id: 2, p1: "Esperando...", p2: "Esperando...", round: 'F' }
        ];
    } else {
        // TORNEO GRANDE: 7 Partidos (4 Cuartos + 2 Semis + 1 Final)
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

  // --- OTRAS FUNCIONES ---
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
    <main className="min-h-screen bg-neutral-950 text-white font-sans pb-24 overflow-x-hidden select-none">
      <header className="bg-neutral-900/80 backdrop-blur-md sticky top-0 z-50 border-b border-white/10 p-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 uppercase tracking-tighter cursor-pointer" onClick={() => setActiveTab('home')}>
                Proyecto Teletubies
            </h1>
            <nav className="flex bg-black/60 p-1 rounded-2xl gap-1 overflow-x-auto max-w-full">
                {['home', 'pachanga', 'fifa', 'castigos'].map((tab) => (
                    <button key={tab} onClick={() => setActiveTab(tab as Tab)} className={`px-3 py-2 rounded-xl font-bold text-xs uppercase transition ${activeTab === tab ? 'bg-white text-black' : 'text-gray-400'}`}>
                        {tab}
                    </button>
                ))}
            </nav>
            <button onClick={resetearTemporada} className="hidden md:block text-[10px] text-gray-600 hover:text-red-500 border border-gray-800 rounded px-2 py-1">Reset</button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4">
        {activeTab === 'home' && (
          <section className="max-w-2xl mx-auto bg-gradient-to-b from-purple-900/10 to-neutral-900 border border-purple-500/20 rounded-3xl p-6">
             <h2 className="text-3xl font-black text-center mb-6">🏆 Ranking Oficial</h2>
             <div className="space-y-2">
                {ranking.map((p, i) => (
                    <div key={p.nombre} className="flex justify-between items-center bg-black/40 p-3 rounded-xl border border-white/5">
                        <div className="flex items-center gap-3">
                            <span className={`font-black text-lg w-6 text-center ${i===0?'text-yellow-400':i===1?'text-gray-300':i===2?'text-orange-400':'text-gray-600'}`}>{i+1}</span>
                            <span className="font-bold">{p.nombre}</span>
                        </div>
                        <span className="font-black text-purple-400">{p.puntos} pts</span>
                    </div>
                ))}
                {ranking.length === 0 && <p className="text-center text-gray-500">Sin datos aún...</p>}
             </div>
          </section>
        )}

        {activeTab === 'pachanga' && (
          <section className="max-w-2xl mx-auto bg-neutral-900/50 border border-green-500/20 rounded-3xl p-6">
             <h2 className="text-2xl font-black text-green-400 mb-4">⚽ Equipos</h2>
             <div className="flex flex-col gap-4 mb-6">
                <textarea 
                    className="w-full h-32 bg-black/40 border border-gray-700 rounded-xl p-4 text-sm text-white resize-none focus:outline-none focus:border-green-500" 
                    placeholder="Escribe nombres y pulsa ENTER para nueva línea..." 
                    value={pachangaInput} 
                    onChange={e=>setPachangaInput(e.target.value)}
                ></textarea>
                <button onClick={handleSorteoPachanga} className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-green-900/30">
                    ¡Hacer Equipos!
                </button>
             </div>
             {equipoA.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-red-900/10 border border-red-500/30 p-4 rounded-xl"><h3 className="text-red-400 font-bold text-center mb-2">ROJOS</h3>{equipoA.map((p,i)=><div key={i} className="text-center text-sm border-b border-red-500/10 py-1">{p}</div>)}</div>
                    <div className="bg-blue-900/10 border border-blue-500/30 p-4 rounded-xl"><h3 className="text-blue-400 font-bold text-center mb-2">AZULES</h3>{equipoB.map((p,i)=><div key={i} className="text-center text-sm border-b border-blue-500/10 py-1">{p}</div>)}</div>
                </div>
             )}
          </section>
        )}

        {activeTab === 'fifa' && (
          <section>
             <div className="bg-neutral-900/50 p-6 rounded-3xl border border-blue-500/20 mb-8 max-w-2xl mx-auto">
                <h2 className="text-xl font-bold text-blue-400 mb-4">Nuevo Torneo</h2>
                <textarea 
                    className="w-full h-24 bg-black/40 border border-gray-700 rounded-xl p-3 text-sm text-white resize-none mb-4 focus:outline-none focus:border-blue-500" 
                    placeholder="Lista de jugadores (Enter para saltar línea)..." 
                    value={fifaInput} 
                    onChange={e=>setFifaInput(e.target.value)}
                ></textarea>
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => crearTorneo(4)} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl border-b-4 border-blue-800 active:border-0 active:translate-y-1 transition">
                        🏆 Torneo de 4
                    </button>
                    <button onClick={() => crearTorneo(8)} className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl border-b-4 border-purple-800 active:border-0 active:translate-y-1 transition">
                        🔥 Torneo de 8
                    </button>
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">*Si sois impares (ej: 3 o 5), se añadirán Bots para completar.</p>
             </div>

             {/* RENDERIZADO DEL CUADRO */}
             {fifaMatches.length > 0 && (
                <div className="w-full overflow-x-auto">
                     {/* SI ES TORNEO DE 4 */}
                     {fifaMatches.length === 3 && (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center max-w-4xl mx-auto">
                             <div className="flex flex-col gap-4">
                                 <h3 className="text-blue-500 text-xs font-bold uppercase text-center">Semifinales</h3>
                                 <MatchCard m={fifaMatches[0]} onFinish={finalizarPartido} />
                                 <MatchCard m={fifaMatches[1]} onFinish={finalizarPartido} />
                             </div>
                             <div className="scale-110">
                                 <h3 className="text-yellow-500 text-xs font-bold uppercase text-center mb-2">GRAN FINAL</h3>
                                 <MatchCard m={fifaMatches[2]} onFinish={finalizarPartido} />
                             </div>
                         </div>
                     )}

                     {/* SI ES TORNEO DE 8 */}
                     {fifaMatches.length === 7 && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 items-center min-h-[500px]">
                            <div className="flex flex-col justify-around gap-4 h-full">
                                {[0,1,2,3].map(id => <MatchCard key={id} m={fifaMatches[id]} onFinish={finalizarPartido} />)}
                            </div>
                            <div className="flex flex-col justify-center gap-12 h-full">
                                <div className="pl-8 md:pl-0"><MatchCard m={fifaMatches[4]} onFinish={finalizarPartido} /></div>
                                <div className="scale-110 z-10 border-2 border-yellow-500/50 rounded-lg shadow-[0_0_20px_rgba(234,179,8,0.3)] bg-black">
                                     <div className="bg-yellow-500 text-black text-[10px] font-black text-center uppercase tracking-widest">Gran Final</div>
                                     <MatchCard m={fifaMatches[6]} onFinish={finalizarPartido} />
                                </div>
                                 <div className="pl-8 md:pl-0"><MatchCard m={fifaMatches[5]} onFinish={finalizarPartido} /></div>
                            </div>
                        </div>
                     )}
                </div>
             )}
          </section>
        )}

        {activeTab === 'castigos' && (
           <section className="max-w-md mx-auto text-center mt-10">
              <div className="bg-black/80 border-2 border-red-600 p-8 rounded-3xl shadow-[0_0_40px_rgba(220,38,38,0.4)] mb-8">
                  <h2 className="text-red-500 font-black uppercase tracking-widest mb-4">El Castigo</h2>
                  <p className={`text-3xl font-black ${isSpinning?'blur-sm text-gray-500':'text-white scale-110'}`}>{resultadoRuleta}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <button disabled={isSpinning} onClick={()=>girarRuleta('soft')} className="bg-gray-800 p-4 rounded-xl border border-gray-600 hover:bg-gray-700 font-bold">🤡 Reto Soft</button>
                  <button disabled={isSpinning} onClick={()=>girarRuleta('chupito')} className="bg-red-900 p-4 rounded-xl border border-red-600 hover:bg-red-800 font-bold text-red-200">🥃 Chupito</button>
              </div>
           </section>
        )}
      </div>
    </main>
  );
}

// MATCHCARD (NO TOCAR, YA FUNCIONA BIEN)
function MatchCard({ m, onFinish }: { m?: Match, onFinish: (id: number, s1: number, s2: number) => void }) {
    const [s1, setS1] = useState("");
    const [s2, setS2] = useState("");

    if (!m) return <div className="bg-gray-900/50 p-2 rounded border border-gray-800 h-16 animate-pulse"></div>;

    const handleConfirm = () => {
        if (s1 === "" || s2 === "") return;
        onFinish(m.id, parseInt(s1), parseInt(s2));
    };

    const isWaiting = m.p1 === "Esperando..." || m.p2 === "Esperando...";

    return (
        <div className={`relative p-2 rounded-lg border mb-2 shadow-md w-full transition-all ${m.winner ? 'bg-blue-900/30 border-blue-500' : 'bg-neutral-800 border-neutral-700'}`}>
            <div className="absolute -top-2 left-2 bg-black px-2 text-[8px] text-gray-500 uppercase font-bold border border-gray-800 rounded">
                {m.round === 'Q' ? 'Cuartos' : m.round === 'S' ? 'Semi' : 'FINAL'}
            </div>

            {m.winner ? (
                <div className="flex justify-between items-center px-2 py-2">
                    <span className={`text-xs font-bold w-1/3 truncate text-right ${m.winner===m.p1 ? 'text-green-400' : 'text-gray-400'}`}>{m.p1}</span>
                    <div className="bg-black/50 px-2 py-1 rounded text-xs font-black text-white">{m.score1} - {m.score2}</div>
                    <span className={`text-xs font-bold w-1/3 truncate text-left ${m.winner===m.p2 ? 'text-green-400' : 'text-gray-400'}`}>{m.p2}</span>
                </div>
            ) : (
                <div className="flex flex-col gap-2 mt-2">
                    <div className="flex justify-between items-center gap-2">
                        <span className="text-xs font-bold w-16 truncate text-right text-gray-300">{m.p1}</span>
                        <input type="number" placeholder="0" className="w-8 h-8 bg-black/50 text-center rounded text-white border border-gray-600 text-sm" value={s1} onChange={e => setS1(e.target.value)} disabled={isWaiting}/>
                        <span className="text-[8px] text-gray-600">VS</span>
                        <input type="number" placeholder="0" className="w-8 h-8 bg-black/50 text-center rounded text-white border border-gray-600 text-sm" value={s2} onChange={e => setS2(e.target.value)} disabled={isWaiting}/>
                        <span className="text-xs font-bold w-16 truncate text-left text-gray-300">{m.p2}</span>
                    </div>
                    {!isWaiting && (
                        <button onClick={handleConfirm} className="w-full bg-blue-600/20 hover:bg-blue-600 text-blue-200 hover:text-white text-[10px] py-1 rounded uppercase font-bold tracking-wider transition">
                            Terminar
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}