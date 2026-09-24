import type { Metadata } from "next";
import { Almendra, EB_Garamond } from "next/font/google";

const gothic = Almendra({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-gothic",
  display: "swap",
});

const book = EB_Garamond({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-book",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Mercenary Band",
  description: "One company. Fifty-two weeks.",
};

export default function MercenaryLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${gothic.variable} ${book.variable} merc-page`}>{children}</div>;
}
