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
            {/* HEADER PRO */}
            <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200 px-4 h-16 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                    <span className="text-xl">🏆</span>
                    <h1 className="text-lg font-black italic tracking-tighter text-black">
                        FOOTYS <span className="text-blue-600">LIGA</span>
                    </h1>
                </div>
                
                <Link href="/perfil">
                    {user ? (
                        <div className="flex items-center gap-2 bg-gray-100 pl-3 pr-2 py-1.5 rounded-full border border-gray-200 hover:bg-gray-200 transition">
                            <div className="text-right leading-none">
                                <p className="font-bold text-xs uppercase text-black">{user.id}</p>
                                <p className="font-mono text-[10px] text-green-600 font-black">{user.balance} €</p>
                            </div>
                            <div className="bg-black text-white p-1.5 rounded-full"><UserCircle size={16} /></div>
                        </div>
                    ) : (
                        <button className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-gray-800 transition">
                            LOGIN
                        </button>
                    )}
                </Link>
            </header>

            {/* CONTENIDO (Ancho liberado) */}
            <main className="pt-4 pb-24 w-full">
                {children}
            </main>

            {/* BOTTOM NAV */}
            <nav className="fixed bottom-4 left-4 right-4 bg-white/90 backdrop-blur-xl border border-gray-200 rounded-2xl flex justify-around p-2 shadow-2xl z-50 max-w-md mx-auto">
                {/* OJO: Cambiado href de '/' a '/torneo' */}
                <NavItem icon={<Trophy size={18}/>} label="Torneo" href="/torneo" active={pathname === '/torneo'} />
                <NavItem icon={<Banknote size={18}/>} label="Apuestas" href="/apuestas" active={pathname === '/apuestas'} />
                <NavItem icon={<Dices size={18}/>} label="Mixer" href="/pachanga" active={pathname === '/pachanga'} />
                <NavItem icon={<Users size={18}/>} label="Perfil" href="/perfil" active={pathname === '/perfil'} />
            </nav>
        </>
    );
}

function NavItem({ icon, label, href, active }: any) {
    return (
        <Link href={href} className={`flex flex-col items-center justify-center w-full py-1 rounded-xl transition ${active ? 'text-blue-600' : 'text-gray-400 hover:text-black'}`}>
            <span className="mb-0.5">{icon}</span>
            <span className="text-[9px] font-bold uppercase tracking-widest">{label}</span>
        </Link>
    )
}