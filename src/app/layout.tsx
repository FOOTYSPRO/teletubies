import './globals.css';
import { AppProvider } from '@/lib/context';
import MainLayoutClient from './MainLayoutClient';

export const metadata = {
  title: 'Footys Liga',
  description: 'Gestor de torneos y apuestas',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      {/* Quitamos el bg-color para que mande el globals.css */}
      <body className="text-black font-sans min-h-screen">
        <AppProvider>
           <MainLayoutClient>
              {children}
           </MainLayoutClient>
        </AppProvider>
      </body>
    </html>
  );
}