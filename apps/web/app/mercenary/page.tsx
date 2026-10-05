"use client";

import HollowmereBoard from "./components/HollowmereBoard";
import { useHollowmere } from "./hooks/useHollowmere";

export default function MercenaryPage() {
  const game = useHollowmere();
  return <HollowmereBoard game={game} />;
}
