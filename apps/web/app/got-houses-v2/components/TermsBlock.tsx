"use client";

import { useState } from "react";
import type { Faction, GameAction, GameState, SurrenderTerms } from "../types";
import { HOLDS_MAP } from "../data/holds";
import {
  TERMS_LIFETIME_TURNS,
  canOfferTerms,
  defaultTermsFor,
  describeTerms,
  openTermsAt,
  surrenderPressure,
} from "../lib/surrender";

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  holdId: string;
  faction: Faction;
}

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-mono), monospace",
};

const FACTION_LABEL: Record<Faction, string> = {
  north: "the North",
  westerlands: "the Westerlands",
};

/**
 * Terms at a besieged seat: put them, answer them, or hand the castle over.
 *
 * Both roles live here because both sides see the same walls — a besieger who
 * can offer mercy, and a garrison that can sue for it or simply yield.
 */
export default function TermsBlock({ state, dispatch, holdId, faction }: Props) {
  const [composing, setComposing] = useState(false);
  const [spareMen, setSpareMen] = useState(true);
  const [spareCaptains, setSpareCaptains] = useState(true);
  const [note, setNote] = useState("");
  const [confirmYield, setConfirmYield] = useState(false);

  const hs = state.holdStates?.[holdId];
  if (!hs?.siege) return null;

  const holdName = HOLDS_MAP.get(holdId)?.name ?? holdId;
  const besieger = hs.siege.besiegerFaction;
  const garrisonSide = hs.garrison.faction ?? hs.controller;
  const amBesieger = besieger === faction;
  const amGarrison = garrisonSide === faction;
  if (!amBesieger && !amGarrison) return null;

  const terms = hs.siege.terms ?? null;
  const open = openTermsAt(hs);
  const mineIsOpen = !!open && open.offeredBy === faction;
  const awaitingMyAnswer = !!open && open.offeredBy !== faction;
  const mayOffer = canOfferTerms(hs, faction) && !composing;
  const pressure = surrenderPressure(holdId, hs, state.armies);

  function putTerms() {
    const base = defaultTermsFor(hs!, faction, state.turn);
    dispatch({
      type: "OFFER_SURRENDER_TERMS",
      holdId,
      terms: {
        ...base,
        garrisonSpared: spareMen,
        leadersSpared: spareCaptains,
        note: note.trim() || base.note,
        offeredTurn: state.turn,
        expiresTurn: state.turn + TERMS_LIFETIME_TURNS,
      },
    });
    setComposing(false);
    setNote("");
  }

  function answer(accepted: boolean) {
    dispatch({
      type: "RESOLVE_SURRENDER",
      holdId,
      accepted,
      reply: accepted
        ? `${FACTION_LABEL[faction]} accepts the terms put at ${holdName}.`
        : `${FACTION_LABEL[faction]} refuses the terms put at ${holdName}.`,
    });
  }

  /** Hand the seat over outright — no terms to weigh, the besieger takes all. */
  function yieldOutright() {
    const unconditional: Omit<SurrenderTerms, "status" | "reply"> = {
      offeredBy: faction,
      garrisonSpared: false,
      leadersSpared: false,
      note: `${holdName} is given up without conditions.`,
      offeredTurn: state.turn,
      expiresTurn: state.turn + TERMS_LIFETIME_TURNS,
    };
    dispatch({ type: "OFFER_SURRENDER_TERMS", holdId, terms: unconditional });
    dispatch({
      type: "RESOLVE_SURRENDER",
      holdId,
      accepted: true,
      reply: `${holdName} opened its gates without conditions.`,
    });
    setConfirmYield(false);
  }

  return (
    <div
      style={{
        marginTop: 8,
        border: "1px solid #2a2418",
        background: "#0d0b06",
        padding: "7px 9px",
      }}
    >
      <div
        style={{
          ...MONO,
          fontSize: 8,
          color: "#7a6a3a",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          marginBottom: 5,
        }}
      >
        Terms
      </div>

      {terms && (
        <div style={{ ...MONO, fontSize: 9, lineHeight: 1.5, marginBottom: 6 }}>
          <div style={{ color: statusColor(terms.status) }}>
            {terms.status === "offered"
              ? mineIsOpen
                ? "Your terms stand at the gate"
                : "Terms put to you"
              : terms.status === "accepted"
                ? "Terms accepted"
                : terms.status === "rejected"
                  ? "Terms refused"
                  : "Terms lapsed"}
            {terms.status === "offered" && (
              <span style={{ color: "#5a4a2a" }}>
                {" "}
                · lapses turn {terms.expiresTurn}
              </span>
            )}
          </div>
          <div style={{ color: "#8a7a5a", fontStyle: "italic", marginTop: 2 }}>
            &ldquo;{terms.note}&rdquo;
          </div>
          <div style={{ color: "#666", marginTop: 2 }}>
            Under them, {describeTerms(terms)}.
          </div>
          {terms.reply && (
            <div style={{ color: "#666", marginTop: 2 }}>
              Answer: {terms.reply}
            </div>
          )}
        </div>
      )}

      {!terms && (
        <div style={{ ...MONO, fontSize: 9, color: "#5a5a5a", marginBottom: 6 }}>
          Nothing has been put to either side.
        </div>
      )}

      {amGarrison && pressure && (
        <div
          style={{
            ...MONO,
            fontSize: 8,
            color: pressure.starving ? "#c07030" : "#555",
            lineHeight: 1.5,
            marginBottom: 6,
          }}
        >
          {pressure.summary}
        </div>
      )}

      {composing && (
        <div style={{ marginBottom: 6 }}>
          <Check
            label="Their men march out alive"
            checked={spareMen}
            onChange={setSpareMen}
          />
          <Check
            label="Their captains walk free"
            checked={spareCaptains}
            onChange={setSpareCaptains}
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 180))}
            placeholder={
              amBesieger
                ? "Open the gates and your men keep their lives…"
                : "We will yield the seat if our people may walk…"
            }
            style={{
              ...MONO,
              fontSize: 9,
              width: "100%",
              marginTop: 4,
              padding: "4px 6px",
              background: "#080808",
              border: "1px solid #2a2418",
              color: "#c8b88a",
              outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
            <SmallButton label="Put terms" onClick={putTerms} accent />
            <SmallButton label="Cancel" onClick={() => setComposing(false)} />
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {mayOffer && (
          <SmallButton
            label={amBesieger ? "Offer terms" : "Sue for terms"}
            onClick={() => setComposing(true)}
            accent
          />
        )}
        {mineIsOpen && (
          <SmallButton
            label="Withdraw terms"
            onClick={() =>
              dispatch({ type: "WITHDRAW_SURRENDER_TERMS", holdId })
            }
          />
        )}
        {awaitingMyAnswer && (
          <>
            <SmallButton
              label={amBesieger ? "Take the seat" : "Open the gates"}
              onClick={() => answer(true)}
              accent
            />
            <SmallButton label="Refuse" onClick={() => answer(false)} />
          </>
        )}
        {amGarrison && !confirmYield && (
          <SmallButton
            label="Yield the seat"
            onClick={() => setConfirmYield(true)}
          />
        )}
        {amGarrison && confirmYield && (
          <>
            <SmallButton
              label="Confirm — give it up"
              onClick={yieldOutright}
              danger
            />
            <SmallButton
              label="Keep holding"
              onClick={() => setConfirmYield(false)}
            />
          </>
        )}
      </div>

      {amGarrison && confirmYield && (
        <div style={{ ...MONO, fontSize: 8, color: "#a05030", marginTop: 5 }}>
          Without conditions: {besieger === "north" ? "the North" : "the Westerlands"}{" "}
          takes the walls, the garrison and its captains with them.
        </div>
      )}
    </div>
  );
}

function statusColor(status: SurrenderTerms["status"]): string {
  switch (status) {
    case "offered":
      return "#c8941a";
    case "accepted":
      return "#5ecb6b";
    case "rejected":
      return "#c05050";
    default:
      return "#666";
  }
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        ...MONO,
        fontSize: 9,
        color: checked ? "#c8b88a" : "#666",
        display: "flex",
        alignItems: "center",
        gap: 6,
        cursor: "pointer",
        marginTop: 3,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: "#c8941a" }}
      />
      {label}
    </label>
  );
}

function SmallButton({
  label,
  onClick,
  accent,
  danger,
}: {
  label: string;
  onClick: () => void;
  accent?: boolean;
  danger?: boolean;
}) {
  const color = danger ? "#d07050" : accent ? "#c8941a" : "#888";
  const border = danger ? "#4a2010" : accent ? "#3a2a00" : "#222";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...MONO,
        fontSize: 9,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        padding: "4px 8px",
        color,
        background: danger ? "#170a04" : accent ? "#120e02" : "#0e0e0e",
        border: `1px solid ${border}`,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
