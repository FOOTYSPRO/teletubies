// src/app/layout.tsx
import './globals.css';
import { AppProvider } from '@/lib/context';
import MainLayoutClient from './MainLayoutClient'; // Importamos el componente cliente

export const metadata = {
  title: 'Footys Liga',
  description: 'Gestor de torneos y apuestas',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-[#f3f4f6] text-black font-sans pb-32">
        <AppProvider>
           <MainLayoutClient>
              {children}
           </MainLayoutClient>
        </AppProvider>
      </body>
    </html>
  );
}