"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  doc, onSnapshot, setDoc, collection, query, orderBy, increment, 
  getDocs, writeBatch 
} from "firebase/firestore";
import confetti from "canvas-confetti";

// Tipos
type Match = { p1: string; p2: string; winner?: string; id: number };
type Player = { nombre: string; puntos: number; victorias: number };
// 👇 Añadimos 'castigos' a las pestañas
type Tab = 'home' | 'pachanga' | 'fifa' | 'castigos';

export default function Home() {
  // --- NAVEGACIÓN ---
  const [activeTab, setActiveTab] = useState<Tab>('home');

  // --- ESTADOS ---
  const [pachangaInput, setPachangaInput] = useState("");
  const [fifaInput, setFifaInput] = useState("");
  
  // --- DATOS FIREBASE ---
  const [equipoA, setEquipoA] = useState<string[]>([]);
  const [equipoB, setEquipoB] = useState<string[]>([]);
  const [fifaMatches, setFifaMatches] = useState<Match[]>([]);
  const [ranking, setRanking] = useState<Player[]>([]);
  
  // Nuevo estado para sincronizar la ruleta
  const [resultadoRuleta, setResultadoRuleta] = useState<string>("☠️ Esperando víctima...");
  const [isSpinning, setIsSpinning] = useState(false);

  // --- LISTAS DE CASTIGOS ---
  const listaSoft = [
    "Haz 10 flexiones 💪", "Manda un audio cantando 🎤", "Baila sin música 30seg 💃", 
    "No puedes hablar 1 ronda 🤐", "Haz de comentarista el próximo partido 🎙️", 
    "Deja que lean tu último WhatsApp 📱", "Sirve la bebida a todos 🥤"
  ];
  
  const listaChupitos = [
    "🥃 1 Chupito para el perdedor", "🥃🥃 2 Chupitos (Castigo Doble)", 
    "🌊 ¡Cascada! Todos beben", "🤝 Elige compañero de chupito", 
    "🚫 Te libras (Nadie bebe)", "💀 CHUPITO DE LA MUERTE (Mezcla todo)"
  ];

  // --- EFECTOS ---
  const lanzarFiesta = () => {
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#a864fd', '#29cdff', '#78ff44', '#ff718d', '#fdff6a'] });
    const audio = new Audio("/gol.mp3"); // Asegúrate de tener este archivo o cámbialo
    audio.volume = 0.5;
    audio.play().catch(() => {});
  };

  // --- CONEXIONES FIREBASE ---
  useEffect(() => {
    // Escuchar Sala Principal y CASTIGOS
    const unsubscribe = onSnapshot(doc(db, "sala", "principal"), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setEquipoA(data.equipoA || []);
        setEquipoB(data.equipoB || []);
        setFifaMatches(data.fifaMatches || []);
        // Sincronizar ruleta si cambia en la nube
        if (data.ultimoCastigo) setResultadoRuleta(data.ultimoCastigo);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "ranking"), orderBy("puntos", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rankingData = snapshot.docs.map(doc => ({ nombre: doc.id, ...doc.data() })) as Player[];
      setRanking(rankingData);
    });
    return () => unsubscribe();
  }, []);

  // --- FUNCIONES ---
  const guardarEnNube = async (datos: any) => {
    await setDoc(doc(db, "sala", "principal"), datos, { merge: true });
    // Solo lanzamos fiesta si no es un castigo (para los castigos ya hay animación propia)
    if (!datos.ultimoCastigo) lanzarFiesta();
  };

  const registrarVictoria = async (jugador: string, matchId: number) => {
    if(jugador.includes("Bot")) return;
    try {
      const playerRef = doc(db, "ranking", jugador);
      await setDoc(playerRef, { puntos: increment(3), victorias: increment(1) }, { merge: true });
      const nuevosPartidos = fifaMatches.map(m => m.id === matchId ? { ...m, winner: jugador } : m);
      await setDoc(doc(db, "sala", "principal"), { fifaMatches: nuevosPartidos }, { merge: true });
      lanzarFiesta();
    } catch (e) { console.error(e); }
  };

  // 🎰 LÓGICA DE LA RULETA (Con animación)
  const girarRuleta = async (tipo: 'soft' | 'chupito') => {
    setIsSpinning(true);
    const lista = tipo === 'soft' ? listaSoft : listaChupitos;
    
    // Animación visual local (girando...)
    let i = 0;
    const intervalo = setInterval(() => {
        setResultadoRuleta(lista[i % lista.length]);
        i++;
    }, 80);

    // Parar y guardar en Firebase
    setTimeout(async () => {
        clearInterval(intervalo);
        const final = lista[Math.floor(Math.random() * lista.length)];
        setResultadoRuleta(final);
        setIsSpinning(false);
        // Guardamos para que lo vean todos
        await setDoc(doc(db, "sala", "principal"), { ultimoCastigo: final }, { merge: true });
        
        // Efecto de sonido de "mala suerte" si es chupito
        if(tipo === 'chupito') confetti({ particleCount: 50, colors: ['#ff0000'] }); 
    }, 2000);
  };

  const resetearTemporada = async () => {
    if(!confirm("⚠️ ¿SEGURO? Esto borrará TODOS los puntos y el ranking a 0.")) return;
    const batch = writeBatch(db);
    const q = query(collection(db, "ranking"));
    const snapshot = await getDocs(q);
    snapshot.forEach((doc) => batch.delete(doc.ref));
    const salaRef = doc(db, "sala", "principal");
    batch.set(salaRef, { equipoA: [], equipoB: [], fifaMatches: [], ultimoCastigo: "☠️ Esperando víctima..." });
    await batch.commit();
    alert("Temporada reiniciada. 🏁");
  };

  // --- GENERADORES ---
  const handleSorteoPachanga = () => {
    const nombres = pachangaInput.split(/[\n,]+/).map((n) => n.trim()).filter((n) => n);
    if (nombres.length < 2) return alert("Mínimo 2 jugadores");
    const shuffled = [...nombres].sort(() => Math.random() - 0.5);
    const mid = Math.ceil(shuffled.length / 2);
    guardarEnNube({ equipoA: shuffled.slice(0, mid), equipoB: shuffled.slice(mid) });
    setPachangaInput(""); 
  };

  const handleTorneoFifa = () => {
    let nombres = fifaInput.split(/[\n,]+/).map((n) => n.trim()).filter((n) => n);
    while (nombres.length < 8) nombres.push(`Bot ${nombres.length + 1} 🤖`);
    if (nombres.length > 8) nombres = nombres.slice(0,8);
    const shuffled = [...nombres].sort(() => Math.random() - 0.5);
    const matches: Match[] = [];
    for (let i = 0; i < 8; i += 2) matches.push({ p1: shuffled[i], p2: shuffled[i + 1], id: i });
    guardarEnNube({ fifaMatches: matches });
    setFifaInput("");
  };

  const BracketMatch = ({ match }: { match: Match }) => (
    <div className={`relative p-2 rounded-lg border ${match.winner ? 'bg-blue-900/40 border-blue-500' : 'bg-neutral-800 border-neutral-700'} mb-4 shadow-lg`}>
        {match.winner ? (
           <div className="text-center text-sm font-bold text-blue-300 py-2">🎉 {match.winner} 🎉</div>
        ) : (
        <div className="flex flex-col gap-1">
            <button onClick={() => registrarVictoria(match.p1, match.id)} className="w-full bg-neutral-900 hover:bg-blue-600 hover:text-white py-2 px-3 rounded text-xs font-bold transition text-left truncate border border-neutral-700">{match.p1}</button>
            <button onClick={() => registrarVictoria(match.p2, match.id)} className="w-full bg-neutral-900 hover:bg-blue-600 hover:text-white py-2 px-3 rounded text-xs font-bold transition text-left truncate border border-neutral-700">{match.p2}</button>
        </div>
        )}
    </div>
  );

  return (
    <main className="min-h-screen bg-neutral-950 text-white font-sans pb-24 overflow-x-hidden">
      {/* HEADER & NAV */}
      <header className="bg-neutral-900/80 backdrop-blur-md sticky top-0 z-50 border-b border-white/10 p-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 uppercase tracking-tighter cursor-pointer" onClick={() => setActiveTab('home')}>
                Proyecto Teletubies
            </h1>
            {/* MENÚ FLOTANTE EN MÓVIL / BARRA EN PC */}
            <nav className="flex bg-black/60 p-1 rounded-2xl overflow-x-auto max-w-full gap-1">
                <button onClick={() => setActiveTab('home')} className={`px-3 py-2 rounded-xl font-bold text-xs md:text-sm transition whitespace-nowrap ${activeTab === 'home' ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>🏠 Inicio</button>
                <button onClick={() => setActiveTab('pachanga')} className={`px-3 py-2 rounded-xl font-bold text-xs md:text-sm transition whitespace-nowrap ${activeTab === 'pachanga' ? 'bg-green-600 text-white' : 'text-gray-400'}`}>⚽ Pachanga</button>
                <button onClick={() => setActiveTab('fifa')} className={`px-3 py-2 rounded-xl font-bold text-xs md:text-sm transition whitespace-nowrap ${activeTab === 'fifa' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>🎮 FIFA</button>
                <button onClick={() => setActiveTab('castigos')} className={`px-3 py-2 rounded-xl font-bold text-xs md:text-sm transition whitespace-nowrap ${activeTab === 'castigos' ? 'bg-red-600 text-white animate-pulse' : 'text-gray-400'}`}>💀 Ruleta</button>
            </nav>
             <button onClick={resetearTemporada} className="hidden md:block text-[10px] text-gray-600 hover:text-red-500 p-2 border border-gray-800 rounded">🔄 Reset</button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 md:p-8">

        {/* --- 1. INICIO (RANKING) --- */}
        {activeTab === 'home' && (
          <section className="animate-in fade-in duration-500 max-w-2xl mx-auto">
             <div className="bg-gradient-to-b from-purple-900/20 to-neutral-900/40 p-6 rounded-3xl border border-purple-500/20 shadow-2xl">
                 <div className="text-center mb-6">
                    <h2 className="text-3xl font-black text-white mb-2">👑 Clasificación</h2>
                    <p className="text-purple-300 text-sm">¿Quién manda aquí?</p>
                 </div>
                 <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                    {ranking.length === 0 ? (
                        <div className="text-center py-10 text-gray-500"><p className="text-4xl mb-2">💤</p><p>Sin datos...</p></div>
                    ) : (
                        ranking.map((player, i) => (
                        <div key={player.nombre} className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/5 hover:bg-white/10 transition">
                            <div className="flex items-center gap-4">
                            <span className={`font-black text-xl w-6 text-center ${i===0 ? 'text-yellow-400' : 'text-gray-600'}`}>{i+1}</span>
                            <div>
                                <span className="font-bold text-lg block">{player.nombre}</span>
                                <span className="text-xs text-gray-500">{player.victorias} Wins</span>
                            </div>
                            </div>
                            <div className="bg-purple-600/20 px-3 py-1 rounded-lg border border-purple-500/30">
                            <span className="font-black text-purple-300 text-xl">{player.puntos}</span> <span className="text-[10px] text-purple-400">PTS</span>
                            </div>
                        </div>
                        ))
                    )}
                </div>
             </div>
          </section>
        )}

        {/* --- 2. PACHANGA --- */}
        {activeTab === 'pachanga' && (
          <section className="animate-in slide-in-from-right duration-500 max-w-3xl mx-auto">
            <div className="bg-neutral-900/50 p-6 rounded-3xl border border-green-800/30 shadow-xl backdrop-blur-sm">
              <h2 className="text-2xl font-black text-green-400 mb-4">⚽ Equipos Random</h2>
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                 <textarea className="flex-1 bg-black/40 border border-neutral-700 rounded-xl p-4 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition h-24" placeholder="Nombres..." value={pachangaInput} onChange={(e) => setPachangaInput(e.target.value)}></textarea>
                 <button onClick={handleSorteoPachanga} className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-green-900/30">Mezclar!</button>
              </div>
              {(equipoA.length > 0) && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                  <div className="bg-red-900/20 p-4 rounded-xl border border-red-500/30"><h3 className="font-black text-center text-red-400 mb-2">🔴 ROJOS</h3><ul className="text-center space-y-1">{equipoA.map((p, i) => <li key={i} className="text-sm text-gray-300">{p}</li>)}</ul></div>
                  <div className="bg-blue-900/20 p-4 rounded-xl border border-blue-500/30"><h3 className="font-black text-center text-blue-400 mb-2">🔵 AZULES</h3><ul className="text-center space-y-1">{equipoB.map((p, i) => <li key={i} className="text-sm text-gray-300">{p}</li>)}</ul></div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* --- 3. FIFA BRACKET --- */}
        {activeTab === 'fifa' && (
          <section className="animate-in slide-in-from-right duration-500">
             <div className="bg-neutral-900/50 p-6 mb-8 rounded-3xl border border-blue-800/30 shadow-xl backdrop-blur-sm max-w-3xl mx-auto">
                <h2 className="text-xl font-black text-blue-400 mb-4">🎮 Torneo Express (8p)</h2>
                <div className="flex gap-2">
                    <input type="text" className="flex-1 bg-black/40 border border-neutral-700 rounded-xl px-4 text-white focus:outline-none focus:border-blue-500" placeholder="Nombres..." value={fifaInput} onChange={(e) => setFifaInput(e.target.value)}/>
                    <button onClick={handleTorneoFifa} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-xl">Crear</button>
                </div>
            </div>
            {fifaMatches.length > 0 && (
                <div className="overflow-x-auto pb-10">
                    <div className="grid grid-cols-5 gap-2 min-w-[700px] text-center items-center">
                        <div className="space-y-6"><h3 className="text-blue-500 text-xs font-bold uppercase">Cuartos</h3>{fifaMatches.slice(0,2).map(match => <BracketMatch key={match.id} match={match} />)}</div>
                        <div className="relative h-full border-r border-blue-500/20"></div>
                        <div className="flex flex-col items-center justify-center space-y-4"><div className="text-4xl animate-bounce">🏆</div><div className="bg-neutral-800 p-4 rounded border border-yellow-500/30"><h3 className="text-yellow-400 font-black">WINNER</h3></div></div>
                        <div className="relative h-full border-l border-blue-500/20"></div>
                        <div className="space-y-6"><h3 className="text-blue-500 text-xs font-bold uppercase">Cuartos</h3>{fifaMatches.slice(2,4).map(match => <BracketMatch key={match.id} match={match} />)}</div>
                    </div>
                </div>
            )}
          </section>
        )}

        {/* --- 4. ZONA DE RIESGO (RULETA & CHUPITOS) --- */}
        {activeTab === 'castigos' && (
           <section className="animate-in zoom-in duration-300 max-w-lg mx-auto text-center">
              
              {/* PANTALLA DEL RESULTADO */}
              <div className="bg-black/60 p-8 rounded-3xl border-2 border-red-600 mb-8 shadow-[0_0_30px_rgba(220,38,38,0.5)] relative overflow-hidden group">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                  <h2 className="text-red-500 font-black tracking-[0.2em] mb-4 uppercase">Sentencia Final</h2>
                  <div className="min-h-[100px] flex items-center justify-center">
                      <p className={`text-2xl md:text-3xl font-black transition-all ${isSpinning ? 'text-gray-400 blur-sm' : 'text-white scale-110 drop-shadow-glow'}`}>
                          {resultadoRuleta}
                      </p>
                  </div>
              </div>

              {/* CONTROLES */}
              <div className="grid grid-cols-2 gap-4">
                  {/* BOTÓN 1: CASTIGOS SOFT */}
                  <button 
                    onClick={() => girarRuleta('soft')} 
                    disabled={isSpinning}
                    className="bg-neutral-800 hover:bg-neutral-700 p-6 rounded-2xl border border-gray-600 transition group disabled:opacity-50"
                  >
                      <div className="text-4xl mb-2 group-hover:scale-110 transition">🤡</div>
                      <h3 className="font-bold text-gray-300">Reto Gracioso</h3>
                      <p className="text-xs text-gray-500">Para reír un rato</p>
                  </button>

                  {/* BOTÓN 2: CHUPITOS */}
                  <button 
                    onClick={() => girarRuleta('chupito')} 
                    disabled={isSpinning}
                    className="bg-red-900/50 hover:bg-red-800 p-6 rounded-2xl border border-red-500 transition group disabled:opacity-50 shadow-lg shadow-red-900/20"
                  >
                      <div className="text-4xl mb-2 group-hover:rotate-12 transition">🥃</div>
                      <h3 className="font-bold text-red-300">Modo Chupito</h3>
                      <p className="text-xs text-red-400">¿Cuántos bebes?</p>
                  </button>
              </div>

              <p className="mt-8 text-xs text-gray-600">
                  *Lo que diga la ruleta va a misa. Sincronizado en todos los móviles.
              </p>
           </section>
        )}

      </div>
    </main>
  );
}