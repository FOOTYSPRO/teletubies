'use client';
import Link from 'next/link';
import { useApp } from '@/lib/context';
import { Trophy, Coins, ShoppingBag, BarChart3, UserCircle, LogOut } from 'lucide-react';

export default function HomePage() {
  const { user, logout } = useApp();

  return (
    <div className="min-h-screen bg-white p-6 pb-24">
      
      {/* CABECERA */}
      <div className="flex justify-between items-center mb-8 pt-4">
        <div>
          <h1 className="text-3xl font-black italic">FOOTYS <span className="text-blue-600">PRO</span></h1>
          {user ? (
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Jugador: {user.id}</p>
          ) : (
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Bienvenido al club</p>
          )}
        </div>
        {user ? (
          <button onClick={logout} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 text-red-500"><LogOut size={20}/></button>
        ) : (
          <Link href="/perfil" className="p-2 bg-black text-white rounded-full"><UserCircle size={20}/></Link>
        )}
      </div>

      {/* GRID DE MENÚ */}
      <div className="grid grid-cols-2 gap-4">
        
        {/* 1. TORNEO (Botón Grande Negro) */}
        <Link href="/torneo" className="col-span-2 bg-black text-white p-6 rounded-3xl shadow-xl flex justify-between items-center group relative overflow-hidden h-32">
          <div className="relative z-10">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Competición</span>
            <h2 className="text-3xl font-black italic">TORNEO</h2>
          </div>
          <Trophy size={48} className="text-white group-hover:scale-110 transition duration-300"/>
          {/* Decoración fondo */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gray-800 rounded-full blur-3xl opacity-50 -mr-10 -mt-10"></div>
        </Link>

        {/* 2. APUESTAS (Botón Cuadrado) */}
        <Link href="/apuestas" className="bg-gray-50 border-2 border-gray-100 p-5 rounded-3xl flex flex-col justify-between h-36 hover:border-black transition duration-300">
          <Coins size={28} className="text-black mb-2"/>
          <div>
            <h2 className="font-black text-lg">APUESTAS</h2>
            <p className="text-[10px] text-gray-400 font-bold leading-tight">Gana dinero para ventajas</p>
          </div>
        </Link>

        {/* 3. TIENDA (Botón Cuadrado) */}
        <Link href="/tienda" className="bg-gray-50 border-2 border-gray-100 p-5 rounded-3xl flex flex-col justify-between h-36 hover:border-red-500 transition duration-300 group">
          <ShoppingBag size={28} className="text-red-500 mb-2 group-hover:rotate-12 transition"/>
          <div>
            <h2 className="font-black text-lg text-red-600">TIENDA</h2>
            <p className="text-[10px] text-gray-400 font-bold leading-tight">Mercado negro de ventajas</p>
          </div>
        </Link>

        {/* 4. CLASIFICACIÓN (Botón Grande Azul) */}
        <Link href="/ranking" className="col-span-2 bg-blue-600 text-white p-5 rounded-3xl shadow-lg shadow-blue-200 flex justify-between items-center group relative overflow-hidden h-24 hover:bg-blue-700 transition">
          <div className="flex items-center gap-4 relative z-10">
            <div className="bg-white/20 p-3 rounded-2xl"><BarChart3 size={24} className="text-white"/></div>
            <div>
              <h2 className="text-xl font-black italic uppercase">Clasificación</h2>
              <p className="text-[10px] text-blue-200 font-bold">Ver Ranking Global</p>
            </div>
          </div>
          <span className="text-xs font-black bg-white text-blue-600 px-4 py-2 rounded-xl group-hover:scale-105 transition">Ver Tabla →</span>
        </Link>

        {/* 5. PERFIL */}
        <Link href="/perfil" className="col-span-2 p-4 text-center bg-gray-50 rounded-2xl border border-gray-100 hover:bg-gray-100">
          <span className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center justify-center gap-2"><UserCircle size={14}/> Gestionar mi Perfil</span>
        </Link>

      </div>
    </div>
  );
}