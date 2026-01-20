// src/lib/context.tsx
'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, query, collection, orderBy } from 'firebase/firestore';

// Tipos básicos
type User = { id: string; clubName: string; balance: number; password?: string; };
type Match = { id: number; p1: string; score1?: number; score2?: number; winner?: string; round: string; isBye?: boolean; [key:string]: any };

interface AppContextType {
  user: User | null;
  login: (u: User) => void;
  logout: () => void;
  users: User[];
  matches: Match[];
  activeBets: any[];
}

const AppContext = createContext<AppContextType | any>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeBets, setActiveBets] = useState<any[]>([]);

  // Escuchar Firebase globalmente
  useEffect(() => {
    const unsubSala = onSnapshot(doc(db, "sala", "principal"), (d) => {
        if(d.exists()) setMatches(d.data().fifaMatches || []);
    });
    const unsubUsers = onSnapshot(query(collection(db, "users"), orderBy("balance", "desc")), (s) => {
        const list = s.docs.map(d => ({ id: d.id, ...d.data() })) as User[];
        setUsers(list);
        // Si el usuario está logueado, actualizar su saldo en tiempo real
        if (user) {
            const updated = list.find(u => u.id === user.id);
            if (updated) setUser(updated);
        }
    });
    const unsubBets = onSnapshot(query(collection(db, "bets")), (s) => setActiveBets(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    return () => { unsubSala(); unsubUsers(); unsubBets(); };
  }, [user?.id]); // Dependencia user.id para refrescar saldo

  const login = (u: User) => {
      setUser(u);
      // Guardar en localStorage para persistir si recarga la página
      localStorage.setItem('teletubies_user', JSON.stringify(u));
  };

  const logout = () => {
      setUser(null);
      localStorage.removeItem('teletubies_user');
  };

  // Recuperar sesión al recargar
  useEffect(() => {
      const stored = localStorage.getItem('teletubies_user');
      if (stored) setUser(JSON.parse(stored));
  }, []);

  return (
    <AppContext.Provider value={{ user, login, logout, users, matches, activeBets }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);