"use client";

import { useGameState } from "./hooks/useGameState";
import TopBar from "./components/TopBar";
import WesterosMap from "./components/WesterosMap";
import SidePanel from "./components/SidePanel";

export default function GotHousesPage() {
  const { state, dispatch } = useGameState();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        overflow: "hidden",
        background: "#080808",
      }}
    >
      <TopBar state={state} dispatch={dispatch} />

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Map fills all remaining width */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <WesterosMap state={state} dispatch={dispatch} />
        </div>

        {/* Side panel */}
        <SidePanel state={state} dispatch={dispatch} />
      </div>
    </div>
  );
}
