// src/app/layout.tsx
import './globals.css';
import { AppProvider } from '@/lib/context'; // Importamos el cerebro
import Link from 'next/link';
import { Trophy, Users, Banknote, Dices } from 'lucide-react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-white text-black font-sans pb-24">
        <AppProvider>
          {/* HEADER FIJO */}
          <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100 px-4 h-16 flex items-center justify-between">
             <h1 className="font-black italic text-lg tracking-tighter">TELETUBIES <span className="text-blue-600">LEAGUE</span></h1>
          </header>

          {/* CONTENIDO DE LA PÁGINA (Perfil, Fifa, etc.) */}
          {children}

          {/* DOCK DE NAVEGACIÓN INFERIOR */}
          <nav className="fixed bottom-4 left-4 right-4 bg-black text-white rounded-2xl flex justify-around p-3 shadow-2xl z-50">
             <Link href="/" className="flex flex-col items-center opacity-70 hover:opacity-100"><Trophy size={20}/><span className="text-[9px] font-bold uppercase mt-1">Torneo</span></Link>
             <Link href="/apuestas" className="flex flex-col items-center opacity-70 hover:opacity-100"><Banknote size={20}/><span className="text-[9px] font-bold uppercase mt-1">Bet</span></Link>
             <Link href="/perfil" className="flex flex-col items-center opacity-70 hover:opacity-100"><Users size={20}/><span className="text-[9px] font-bold uppercase mt-1">Perfil</span></Link>
             <Link href="/pachanga" className="flex flex-col items-center opacity-70 hover:opacity-100"><Dices size={20}/><span className="text-[9px] font-bold uppercase mt-1">Mixer</span></Link>
          </nav>
        </AppProvider>
      </body>
    </html>
  );
}