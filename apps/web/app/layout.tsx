import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cormorant, inter, jetbrains } from "./fonts/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "French Immersion Games",
  description: "L'Épicerie & Le Séjour — interactive French language immersion",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${cormorant.variable} ${jetbrains.variable}`}
    >
      <body>
        <TooltipProvider delayDuration={480}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
