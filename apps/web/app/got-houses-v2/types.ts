export type Region = "north" | "riverlands" | "westerlands" | "crownlands";

export const REGIONS: Region[] = [
  "north",
  "riverlands",
  "westerlands",
  "crownlands",
];

export type Faction = "north" | "westerlands";

export type UnitType = "cavalry" | "infantry" | "archers";

export type GamePhase = "planning" | "resolving" | "retreat" | "rename_commanders";

export interface Hold {
  id: string;
  name: string;
  house: string;
  lord: string;
  region: Region;
  /** 0–80, west→east */
  x: number;
  /** 0–100, south→north */
  y: number;
  /** IDs of directly connected holds */
  links: string[];
  /**
   * Soft ground: climate, defensibility, rest quality.
   * Adjudicator-only — never shown to players.
   */
  ground: string;
}

/**
 * Soft march between two adjacent holds.
 * Adjudicator-only — never shown to players.
 */
export interface Pathway {
  a: string;
  b: string;
  route: string;
  /** Crossing made by ship rather than road (Blackwater Bay to Dragonstone). */
  sea?: boolean;
}

/** How an army arrived at a battle hold this turn (if it marched in). */
export interface ArmyApproach {
  fromHoldId: string;
  fromHoldName: string;
  route: string;
}

export interface ArmyUnit {
  house: string;
  type: UnitType;
  count: number;
}

export interface Leader {
  name: string;
  title?: string;
}

export interface Notable {
  name: string;
  /** Brief description of who/what they are */
  description: string;
}

/**
 * Tracks how many consecutive turns an army has spent in each mode,
 * and how recently it merged or split. No booleans — all counters.
 * turnsSinceMerge/Split: null = never happened; 0 = happened this resolve.
 */
export interface ArmyActivity {
  turnsResting: number;
  turnsFortiying: number;
  turnsMarching: number;
  turnsSinceMerge: number | null;
  turnsSinceSplit: number | null;
}

/**
 * Snapshot of a source army's qualitative condition at the moment of merging.
 * Populated for one turn (cleared after UPDATE_TIREDNESS) so the tiredness
 * API can describe the heterogeneous state of a freshly merged force.
 */
export interface MergeSourceRecord {
  name: string;
  morale: string;
  tiredness: string;
  stance: string;
}

export interface Army {
  id: string;
  name: string;
  holdId: string;
  faction: Faction;
  units: ArmyUnit[];
  leaders: Leader[];
  /** Named warriors, companions, or creatures of significance */
  notables?: Notable[];
  /** Qualitative one-liner */
  morale: string;
  /** Qualitative one-liner */
  tiredness: string;
  /** Qualitative one-liner — updated by tiredness bot and battle adjudicator */
  stance: string;
  /** Activity history counters — fed to AI bots each turn */
  activity: ArmyActivity;
  /** Number of consecutive moves without rest */
  movesSinceRest?: number;
  /** The hold this army was at immediately before its current position (for retreat blocking) */
  lastHoldId?: string;
  /**
   * Set when this army was formed by merging two or more armies this turn.
   * Contains each source army's morale/tiredness/stance at the moment of merge.
   * Cleared after the next UPDATE_TIREDNESS so the tiredness API sees it exactly once.
   */
  mergedFrom?: MergeSourceRecord[];
}

export interface MoveOrder {
  armyId: string;
  fromHoldId: string;
  toHoldId: string;
}

export interface FactionOrders {
  orders: MoveOrder[];
  /** REST or FORTIFY orders issued by the player this turn — cleared on resolve */
  stanceOrders: Record<string, "rest" | "fortify">;
  /** Field armies ordered to storm the gates this turn — cleared on resolve */
  stormArmyIds: string[];
  /** Holds whose garrison is ordered to sally out — cleared on resolve */
  sallyHoldIds: string[];
  submitted: boolean;
}

/* ── Hold / castle / siege ────────────────────────────────────── */

