'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { Trophy, Medal, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function RankingPage() {
  const [ranking, setRanking] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, "ranking"));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        name: doc.id,
        ...doc.data()
      }));
      // Ordenar por VICTORIAS, y si empatan, por PARTIDOS JUGADOS (más experiencia)
      const sorted = data.sort((a:any, b:any) => (b.ganados || 0) - (a.ganados || 0));
      setRanking(sorted);
    });
    return () => unsub();
  }, []);

  return (
    <div className="max-w-xl mx-auto p-4 pb-20">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/" className="p-2 bg-gray-100 rounded-full"><ChevronLeft size={20}/></Link>
        <h1 className="text-2xl font-black italic uppercase">Clasificación <span className="text-blue-600">Global</span></h1>
      </div>

      <div className="bg-white border-2 border-gray-100 rounded-3xl shadow-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Pos</th>
              <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Jugador</th>
              <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">J</th>
              <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">G</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ranking.map((player:any, idx:number) => (
              <tr key={player.name} className={`hover:bg-gray-50 transition ${idx===0?'bg-yellow-50/50':''}`}>
                <td className="p-4 text-xs font-bold text-gray-500">
                  {idx === 0 ? <Trophy size={16} className="text-yellow-500"/> : `#${idx+1}`}
                </td>
                <td className="p-4 font-black text-sm uppercase flex items-center gap-2">
                  {player.name}
                  {idx === 0 && <span className="bg-yellow-100 text-yellow-700 text-[9px] px-1 rounded">GOAT</span>}
                </td>
                <td className="p-4 text-center font-mono font-bold text-sm text-gray-500">{player.jugados || 0}</td>
                <td className="p-4 text-right font-mono font-black text-lg text-blue-600">{player.ganados || 0}</td>
              </tr>
            ))}
            {ranking.length === 0 && (
              <tr><td colSpan={4} className="p-8 text-center text-gray-300 italic text-sm">Aún no hay datos de liga.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}