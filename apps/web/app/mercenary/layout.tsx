import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Mercenary Band",
  description: "One company. Fifty-two weeks.",
};

export default function MercenaryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