export type SiteKind = "castle" | "ruin" | "open";

export interface HoldGarrison {
  /** Who the garrison fights for; null = unaffiliated / hostile-to-both */
  faction: Faction | null;
  units: ArmyUnit[];
  leaders: Leader[];
  notables: Notable[];
  /** Soft condition — like field armies; worn under siege / scar */
  morale: string;
  tiredness: string;
  stance: string;
}

/**
 * Terms on the table at a besieged seat.
 *
 * Kept on the siege rather than in transient UI state so an offer survives a
 * save, a reload, and the turn boundary, and so both the castellan agent and
 * the map can read it.
 */
export interface SurrenderTerms {
  /** Who put these terms on the table. */
  offeredBy: Faction;
  /** Garrison marches out alive instead of being taken. */
  garrisonSpared: boolean;
  /** Castellan and named defenders walk free rather than being held. */
  leadersSpared: boolean;
  /** Soft flavour — what was actually said. Shown to the other side. */
  note: string;
  /** Turn the offer was made. */
  offeredTurn: number;
  /** Offer lapses at the start of this turn. */
  expiresTurn: number;
  status: "offered" | "accepted" | "rejected" | "lapsed";
  /** Set when the other side answers; soft one-liner for the log. */
  reply?: string;
}

export interface HoldSiegeState {
  besiegerFaction: Faction;
  turns: number;
  armyIds: string[];
  /** Terms currently on the table, if any. */
  terms?: SurrenderTerms | null;
}

export interface HoldRuntime {
  homeFaction: Faction | "hostile";
  /** Who currently holds the seat; null if empty / unheld */
  controller: Faction | "hostile" | null;
  garrison: HoldGarrison;
  /** Soft supply one-liner */
  supplies: string;
  /** Hard food counter under siege; null if not tracked */
  foodDaysRemaining: number | null;
  siege: HoldSiegeState | null;
  /** Soft recovery timer after a siege ends */
  postSiegeTurnsLeft: number;
  /** Soft longer scar; survives post-siege timer */
  scar: string | null;
  /**
   * When true, skip soft-condition adjudication (default for seeded seats).
   * Cleared on siege / storm wear; may be restored by decade recovery pass.
   */
  skipUpdates: boolean;
  /** Ephemeral castellan character id while under siege / for talk */
  castellanId?: CharacterId | null;
}

export type GarrisonPanelMode = "deposit" | "withdraw" | "abandon";

export interface GarrisonPanelState {
  holdId: string;
  mode: GarrisonPanelMode;
  /**
   * Source/target field army for the peel.
   * Null on withdraw = form a new impromptu host at the hold.
   */
  armyId: string | null;
}

/** Peel units/leaders between a field army and a castle garrison. */
export interface GarrisonTransfer {
  holdId: string;
  /** Null on withdraw = create a new field army at the hold */
  armyId: string | null;
  mode: "deposit" | "withdraw";
  units: ArmyUnit[];
  leaderNames: string[];
  notableNames: string[];
}

export type GarrisonConditionPhase = "siege" | "scar" | "decade";

export interface GarrisonConditionContext {
  holdId: string;
  holdName: string;
  phase: GarrisonConditionPhase;
  morale: string;
  tiredness: string;
  stance: string;
  supplies: string;
  foodDaysRemaining: number | null;
  siegeTurns: number | null;
  postSiegeTurnsLeft: number;
  scar: string | null;
  men: number;
  defaultGarrison: number;
  capacity: number;
  siteKind: string;
}

export interface GarrisonConditionUpdate {
  holdId: string;
  morale: string;
  tiredness: string;
  stance: string;
  /** Adjudicator may restore skipUpdates on decade pass when fully recovered */
  skipUpdates?: boolean;
  /** Optional soft scar line to keep after recovery */
  scar?: string | null;
}

export type BattleEngagement = "field" | "storm" | "sally";

