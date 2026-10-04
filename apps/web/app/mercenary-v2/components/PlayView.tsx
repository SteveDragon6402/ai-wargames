"use client";

import { useState } from "react";
import { CONFIG } from "../lib/config";
import {
  acceptDeal,
  acceptVolunteer,
  counterDeal,
  declineVolunteer,
  disposition,
  localReply,
  move,
  placeActions,
  quartermasterReply,
  reachable,
  resolveWeek,
  rumourFromInn,
  screenIntent,
  sellGood,
  setStance,
  setWage,
  stageAction,
  trade,
} from "../lib/engine";
import { companyHeadcount } from "../lib/seed";
import type { GameState, PendingAction, Stance } from "../lib/types";
import { Face, Icon } from "./icons";

const SPOT: Record<string, { left: string; top: string }> = {
  drowned: { left: "14%", top: "58%" },
  "salt-ferry": { left: "32%", top: "48%" },
  crownmarket: { left: "50%", top: "40%" },
  lantern: { left: "50%", top: "16%" },
  thornwick: { left: "70%", top: "46%" },
  thornwood: { left: "86%", top: "34%" },
};

const COACH = [
  "Open a unit card. The pips are the men. The bars are stance, morale, and condition.",
  "Reeve Marta Hale is marked. The morning after the raid, she wants something.",
  "Buy bread from Fenn before the week eats your purse.",
  "Recruit in the square, or take the barn. Two stragglers are still looting it.",
  "End the week. Read the report. Accept or refuse whoever offered to join.",
];

