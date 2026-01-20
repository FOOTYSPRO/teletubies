'use client';

import { useApp } from '@/lib/context';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Trophy, Banknote, Users, Dices, UserCircle } from 'lucide-react';

export default function MainLayoutClient({ children }: { children: React.ReactNode }) {
    const { user } = useApp();
    const pathname = usePathname();

    return (
        <>
            {/* HEADER PRO - Más limpio, sin borde inferior duro */}
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl px-6 h-20 flex items-center justify-between shadow-sm supports-[backdrop-filter]:bg-white/60">
                <div className="flex items-center gap-2 transition-transform hover:scale-105">
                    <span className="text-3xl filter drop-shadow-sm">🏆</span>
                    <div>
                        <h1 className="text-xl font-black italic tracking-tighter text-black leading-none">
                            FOOTYS
                        </h1>
                        <span className="text-blue-600 text-xs font-bold uppercase tracking-widest">League</span>
                    </div>
                </div>
                
                <Link href="/perfil">
                    {user ? (
                        <div className="flex items-center gap-3 bg-white/50 pl-4 pr-2 py-2 rounded-full border border-white/40 shadow-sm hover:shadow-md transition-all group">
                            <div className="text-right leading-tight">
                                <p className="font-black text-sm uppercase text-black group-hover:text-blue-600 transition">{user.id}</p>
                                <p className="font-mono text-xs text-green-600 font-black">{user.balance} €</p>
                            </div>
                            <div className="bg-black text-white p-2 rounded-full group-hover:bg-blue-600 transition"><UserCircle size={20} /></div>
                        </div>
                    ) : (
                        <button className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-full text-xs font-black hover:bg-gray-900 hover:shadow-lg transition uppercase tracking-wider">
                            LOGIN / REGISTRO
                        </button>
                    )}
                </Link>
            </header>

            {/* CONTENIDO */}
            <main className="pt-6 pb-36 w-full px-2 md:px-0">
                {children}
            </main>

            {/* BOTTOM NAV - Flotante y más "cristal" */}
            <nav className="fixed bottom-6 left-4 right-4 bg-white/70 backdrop-blur-2xl border border-white/50 rounded-3xl flex justify-around p-3 shadow-2xl shadow-blue-900/5 z-40 max-w-md mx-auto ring-1 ring-black/5">
                <NavItem icon={<Trophy size={20}/>} label="Torneo" href="/torneo" active={pathname === '/torneo'} />
                <NavItem icon={<Banknote size={20}/>} label="Apuestas" href="/apuestas" active={pathname === '/apuestas'} />
                <NavItem icon={<Dices size={20}/>} label="Mixer" href="/pachanga" active={pathname === '/pachanga'} />
                <NavItem icon={<Users size={20}/>} label="Perfil" href="/perfil" active={pathname === '/perfil'} />
            </nav>
        </>
    );
}

function NavItem({ icon, label, href, active }: any) {
    return (
        <Link href={href} className={`flex flex-col items-center justify-center w-full py-2 rounded-2xl transition-all duration-300 group ${active ? 'text-blue-600 bg-blue-50/80 scale-105 shadow-sm' : 'text-gray-400 hover:text-black hover:bg-gray-50'}`}>
            <span className={`mb-1 transition-transform group-hover:-translate-y-1 ${active ? 'animate-pulse-slow' : ''}`}>{icon}</span>
            <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
        </Link>
    )
}