import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { PlayerProvider } from "@/components/player/player-context";
import { PlayerBar } from "@/components/player/player-bar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "Selecta — A&R AI e catalogo Tech House",
  description:
    "Analizza il tuo sound, scopri le label compatibili e pubblica la tua traccia nel catalogo Tech House curato per come suona.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <PlayerProvider>
          <SiteHeader />
          {children}
          <PlayerBar />
        </PlayerProvider>
      </body>
    </html>
  );
}
