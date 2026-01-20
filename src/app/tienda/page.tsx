'use client';
import { useState, useMemo } from 'react';
import { useApp } from '@/lib/context';
import { db } from '@/lib/firebase';
import { doc, addDoc, collection, setDoc, increment, serverTimestamp } from 'firebase/firestore';
import { ShoppingCart, Shield, Ban, Skull, ChevronLeft, Lock } from 'lucide-react';
import Link from 'next/link';

export default function TiendaPage() {
  const { user, matches } = useApp();
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");

  const items = [
    {
      id: 'insurance',
      name: '🛡️ Seguro de Vida',
      price: 300,
      desc: 'Si pierdes, no te restan puntos de ranking ni honor.',
      color: 'bg-blue-50 border-blue-200 text-blue-700'
    },
    {
      id: 'veto',
      name: '⭐ Veto VIP',
      price: 500,
      desc: 'Tu rival NO puede elegir equipos de 5 estrellas (Adiós City/Madrid).',
      color: 'bg-yellow-50 border-yellow-200 text-yellow-700'
    },
    {
      id: 'injury',
      name: '🤕 Rompepiernas',
      price: 800,
      desc: 'Tu rival debe sentar a su jugador con más media en el banquillo.',
      color: 'bg-red-50 border-red-200 text-red-700'
    }
  ];

  const comprarVentaja = async (item: any) => {
    if (!user) return;
    if (!selectedMatchId) return alert("Selecciona primero en qué partido usarlo.");
    if ((user.balance || 0) < item.price) return alert("No tienes suficiente dinero, trabaja más.");

    const confirmMsg = `¿Gastar ${item.price}€ en "${item.name}" para el partido?`;
    if (!confirm(confirmMsg)) return;

    try {
      // 1. Cobrar
      await setDoc(doc(db, "users", user.id), { balance: increment(-item.price) }, { merge: true });
      
      // 2. Registrar ventaja
      await addDoc(collection(db, "powerups"), {
        buyer: user.id,
        matchId: parseInt(selectedMatchId), // Aseguramos que sea número para coincidir con el torneo
        type: item.id,
        name: item.name,
        timestamp: serverTimestamp()
      });

      alert(`✅ ¡Comprado! Ahora ve al torneo y haz valer tu ventaja.`);
    } catch (e) {
      console.error(e);
      alert("Error al comprar en el mercado negro.");
    }
  };

  // Filtrar mis partidos pendientes
  // Usamos useMemo para que no recargue constantemente
  const myMatches = useMemo(() => {
      if (!user || !matches) return [];
      return matches.filter((m:any) => 
        !m.winner && // Que no haya acabado
        !m.isBye && // Que no sea un pase directo
        (m.p1 === user.id || m.p2 === user.id) // Que sea YO uno de los jugadores
      );
  }, [matches, user]);

  // Si no hay usuario cargado aún, mostramos pantalla de carga o aviso
  if (!user) {
      return (
          <div className="min-h-screen bg-white flex flex-col items-center justify-center p-10 text-black">
              <Lock size={48} className="text-gray-300 mb-4"/>
              <p className="font-bold text-lg">Identifícate primero</p>
              <Link href="/perfil" className="mt-4 px-6 py-2 bg-black text-white rounded-full font-bold">Ir al Perfil</Link>
          </div>
      );
  }

  return (
    // "min-h-screen bg-white text-black" fuerza que la pantalla sea blanca y el texto negro siempre
    <div className="min-h-screen bg-white text-black pb-24">
        <div className="max-w-md mx-auto p-4 space-y-6">
            
            {/* CABECERA */}
            <div className="flex items-center gap-2 mb-6 pt-4">
                <Link href="/torneo" className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition"><ChevronLeft size={20}/></Link>
                <h1 className="text-2xl font-black italic uppercase">Mercado <span className="text-red-600">Negro</span></h1>
            </div>

            {/* SALDO */}
            <div className="bg-black text-white p-6 rounded-3xl shadow-xl flex justify-between items-center relative overflow-hidden">
                <div className="z-10">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Tu Dinero Sucio</p>
                    <p className="text-4xl font-mono font-black text-green-400 mt-1">{user.balance || 0} €</p>
                </div>
                <ShoppingCart size={48} className="opacity-20 absolute -right-4 -bottom-4 text-white"/>
            </div>

            {/* SELECTOR DE PARTIDO */}
            <div className="bg-gray-50 p-5 rounded-2xl border-2 border-gray-100">
                <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">1. ¿Dónde quieres hacer trampa?</label>
                {myMatches.length > 0 ? (
                    <select 
                        className="w-full p-4 bg-white rounded-xl font-bold text-sm outline-none border-2 border-gray-200 focus:border-black transition" 
                        onChange={e => setSelectedMatchId(e.target.value)}
                        value={selectedMatchId}
                    >
                        <option value="">👇 Selecciona un partido</option>
                        {myMatches.map((m:any) => (
                            <option key={m.id} value={m.id}>{m.p1} vs {m.p2}</option>
                        ))}
                    </select>
                ) : (
                    <div className="text-center p-4 bg-white rounded-xl border border-dashed border-gray-300">
                        <p className="text-xs text-gray-400 italic">No tienes partidos pendientes en el torneo.</p>
                    </div>
                )}
            </div>

            {/* LISTA DE ITEMS */}
            <div className="space-y-4">
                <label className="text-[10px] font-black uppercase text-gray-400 pl-2 tracking-widest">2. Elige tu ventaja</label>
                {items.map((item) => (
                    <button 
                        key={item.id} 
                        onClick={() => comprarVentaja(item)}
                        disabled={!selectedMatchId}
                        className={`w-full text-left p-5 rounded-2xl border-2 transition-all active:scale-[0.98] flex justify-between items-center group ${item.color} ${!selectedMatchId ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:shadow-lg bg-white'}`}
                    >
                        <div className="w-3/4 pr-4">
                            <div className="flex items-center gap-2 mb-1">
                                {item.id === 'veto' && <Ban size={18}/>}
                                {item.id === 'injury' && <Skull size={18}/>}
                                {item.id === 'insurance' && <Shield size={18}/>}
                                <h3 className="font-black text-sm uppercase">{item.name}</h3>
                            </div>
                            <p className="text-[10px] font-medium opacity-80 leading-snug">{item.desc}</p>
                        </div>
                        <div className="text-right flex flex-col items-end">
                            <span className="block font-black text-lg font-mono">{item.price}€</span>
                            <span className="text-[9px] font-black uppercase bg-black text-white px-2 py-1 rounded mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Comprar</span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    </div>
  );
}