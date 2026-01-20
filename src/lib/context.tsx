'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, query, collection, orderBy } from 'firebase/firestore';

// Definición de Tipos
export type User = { id: string; clubName: string; balance: number; password?: string; };
export type Match = { id: number; p1: string; p1Team?: string; p1Club?: string; p2: string; p2Team?: string; p2Club?: string; score1?: number; score2?: number; winner?: string; round: string; isBye?: boolean; };
export type Bet = { id: string; matchId: number; bettor: string; chosenWinner: string; amount: number; status: 'pending'|'won'|'lost' };

interface AppContextType {
  user: User | null;
  login: (u: User) => void;
  logout: () => void;
  users: User[];
  matches: Match[];
  activeBets: Bet[];
  ranking: any[];
  history: any[];
}

const AppContext = createContext<AppContextType | any>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]); // <--- AQUÍ SE GUARDAN LOS JUGADORES
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeBets, setActiveBets] = useState<Bet[]>([]);
  const [ranking, setRanking] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  // 1. Escuchar Datos de Firebase en Tiempo Real
  useEffect(() => {
    // Escuchar la Sala del Torneo
    const unsubSala = onSnapshot(doc(db, "sala", "principal"), (d) => {
        if(d.exists()) setMatches(d.data().fifaMatches || []);
    });

    // Escuchar TODOS los Usuarios (Para la lista de selección)
    const qUsers = query(collection(db, "users"), orderBy("balance", "desc"));
    const unsubUsers = onSnapshot(qUsers, (s) => {
        const list = s.docs.map(d => ({ id: d.id, ...d.data() })) as User[];
        setUsers(list);
        
        // Si el usuario actual está logueado, actualizamos sus datos (dinero) también
        if (user) {
            const updated = list.find(u => u.id === user.id);
            if (updated) {
                setUser(updated);
                localStorage.setItem('footys_user', JSON.stringify(updated));
            }
        }
    });

    // Escuchar Apuestas y Ranking
    const unsubBets = onSnapshot(query(collection(db, "bets")), (s) => setActiveBets(s.docs.map(d => ({ id: d.id, ...d.data() })) as Bet[]));
    const unsubRank = onSnapshot(query(collection(db, "ranking"), orderBy("puntos", "desc")), (s) => setRanking(s.docs.map(d => ({ nombre: d.id, ...d.data() }))));
    const unsubHist = onSnapshot(query(collection(db, "history"), orderBy("date", "desc")), (s) => setHistory(s.docs.map(d => d.data())));
    
    return () => { unsubSala(); unsubUsers(); unsubBets(); unsubRank(); unsubHist(); };
  }, [user?.id]); // Se refresca si cambia el ID

  // 2. Persistencia de Sesión
  useEffect(() => {
      const stored = localStorage.getItem('footys_user');
      if (stored) setUser(JSON.parse(stored));
  }, []);

  const login = (u: User) => {
      setUser(u);
      localStorage.setItem('footys_user', JSON.stringify(u));
  };

  const logout = () => {
      setUser(null);
      localStorage.removeItem('footys_user');
  };

  return (
    <AppContext.Provider value={{ user, login, logout, users, matches, activeBets, ranking, history }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);