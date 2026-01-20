// src/app/page.tsx
'use client';
import { useState } from 'react';
import { useApp } from '@/lib/context'; // Usamos el cerebro
import { db } from '@/lib/firebase';
import { doc, setDoc, writeBatch, updateDoc, increment, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import confetti from 'canvas-confetti';

const TEAMS = ["Man. City", "Real Madrid", "Bayern", "Liverpool", "Arsenal", "Inter", "PSG", "Barça"]; // (Puedes poner la lista completa aquí)
const BYE_NAME = "Pase Directo ➡️";

export default function FifaPage() {
  const { matches, users } = useApp(); // Datos globales
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [gameMode, setGameMode] = useState('1vs1');

  // ... (Aquí copias las funciones handleCrearTorneo y finalizarPartido de la versión anterior) ...
  // ... (Pero usando 'matches' que viene del context, y 'users' del context) ...
  
  // NOTA: Para no pegar 500 líneas de código otra vez, la lógica es IDÉNTICA a la V25,
  // solo que en vez de useState para 'matches', usas la variable del contexto.
  
  // Aquí te pongo el renderizado simplificado para que veas la estructura:
  return (
      <div className="p-4 max-w-4xl mx-auto">
          {matches.length === 0 ? (
              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 text-center">
                  <h2 className="text-2xl font-black mb-4">Configurar Torneo</h2>
                  {/* Selector de jugadores usando 'users' del context */}
                  <div className="grid grid-cols-3 gap-2 mb-6">
                      {users.map((u:any) => (
                          <button key={u.id} onClick={()=>{
                              if(selectedPlayers.includes(u.id)) setSelectedPlayers(selectedPlayers.filter(p=>p!==u.id));
                              else setSelectedPlayers([...selectedPlayers, u.id]);
                          }} className={`p-2 rounded-lg border text-xs font-bold ${selectedPlayers.includes(u.id)?'bg-black text-white':'bg-white'}`}>
                              {u.id}
                          </button>
                      ))}
                  </div>
                  <button className="bg-blue-600 text-white font-bold py-3 px-8 rounded-xl">Crear Cuadro</button>
              </div>
          ) : (
              <div className="space-y-6">
                  <h3 className="font-black text-xl">En Juego</h3>
                  {/* Aquí mapeas los matches igual que antes */}
                  <div className="grid gap-4 md:grid-cols-2">
                      {matches.map((m:any) => (
                          <div key={m.id} className="bg-white border p-4 rounded-xl shadow-sm">
                              {/* Tarjeta de partido */}
                              <div className="flex justify-between items-center font-bold">
                                  <span>{m.p1}</span>
                                  <span className="bg-gray-100 px-2 rounded">{m.score1 ?? '-'} - {m.score2 ?? '-'}</span>
                                  <span>{m.p2}</span>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}
      </div>
  );
}