import type { Metadata } from "next";
import { caveat, fraunces, lora } from "../fonts/fonts";
import "../epicerie/epicerie.css";
import "./sejour.css";

export const metadata: Metadata = {
  title: "Le Séjour",
  description: "A week in Saint-Aubin, with Madame Rousseau.",
};

export default function SejourLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${fraunces.variable} ${lora.variable} ${caveat.variable} ep-page sj-page`}>{children}</div>
  );
}
