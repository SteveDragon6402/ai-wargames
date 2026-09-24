"use client";

import { MercenaryPlay } from "./components/Play";
import { useMercenary } from "./hooks/useMercenary";

export default function MercenaryPage() {
  const game = useMercenary();
  return <MercenaryPlay game={game} />;
}