export function PlayView({
  game,
  setGame,
  onBarn,
  onSkipTutorial,
}: {
  game: GameState;
  setGame: (game: GameState) => void;
  onBarn: () => void;
  onSkipTutorial: () => void;
}) {
  const [placeId, setPlaceId] = useState<string | null>(game.places.find((place) => place.locationId === game.locationId)?.id ?? null);
  const [openUnit, setOpenUnit] = useState<string | null>(null);
  const [talk, setTalk] = useState<string | null>(null);
  const [line, setLine] = useState("");
  const [qm, setQm] = useState("");
  const [qmLine, setQmLine] = useState("Ask me how the week works.");
  const [form, setForm] = useState<string | null>(null);
  const [speech, setSpeech] = useState("");
  const [plan, setPlan] = useState("Hold the line.");
  const [busy, setBusy] = useState(false);
  const [seals, setSeals] = useState(false);
  const [ledger, setLedger] = useState(false);
  const [counter, setCounter] = useState("");
  const [storyOpen, setStoryOpen] = useState(false);
  const [inn, setInn] = useState<string[]>([]);
  const here = game.locations.find((location) => location.id === game.locationId);
  const place = game.places.find((item) => item.id === placeId && item.locationId === game.locationId) ?? game.places.find((item) => item.locationId === game.locationId);
  const reach = reachable(game);
  const deltaGold = game.report?.goldDelta;
  const deltaBread = game.report?.breadDelta;

  async function endTurn() {
    let next = game;
    const action = next.pendingAction;
    if (action && (action.kind === "fight" || action.kind === "ambush")) {
      setBusy(true);
      try {
        const response = await fetch("/api/mercenary-v2/agent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            agent: "adjudicator",
            prompt: `Week ${next.week} at ${next.locationId}. Company plan: ${"plan" in action ? action.plan : "none"}. Men: ${companyHeadcount(next)}. Judge sides A (the company) and B.`,
          }),
        });
        if (response.ok) {
          const judged = (await response.json()) as { winner?: "a" | "b" | "none"; units?: { id: string; killed: number; wounded: number; moraleDelta: number; conditionDelta: number }[]; highlights?: string[]; narrative?: string };
          if (judged.winner && judged.units) {
            next = {
              ...next,
              stagedBattle: {
                id: `judged-${next.week}`,
                week: next.week,
                locationId: next.locationId,
                winner: judged.winner,
                sideA: "company",
                sideB: action.kind === "fight" ? action.forceId : action.forceId,
                surprise: action.kind === "ambush" ? "ambush" : "none",
                units: judged.units,
                breadTaken: 0,
                goldTaken: 0,
                civiliansKilled: 0,
                loot: [],
                highlights: (judged.highlights ?? []).slice(0, 3),
                narrative: (judged.narrative ?? "").split(/(?<=[.!?])\s+/).slice(0, 6).join(" "),
              },
            };
          }
        }
      } catch {
        /* the engine still fights */
      }
      setBusy(false);
    }
    setGame(resolveWeek(next));
    setForm(null);
    setTalk(null);
    setInn([]);
  }

  function act(action: PendingAction) {
    setGame(stageAction(game, action));
    setForm(null);
  }

  async function say(who: string) {
    const text = line.trim();
    if (!text) return;
    const local = localReply(game, who, text);
    let reply = local;
    setBusy(true);
    try {
      const response = await fetch("/api/mercenary-v2/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agent: who.length < 12 && game.npcs.some((npc) => npc.id === who) ? "major" : "group",
          prompt: `${who} is speaking. Company: ${game.company.name}, week ${game.week}, at ${game.locationId}. Record: ${game.company.gold} gold, ${game.company.bread} bread. Player says: ${text}`,
        }),
      });
      if (response.ok) {
        const data = (await response.json()) as { text?: string; chip?: string; deal?: { gold?: number; upfrontGold?: number; bread?: number; note?: string; questId?: string; kind?: string } };
        if (data.text) {
          reply = {
            text: data.text,
            chip: data.chip ?? screenIntent(text, place?.id ?? ""),
            deal: data.deal?.note
              ? {
                  id: `deal-ai-${game.messages.length}`,
                  npcId: who,
                  kind: data.deal.kind === "loan" ? "loan" : "quest",
                  gold: data.deal.gold ?? 0,
                  bread: data.deal.bread ?? 0,
                  upfrontGold: data.deal.upfrontGold ?? 0,
                  dueWeek: 12,
                  note: data.deal.note,
                  questId: data.deal.questId,
                  status: "offered",
                }
              : local.deal,
          };
        }
      }
    } catch {
      /* local voice */
    }
    setBusy(false);
    const name = game.npcs.find((npc) => npc.id === who)?.name ?? game.groups.find((group) => group.id === who)?.name ?? "Them";
    setGame({
      ...game,
      messages: [
        ...game.messages,
        { id: `p-${game.messages.length}`, who: game.company.captainName, role: "player", text },
        { id: `n-${game.messages.length}`, who: name, role: "npc", text: reply.text },
      ],
      deals: reply.deal ? [...game.deals.filter((deal) => deal.id !== reply.deal?.id), reply.deal] : game.deals,
    });
    setLine("");
    if (reply.chip) setForm(reply.chip);
  }

  function askQm() {
    const answer = quartermasterReply(game, qm);
    setQmLine(answer.text);
    if (answer.action && !game.actionUsed) setForm(answer.action.kind);
    setQm("");
    void fetch("/api/mercenary-v2/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent: "quartermaster", prompt: qm }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { text?: string } | null) => {
        if (data?.text) setQmLine(data.text);
      })
      .catch(() => undefined);
  }

  function drinkLine() {
    if (inn.length >= CONFIG.innMessages) return;
    const rumour = rumourFromInn(game, line || "the room");
    const nextInn = [...inn, line || "…"];
    setInn(nextInn);
    if (rumour) {
      const withRumour = { ...game, company: { ...game.company, rumours: [...game.company.rumours, rumour] } };
      if (nextInn.length >= 3) {
        withRumour.events = [...withRumour.events, { week: game.week, type: "rumours", significant: false, payload: { count: 3 } }];
      }
      setGame(withRumour);
    }
    setLine("");
    if (nextInn.length === 1 && !game.actionUsed) act({ kind: "drink", placeId: place?.id ?? "", rumours: rumour ? [rumour] : [] });
  }

  const peopleHere = [
    ...game.npcs.filter((npc) => npc.placeId === place?.id),
    ...game.groups.filter((group) => group.placeId === place?.id),
  ];
  const actions = place ? placeActions(game, place.id) : [];
  const lastBattle = game.battles[game.battles.length - 1];

  return (
    <main className="mc2-page">
      <header className="mc2-top">
        <div>
          <div className="mc2-display">Week {Math.min(game.week, 12)} / 12</div>
          <div className="mc2-week" aria-hidden="true">
            {Array.from({ length: 12 }, (_, index) => (
              <i key={index} className={`mc2-seg ${index < game.week ? "on" : ""}`} />
            ))}
          </div>
        </div>
        <div className="mc2-purse">
          <span><Icon name="gold" /> <b>{game.company.gold}</b> {deltaGold ? <em className={deltaGold > 0 ? "mc2-delta up" : "mc2-delta down"}>{deltaGold > 0 ? `+${deltaGold}` : deltaGold}</em> : null}</span>
          <span><Icon name="bread" /> <b>{game.company.bread}</b> {deltaBread ? <em className={deltaBread > 0 ? "mc2-delta up" : "mc2-delta down"}>{deltaBread > 0 ? `+${deltaBread}` : deltaBread}</em> : null}</span>
        </div>
        <span className={`mc2-token ${game.moveUsed ? "spent" : ""}`}>Move</span>
        <span className={`mc2-token ${game.actionUsed ? "spent" : ""}`}>Action</span>
        <div className="mc2-actions">
          <button onClick={() => setSeals(true)}>Seals</button>
          <button onClick={() => setLedger(true)}>Ledger</button>
          <button className="mc2-end" disabled={busy} onClick={() => void endTurn()}>{busy ? "…" : "End turn"}</button>
        </div>
      </header>

      <div className="mc2-shell">
        <aside className="mc2-rail left">
          <p className="mc2-display">{game.company.name}</p>
          {game.company.hidden && <p><Icon name="cloak" /> Hidden</p>}
          {game.company.units.map((unit) => (
            <article key={unit.id} className={`mc2-card ${openUnit === unit.id ? "open" : ""}`}>
              <header>
                <button onClick={() => setOpenUnit(openUnit === unit.id ? null : unit.id)}>
                  <b className="mc2-display">{unit.headcount > 0 ? unit.name : "Empty"}</b>
                </button>
                <span>{unit.headcount || ""}</span>
              </header>
              {unit.headcount > 0 && (
                <>
                  <div className="mc2-pips">
                    {Array.from({ length: 10 }, (_, index) => (
                      <i key={index} className={`mc2-pip ${index < unit.headcount - unit.wounded ? "full" : ""} ${index >= unit.headcount - unit.wounded && index < unit.headcount ? "hurt" : ""}`} />
                    ))}
                  </div>
                  <div className="mc2-bar" title={unit.stance}><span style={{ width: `${stanceWidth(unit.stance)}%` }} /></div>
                  <div className={`mc2-bar ${unit.morale < 30 ? "loss" : ""}`}><span style={{ width: `${unit.morale}%` }} /></div>
                  <div className={`mc2-bar ${unit.condition < 40 ? "warn" : ""}`}><span style={{ width: `${unit.condition}%` }} /></div>
                  {unit.permanence === "temporary" && <p><Icon name="hourglass" /> {unit.leaveCondition}</p>}
                </>
              )}
              {openUnit === unit.id && unit.headcount > 0 && (
                <div>
                  <p>{unit.nameMeaning}</p>
                  <p>{unit.traits.join(" · ") || "No trait yet."}</p>
                  <p>{unit.historyText}</p>
                  <label>Wage {unit.wageBreadPerDay} bread / day
                    <input type="range" min={0} max={4} value={unit.wageBreadPerDay} onChange={(event) => setGame(setWage(game, unit.id, Number(event.target.value)))} />
                  </label>
                  <div className="mc2-actions">
                    {(["aggressive", "holding", "skirmish", "unready"] as Stance[]).map((stance) => (
                      <button key={stance} onClick={() => setGame(setStance(game, unit.id, stance))}>{stance}</button>
                    ))}
                  </div>
                </div>
              )}
            </article>
          ))}
        </aside>

        <section className="mc2-map" aria-label="Hollowmere">
          {game.locations.map((location) => {
            const spot = SPOT[location.id];
            const store = game.stores.find((item) => item.locationId === location.id);
            const marked = game.report?.markers.find((marker) => marker.locationId === location.id);
            return (
              <button
                key={location.id}
                className={`mc2-node ${location.id === game.locationId ? "here" : ""} ${reach.includes(location.id) ? "reach" : ""}`}
                style={spot}
                onClick={() => {
                  if (reach.includes(location.id)) setGame(move(game, location.id));
                }}
              >
                <b className="mc2-display">{location.name}</b>
                <small>{location.nameMeaning}</small>
                {store && (
                  <div className="mc2-store mc2-bar"><span style={{ width: `${Math.min(100, (store.bread / store.breadCap) * 100)}%` }} /></div>
                )}
                {marked && <small><Icon name={marked.kind === "column" ? "column" : marked.kind === "smoke" ? "smoke" : "quest"} /> {marked.label}</small>}
              </button>
            );
          })}
        </section>

        <aside className="mc2-rail right">
          <p className="mc2-display">{here?.name}</p>
          {game.places.filter((item) => item.locationId === game.locationId).map((item) => {
            const flagged = [...game.npcs, ...game.groups].some((body) => ("placeId" in body ? body.placeId === item.id : false) && game.talkFlags.some((flag) => flag.npcOrGroupId === body.id && flag.wantsToTalk));
            return (
              <button key={item.id} className={`mc2-place ${place?.id === item.id ? "on" : ""}`} onClick={() => { setPlaceId(item.id); setForm(null); }}>
                {item.name}
                {flagged && <span className="mc2-mark"><Icon name="exclamation" /></span>}
              </button>
            );
          })}
          {place && (
            <div className="mc2-card">
              {peopleHere.map((body) => {
                const flag = game.talkFlags.find((item) => item.npcOrGroupId === body.id && item.wantsToTalk);
                const level = disposition(game, body.id)?.level;
                return (
                  <p key={body.id}>
                    <span className="mc2-bust">{body.name.slice(0, 1)}</span>
                    <button onClick={() => setTalk(body.id)}>{body.name}</button>
                    <Face level={level} />
                    {flag && <span className="mc2-mark" title={flag.reason}><Icon name="exclamation" /></span>}
                  </p>
                );
              })}
              <div className="mc2-actions">
                {actions.map((action) => (
                  <button key={action.id} className={action.spends ? "spend" : ""} disabled={action.spends && game.actionUsed} onClick={() => runAction(action.id)}>
                    {action.label}
                  </button>
                ))}
              </div>
              {place.name.toLowerCase().includes("merchant") || place.id === "cm-market" ? (
                <div className="mc2-actions">
                  <button onClick={() => {
                    const seller = game.npcs.find((npc) => npc.placeId === place.id);
                    if (!seller) return;
                    const bought = trade(game, seller.id, 50, "buy");
                    setGame(bought.state);
                    setQmLine(bought.note);
                  }}>Buy 50 bread</button>
                  <button onClick={() => {
                    const seller = game.npcs.find((npc) => npc.placeId === place.id);
                    if (!seller) return;
                    const sold = trade(game, seller.id, 50, "sell");
                    setGame(sold.state);
                    setQmLine(sold.note);
                  }}>Sell 50 bread</button>
                </div>
              ) : null}
              {game.company.goods.length > 0 && (
                <div className="mc2-actions">
                  {game.company.goods.map((good) => (
                    <button key={good.id} onClick={() => setGame(sellGood(game, good.id))}>Sell {good.name} ({good.qty})</button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="mc2-dock">
            <p className="mc2-display">Quartermaster</p>
            <p>{qmLine}</p>
            <textarea value={qm} rows={2} onChange={(event) => setQm(event.target.value)} placeholder="How do I find the bandits?" />
            <button onClick={askQm}>Ask</button>
          </div>
        </aside>
      </div>

      {game.tutorial !== null && game.tutorial < COACH.length && (
        <div className="mc2-coach">
          <p>{COACH[game.tutorial]}</p>
          <div className="mc2-actions">
            {game.tutorial === 3 && <button onClick={onBarn}>The barn</button>}
            <button onClick={() => setGame({ ...game, tutorial: (game.tutorial ?? 0) + 1 })}>Next</button>
            <button onClick={onSkipTutorial}>Skip</button>
          </div>
        </div>
      )}

      {form && !game.showReport && (
        <div className="mc2-panel">
          <button onClick={() => setForm(null)}>Close</button>
          <h2 className="mc2-display">{form}</h2>
          {form === "recruit" && (
            <>
              <textarea rows={4} value={speech} onChange={(event) => setSpeech(event.target.value)} placeholder="The speech they will hear" />
              <div className="mc2-actions">
                {["We pay two loaves and we bury our own.", "We're going into the wood after the men who took your grain.", "Shield, spear, and a wage."].map((template) => (
                  <button key={template} onClick={() => setSpeech(template)}>{template}</button>
                ))}
              </div>
              {game.groups.filter((group) => group.placeId === place?.id && group.recruitable).map((group) => (
                <button key={group.id} className="spend" disabled={game.actionUsed} onClick={() => act({ kind: "recruit", groupId: group.id, speech })}>
                  Pitch {group.name}
                </button>
              ))}
            </>
          )}
          {form === "train" && (
            <>
              <textarea rows={3} value={speech} onChange={(event) => setSpeech(event.target.value)} placeholder="How they train" />
              <button className="spend" disabled={game.actionUsed} onClick={() => act({ kind: "train", unitIds: game.company.units.filter((unit) => unit.headcount > 0).slice(0, 2).map((unit) => unit.id), drill: speech || "Close order", master: place?.id === "cm-barracks" })}>
                Train two units{place?.id === "cm-barracks" ? " with the Master" : ""}
              </button>
            </>
          )}
          {form === "rest" && (
            <div className="mc2-actions">
              <button className="spend" disabled={game.actionUsed} onClick={() => act({ kind: "rest", source: "own", force: false })}>Own bread</button>
              <button className="spend" disabled={game.actionUsed} onClick={() => act({ kind: "rest", source: "requisition", force: false })}>Requisition</button>
              <button className="spend" disabled={game.actionUsed} onClick={() => act({ kind: "rest", source: "requisition", force: true })}>Take it by force</button>
            </div>
          )}
          {(form === "search" || here?.kind === "wilderness") && form === "search" && (
            <>
              <textarea rows={2} value={speech} onChange={(event) => setSpeech(event.target.value)} placeholder="What you are looking for" />
              <div className="mc2-hexes">
                {game.hexes.filter((hex) => hex.wildernessId === game.locationId).map((hex) => (
                  <button key={hex.id} className={`mc2-hex ${hex.searchedCount ? "searched" : ""}`} disabled={game.actionUsed} onClick={() => act({ kind: "search", hexId: hex.id, lookingFor: speech || "bandit camp" })}>
                    <b>{hex.label}</b>
                    <small>{hex.found.join(", ")}</small>
                  </button>
                ))}
              </div>
            </>
          )}
          {(form === "fight-pack" || form === "fight-wolves" || form === "fight-thornback" || form === "attack-crown" || form === "ambush" || form === "fight") && (
            <>
              <textarea rows={4} value={plan} onChange={(event) => setPlan(event.target.value)} />
              <button className="spend" disabled={game.actionUsed} onClick={() => {
                const forceId = form === "fight-pack" ? "force-pack" : form === "fight-wolves" ? "force-wolves" : form === "fight-thornback" ? "force-thornback" : form === "attack-crown" ? "cm-guards" : game.forces.find((force) => force.locationId === game.locationId && force.id !== game.company.forceId && force.alive)?.id ?? "force-pack";
                act(form === "ambush" ? { kind: "ambush", forceId, plan } : { kind: "fight", forceId, plan });
              }}>Commit the plan</button>
            </>
          )}
          {form === "refuge" && (
            <>
              <textarea rows={2} value={speech} onChange={(event) => setSpeech(event.target.value)} placeholder="What you offer for shelter" />
              <button className="spend" disabled={game.actionUsed} onClick={() => act({ kind: "refuge", offer: speech })}>Ask</button>
            </>
          )}
          {form === "drink" && (
            <>
              <p>{CONFIG.innMessages - inn.length} words left at the table.</p>
              <div className="mc2-chat">{inn.map((item, index) => <p key={index}>{item}</p>)}</div>
              <div className="mc2-chat">{game.company.rumours.slice(-3).map((rumour) => <p key={rumour.id}><Icon name="rumour" /> {rumour.text}</p>)}</div>
              <textarea rows={2} value={line} onChange={(event) => setLine(event.target.value)} />
              <button onClick={drinkLine} disabled={inn.length >= CONFIG.innMessages}>Speak</button>
            </>
          )}
          {form === "pillage" || form === "pillage-crown" ? (
            <button className="spend" disabled={game.actionUsed} onClick={() => act({ kind: "pillage", locationId: game.locationId })}>Pillage</button>
          ) : null}
        </div>
      )}

      {talk && !game.showReport && (
        <div className="mc2-panel">
          <button onClick={() => setTalk(null)}>Close</button>
          <h2 className="mc2-display">{game.npcs.find((npc) => npc.id === talk)?.name ?? game.groups.find((group) => group.id === talk)?.name}</h2>
          <p>{game.npcs.find((npc) => npc.id === talk)?.role}</p>
          <div className="mc2-chat">
            {game.messages.filter((message) => message.who === (game.npcs.find((npc) => npc.id === talk)?.name ?? game.groups.find((group) => group.id === talk)?.name) || message.role === "player").slice(-8).map((message) => (
              <p key={message.id}><b>{message.who}. </b>{message.text}</p>
            ))}
          </div>
          {game.deals.filter((deal) => deal.npcId === talk && deal.status === "offered").map((deal) => (
            <div key={deal.id} className="mc2-deal">
              <p>{deal.note}</p>
              <p>{deal.gold} gold · {deal.upfrontGold} now {deal.dueWeek ? `· due week ${deal.dueWeek}` : ""}</p>
              <div className="mc2-actions">
                <button onClick={() => setGame(acceptDeal(game, deal.id))}>Accept</button>
                <input value={counter} onChange={(event) => setCounter(event.target.value)} placeholder="Up front" />
                <button onClick={() => setGame(counterDeal(game, deal.id, Number(counter) || 0))}>Counter</button>
                <button onClick={() => setGame({ ...game, deals: game.deals.map((item) => item.id === deal.id ? { ...item, status: "declined" } : item) })}>Decline</button>
              </div>
            </div>
          ))}
          {screenIntent(line, place?.id ?? "") && <p>This sounds like an action: {screenIntent(line, place?.id ?? "")}</p>}
          <textarea rows={3} value={line} onChange={(event) => setLine(event.target.value)} />
          <button disabled={busy} onClick={() => void say(talk)}>Speak</button>
        </div>
      )}

      {game.showReport && game.report && (
        <div className="mc2-panel report">
          <div className="mc2-spread">
            <section>
              <h2 className="mc2-display">The company</h2>
              {game.report.unitDeltas.map((delta) => (
                <p key={delta.unitId}>{delta.name} {signed(delta.headcount)} men, morale {signed(delta.morale)}, condition {signed(delta.condition)}</p>
              ))}
              <p><Icon name="gold" /> {game.report.gold} ({signed(game.report.goldDelta)}) <Icon name="bread" /> {game.report.bread} ({signed(game.report.breadDelta)})</p>
              {game.report.causes.map((cause) => <p key={cause.label}>{cause.label} {cause.gold ? `${signed(cause.gold)} gold` : ""} {cause.bread ? `${signed(cause.bread)} bread` : ""}</p>)}
            </section>
            <section>
              <h2 className="mc2-display">The kingdom</h2>
              {game.report.stores.map((store) => (
                <p key={store.locationId}>{store.name}
                  <span className="mc2-bar"><span style={{ width: `${Math.min(100, (store.bread / store.cap) * 100)}%` }} /></span>
                </p>
              ))}
              {game.report.markers.map((marker) => <p key={marker.label}><Icon name={marker.kind === "column" ? "column" : "smoke"} /> {marker.label}</p>)}
              {game.report.shifts.map((shift) => (
                <p key={shift.holderId}><Face level={shift.from} /> → <Face level={shift.to} /> {shift.holderId}</p>
              ))}
              {game.report.volunteers.map((volunteer) => (
                <div key={volunteer.id} className="mc2-deal">
                  <p>{volunteer.count} offered from {volunteer.groupId}. {volunteer.skills} {volunteer.permanence === "temporary" ? `· ${volunteer.conditionText}` : "· to stay"}</p>
                  <div className="mc2-actions">
                    <button onClick={() => setGame(acceptVolunteer(game, volunteer.id))}>Accept</button>
                    <button onClick={() => setGame(declineVolunteer(game, volunteer.id))}>Decline</button>
                  </div>
                </div>
              ))}
            </section>
          </div>
          <button onClick={() => setStoryOpen(!storyOpen)}>{storyOpen ? "Hide the telling" : "The telling"}</button>
          {storyOpen && game.report.story.map((lineItem) => <p key={lineItem}>{lineItem}</p>)}
          {lastBattle && (
            <div className="mc2-card">
              <p>{lastBattle.highlights.join(" · ")}</p>
              <p>{lastBattle.narrative}</p>
            </div>
          )}
          <button className="mc2-end" onClick={() => setGame({ ...game, showReport: false })}>To the week</button>
        </div>
      )}

      {seals && (
        <div className="mc2-panel">
          <button onClick={() => setSeals(false)}>Close</button>
          <h2 className="mc2-display">Seal case</h2>
          {game.achievements.map((seal) => (
            <span key={seal.id} className={`mc2-seal ${seal.earnedWeek === undefined ? "blank" : ""}`}>
              {seal.earnedWeek === undefined && seal.hidden ? "" : seal.name}
            </span>
          ))}
        </div>
      )}

      {ledger && (
        <div className="mc2-panel">
          <button onClick={() => setLedger(false)}>Close</button>
          <h2 className="mc2-display">Ledger</h2>
          {game.ledger.length === 0 && <p>Nothing owed either way.</p>}
          {game.ledger.map((entry) => (
            <p key={entry.id} className={entry.status === "overdue" ? "mc2-loss" : ""}>
              {entry.npcId} {entry.direction === "player_owes" ? "you owe" : "owes you"} {entry.amount} {entry.currency}
              {entry.dueWeek ? ` · week ${entry.dueWeek}` : ""} · {entry.status}. {entry.note}
            </p>
          ))}
          <h2>Quests</h2>
          {game.quests.filter((quest) => quest.status !== "locked").map((quest) => (
            <p key={quest.id}><Icon name="quest" /> {quest.title} — {quest.status}. {quest.termsText}</p>
          ))}
        </div>
      )}
    </main>
  );

  function runAction(id: string) {
    if (id === "hide") return act({ kind: "hide" });
    if (id === "repair") return act({ kind: "repair" });
    if (id === "fields") return act({ kind: "work", job: "fields" });
    if (id === "merchant-guard") return act({ kind: "work", job: "merchant" });
    if (id === "guard-village") return act({ kind: "work", job: "guard-village" });
    if (id === "guard-city") return act({ kind: "work", job: "guard-city" });
    if (id === "pillage" || id === "pillage-crown") return setForm("pillage");
    setForm(id);
  }
}

function stanceWidth(stance: Stance): number {
  if (stance === "aggressive") return 100;
  if (stance === "holding") return 70;
  if (stance === "skirmish") return 40;
  return 15;
}

function signed(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}