/* ── Battle types ─────────────────────────────────────────────── */

export interface Casualty {
  faction: Faction;
  armyId: string;
  unitType: UnitType;
  house: string;
  count: number;
}

export interface FallenFigure {
  armyId: string;
  name: string;
  /** true = removed from leaders[], false = removed from notables[] */
  isLeader: boolean;
}

/** Post-battle qualitative morale + tiredness + stance update for one army */
export interface ArmyConditionUpdate {
  armyId: string;
  morale: string;
  tiredness: string;
  stance?: string;
}

/**
 * How the losing side left the field. Drives casualty magnitude and narrative tone.
 * structured_withdrawal  — ordered retreat, rear-guard holds, low losses
 * rout                   — formation breaks, men flee, pursuit casualties + abandonment
 * shattering             — army effectively destroyed, mass desertion, may reach 0 strength
 * pyrrhic_win            — winner triumphs but pays dearly (winner casualties > loser in some cases)
 * last_stand             — trapped with no retreat, fight to the last
 */
export type DefeatType = "structured_withdrawal" | "rout" | "shattering" | "pyrrhic_win" | "last_stand";

/** Deterministic per-side force arithmetic, computed in TS (never by a model). */
export interface SideForce {
  faction: Faction | "garrison";
  armyCount: number;
  total: number;
  byType: Record<UnitType, number>;
  /** 0-1 share of the side that is mounted. */
  cavalryShare: number;
}

export interface ForceSummary {
  north: SideForce;
  west: SideForce;
  /** null when the two sides are exactly equal. */
  stronger: Faction | null;
  /** Stronger:weaker, 2dp. null when one side has no men at all. */
  ratio: number | null;
}

/**
 * What the Stage 3 validator changed about the executor's raw output.
 * Surfaced in the battle modal so silent corrections stay inspectable.
 */
export interface ValidationNote {
  kind:
    | "dropped_unknown_army"
    | "dropped_negative"
    | "clamped_to_available"
    | "redistributed_unit_type"
    | "redistribution_remainder"
    | "dropped_unknown_fallen"
    | "corrected_hold_result"
    | "corrected_retreats"
    | "dropped_unknown_condition";
  detail: string;
}

/** Player-facing explanation of the inputs that drove the verdict. */
export interface BattleFactors {
  forceRatio: string;
  northPosture: string;
  westPosture: string;
  ground: string;
  region: string;
  northCondition: string;
  westCondition: string;
  commanderMoods: string[];
}

export interface BattleReport {
  id: string;
  turn: number;
  holdId: string;
  /** How the battle ended — determines casualty scale */
  defeatType?: DefeatType;
  /** Claude's ASOIAF-style narrative (2–3 paragraphs) */
  narrative: string;
  /** Freeform three-line Haiku summary for the battle screen header */
  shortSummary: string;
  /** Set when the Haiku summary pass was incomplete or failed — battle still resolved */
  summaryError?: string;
  holdResult: Faction | "abandoned";
  casualties: Casualty[];
  fallen: FallenFigure[];
  retreatingArmyIds: string[];
  /** Qualitative morale + tiredness + stance after the battle for each involved army */
  conditionUpdates?: ArmyConditionUpdate[];
  /** Inputs that drove the verdict — shown to the player, not fed back in */
  factors?: BattleFactors;
  /** Corrections Stage 3 applied to the executor's output */
  validation?: ValidationNote[];
  /** Set when the resolution came from the deterministic fallback, not the models */
  fallbackReason?: string;
}

