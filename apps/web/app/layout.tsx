import type { Metadata } from "next";
import { Space_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const playfair = Playfair_Display({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "WAR ROOM: MIDDLE-EARTH",
  description: "AI-adjudicated node-map wargame — Rohan vs Isengard",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${spaceMono.variable} ${playfair.variable}`}>
      <body>{children}</body>
    </html>
  );
}
