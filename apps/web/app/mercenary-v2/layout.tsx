import type { Metadata } from "next";
import { EB_Garamond, IM_Fell_English_SC } from "next/font/google";
import "./theme.css";

const display = IM_Fell_English_SC({
  weight: "400",
  subsets: ["latin"],
  variable: "--mc-display",
  display: "swap",
});

const body = EB_Garamond({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--mc-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mercenary Game V2",
  description: "Twelve weeks. One company. The kingdom keeps the books.",
};

export default function MercenaryV2Layout({ children }: { children: React.ReactNode }) {
  return <div className={`mc2 ${display.variable} ${body.variable}`}>{children}</div>;
}
