"use client";

import { useEffect, useState } from "react";
import { BACKGROUNDS, BANNER_COLORS, SIGILS, UNIT_TYPES } from "../lib/config";
import { applyCreation, chronicleOf, netWorth, tutorialFight } from "../lib/engine";
import { clearGame, loadGame, saveGame } from "../lib/save";
import { blankCreation, createGame } from "../lib/seed";
import type { CreationDraft, GameState } from "../lib/types";
import { Icon } from "./icons";
import { PlayView } from "./PlayView";

const ORIGINS = [
  "Founded by a bankrupt accountant who kept fighting to clear his debts.",
  "What was left of a lord's guard after the lord stopped paying.",
  "River pilots who sold the boat and bought spears.",
  "Deserters who would not march on their own village.",
  "A funeral party that never put the weapons down.",
];

const NAMES = ["The Ash Pikes", "The Salt Ledger", "The Thorn Company", "The Last Watch", "Hale's Debt"];
const CAPTAINS = ["Mara Venn", "Joss Hale", "Edric Quinn", "Nell Archer", "Tomos Reed"];

export function GameApp() {
  const [game, setGame] = useState<GameState | null>(null);
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState<CreationDraft | null>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    setReady(true);
  }, []);

  function commit(next: GameState) {
    setGame(next);
    saveGame(next);
  }

  if (!ready) return <main className="mc2-page" />;

  if (!game && !draft) {
    return (
      <main className="mc2-page">
        <div className="mc2-title">
          <p>Hollowmere · a spring</p>
          <h1 className="mc2-display" style={{ fontSize: 64, margin: "8px 0" }}>Mercenary Game V2</h1>
          <p>Twelve weeks. The kingdom is already eating. You are one more mouth with spears.</p>
          <div className="mc2-actions" style={{ marginTop: 18 }}>
            <button
              className="spend"
              onClick={() => {
                const origins = ORIGINS.slice(0, 3);
                setDraft({ ...blankCreation(origins), origins });
                setStep(0);
              }}
            >
              New Company
            </button>
            <button
              onClick={() => {
                const saved = loadGame();
                if (saved) setGame(saved);
              }}
            >
              Continue
            </button>
          </div>
          <p style={{ marginTop: 28 }}><a className="mc2-back" href="/">Back to the table</a></p>
        </div>
      </main>
    );
  }

  if (draft && !game) {
    return (
      <main className="mc2-page">
        <Create
          draft={draft}
          step={step}
          onDraft={setDraft}
          onStep={setStep}
          onBack={() => setDraft(null)}
          onMarch={() => {
            const next = applyCreation(draft, Math.floor(Math.random() * 9999) + 1);
            commit(next);
            setDraft(null);
          }}
        />
      </main>
    );
  }

  if (!game) return null;

  if (game.phase === "chronicle" || game.ended) {
    return (
      <main className="mc2-page">
        <Chronicle game={game} onNew={() => { clearGame(); setGame(null); }} />
      </main>
    );
  }

  return (
    <PlayView
      game={game}
      setGame={commit}
      onBarn={() => commit(tutorialFight(game))}
      onSkipTutorial={() => commit({ ...game, tutorial: null })}
    />
  );
}