export interface BattleContext {
  holdId: string;
  northArmies: Army[];
  westArmies: Army[];
  /** hold the north army marched from; undefined = was already there (defender) */
  northFromHoldId?: string;
  /** hold the westerlands army marched from; undefined = defender */
  westFromHoldId?: string;
  /** Per-army approach path for armies that marched into this hold this turn */
  armyApproaches?: Record<string, ArmyApproach>;
  /** Per-army order type for this engagement */
  armyOrders?: Record<string, "march" | "rest" | "fortify">;
  /** When true, one side is trapped with no retreat options — fight to the last */
  lastStand?: boolean;
  /** NPC commander takes — player lords never included */
  commanderBriefs?: CommanderBrief[];
  /** Field clash vs storming the walls vs sallying out */
  engagement?: BattleEngagement;
  /** When set, a synthetic `garrison:{holdId}` army is in the fight */
  garrisonHoldId?: string;
}

export interface RetreatEntry {
  armyId: string;
  fromHoldId: string;
  /** holds the army CANNOT retreat to */
  forbiddenHoldIds: string[];
  validTargets: string[];
  chosenHoldId: string | null;
}

export interface TurnHistory {
  turn: number;
  armyMoves: { armyId: string; moved: boolean }[];
}

/* ── Tiredness types ──────────────────────────────────────────── */

export interface TirednessUpdate {
  armyId: string;
  tiredness: string;
  morale?: string;
  stance?: string;
}

export interface TirednessRequest {
  armies: TirednessArmyContext[];
}

export interface TirednessArmyContext {
  armyId: string;
  name: string;
  units: ArmyUnit[];
  leaders: Leader[];
  notables?: Notable[];
  currentTiredness: string;
  currentMorale: string;
  currentStance: string;
  moveType: "rest" | "march";
  movesSinceRest: number;
  territory: "home" | "neutral";
  holdName: string;
  /** Soft ground at the army's current hold — adjudicator only */
  holdGround: string;
  /** Soft homeland character for this army's faction — adjudicator only */
  homeland: string;
  /** Soft region character for marching here — adjudicator only */
  regionMarch: string;
  /** Whether this region's country suits this army — adjudicator only */
  regionFit: string;
  /**
   * If the army marched this turn, the pathway it took.
   * Soft route text — adjudicator only.
   */
  marchRoute?: {
    fromHoldName: string;
    toHoldName: string;
    route: string;
  };
  /** Full activity history — fed verbatim to AI */
  activity: ArmyActivity;
  /** The explicit stance order the player issued this turn (if any) */
  stanceOrder: "rest" | "fortify" | "march";
  /**
   * If this army was formed by merging this turn, the pre-merge conditions
   * of each source army. Used to produce a heterogeneous condition description.
   */
  mergedFrom?: MergeSourceRecord[];
}

/* ── Split types ─────────────────────────────────────────────── */

export interface SplitConfig {
  sourceArmyId: string;
  army1: { units: ArmyUnit[]; leaderNames: string[]; notableNames: string[] };
  army2: { units: ArmyUnit[]; leaderNames: string[]; notableNames: string[] };
}

/* ── Character / conversation types ───────────────────────────── */

export type CharacterId = string;

export interface InviteMemory {
  fromCharacterId: CharacterId;
  turn: number;
  outcome: "accepted" | "declined" | "left";
  reason: string;
}

/** Thin player-lord record — not an AI agent. */
export interface PlayerLordState {
  kind: "player";
  id: CharacterId;
  name: string;
  faction: Faction;
  role: "lord";
  /** For NPCs to read via tools — not an AI system prompt */
  background: string;
  armyId: string | null;
  alive: boolean;
}

