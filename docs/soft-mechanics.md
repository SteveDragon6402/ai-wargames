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

NPC agents (commanders, notables) have durable soft state: notepad, mood, invite memory. Player lords (Robb, Tywin) are thin records — background only, no system prompt, no mood, no battle takes. NPCs cannot leave or decline talks the player opens — conversations last as long as the player keeps them open.

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

## Fortify vs garrison vs siege

| Concept | Layer | Meaning |
|---|---|---|
| **Fortify** | Soft (field) | Digging in as a *field* stance (`turnsFortiying`). Not men inside walls. |
| **Garrison** | Hard | Units + commanders peeled from a field army into a castle/ruin. Same shape as a split — those men leave the field host. |
| **Castellan / parley** | Soft + ephemeral hard | Talk to a named human in the garrison, or an ephemeral castellan (random name) if none. Beasts (e.g. Grey Wind) cannot negotiate. Ephemeral castellans keep notepad memory for the siege; if a parley thread is still open when the siege ends they stay until the talk closes. Tools: `inspect_my_castle`, history, food/supplies. |
| **defaultGarrison** | Hard (seeded) | Native / liberation refill watermark. Friendly ungarrison cannot go below this. Friendly field presence (or home reclaim) tops headcount toward default after moves. |
| **capacity** | Hard (seeded) | Max men the walls can hold. Filling default→capacity requires player peel. |
| **siteKind** | Hard | `castle` (siegable), `ruin` (garrisonable, default 0 — e.g. Harrenhal, Moat Cailin), `open` (no walls — e.g. Clegane's Keep). |
| **homeFaction / controller** | Hard | Home is region-seeded allegiance; controller is who holds it now. Marching alone does not flip control. |
| **Siege investment** | Hard + soft | Same resolve as the march: unfriendly garrisonable hold with defending men and no opposing *field* army → auto-invest. Opening day sets `turns = 1` but does **not** decrement food; continued ticks do. Soft `supplies` update every invest tick. |
| **Garrison soft condition** | Soft + cadence | `morale` / `tiredness` / `stance` on the garrison (same spirit as field armies). `skipUpdates` (default true) skips adjudication for quiet seats. Cleared on invest / storm wear. Cadence: every turn under siege; every turn while `postSiegeTurnsLeft > 0`; otherwise only on turns where `turn % 10 === 0` until the adjudicator restores `skipUpdates`. Siege lift refills headcount and starts the scar — it does **not** snap soft condition to pristine. |
| **Storm / Sally** | Hard orders → battle | Assault the walls, or sortie (alone or with a relieving field army — one two-front engagement). Storm cannot be ordered on the arrival turn (storm orders clear with march queue). After a successful storm, walls are open until the attacker peels men to claim. |
| **Post-siege scar** | Soft + hard timer | 3 turns of recovery soft updates after a siege ends; longer scar string may remain past the timer. |

**Conquer** (unfriendly / hostile / enemy-controlled): peel *your* men into the seat to claim. **Liberate** (retake a seat whose `homeFaction` is you): control returns and the castle refills up to `defaultGarrison`; extras above default still need peel. **Abandon** (non-home occupier): full withdraw → home reclaim + refill to default. Friendly ungarrison floors at default; with no field army selected, extras form a new host outside the gates.

## For future features

Before adding a system, classify each piece:

1. Hard constraint / procedure?
2. Soft state that adjudication must see?
3. Flavor only?

Default new non-numeric concepts into (2), not (3). If it should matter in war, put it in the adjudicator's inputs and outputs — as soft mechanics, not as decorative prose.