function Create({
  draft,
  step,
  onDraft,
  onStep,
  onBack,
  onMarch,
}: {
  draft: CreationDraft;
  step: number;
  onDraft: (draft: CreationDraft) => void;
  onStep: (step: number) => void;
  onBack: () => void;
  onMarch: () => void;
}) {
  const set = (patch: Partial<CreationDraft>) => onDraft({ ...draft, ...patch });
  return (
    <div className="mc2-create">
      <p>Company creation</p>
      <h1>{["Name", "Origin", "Banner", "Captain", "Two units", "Purse", "March"][step]}</h1>
      {step === 0 && (
        <>
          <input value={draft.name} placeholder="Company name" onChange={(event) => set({ name: event.target.value })} />
          <div className="mc2-actions">
            <button onClick={() => set({ name: NAMES[Math.floor(Math.random() * NAMES.length)] })}>Roll a name</button>
          </div>
        </>
      )}
      {step === 1 && (
        <>
          <input value={draft.origin} placeholder="One line of origin" onChange={(event) => set({ origin: event.target.value })} />
          <div className="mc2-actions">
            {draft.origins.map((origin) => (
              <button key={origin} onClick={() => set({ origin })}>{origin}</button>
            ))}
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <div className="mc2-actions">
            {BANNER_COLORS.map((color) => (
              <button key={color.id} onClick={() => set({ primary: color.id })} style={{ borderColor: color.hex }}>
                {color.label}{draft.primary === color.id ? " · field" : ""}
              </button>
            ))}
          </div>
          <div className="mc2-actions">
            {BANNER_COLORS.map((color) => (
              <button key={`b-${color.id}`} onClick={() => set({ secondary: color.id })}>
                {color.label}{draft.secondary === color.id ? " · charge" : ""}
              </button>
            ))}
          </div>
          <div className="mc2-actions">
            {SIGILS.map((sigil) => (
              <button key={sigil} onClick={() => set({ sigil })}><Icon name={sigil} /> {sigil}</button>
            ))}
          </div>
        </>
      )}
      {step === 3 && (
        <>
          <input value={draft.captainName} placeholder="Captain's name" onChange={(event) => set({ captainName: event.target.value })} />
          <div className="mc2-actions">
            <button onClick={() => set({ captainName: CAPTAINS[Math.floor(Math.random() * CAPTAINS.length)] })}>Roll</button>
            {BACKGROUNDS.map((background) => (
              <button key={background} onClick={() => set({ captainBackground: background })}>
                {background}{draft.captainBackground === background ? " ·" : ""}
              </button>
            ))}
          </div>
          <p>The background is history. It changes no number. People may mention it.</p>
        </>
      )}
      {step === 4 && (
        <div className="mc2-actions">
          {UNIT_TYPES.map((type) => (
            <button key={type.key} onClick={() => set(draft.unitA && draft.unitA !== type.key && !draft.unitB ? { unitB: type.key } : { unitA: type.key, unitB: draft.unitB === type.key ? "" : draft.unitB })}>
              {type.key}{draft.unitA === type.key ? " · first" : ""}{draft.unitB === type.key ? " · second" : ""}
            </button>
          ))}
          <p>Both start at ten. {draft.unitA || "—"} and {draft.unitB || "—"}.</p>
        </div>
      )}
      {step === 5 && (
        <p>120 gold. 280 bread. One week of wages for twenty soldiers, and then the kingdom starts charging you for existing.</p>
      )}
      {step === 6 && (
        <div className="mc2-card">
          <h2>{draft.name || "The Free Company"}</h2>
          <p>{draft.origin}</p>
          <p>{draft.captainName || "The Captain"}, {draft.captainBackground}. Banner {draft.primary} and {draft.secondary}, a {draft.sigil}.</p>
          <p>{draft.unitA} and {draft.unitB}, ten each. You are standing in Thornwick the morning after the raid.</p>
        </div>
      )}
      <div className="mc2-actions">
        <button onClick={onBack}>Abandon</button>
        {step > 0 && <button onClick={() => onStep(step - 1)}>Back</button>}
        {step < 6 && <button className="spend" onClick={() => onStep(step + 1)}>Next</button>}
        {step === 6 && <button className="spend" onClick={onMarch}>March</button>}
      </div>
    </div>
  );
}

function Chronicle({ game, onNew }: { game: GameState; onNew: () => void }) {
  const page = chronicleOf(game);
  const seals = game.achievements.filter((seal) => seal.earnedWeek !== undefined);
  return (
    <div className="mc2-chronicle">
      <p>{game.lost ? "The company is gone" : "Week 12"}</p>
      <h1>{game.company.name}</h1>
      <p>{game.company.origin}</p>
      <p className="mc2-display" style={{ fontSize: 42 }}>{page.score}</p>
      <p>Net worth. Gold, bread at the Crownmarket rate, goods, less what you owe.</p>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", margin: "12px 0" }}>
        {page.timeline.map((mark, index) => (
          <span key={index} title={mark} className={`mc2-seg ${mark === "quiet" ? "" : "on"}`} />
        ))}
      </div>
      <h2>Three things that stuck</h2>
      {page.moments.map((moment) => <p key={moment}>{moment}</p>)}
      <h2>What they say of you now</h2>
      {page.verdicts.slice(0, 8).map((verdict) => (
        <p key={verdict.name}><b>{verdict.name}.</b> {verdict.line}</p>
      ))}
      <h2>Seals</h2>
      <div>
        {seals.map((seal) => <span key={seal.id} className="mc2-seal">{seal.name}</span>)}
        {seals.length === 0 && <p>No seals.</p>}
      </div>
      <div className="mc2-actions">
        <button onClick={onNew}>New Company</button>
        <a href="/">The table</a>
      </div>
      <p>Worth {netWorth(game)}. {game.company.captainName}, {game.company.captainBackground}.</p>
    </div>
  );
}