/** Full NPC agent runtime state. */
export interface NpcAgentState {
  kind: "npc";
  id: CharacterId;
  name: string;
  faction: Faction;
  role: "commander" | "notable" | "castellan";
  /**
   * Beasts (direwolves, etc.) can be present but cannot negotiate or take
   * castellan charge. Default / omitted = human.
   */
  species?: "human" | "beast";
  armyId: string | null;
  /** Posted inside a castle garrison (or castellan of this hold) */
  holdId?: string | null;
  alive: boolean;
  /** Soft memory — capped; adjudicator/agent only */
  notepad: string;
  /** Soft mood one-liner — feeds battle briefs */
  mood: string;
  dispositionToward: Record<string, string>;
  inviteHistory: InviteMemory[];
  /**
   * Ids of advice this NPC has recorded (points into GameState.adviceLog).
   * Kept small — full text lives in the shared advice log.
   */
  adviceGivenIds: string[];
  /**
   * Ephemeral castellans: spun up for negotiation / siege memory.
   * Removed when the siege ends (or when a talk ends if never under siege).
   */
  ephemeral?: boolean;
  /** Runtime-only persona for ephemeral agents (no character seed) */
  runtimeBackground?: string;
  runtimeSystemPrompt?: string;
  /**
   * Taken when a seat fell on terms that did not spare its defenders. Alive,
   * but out of play until traded or freed.
   */
  captive?: boolean;
}

export type CharacterState = PlayerLordState | NpcAgentState;

export type ChatMessageKind =
  | "chat"
  | "invite"
  | "system"
  | "leave"
  | "speech_reaction"
  | "turn_break";

export interface ChatMessage {
  id: string;
  speakerId: CharacterId;
  speakerName: string;
  text: string;
  at: number;
  kind: ChatMessageKind;
}

/** Searchable log of what a faction's hosts actually did — fed to NPC agents. */
export type FactionEventKind =
  | "march"
  | "rest"
  | "fortify"
  | "speech"
  | "battle"
  | "advice"
  | "invest"
  | "storm"
  | "sally"
  | "liberate"
  | "claim"
  | "abandon"
  | "garrison"
  | "other";

export interface FactionEvent {
  id: string;
  turn: number;
  faction: Faction;
  kind: FactionEventKind;
  /** Short line for search / lists */
  summary: string;
  /** Fuller detail for tool results (not shown to players) */
  detail: string;
  armyId?: string;
  holdIds?: string[];
  relatedCharacterIds?: CharacterId[];
}

/**
 * Counsel an NPC has given (usually to their lord).
 * Separate from notepad — used to compare advice against later actions.
 */
export interface AdviceRecord {
  id: string;
  turn: number;
  fromCharacterId: CharacterId;
  toCharacterId: CharacterId;
  text: string;
}

export type ConversationKind = "direct" | "war_council";
export type ConversationStatus = "pending_invite" | "active" | "closed";

export interface ConversationThread {
  id: string;
  kind: ConversationKind;
  faction?: Faction;
  participantIds: CharacterId[];
  /** NPCs who left a war council (player always remains for council) */
  leftParticipantIds: CharacterId[];
  status: ConversationStatus;
  messages: ChatMessage[];
  inviteFrom: CharacterId;
  inviteTo: CharacterId | null;
  closedReason?: string;
  createdTurn: number;
  /**
   * Walls this talk is about, for a parley. Without it the castellan has no way
   * to look at their own castle or answer terms.
   */
  holdId?: string | null;
}

export interface CommanderBrief {
  characterId: CharacterId;
  name: string;
  armyId: string;
  mood: string;
  take: string;
  outlook: string;
  approach: string;
}

export interface NpcRuntimePatch {
  id: CharacterId;
  notepad?: string;
  mood?: string;
  dispositionToward?: Record<string, string>;
  inviteHistory?: InviteMemory[];
  alive?: boolean;
  armyId?: string | null;
  adviceGivenIds?: string[];
  /** Promote/demote between battlefield commander and notable */
  role?: "commander" | "notable";
}

/**
 * A seat that has just changed hands and must be garrisoned before its captor
 * can issue orders again.
 *
 * Taking a castle is not free: you have to leave men in it. The pledge is what
 * makes that mandatory, and once it is met the garrison holds the seat on its
 * own so the field army is free to march away.
 */
export interface CapturePledge {
  holdId: string;
  faction: Faction;
  /** Men that must be in the garrison before the captor can submit orders. */
  minimumMen: number;
  /** Turn the seat fell. */
  turn: number;
  cause: "storm" | "walk_in" | "surrender";
}

