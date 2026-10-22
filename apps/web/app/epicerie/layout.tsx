import type { Metadata } from "next";
import { Caveat, Fraunces, Lora } from "next/font/google";
import "./epicerie.css";

const display = Fraunces({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-ep-display",
  display: "swap",
});

const body = Lora({
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-ep-body",
  display: "swap",
});

const hand = Caveat({
  weight: ["500", "700"],
  subsets: ["latin"],
  variable: "--font-ep-hand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "L'Épicerie",
  description: "A village shop. A list. No English.",
};

export default function EpicerieLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${display.variable} ${body.variable} ${hand.variable} ep-page`}>{children}</div>;
}
