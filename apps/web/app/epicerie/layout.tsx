import type { Metadata } from "next";
import { caveat, fraunces, lora } from "../fonts/fonts";
import "./epicerie.css";

export const metadata: Metadata = {
  title: "L'Épicerie",
  description: "A village shop. A list. No English.",
};

export default function EpicerieLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${fraunces.variable} ${lora.variable} ${caveat.variable} ep-page`}>{children}</div>;
}
