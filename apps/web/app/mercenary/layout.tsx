import type { Metadata } from "next";
import { Bebas_Neue, Bungee } from "next/font/google";

const poster = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-poster",
  display: "swap",
});

const funky = Bungee({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-funky",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Mercenary Band",
  description: "One company. Fifty-two weeks.",
};

export default function MercenaryLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${poster.variable} ${funky.variable}`}>{children}</div>;
}