/* ── Game state ───────────────────────────────────────────────── */

export interface GameState {
  turn: number;
  phase: GamePhase;
  armies: Army[];
  selectedHoldId: string | null;
  selectedArmyIds: string[];
  moveMode: { active: boolean; validTargets: string[] };
  north: FactionOrders;
  westerlands: FactionOrders;
  adminMode: boolean;
  /** The faction currently issuing orders */
  activeFaction: Faction;
  /** Battles detected after move application — consumed by page.tsx → API */
  pendingBattles: BattleContext[];
  /** Accumulated battle history */
  battleReports: BattleReport[];
  /** Armies that must retreat after battles resolve */
  retreats: RetreatEntry[];
  /**
   * Holds that have already been adjudicated as a last stand this turn.
   * A second trapped result at the same hold destroys the trapped force rather
   * than queueing another last stand, which would loop forever.
   */
  lastStandHoldIds?: string[];
  /** Seats taken this turn that still owe a garrison before orders can be submitted */
  capturePledges?: CapturePledge[];
  /** Whether the battle log panel is open */
  battleLogOpen: boolean;
  /** Turn-by-turn movement history */
  turnHistory?: TurnHistory[];
  /** Army IDs awaiting post-battle commander selection */
  pendingRenames: string[];
  /** Army ID whose commander the player is voluntarily reassigning (null = panel closed) */
  voluntaryCommanderChange: string | null;
  /** Army ID currently open in the split panel (null = panel closed) */
  splitPanelArmyId: string | null;
  /** Permanent character homes (player lords + NPC agents) */
  characters: Record<CharacterId, CharacterState>;
  /** Active and archived conversation threads */
  conversations: ConversationThread[];
  /** Army IDs that already gave a speech this turn */
  speechesThisTurn: string[];
  /** Army currently composing a speech command (null = none) */
  speechArmyId: string | null;
  /** Open chat thread ids in the talk hub (UI) */
  openConversationIds: string[];
  /** Whether the talk hub column is open */
  talkPickerOpen: boolean;
  /** Thread currently shown in the talk hub */
  focusedConversationId: string | null;
  /** Searchable faction action / battle log for NPC agents */
  factionEvents: FactionEvent[];
  /** Advice NPCs have recorded toward lords / others */
  adviceLog: AdviceRecord[];
  /** Per-hold castle/ruin runtime (controller, garrison, siege) */
  holdStates: Record<string, HoldRuntime>;
  /** Garrison peel panel (null = closed) */
  garrisonPanel: GarrisonPanelState | null;
}

