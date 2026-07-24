# Soft mechanics

Design rule for this project: **prefer soft mechanics for anything that, in the real world, does not naturally correspond to a number.** Soft is not the same as cosmetic. Soft state still feeds adjudication and changes outcomes.

## Three layers

| Layer | What it is | Mechanical? | Example in GOT Houses |
|---|---|---|---|
| **Hard mechanics** | Deterministic rules with clear inputs and outputs | Yes — formulaic | Simultaneous move apply, battle detection (both factions at a hold), merge/split unit math, retreat adjacency / blocked holds |
| **Soft mechanics** | Qualitative state that shapes adjudication | Yes — judgmental | Morale, tiredness, stance, fortify, activity streaks, merge history, hold `ground`, pathway `route`, faction homeland |
| **Flavor** | Narrative dressing that does not enter the decision loop | No | Prose tone in a battle report, incidental place names in copy |

The failure mode to avoid: calling soft mechanics "just AI flavor" because they are not numeric. If a field is passed into tiredness or battle adjudication and can change casualties, defeat type, retreats, or ongoing condition, it is mechanical.

## Default preference

When modelling a new concept, ask: **would a competent medieval commander describe this as a count, a score, or a situation?**

- Prefer **soft** for condition, cohesion, fatigue, posture, reputation, loyalty, weather-as-felt, supply-as-felt, political pressure, commander temper, and similar.
- Prefer **hard** for graph topology, who occupies what, unit headcounts, order timing, legal moves, and anything that must be fair, replayable, and unambiguous without an LLM.
- Use **flavor** only for presentation that players could remove without changing play.

Do not invent fake precision. A `tiredness: 0.73` dial is usually worse than a short qualitative line the adjudicator can actually reason about — unless the number maps to a real countable thing (men, days marched, wagons).

## How soft mechanics work here

1. **State is qualitative** — one-liners and structured activity counters that describe a situation, not a hit-point bar.
2. **Hard rules decide when soft state matters** — e.g. moves resolve first; then tiredness updates; then battles read condition + orders.
3. **Adjudicators consume soft state** — Claude (with deterministic fallback) turns that situation into outcomes.
4. **Outcomes write soft state back** — morale / tiredness / stance updates keep the loop closed.

Soft mechanics are therefore first-class game state. Treat them with the same care as hard fields: typed, updated on purpose, cleared when stale (e.g. `mergedFrom` after tiredness), and never left as orphaned copy.

## Hold ground and pathways

Every hold has soft `ground` (climate, defensibility, rest quality). Every link between holds has a soft `route` on a pathway. Faction `homeland` describes what climate and country that host is bred for.

These are **adjudicator-only** — never shown in the player UI. They still feed tiredness (rest quality, march fatigue, climate fit) and battle adjudication (deployment, approach disorder, homeland–climate mismatch).

Hard rules still decide adjacency and that a march happened; soft ground/route/homeland decide how the adjudicator reads that march and fight. Do not replace them with numeric movement costs.

## Characters, conversation, and battle takes

NPC agents (commanders, notables) have durable soft state: notepad, mood, invite memory. Player lords (Robb, Tywin) are thin records — background only, no system prompt, no mood, no battle takes.

Before each battle, NPC commanders in the fight give short takes (take / outlook / approach). Those takes plus mood are soft mechanics fed into the battle adjudicator. Player lords never submit an AI take.

Army speeches are an **army command** (like Move / Rest / Fortify), not Talk. Soft judgment (reaction + morale/stance) can hand off to hard stance orders (rest/fortify) and clear a queued march — the host is listening that turn; that counts as their action.

**Faction event log** (searchable by NPCs): marches, rest, fortify, speeches, and battles involving *their* side. Not the enemy's private orders. Generous retrieval; short generated notes.

**Advice ledger** (separate from notepad): counsel an NPC records toward their lord (or peer). After resolve, digests compare advice vs what the lord's hosts actually did so NPCs can update notepads (e.g. "he marched south against my counsel").

Conversations persist across turns; a turn-break line is inserted when a new planning turn begins.

## When to choose hard anyway

Use hard mechanics when:

- Players need a guarantee ("I can always retreat to an adjacent empty hold").
- Disagreement would feel like cheating ("did that army arrive or not?").
- The concept *is* a number in the fiction (headcount, days without rest as a counter feeding soft text).

Hard scaffolding + soft judgment is the intended pattern: the engine decides *that* a fight happens; soft state helps decide *how* it goes.

## For future features

Before adding a system, classify each piece:

1. Hard constraint / procedure?
2. Soft state that adjudication must see?
3. Flavor only?

Default new non-numeric concepts into (2), not (3). If it should matter in war, put it in the adjudicator's inputs and outputs — as soft mechanics, not as decorative prose.
