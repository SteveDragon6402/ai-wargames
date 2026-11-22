import localFont from "next/font/local";

// Self-hosted so `next build` does not download Google Fonts CSS.
// Google now serves some subsets from extensionless URLs, and next/font 15.1
// crashes when a font file URL has no extension.

export const inter = localFont({
  src: "./Inter-latin.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-sans",
});

export const cormorant = localFont({
  src: "./CormorantGaramond-latin.woff2",
  weight: "300 700",
  display: "swap",
  variable: "--font-display",
});

export const jetbrains = localFont({
  src: "./JetBrainsMono-latin.woff2",
  weight: "400 800",
  display: "swap",
  variable: "--font-mono",
});

export const fraunces = localFont({
  src: "./Fraunces-latin.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-ep-display",
});

export const lora = localFont({
  src: [
    { path: "./Lora-latin.woff2", weight: "400 700", style: "normal" },
    { path: "./Lora-italic-latin.woff2", weight: "400 700", style: "italic" },
  ],
  display: "swap",
  variable: "--font-ep-body",
});

export const caveat = localFont({
  src: "./Caveat-latin.woff2",
  weight: "400 700",
  display: "swap",
  variable: "--font-ep-hand",
});
