import type { Metadata } from "next";
import { Cormorant_Garamond } from "next/font/google";
import "./rose.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-rose",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Secret Test — The Wars of the Roses",
  description: "Two houses. Private dispatches. One throne.",
};

export default function SecretTestLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className={`${cormorant.variable} rose-root`}>{children}</div>;
}
