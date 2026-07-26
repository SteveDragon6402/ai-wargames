# GOT Houses — Game Design Document (v0.1 draft)

> Status: **first draft, reverse-engineered from the current codebase** as of the commit tagged `411d050 fix(got-houses): reject narrative NPC chat replies`. This doc describes what is actually built today, calls out where the design is still implicit or unresolved, and proposes next steps. Treat it as a living document — update it as decisions get made rather than letting the code and the doc drift apart again.

---

## 1. Elevator pitch

**GOT Houses** is a two-player, turn-based, hold-based strategy game set in Robert's Rebellion-era Westeros. Each player commands a faction (**the North** or **the Westerlands**) made up of several noble hosts spread across a 57-hold map of the Seven Kingdoms. Every turn you march hosts, rest them, dig in, or **give a speech** to rally them — then AI (Claude) adjudicates any battles that result, using both hard game state (troop counts, position) and a rich layer of **soft, qualitative state** (morale, tiredness, terrain "feel," a commander's mood and pre-battle outlook) to produce a written battle chronicle and its mechanical consequences.

The other half of the game is social: every named commander and notable on your side (and the enemy's) is a **persistent AI character** with memory, mood, and opinions. You can pull any of them into a private conversation or convene a full war council, ask for counsel, and see whether they resent you later for ignoring it. This is not a chatbot bolted onto a wargame — the design intent (`docs/soft-mechanics.md`) is that conversation, morale, terrain, and command style are first-class mechanical inputs, not flavor text.

---

## 2. Design pillars

These are inferred from the codebase's own stated doctrine (`docs/soft-mechanics.md`) plus consistent patterns in the commit history. Treat them as the constitution for future feature decisions.

1. **Soft mechanics are mechanics, not flavor.** If a qualitative field (morale, mood, ground, a commander's pre-battle take) is read by the adjudicator and can change casualties, retreats, or outcomes, it is first-class game state — typed, updated on purpose, never orphaned. The test: *"would a competent medieval commander describe this as a count, a score, or a situation?"* Counts/headcounts → hard. Condition/posture/reputation → soft, described in prose.
2. **Hard scaffolding decides *that*; soft judgment decides *how*.** The engine deterministically decides whether a march is legal, whether two armies occupy the same hold, whether a retreat destination is open. The AI adjudicator decides how a fight with those hard facts, dressed in this soft context, actually goes.
3. **No fake precision.** A `tiredness: 0.73` float is worse than a one-line qualitative description the adjudicator can reason about, unless the number maps to something real and countable (troops, days marched).
4. **Players are not AI, NPCs are not players.** Player lords (Robb, Tywin) are thin records with no system prompt, no mood, no battle takes — the player's decisions *are* their behavior. NPCs (commanders, notables) are full agents with memory and are never puppeted by the player.
5. **The player always controls the conversation.** NPCs cannot decline or leave a talk the player opens; they cannot invent secrets or narrate outside dialogue. This keeps the social layer feeling responsive rather than like a slot machine.
6. **Command is the interface, not just clicking.** A speech is an army order (like Move or Fortify), not idle chat — it costs the army's turn and can hand off to a hard stance order. This is the game's most novel mechanic and deserves to be a headline feature, not a side system.

---

## 3. World & setting

### 3.1 Factions

| Faction | Player lord | Home hold | Vibe |
|---|---|---|---|
| **The North** (`north`) | Robb Stark, Lord of Winterfell | Moat Cailin (`08`) | Cold-bred, disciplined, home-field advantage in frost/snow |
| **The Westerlands** (`westerlands`) | Tywin Lannister, Lord of Casterly Rock | Harrenhal (`18`) / Riverrun (`16`) | Wealthy, methodical, home-field advantage in hills/mining country |

Each faction's "homeland" is soft flavor text (`data/homeland.ts`) that never reaches the player UI but is fed to the battle adjudicator — a Northern host fighting deep in Dorne's heat is narratively and mechanically disadvantaged; a Westerlands host is unusually comfortable in the westerlands hills.

### 3.2 Starting forces

Five Northern hosts, all starting stacked at Moat Cailin, and two Lannister hosts split between Harrenhal and Riverrun:

| Army | Commander | Notables | Cav / Inf / Archers | Flavor |
|---|---|---|---|---|
| Robb Stark's Host | Robb Stark | Grey Wind, Catelyn Tully, Theon Greyjoy, Ser Rodrik Cassel | 1000 / 2000 / 500 | High spirits, disciplined, fresh from Winterfell |
| Bolton Spearmen | Roose Bolton | Ramsay Snow, Locke | 200 / 1500 / 0 | Cold, methodical, doesn't rush |
| Manderly Fleet-Guard | Wyman Manderly | Ser Wylis Manderly, Robett Glover | 300 / 800 / 400 | Wealthy, well-drilled harbor troops |
| Greatjon's Umbers | Jon Umber "the Greatjon" | Smalljon Umber, Mors "Crowfood" Umber | 400 / 1200 / 100 | Aggressive, itching for a fight |
| Glover's Wardens | Galbart Glover | Larence Snow | 100 / 600 / 300 | Light, mobile rangers |
| Tywin's Host | Tywin Lannister | Ser Kevan Lannister, Ser Addam Marbrand, Ser Harys Swyft | 2000 / 5000 / 1000 | Utterly assured, forms lines before striking |
| Jaime's Vanguard | Jaime Lannister | Ser Ilyn Payne, Bronn, Ser Balon Swann | 1500 / 2000 / 500 | Bold, attacks before the enemy can set |

This is a deliberately **asymmetric start**: the North has more, smaller, characterful hosts (11 named notables across 5 armies); the Westerlands has fewer, larger, harder-hitting hosts (7,000 vs. 9,500 troops respectively, but concentrated). This shapes early strategy — the North can out-maneuver and mass hosts; the Westerlands hits harder per engagement but has fewer decision points and less redundancy if a host is lost.

### 3.3 The map

57 holds across all eight regions of Westeros (North, Vale, Riverlands, Westerlands, Crownlands, Stormlands, Reach, Dorne), each with an `x/y` position, a region, and a soft **`ground`** description (climate, defensibility, rest quality — e.g. Moat Cailin's fever bogs, Casterly Rock's impregnable vaults, Yronwood's brutal desert heat for cold-bred armies). Holds connect via undirected **pathways**, each carrying a soft **`route`** description (e.g. the Neck causeway, the Golden Tooth, the Boneway) fed to the adjudicator to color marches and arrivals.

Crucially, **`ground` and `route` are adjudicator-only** — never shown to the player. The player experiences terrain only indirectly, through how battles play out and how their commanders react — not through a stat sheet. This is a strong, consistent design choice worth preserving (and worth eventually surfacing *some* signal of, per the open questions in §8).

There is currently no movement cost, no distinction between adjacent-hold "distance," and no fog of war on the map graph itself — the hard layer is pure adjacency.

---

## 4. Core gameplay loop

```
┌─────────────┐     both factions      ┌────────────┐     casualties/fallen     ┌──────────────────┐
│  PLANNING   │ ───── submit ────────▶ │  RESOLVING  │ ──── applied, retreats ──▶ │ RETREAT (if any)  │
│             │                         │             │      built if needed       │ RENAME (if leader │
│ move/rest/  │                         │ tiredness → │                            │  fell)            │
│ fortify/    │                         │ battle-brief│                            └────────┬──────────┘
│ speech/talk │                         │ → AI battle │                                     │
│ /merge/split│                         │ → apply     │                                     ▼
└─────────────┘                         └─────────────┘                          back to PLANNING (turn+1)
       ▲                                                                                     │
       └──────────────────────── NPC digest runs on turn entry ◀───────────────────────────┘
```

1. **Planning.** Both players simultaneously (hidden-information intent, see §8) queue orders for their own armies: march to an adjacent hold, hold in place and rest, fortify, or deliver a speech to the host. Players can also merge/split armies, promote a notable to commander or rename a commander voluntarily, and open Talk with any commander/notable (their own or the enemy's) at any time. There is no turn timer.
2. **Submit.** When both factions submit, orders apply simultaneously — moves resolve, activity counters tick, and any hold now containing armies from both factions becomes a **battle**.
3. **Resolving.** Per battle: an off-turn qualitative tiredness/morale/stance pass runs first for all armies; then, for each battle, alive NPC commanders in the fight give a private pre-battle take (battle-brief); then Claude adjudicates the fight using hard state (units, position) + soft state (morale, ground, route, homeland fit, orders, activity streaks, commander takes/mood) and returns a narrative chronicle plus casualties, fallen characters, hold outcome, defeat type, and updated qualitative condition per surviving army.
4. **Aftermath.** If an army has nowhere to retreat to, it fights again as a **last stand** (fed back into resolving). If a commander fell, that army enters forced rename. Losing armies otherwise choose (or are auto-assigned, if only one option) a retreat destination.
5. **Next planning turn.** NPCs on both sides privately "digest" the turn — reviewing their faction's event log and any advice they gave the lord — updating their private notepad and mood before the player can talk to them again.

There is currently **no explicit win condition implemented** (see §8.1) — the loop runs indefinitely, attriting hosts turn over turn.

---

## 5. Systems deep-dive

### 5.1 Armies & orders

An **army** ("host") is the unit of play — not individual regiments. Each has:

- `units`: stacks of `{ house, type (cavalry/infantry/archers), count }` — the only *hard* numeric combat state.
- `leaders` / `notables`: named characters, each optionally backed by an NPC agent.
- `morale`, `tiredness`, `stance`: qualitative one-line descriptions, not numbers.
- `activity`: hard counters (`turnsResting`, `turnsFortiying` [sic — preserved typo], `turnsMarching`, `turnsSinceMerge`, `turnsSinceSplit`) that feed the *soft* text generation and the battle adjudicator, without being shown to the player as raw numbers.

**Orders available to a player, per army, per turn (mutually exclusive):**

| Order | Effect |
|---|---|
| **Move** | March to one adjacent hold. Clears any stance order. Marked `"march"` for adjudication. |
| **Rest** | Recover condition at the current hold. Default if no order is given. |
| **Fortify** | Dig in at the current hold — read by the adjudicator as prepared defense, "digging in," surprise-resistant. |
| **Speech** | Address the host (≤200 words). Counts as the army's action this turn (clears any queued march); the adjudicator returns a reaction plus updated morale/tiredness/stance, and may *imply* Rest or Fortify, which is then applied as that army's stance order. One speech per army per turn. |

Additionally, at any time during planning (not turn-costing): **merge** two same-faction armies at the same hold (largest becomes the base; unit stacks combine; stance becomes "disorganised" for one turn), **split** one army into two (apportion units and leaders/notables across both halves; a half does not require a commander), and **appoint/voluntarily change a commander** (promote a notable to lead, or leave a host commanderless — it falls back to a generic house name).

There is **no Attack order** and **no stance/intention/speed dial** — fighting is automatic: if hostile armies end a turn in the same hold, a battle happens. This is a deliberately simple, legible order model; the tradeoff (very little tactical control once armies are co-located) is called out in [§8.6](#86-depth-of-the-order-model).

### 5.2 Battle adjudication

Battles are detected purely by hold co-occupancy after moves resolve (no attack order needed — arriving in a hostile hold, or being arrived upon, is enough). Each battle bundles for the adjudicator:

- All armies of both factions present, with full unit/leader/notable state.
- Which hold each side arrived from (and the pathway `route` text for that approach), if they moved this turn.
- Each army's order this turn (march / rest / fortify) — a Rest order is read as being caught relatively unprepared; Fortify as dug in.
- Activity streaks (resting/fortifying/marching streaks; whether the army just merged or split this turn — merged hosts fight less cohesively, split hosts less certainly).
- The hold's soft `ground` and the faction's `homeland` fit to it.
- Pre-battle **commander briefs**: each alive NPC commander present gives a short private take/outlook/approach plus current mood (player lords never do — they're represented only by their army's orders and condition).
- Whether this is a **last stand** (no valid retreat).

Claude (`claude-sonnet-5`, falling back to `claude-haiku-4-5`, and a deterministic fallback report if the API is unavailable) returns strict JSON: a labelled-phase tactical narrative (no flowery ASOIAF prose, no invented politics or reinforcements, no comment on retreats-to-where or on territory not explicitly in the data), a `defeatType`, `holdResult`, per-unit-type-per-house `casualties`, `fallen` named characters, and per-surviving-army qualitative `conditionUpdates`.

**Defeat types** and their intended narrative/mechanical weight:

| Type | Meaning |
|---|---|
| `structured_withdrawal` | Ordered retreat, rear-guard holds, low losses |
| `rout` | Formation breaks, men flee, pursuit casualties, abandonment |
| `shattering` | Army effectively destroyed, mass desertion, may reach zero strength |
| `pyrrhic_win` | Winner takes the field but pays dearly — possibly worse losses than the loser |
| `last_stand` | Trapped with no retreat; fights to the last; total destruction possible but not automatic |

Units reduced to zero are removed; an army with no units left is removed entirely; its commander/notables are marked fallen. A fallen commander forces the **rename_commanders** phase before the next planning turn.

### 5.3 Retreat & destruction

After a lost battle, valid retreat holds are: adjacent, not occupied by any enemy army, and not an enemy army's *last* hold of origin — **except** your own origin is always a legal fallback. If zero valid holds remain, the army is trapped and a **last stand** battle is triggered instead of an automatic wipe — giving the losing side one more (harsher) adjudication rather than an instant kill. If there's exactly one legal retreat hold, it's auto-selected; otherwise the player chooses in the retreat phase.

### 5.4 Tiredness, morale, and condition

Deliberately **qualitative, not numeric** — no tiredness/morale bars or sliders anywhere. A lightweight AI pass (Haiku) runs once per resolving phase for every army, reading: whether the army is resting at home vs. neutral ground, march streaks, cavalry composition, the hold's `ground`, the `route` just marched, homeland-vs-climate fit, fortify vs. rest posture, and recent merge/split turbulence — and returns fresh one-line `morale` / `tiredness` / `stance` text per army. Condition is also updated directly by battle outcomes and by speech reactions.

### 5.5 Terrain ("ground") and homeland

Every hold carries a hidden soft description of climate, defensibility, and rest quality; every pathway a hidden soft description of the march itself. Every faction has a hidden "homeland" description of what climate/terrain it's bred for. None of this is shown in the player UI (holds render with a flat region color, not a "you'll fight well/poorly here" indicator) — it exists purely to give the adjudicator something to reason about, keeping strategic depth in "read the battle chronicles and your commanders' moods" rather than in a stat sheet the player min-maxes against.

---

## 6. The social layer — NPC commanders & notables

This is the game's most distinctive system and probably deserves to be marketed as a headline feature, not an ancillary chat window.

### 6.1 Character types

- **Player lords** (Robb, Tywin): thin records — name, faction, background text, current army. No AI system prompt, no mood, no memory, no battle take. The player's play *is* their behavior.
- **NPC commanders**: lead a host. Eligible for war council and give pre-battle takes. Carry durable state: a private **notepad** (capped ~800 characters, oldest content trimmed), a **mood** one-liner (feeds battle briefs and colors dialogue), an **invite history** (who's talked to them and how it went), and pointers into a shared **advice ledger**.
- **NPC notables**: vassals riding with a host (Grey Wind, Bronn, Ser Kevan, etc.) — same agent machinery as commanders, talkable, and promotable to commander at any time (including leaving a host commanderless if the player chooses — it just loses its named-leader flavor and war-council/battle-brief presence).

### 6.2 Talk

Players open conversations from a map-first **Talk** rail (replacing the army panel while open), either as a **private word** with one commander/notable, a full **war council** (the player's lord plus every alive commander on their side, who then reply in sequence and hear each other), or an invite to the **enemy lord** (which just opens a pending thread for the other human player — no AI stands in for the opposing lord).

The load-bearing design rule, repeated in both the code comments and `docs/soft-mechanics.md`: **NPCs cannot decline or leave a conversation the player opens.** They always greet in character and stay until the player closes the thread. This trades a little realism (a busy commander should sometimes brush you off) for a consistent, controllable UX — the player is never stonewalled by an agent deciding not to engage. Conversations persist turn to turn with an inserted turn-break marker.

Dialogue output is tightly constrained: NPC replies must be *only* the words spoken aloud — no third-person narration, no internal monologue, no stage directions, no meta-commentary — enforced both by prompt rules and by a post-hoc narration filter that rejects and retries offending output. This keeps the chat feeling like an in-world conversation rather than a novel excerpt.

### 6.3 Speeches (army command, not Talk)

Distinct from Talk: a **speech** targets an army, not a person, costs that army's turn (it will not march this turn), and is adjudicated by a lightweight system (not a character agent) that decides the host's reaction and updates morale/tiredness/stance, optionally implying a Rest or Fortify order for that turn. This is the mechanism by which "soft judgment hands off to a hard stance order" — a good rally-the-troops moment before a big fight, at the cost of not being able to also march that turn.

### 6.4 Battle briefs, war council, and digests

- **Battle-brief**: right before each battle, every alive NPC commander present privately gives a short (≤15 words each) take / outlook / approach plus mood — fed straight into that battle's adjudication as soft input. Player lords never do this.
- **War council**: a standing multi-NPC conversation where commanders can be asked for and can volunteer counsel, which is recorded into a separate **advice ledger** (distinct from personal notepads) — timestamped, attributed, addressed to a specific person (usually the lord).
- **Digest**: on entering a new planning turn, each NPC privately reviews their faction's event log (their own side's marches/rests/fortifications/speeches/battles only — never the enemy's private orders) and any advice they gave, and may update their notepad or mood — e.g., noting that the lord marched south against their counsel. This is what gives the memory system teeth: advice you ignore can come back around in later dialogue and mood shifts.

### 6.5 Promotion & commanderless hosts

A host doesn't strictly need a named commander. Splitting an army doesn't require assigning a leader to both halves, and a commander's death doesn't have to be immediately replaced — a commanderless host just loses its personalized name, war-council seat, and battle-brief voice until the player promotes a notable or appoints someone.

---

## 7. UI/UX (current implementation)

### 7.1 Player journey

`Home (/) → create/join room → Lobby → Game screen`. The actual product landing page is the **Command Uplink** at `/` (faction sigils, commander name, create-or-join-by-code); `/got-houses` itself is currently an unlabeled standalone/admin sandbox with no persistence, used for solo dev play. The **Lobby** shows both faction slots filling in and lets the host start once both are present (or a "solo dual-faction" mode is used for one person controlling both sides). The **Game screen** is a single persistent view — map, side rail, top bar — that cycles through planning → resolving → retreat/rename → planning without navigating away.

### 7.2 Map

A React Flow graph of compact hold cards, tinted by region, with small colored dots indicating army presence per faction (dimmed when resting, a filled square when fortifying) and simple straight-line roads between linked holds. Selecting a hold opens the side rail with its armies; queued moves draw as dashed (planning) or solid (submitted) arrows. There is currently **no ownership/control coloring** on the map — a hold doesn't visually show who holds it, only who's currently standing in it.

### 7.3 Army management

A right-side panel shows armies at the selected hold, grouped by faction, each card showing order state (ORDERED/REST/FORTIFY/SPEECH), leaders, notables, unit breakdown, and the three qualitative condition lines (Morale / Condition / Stance) as prose — deliberately not bars or numbers. Command buttons (Move, Combine, Split, Commander, Rest, Fortify, Speech, Deselect) appear when armies are selected; cards lock once a faction has submitted.

### 7.4 Conversation UI

Opening **Talk** swaps the side rail for a `ConversationDock`: a character picker (war council / enemy lord / commanders / vassals & notables) and tabbed open threads, each rendered as a chat window with player/NPC bubbles, turn-break dividers, a word-count-limited composer, and (for incoming enemy invites) accept/decline controls.

### 7.5 Turn chrome

A top bar shows the turn number, per-faction submit status pips, and a submit button; there's no timer or countdown. Resolving shows a static "Adjudicating…" overlay with no progress indicator. Battle results collect in a bottom **Battle Log**, each opening into a full chronicle modal with narrative, casualties, fallen, and a defeat-type badge.

### 7.6 Visual identity

The current look is a **dark tactical command console** — near-black surfaces, hairline borders, monospace uppercase micro-labels, a gold accent for interactive/selected state, cool blue for North vs. muted crimson for Westerlands — closer to a sci-fi ops-room HUD than an illuminated manuscript or parchment map. That's a legitimate direction, but worth an explicit decision (see §8.4): is "war-room HUD" the intended final aesthetic for a GOT game, or a placeholder that should shift toward something warmer and more in-period?

---

## 8. Open design questions

These are gaps or undecided points surfaced by reading the code, not existing decisions — flagging them is the main value a first design-doc pass should add.

### 8.1 No win condition
There is currently no implemented victory/defeat check. The game currently just... continues. Needs a decision: total annihilation of the enemy faction, a capital-seat capture condition (Winterfell / Casterly Rock falling), a turn-limit/score condition, or something narrative (e.g., political collapse via the advice/mood systems)? Given the soft-mechanics philosophy, a "soft" win condition (e.g., an AI-adjudicated campaign-level assessment) is at least as plausible as a hard one and would fit the game's identity better than a bolted-on numeric threshold.

### 8.2 Multiplayer integrity
State currently persists as a single JSON blob per room with no server-side authority, no per-faction hidden information enforcement (both factions' queued orders are visible client-side even though the intent is clearly hidden simultaneous orders), and no conflict resolution if both players' clients save near-simultaneously. A "player can flip on admin mode and control both sides" toggle is always available in the top bar even inside a real two-player room. Before this ships to real opponents, the fog-of-war and write-conflict stories need explicit answers.

### 8.3 Turn pacing
No turn timer exists. Is that intentional (a slower, correspondence-chess-style game) or a missing feature? Worth a deliberate call rather than an oversight.

### 8.4 Visual identity fit
Is the current "dark ops HUD" aesthetic the intended final direction for a Game of Thrones strategy game, or a functional placeholder? A more in-period treatment (parchment, sigils, illuminated map) is the more obvious genre fit and would likely land better with the ASOIAF audience — but the HUD approach does keep the qualitative-not-numeric philosophy visually honest (no bars, no meters). This is a good discussion to have explicitly rather than let default Tailwind choices decide it.

### 8.5 Map ownership & the "capital" concept
Holds don't currently track ownership independent of "who's standing there right now" — there's no persistent "this hold belongs to House X" state, no seat-of-power distinction, and no economy/attrition tied to territory control. If a win condition or any meta-strategic layer (supply, reinforcement, income) is wanted, hold ownership needs to become a real, hard piece of state, not just implied by army position.

### 8.6 Depth of the order model
The order set is intentionally minimal — Move / Rest / Fortify / Speech, with fighting triggered automatically by co-location rather than an explicit Attack order. That's a legible, low-friction model, but it also means players have very little tactical control once armies are in the same hold — no way to signal "hold back and skirmish" vs. "go all in" beyond the current order set. Worth deciding whether that's a deliberate design simplification (soft mechanics absorb what would otherwise be dials) or a system waiting for a second pass.

### 8.7 Reinforcement, attrition, and economy
There's currently no supply, recruitment, or reinforcement system — armies only ever shrink (casualties) or reshuffle (merge/split). Is attrition-to-zero the entire strategic arc, or should there be a way to raise new levies from held territory, which would also motivate solving §8.5 (ownership)?

### 8.8 Character mortality & narrative stakes
Fallen leaders trigger a rename; fallen notables just vanish from the roster. Is there a desire for more narrative weight here (e.g., a death announcement, a notepad/mood ripple through other NPCs who knew the fallen character) given how much investment the rest of the system puts into characters mattering?

---

## 9. Architecture & codebase map

For engineering onboarding — where each concern actually lives.

| Concern | Path |
|---|---|
| GOT types / `GameState` | `apps/web/app/got-houses/types.ts` |
| Initial armies & state | `apps/web/app/got-houses/data/initial-state.ts` |
| Holds + soft `ground` | `apps/web/app/got-houses/data/holds.ts` |
| Pathways + soft `route` | `apps/web/app/got-houses/data/pathways.ts` |
| Characters (lords/NPCs) | `apps/web/app/got-houses/data/characters.ts` |
| Homeland soft text | `apps/web/app/got-houses/data/homeland.ts` |
| Turn reducer / state machine | `apps/web/app/got-houses/hooks/useGameState.ts` |
| Faction event log | `apps/web/app/got-houses/lib/faction-events.ts` |
| NPC agent tool loop | `apps/web/app/got-houses/lib/character-tools.ts` |
| Map | `apps/web/app/got-houses/components/WesterosMap.tsx`, `HoldNode.tsx` |
| Army UI | `apps/web/app/got-houses/components/ArmyCard.tsx`, `SidePanel.tsx` |
| Conversation UI | `apps/web/app/got-houses/components/ConversationDock.tsx`, `ChatWindow.tsx`, `CharacterPicker.tsx`, `SpeechComposer.tsx` |
| Battle chronicle UI | `apps/web/app/got-houses/components/BattleSummaries.tsx` |
| Battle adjudication API | `apps/web/app/api/got-houses/battle` |
| Tiredness API | `apps/web/app/api/got-houses/tiredness` |
| NPC conversation APIs | `apps/web/app/api/got-houses/converse/{invite,message,speech,battle-brief,war-council,digest}` |
| Room lifecycle | `apps/web/app/api/got-houses/rooms/[roomId]/*` |
| Design doctrine | `docs/soft-mechanics.md` |

---

## 10. Suggested next steps

1. Pick answers for §8.1 (win condition) and §8.5 (ownership) together — they're the same underlying gap and unlock a real "campaign" arc instead of indefinite attrition.
2. Decide the multiplayer integrity story (§8.2) before running this with real remote opponents — at minimum, stop shipping both factions' orders to both clients.
3. Make an explicit call on visual direction (§8.4) so UI work stops accumulating in an unreviewed default style.
4. If keeping the current order-simplicity (§8.6), document it here as a decision, not just an absence, so it doesn't get "fixed" later without buy-in.
5. Consider a short "vertical slice" playtest doc/log once these are answered — this design doc should grow a changelog section as decisions land.
