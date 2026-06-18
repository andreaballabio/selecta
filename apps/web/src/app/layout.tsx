import type { Metadata } from "next";
import { Inter, Syne } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { PlayerProvider } from "@/components/player/player-context";
import { PlayerBar } from "@/components/player/player-bar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const syne = Syne({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-syne",
});

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
    <html lang="it" className={`${inter.variable} ${syne.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-bg font-sans text-text">
        <PlayerProvider>
          <SiteHeader />
          {children}
          <PlayerBar />
        </PlayerProvider>
      </body>
    </html>
  );
}
