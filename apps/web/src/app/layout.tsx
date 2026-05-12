import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Selecta - AI A&R for Tech House Producers",
  description: "Scopri quale label firmerà la tua track. Analisi AI del tuo sound e matching con le migliori etichette tech house.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-black font-sans">{children}</body>
    </html>
  );
}