export type GameAction =
  | { type: "SELECT_HOLD"; holdId: string | null }
  | { type: "SELECT_ARMY"; armyId: string; shift: boolean }
  | { type: "SELECT_ALL_AT_HOLD"; holdId: string }
  | { type: "BEGIN_MOVE" }
  | { type: "QUEUE_MOVE"; toHoldId: string }
  | { type: "CANCEL_MOVE" }
  | { type: "SUBMIT_FACTION"; faction: Faction; deferAdjudicate?: boolean }
  | { type: "ADJUDICATE_MOVES" }
  | { type: "BATTLES_RESOLVED"; reports: BattleReport[] }
  | { type: "SET_RETREAT"; armyId: string; toHoldId: string }
  | { type: "COMMIT_RETREATS" }
  | { type: "COMBINE_ARMIES" }
  | { type: "TOGGLE_ADMIN" }
  | { type: "SWITCH_FACTION"; faction: Faction }
  | { type: "TOGGLE_BATTLE_LOG" }
  | { type: "UPDATE_TIREDNESS"; updates: TirednessUpdate[] }
  | { type: "UPDATE_GARRISON_CONDITION"; updates: GarrisonConditionUpdate[] }
  | { type: "SET_STANCE_ORDER"; armyId: string; order: "rest" | "fortify" | null }
  | { type: "OPEN_SPLIT"; armyId: string }
  | { type: "CLOSE_SPLIT" }
  | { type: "SPLIT_ARMY"; config: SplitConfig }
  | {
      type: "SELECT_LEAD_COMMANDER";
      armyId: string;
      /** null = no commander; army takes a house host name */
      leaderName: string | null;
    }
  | { type: "OPEN_COMMANDER_CHANGE"; armyId: string }
  | { type: "CLOSE_COMMANDER_CHANGE" }
  | { type: "TOGGLE_TALK_PICKER" }
  | { type: "OPEN_CONVERSATION"; threadId: string }
  | { type: "FOCUS_CONVERSATION"; threadId: string | null }
  | { type: "CLOSE_CONVERSATION_DOCK"; threadId: string }
  | { type: "UPSERT_CONVERSATION"; thread: ConversationThread }
  | { type: "APPEND_MESSAGES"; threadId: string; messages: ChatMessage[] }
  | { type: "PATCH_CHARACTERS"; patches: NpcRuntimePatch[] }
  | { type: "OPEN_SPEECH"; armyId: string }
  | { type: "CLOSE_SPEECH" }
  | {
      type: "APPLY_SPEECH";
      armyId: string;
      speech: string;
      reaction: string;
      condition: ArmyConditionUpdate;
      impliedOrder: "rest" | "fortify" | "none";
      commanderPatch?: NpcRuntimePatch;
    }
  | { type: "MARK_CHARACTERS_FALLEN"; names: string[] }
  | { type: "APPEND_FACTION_EVENTS"; events: FactionEvent[] }
  | { type: "APPEND_ADVICE"; records: AdviceRecord[] }
  | { type: "APPEND_TURN_BREAKS"; turn: number }
  | {
      type: "OPEN_GARRISON_PANEL";
      holdId: string;
      mode: GarrisonPanelMode;
      /** Null = withdraw into a new impromptu host */
      armyId: string | null;
    }
  | { type: "CLOSE_GARRISON_PANEL" }
  | { type: "GARRISON_TRANSFER"; transfer: GarrisonTransfer }
  | { type: "ABANDON_HOLD"; holdId: string; armyId: string }
  | { type: "SET_STORM_ORDER"; armyId: string; active: boolean }
  | { type: "SET_SALLY_ORDER"; holdId: string; active: boolean }
  | {
      /** Besieger puts terms to the garrison, or a garrison sues for terms. */
      type: "OFFER_SURRENDER_TERMS";
      holdId: string;
      terms: Omit<SurrenderTerms, "status" | "reply">;
    }
  | { type: "WITHDRAW_SURRENDER_TERMS"; holdId: string }
  | {
      /**
       * Terms answered. On accept the seat changes hands without a battle and
       * falls under the same forced-garrison rule as a storm.
       */
      type: "RESOLVE_SURRENDER";
      holdId: string;
      accepted: boolean;
      /** Soft one-liner from whoever answered. */
      reply: string;
      /** Replaces the offered terms when the answer was a counter-offer. */
      counterTerms?: Omit<SurrenderTerms, "status" | "reply">;
    }
  | {
      type: "APPLY_NEGOTIATOR_ENSURE";
      characters: Record<CharacterId, CharacterState>;
      holdStates: Record<string, HoldRuntime>;
    }
  | { type: "REMOVE_EPHEMERAL_CASTELLAN"; holdId: string }
  | {
      /**
       * Take the rival's orders from the room save without touching ours.
       * Used while both players are still planning.
       */
      type: "PULL_RIVAL_ORDERS";
      faction: Faction;
      north: FactionOrders;
      westerlands: FactionOrders;
    }
  | {
      /** Replace the board with the host's resolved state (guest client). */
      type: "HYDRATE_REMOTE";
      state: GameState;
    };
