"use client";

import Founding from "./components/Founding";
import Play from "./components/Play";
import { useMercenary } from "./hooks/useMercenary";

export default function MercenaryPage() {
  const game = useMercenary();
  if (!game.state) return <main className="min-h-dvh" />;

  const founding = game.state.phase === "name" || game.state.phase === "types" || game.state.phase === "unit-names" || game.state.phase === "reputation";
  if (founding) {
    return (
      <Founding
        state={game.state}
        busy={game.busy}
        error={game.error}
        onName={game.nameCompany}
        onTypes={game.pickTypes}
        onUnitNames={game.nameUnits}
        onReputation={() => void game.rollReputation()}
        onReset={game.reset}
      />
    );
  }

  return <Play state={game.state} api={game} />;
}
