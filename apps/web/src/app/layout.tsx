import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { PlayerProvider } from "@/components/player/player-context";
import { PlayerBar } from "@/components/player/player-bar";
import { AmbientBackground } from "@/components/ui/ambient-background";

// Geist (sans + mono): grotesk pulito vicino alla "M Saans" di Mobbin,
// e Geist Mono per i dati tecnici (key/bpm/durata) come nel catalogo.

// Imposta il tema prima del paint per evitare il "flash" (default: chiaro).
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('selecta-theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Selecta — A&R AI e catalogo Tech House",
  description:
    "Analizza il tuo sound, scopri le label compatibili e pubblica nel catalogo Tech House curato per come suona. Dove DJ e label ascoltano davvero.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-bg font-sans text-text">
        <AmbientBackground />
        <PlayerProvider>
          <SiteHeader />
          {children}
          <PlayerBar />
        </PlayerProvider>
      </body>
    </html>
  );
}
