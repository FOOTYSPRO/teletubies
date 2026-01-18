"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  doc, onSnapshot, setDoc, collection, query, orderBy, increment, 
  getDocs, writeBatch 
} from "firebase/firestore";
import confetti from "canvas-confetti";

// Definimos los tipos para que TypeScript no se queje
type Match = { p1: string; p2: string; winner?: string; id: number };
type Player = { nombre: string; puntos: number; victorias: number };
type Tab = 'home' | 'pachanga' | 'fifa';

export default function Home() {
  // --- NAVEGACIÓN ---
  const [activeTab, setActiveTab] = useState<Tab>('home');

  // --- ESTADOS INPUT ---
  const [pachangaInput, setPachangaInput] = useState("");
  const [fifaInput, setFifaInput] = useState("");
  
  // --- DATOS FIREBASE ---
  const [equipoA, setEquipoA] = useState<string[]>([]);
  const [equipoB, setEquipoB] = useState<string[]>([]);
  // Ahora fifaMatches guardará los 4 partidos de cuartos de final
  const [fifaMatches, setFifaMatches] = useState<Match[]>([]);
  const [ranking, setRanking] = useState<Player[]>([]);
  
  // --- EFECTOS ---
  const lanzarFiesta = () => {
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#a864fd', '#29cdff', '#78ff44', '#ff718d', '#fdff6a'] });
    const audio = new Audio("/gol.mp3");
    audio.volume = 0.5;
    audio.play().catch(e => console.log("Audio no encontrado (opcional)"));
  };

  // --- CONEXIONES FIREBASE ---
  // 1. Escuchar Sala Principal
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "sala", "principal"), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setEquipoA(data.equipoA || []);
        setEquipoB(data.equipoB || []);
        setFifaMatches(data.fifaMatches || []);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Escuchar Ranking
  useEffect(() => {
    const q = query(collection(db, "ranking"), orderBy("puntos", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rankingData = snapshot.docs.map(doc => ({
        nombre: doc.id,
        ...doc.data()
      })) as Player[];
      setRanking(rankingData);
    });
    return () => unsubscribe();
  }, []);

  // --- FUNCIONES ---
  const guardarEnNube = async (datos: any) => {
    await setDoc(doc(db, "sala", "principal"), datos, { merge: true });
    lanzarFiesta();
  };

  const registrarVictoria = async (jugador: string, matchId: number) => {
    if(jugador.includes("Bot")) return;
    try {
      // Sumar puntos al ranking
      const playerRef = doc(db, "ranking", jugador);
      await setDoc(playerRef, { puntos: increment(3), victorias: increment(1) }, { merge: true });
      
      // Actualizar el ganador en el bracket visual
      const nuevosPartidos = fifaMatches.map(m => 
        m.id === matchId ? { ...m, winner: jugador } : m
      );
      
      await setDoc(doc(db, "sala", "principal"), { fifaMatches: nuevosPartidos }, { merge: true });
      lanzarFiesta();
    } catch (e) { console.error(e); }
  };

  const resetearTemporada = async () => {
    if(!confirm("⚠️ ¿SEGURO? Esto borrará TODOS los puntos y el ranking a 0.")) return;
    const batch = writeBatch(db);
    const q = query(collection(db, "ranking"));
    const snapshot = await getDocs(q);
    snapshot.forEach((doc) => batch.delete(doc.ref));
    const salaRef = doc(db, "sala", "principal");
    batch.set(salaRef, { equipoA: [], equipoB: [], fifaMatches: [] });
    await batch.commit();
    alert("Temporada reiniciada. 🏁");
  };

  // --- LÓGICA PACHANGA ---
  const handleSorteoPachanga = () => {
    const nombres = pachangaInput.split(/[\n,]+/).map((n) => n.trim()).filter((n) => n);
    if (nombres.length < 2) return alert("Mínimo 2 jugadores");
    const shuffled = [...nombres].sort(() => Math.random() - 0.5);
    const mid = Math.ceil(shuffled.length / 2);
    guardarEnNube({ equipoA: shuffled.slice(0, mid), equipoB: shuffled.slice(mid) });
    setPachangaInput(""); 
  };

  // --- LÓGICA FIFA (BRACKET DE 8) ---
  const handleTorneoFifa = () => {
    let nombres = fifaInput.split(/[\n,]+/).map((n) => n.trim()).filter((n) => n);
    
    // Rellenar con bots hasta llegar a 8 jugadores para un bracket perfecto de Cuartos
    while (nombres.length < 8) {
        nombres.push(`Bot ${nombres.length + 1} 🤖`);
    }
    if (nombres.length > 8) {
        nombres = nombres.slice(0,8);
        alert("Se han seleccionado los primeros 8 jugadores para el cuadro.");
    }

    const shuffled = [...nombres].sort(() => Math.random() - 0.5);
    const matches: Match[] = [];
    // Generamos 4 partidos de cuartos de final
    for (let i = 0; i < 8; i += 2) {
      matches.push({ p1: shuffled[i], p2: shuffled[i + 1], id: i });
    }
    guardarEnNube({ fifaMatches: matches });
    setFifaInput("");
  };

  // Componente visual para un partido del bracket
  const BracketMatch = ({ match }: { match: Match }) => (
    <div className={`relative p-2 rounded-lg border ${match.winner ? 'bg-blue-900/40 border-blue-500' : 'bg-neutral-800 border-neutral-700'} mb-4 shadow-lg`}>
        {match.winner ? (
           <div className="text-center text-sm font-bold text-blue-300 py-2">🎉 {match.winner} 🎉</div>
        ) : (
        <div className="flex flex-col gap-1">
            <button onClick={() => registrarVictoria(match.p1, match.id)} className="w-full bg-neutral-900 hover:bg-blue-600 hover:text-white py-2 px-3 rounded text-xs font-bold transition text-left truncate border border-neutral-700">
                {match.p1}
            </button>
            <button onClick={() => registrarVictoria(match.p2, match.id)} className="w-full bg-neutral-900 hover:bg-blue-600 hover:text-white py-2 px-3 rounded text-xs font-bold transition text-left truncate border border-neutral-700">
                {match.p2}
            </button>
        </div>
        )}
    </div>
  );

  return (
    <main className="min-h-screen bg-neutral-950 text-white font-sans pb-20 overflow-x-hidden">
      {/* HEADER & NAVEGACIÓN */}
      <header className="bg-neutral-900/80 backdrop-blur-md sticky top-0 z-50 border-b border-white/10 p-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div onClick={() => setActiveTab('home')} className="cursor-pointer text-center md:text-left">
                <h1 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 uppercase tracking-tighter">
                Proyecto Teletubies
                </h1>
            </div>

            {/* MENÚ DE NAVEGACIÓN */}
            <nav className="flex bg-black/40 p-1 rounded-xl">
                <button onClick={() => setActiveTab('home')} className={`px-4 py-2 rounded-lg font-bold text-sm transition ${activeTab === 'home' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>🏠 Inicio</button>
                <button onClick={() => setActiveTab('pachanga')} className={`px-4 py-2 rounded-lg font-bold text-sm transition ${activeTab === 'pachanga' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>⚽ Pachanga</button>
                <button onClick={() => setActiveTab('fifa')} className={`px-4 py-2 rounded-lg font-bold text-sm transition ${activeTab === 'fifa' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>🎮 Torneo FIFA</button>
            </nav>
             <button onClick={resetearTemporada} className="hidden md:block text-[10px] text-gray-600 hover:text-red-500 p-2 border border-gray-800 rounded">🔄 Reset</button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 md:p-8">

        {/* --- VISTA: INICIO (Ranking) --- */}
        {activeTab === 'home' && (
          <section className="animate-in fade-in duration-500">
             <div className="bg-gradient-to-b from-purple-900/20 to-neutral-900/40 p-6 rounded-3xl border border-purple-500/20 shadow-2xl max-w-2xl mx-auto">
                 <div className="text-center mb-8">
                    <h2 className="text-4xl font-black text-white mb-2">👑 Salón de la Fama</h2>
                    <p className="text-purple-300">Clasificación General de la Temporada</p>
                 </div>
                 
                 <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                    {ranking.length === 0 ? (
                        <div className="text-center py-10 text-gray-500 opacity-50">
                            <p className="text-4xl mb-4">💤</p>
                            <p>Aún no hay leyendas...</p>
                        </div>
                    ) : (
                        ranking.map((player, i) => (
                        <div key={player.nombre} className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/5 hover:bg-white/10 transition group">
                            <div className="flex items-center gap-4">
                            <span className={`font-black text-2xl w-8 text-center ${i===0 ? 'text-yellow-400 drop-shadow-glow' : i===1 ? 'text-gray-300' : i===2 ? 'text-amber-600' : 'text-gray-600'}`}>
                                {i+1}
                            </span>
                            <div>
                                <span className="font-bold text-xl block group-hover:text-purple-300 transition">{player.nombre}</span>
                                <span className="text-xs text-gray-500">{player.victorias} Victorias</span>
                            </div>
                            </div>
                            <div className="text-right bg-purple-600/20 px-4 py-2 rounded-xl border border-purple-500/30">
                            <span className="block font-black text-purple-300 text-2xl">{player.puntos}</span>
                            <span className="text-[10px] text-purple-400 uppercase tracking-wider font-bold">Puntos</span>
                            </div>
                        </div>
                        ))
                    )}
                </div>
             </div>
          </section>
        )}

        {/* --- VISTA: PACHANGA (Fútbol Real) --- */}
        {activeTab === 'pachanga' && (
          <section className="animate-in slide-in-from-right duration-500 max-w-3xl mx-auto">
            <div className="bg-neutral-900/50 p-6 md:p-8 rounded-3xl border border-green-800/30 shadow-xl backdrop-blur-sm">
              <h2 className="text-3xl font-black text-green-400 mb-6 flex items-center gap-3">
                ⚽ Sorteo de Equipos
              </h2>
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                 <textarea
                    className="flex-1 bg-black/40 border border-neutral-700 rounded-xl p-4 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition resize-none h-32"
                    placeholder="Pega la lista de convocados..."
                    value={pachangaInput}
                    onChange={(e) => setPachangaInput(e.target.value)}
                ></textarea>
                <button onClick={handleSorteoPachanga} className="md:w-32 bg-green-600 hover:bg-green-500 text-white font-black py-4 px-6 rounded-xl transition transform hover:scale-105 active:scale-95 shadow-lg shadow-green-900/30 flex items-center justify-center uppercase tracking-wider text-sm">
                   Mezclar!
                </button>
              </div>
              
              {(equipoA.length > 0) && (
                <div className="grid grid-cols-2 gap-4 md:gap-8 animate-in fade-in mt-8">
                  <div className="bg-gradient-to-br from-red-900/40 to-black p-4 rounded-2xl border border-red-500/30 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
                    <h3 className="font-black text-center text-red-400 mb-4 text-xl uppercase tracking-widest">🔴 Rojos</h3>
                    <ul className="text-center space-y-2">
                        {equipoA.map((p, i) => <li key={i} className="font-bold text-gray-200 py-1 border-b border-red-500/10 last:border-0">{p}</li>)}
                    </ul>
                  </div>
                  <div className="bg-gradient-to-br from-blue-900/40 to-black p-4 rounded-2xl border border-blue-500/30 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                    <h3 className="font-black text-center text-blue-400 mb-4 text-xl uppercase tracking-widest">🔵 Azules</h3>
                    <ul className="text-center space-y-2">
                        {equipoB.map((p, i) => <li key={i} className="font-bold text-gray-200 py-1 border-b border-blue-500/10 last:border-0">{p}</li>)}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* --- VISTA: TORNEO FIFA (Bracket) --- */}
        {activeTab === 'fifa' && (
          <section className="animate-in slide-in-from-right duration-500">
             {/* GENERADOR */}
             <div className="bg-neutral-900/50 p-6 mb-8 rounded-3xl border border-blue-800/30 shadow-xl backdrop-blur-sm max-w-3xl mx-auto">
                <h2 className="text-2xl font-black text-blue-400 mb-4">🎮 Nuevo Torneo (8 Jugadores)</h2>
                <div className="flex gap-4">
                    <input
                        type="text"
                        className="flex-1 bg-black/40 border border-neutral-700 rounded-xl px-4 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition"
                        placeholder="Nombres (ej: Pepe, Juan, Ana...)"
                        value={fifaInput}
                        onChange={(e) => setFifaInput(e.target.value)}
                    />
                    <button onClick={handleTorneoFifa} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition whitespace-nowrap">
                        Generar Cuadro
                    </button>
                </div>
                <p className="text-xs text-gray-500 mt-2 ml-2">*Se necesitan 8 jugadores. Si hay menos, se rellenará con Bots.</p>
            </div>

            {/* BRACKET VISUAL (Solo se muestra si hay partidos generados) */}
            {fifaMatches.length > 0 && (
                <div className="overflow-x-auto py-10">
                    {/* Título del Torneo */}
                    <div className="text-center mb-8 relative">
                        <div className="absolute inset-x-0 top-1/2 h-px bg-blue-500/30 -z-10"></div>
                        <h2 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 uppercase inline-block bg-neutral-950 px-6 py-2 border border-blue-500/50 rounded-xl transform -skew-x-12">
                            TOURNAMENT CUP
                        </h2>
                    </div>

                    {/* Estructura del Bracket (CSS Grid) */}
                    <div className="grid grid-cols-5 gap-4 min-w-[800px] text-center items-center">
                        
                        {/* COLUMNA 1: CUARTOS A */}
                        <div className="space-y-8">
                            <h3 className="text-blue-300 font-bold text-sm mb-6 uppercase tracking-widest">Cuartos A</h3>
                            {fifaMatches.slice(0,2).map(match => <BracketMatch key={match.id} match={match} />)}
                        </div>

                        {/* COLUMNA 2: SEMIS A (Conectores visuales) */}
                        <div className="relative h-full">
                             <h3 className="text-blue-300 font-bold text-sm mb-6 uppercase tracking-widest invisible">Semis</h3>
                            <div className="absolute top-[15%] right-0 w-1/2 h-[35%] border-r-2 border-t-2 border-b-2 border-blue-500/30 rounded-r-xl"></div>
                            <div className="absolute top-[60%] right-0 w-1/2 h-[35%] border-r-2 border-t-2 border-b-2 border-blue-500/30 rounded-r-xl"></div>
                        </div>

                        {/* COLUMNA 3: FINAL Y COPA (Centro) */}
                        <div className="flex flex-col items-center justify-center space-y-6">
                             <div className="text-5xl animate-bounce drop-shadow-glow text-yellow-500">🏆</div>
                             <div className="bg-gradient-to-r from-yellow-600 to-orange-600 p-1 rounded-xl skew-x-[-10deg]">
                                 <div className="bg-black/60 px-8 py-4 rounded-lg backdrop-blur-md skew-x-[10deg] border border-yellow-500/30">
                                     <h3 className="text-2xl font-black text-yellow-400 uppercase tracking-[0.2em]">WINNER</h3>
                                     <p className="text-gray-400 text-sm mt-1">Esperando campeón...</p>
                                 </div>
                             </div>
                             <div className="h-20 w-px bg-blue-500/30"></div>
                              <div className="bg-neutral-800/80 px-6 py-3 rounded-lg border border-blue-500/30 w-full max-w-xs">
                                 <h3 className="text-blue-300 font-bold text-sm uppercase tracking-widest">GRAN FINAL</h3>
                                 <p className="text-xs text-gray-500 mt-2">Ganadores de Semis</p>
                             </div>
                        </div>

                         {/* COLUMNA 4: SEMIS B (Conectores visuales) */}
                         <div className="relative h-full">
                              <h3 className="text-blue-300 font-bold text-sm mb-6 uppercase tracking-widest invisible">Semis</h3>
                            <div className="absolute top-[15%] left-0 w-1/2 h-[35%] border-l-2 border-t-2 border-b-2 border-blue-500/30 rounded-l-xl"></div>
                            <div className="absolute top-[60%] left-0 w-1/2 h-[35%] border-l-2 border-t-2 border-b-2 border-blue-500/30 rounded-l-xl"></div>
                        </div>

                        {/* COLUMNA 5: CUARTOS B */}
                        <div className="space-y-8">
                            <h3 className="text-blue-300 font-bold text-sm mb-6 uppercase tracking-widest">Cuartos B</h3>
                            {fifaMatches.slice(2,4).map(match => <BracketMatch key={match.id} match={match} />)}
                        </div>
                    </div>
                </div>
            )}
          </section>
        )}

      </div>
    </main>
  );
}