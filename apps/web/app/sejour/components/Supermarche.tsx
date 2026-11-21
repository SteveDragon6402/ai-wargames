"use client";

import { useRef, useState } from "react";
import { ITEM_BY_ID, ITEMS, itemIcon, STAPLES, type ShopItem } from "@/app/epicerie/data/items";
import { PaymentTray, Purse } from "@/app/epicerie/components/Money";
import { eurosInWords } from "@/app/epicerie/lib/money-words";
import { formatEuros, linesTotal, mergeLines, pay, sumCoins, type Line, type Turn } from "@/app/epicerie/lib/shop";
import { hear, type TalkReply, type TalkTurn } from "../lib/voice";
import { basketCovers, type Recipe } from "../world/recipes";
import { Conversation, type PaymentEvent } from "./Conversation";

interface SupermarcheProps {
  recipe: Recipe;
  purse: number[];
  memory?: string;
  listening: boolean;
  knownIds?: readonly string[];
  onMeet?: (id: string) => void;
  onPhrase: (phrases: { fr: string; en: string }[], source: string) => void;
  onDone: (turns: Turn[], basket: Line[], purse: number[]) => void;
}

const AISLES: { id: string; titleFr: string; titleEn: string; ids: string[] }[] = [
  {
    id: "primeur",
    titleFr: "🥬 Rayon Fruits, Légumes & Herbes",
    titleEn: "Produce & Herbs Aisle",
    ids: ["tomatoes", "mushrooms", "onion", "garlic", "apples", "lemon", "bay"],
  },
  {
    id: "cremerie",
    titleFr: "🧀 Rayon Crèmerie, Œufs & Boulangerie",
    titleEn: "Dairy, Eggs & Bakery Aisle",
    ids: ["butter", "eggs", "milk", "camembert", "baguette", "croissant"],
  },
  {
    id: "epicerie",
    titleFr: "🍯 Rayon Épicerie & Maison",
    titleEn: "Pantry & Household Aisle",
    ids: ["oil", "honey", "chocolate", "sardines", "wine", "soap", "candle", "envelope"],
  },
];

const LABEL_NOTES: Record<string, string> = {
  butter: "Beurre doux gastronomique · 82% Mat. Gr. · À conserver au frais (+4°C).",
  oil: "Huile d'olive vierge extra · Première pression à froid.",
  bay: "Feuilles de laurier séchées · Idéal pour soupes et sauces.",
  eggs: "Œufs frais de poules élevées en plein air · Calibre moyen.",
  milk: "Lait entier pasteurisé · Bouteille d'un litre · Origine France.",
  camembert: "Camembert moulé à la louche · Au lait cru de Normandie.",
  baguette: "Baguette de campagne cuite au fournil du magasin.",
  croissant: "Croissant pur beurre doré au four.",
  tomatoes: "Tomates grappes mûries au soleil · Catégorie I · Origine Val de Loire.",
  mushrooms: "Champignons de Paris blancs frais · Lavés prêts à cuisiner.",
  onion: "Oignon jaune de cuisine · Récolte locale.",
  garlic: "Ail blanc séché · Tête entière.",
  apples: "Pommes croquantes et sucrées · Variété Golden / Gala.",
  lemon: "Citron jaune non traité après récolte.",
  honey: "Miel de fleurs sauvages · Récolté en France.",
  sardines: "Sardines entières à l'huile d'olive · Pêchées en Atlantique.",
  chocolate: "Chocolat noir de dégustation · 70% cacao minimum.",
  wine: "Vin rouge de table · Côtes de la Loire · 75 cl.",
  soap: "Véritable savon de Marseille à l'huile végétale.",
  candle: "Bougie blanche de ménage · Longue durée.",
  envelope: "Enveloppe blanche format standard.",
};

const ALL_SUPERMARCHE_ITEMS: ShopItem[] = [...ITEMS, ...STAPLES];

export function Supermarche({
  recipe,
  purse: initialPurse,
  memory = "",
  listening,
  knownIds = [],
  onMeet,
  onPhrase,
  onDone,
}: SupermarcheProps) {
  const [aisleId, setAisleId] = useState<string>(AISLES[0].id);
  const [selectedId, setSelectedId] = useState<string>(recipe.lines[0]?.itemId ?? "butter");
  const [basket, setBasket] = useState<Line[]>([]);
  const [purse, setPurse] = useState<number[]>(initialPurse);
  const [stage, setStage] = useState<"aisles" | "checkout">("aisles");
  const [paid, setPaid] = useState(false);
  const [payNotice, setPayNotice] = useState<string | null>(null);
  const [cashierTurns, setCashierTurns] = useState<TalkTurn[]>([]);
  const [paymentEvent, setPaymentEvent] = useState<PaymentEvent | null>(null);
  const payTrayRef = useRef<HTMLDivElement>(null);

  const selectedItem = ITEM_BY_ID[selectedId] ?? ALL_SUPERMARCHE_ITEMS[0];
  const currentAisle = AISLES.find((a) => a.id === aisleId) ?? AISLES[0];
  const basketTotal = linesTotal(basket);
  const basketCount = basket.reduce((sum, l) => sum + l.qty, 0);
  const gotRecipeItems = basketCovers(basket, recipe.lines);

  function addToBasket(item: ShopItem) {
    setPaid(false);
    setBasket((curr) => mergeLines(curr, [{ itemId: item.id, qty: 1 }]));
    onPhrase([{ fr: `${item.word} (${item.unitFr})`, en: item.en }], "Le Supermarché");
  }

  function removeFromBasket(itemId: string) {
    setPaid(false);
    setBasket((curr) =>
      curr
        .map((line) => (line.itemId === itemId ? { ...line, qty: line.qty - 1 } : line))
        .filter((line) => line.qty > 0),
    );
  }

  function buildCheckoutContext(isPaidNow: boolean, extraNote = ""): string {
    return `At the checkout (La Caisse) of the Supermarché de Saint-Aubin. Items in the customer's basket: ${basket
      .map((l) => `${l.qty}x ${ITEM_BY_ID[l.itemId]?.fr ?? l.itemId}`)
      .join(", ")}. Total due: ${formatEuros(basketTotal)}. Paid yet: ${
      isPaidNow
        ? `YES (paid in full: ${formatEuros(basketTotal)})`
        : `NO (still owes ${formatEuros(basketTotal)} — do NOT accept verbal claims of payment and do NOT let them leave with only a partial payment!)`
    }.${extraNote ? ` ${extraNote}` : ""} Greet them warmly ("Bonjour ! Je m'appelle Élodie. Vous avez trouvé tout ce qu'il vous fallait ?"), tell them the total in French words, exactly « ${eurosInWords(basketTotal)} », with no digits, and ask if they need a bag ("Vous voulez un sac ?").`;
  }

  function handlePay(coins: number[]): boolean {
    if (basketTotal <= 0) return true;
    const offered = sumCoins(coins);
    const result = pay(purse, coins, basketTotal);
    if (!result.ok) {
      const missing = basketTotal - offered;
      setPayNotice(
        `❌ Vous avez posé ${eurosInWords(offered)}, ce n'est pas assez ! Le total est de ${eurosInWords(basketTotal)} (il manque ${eurosInWords(missing)}).`,
      );
      setPaymentEvent({
        id: Date.now(),
        shown: `[Put down ${eurosInWords(offered)} — short of ${eurosInWords(basketTotal)}]`,
        prompt: `[The customer put ${formatEuros(offered)} on the checkout counter, which is SHORT of the ${formatEuros(
          basketTotal,
        )} total (missing ${formatEuros(missing)}). Push the ${formatEuros(offered)} back, call bill, and tell them in French how much they put down (${formatEuros(
          offered,
        )}) and that the total is ${formatEuros(basketTotal)} so ${formatEuros(missing)} is still missing!]`,
        updatedContext: buildCheckoutContext(false, `Customer just tried to pay only ${formatEuros(offered)} on a ${formatEuros(basketTotal)} basket.`),
      });
      return true;
    }
    setPurse(result.purse);
    setPaid(true);
    const change = sumCoins(result.change);
    setPayNotice(
      change > 0
        ? `✅ Payé ${eurosInWords(result.paid)} pour ${eurosInWords(basketTotal)} ! La caissière vous rend ${formatEuros(change)} de monnaie et votre ticket de caisse.`
        : `✅ Payé ${eurosInWords(result.paid)} ! Compte exact. Voici votre ticket de caisse !`,
    );
    setPaymentEvent({
      id: Date.now(),
      shown: `[Handed over ${eurosInWords(result.paid)}${change ? ` · received ${formatEuros(change)} change` : ""}]`,
      prompt: `[The customer handed over ${formatEuros(result.paid)} to pay the ${formatEuros(basketTotal)} basket total.${
        change ? ` You gave them ${formatEuros(change)} in change.` : " Exact change."
      } The total of ${formatEuros(basketTotal)} is now PAID IN FULL. Thank them warmly in French, mention the change if any, and wish them bonne journée et bonne cuisine!]`,
      updatedContext: buildCheckoutContext(true),
    });
    return true;
  }

  function handleCashierReply(reply: TalkReply, history: TalkTurn[]) {
    setCashierTurns(history);
    if (reply.phrases.length) onPhrase(reply.phrases, "Le Supermarché");
  }

  function finishSupermarche(history: TalkTurn[]) {
    const finalTurns = history.length ? history : cashierTurns;
    const shopTurns: Turn[] = finalTurns.map((t) => ({
      role: t.who === "you" ? "you" : "gerard",
      text: t.text,
    }));
    onDone(shopTurns, basket, purse);
  }

  const qtyInBasket = basket.find((l) => l.itemId === selectedItem.id)?.qty ?? 0;

  return (
    <section aria-label="Le Supermarché" data-voice="caissiere">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/sejour/places/market.jpg" alt="Le Supermarché" className="sj-photo" />
      <div className="sj-sheet">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[12px] uppercase tracking-widest text-[var(--ep-ink-soft)]">
              Libre-service · {stage === "aisles" ? "Dans les rayons" : "À la caisse"}
            </p>
            <h2 className="ep-display text-[28px]">🛒 Supermarché de Saint-Aubin</h2>
          </div>
          {stage === "aisles" ? (
            <button
              type="button"
              disabled={basketCount === 0}
              className="ep-button ep-primary disabled:opacity-50"
              onClick={() => setStage("checkout")}
            >
              🧾 Passer à la caisse ({basketCount} article{basketCount > 1 ? "s" : ""} · {eurosInWords(basketTotal)}) →
            </button>
          ) : (
            <button type="button" className="ep-button" onClick={() => setStage("aisles")}>
              ← Retourner dans les rayons
            </button>
          )}
        </div>

        {stage === "aisles" ? (
          <div className="mt-3 space-y-4">
            <p className="rounded-lg bg-white/70 px-3 py-2 text-[14px] text-[var(--ep-ink-soft)]">
              🏷️ <strong>Self-Service Supermarket:</strong> Click any product on the shelves to inspect its French label (<em>étiquette</em>) and add it directly to your basket.
            </p>

            {/* Aisle selector tabs */}
            <div className="flex flex-wrap gap-2">
              {AISLES.map((aisle) => (
                <button
                  key={aisle.id}
                  type="button"
                  className={`ep-button text-[14px] ${aisleId === aisle.id ? "ep-primary" : ""}`}
                  onClick={() => setAisleId(aisle.id)}
                >
                  {aisle.titleFr}
                </button>
              ))}
            </div>

            {/* Shelf grid for the current aisle */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {currentAisle.ids.map((id) => {
                const item = ITEM_BY_ID[id];
                if (!item) return null;
                const count = basket.find((l) => l.itemId === item.id)?.qty ?? 0;
                const isSelected = selectedItem.id === item.id;
                const neededQty = recipe.lines.find((l) => l.itemId === item.id)?.qty ?? 0;
                return (
                  <div
                    key={item.id}
                    className={`flex flex-col justify-between rounded-xl border p-3 transition ${
                      isSelected
                        ? "border-amber-700 bg-amber-50/95 ring-2 ring-amber-600/30"
                        : "border-black/15 bg-white/85 hover:bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      className="flex flex-col items-center text-center"
                      onClick={() => {
                        setSelectedId(item.id);
                        void hear("caissiere", item.word, "any");
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={itemIcon(item.id)} alt="" className="h-14 w-14 object-contain" />
                      <span className="mt-1.5 text-[15px] font-bold text-stone-900">{item.word}</span>
                      <span className="text-[12px] text-[var(--ep-ink-soft)]">
                        {eurosInWords(item.price)} / {item.unitFr}
                      </span>
                      {neededQty > 0 ? (
                        <span className="mt-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                          Recette : {count}/{neededQty}
                        </span>
                      ) : null}
                    </button>
                    <div className="mt-2.5 flex items-center justify-center gap-1.5 border-t border-black/10 pt-2">
                      <button
                        type="button"
                        className="rounded-lg bg-amber-900 px-2.5 py-1 text-[12px] font-semibold text-amber-50 hover:bg-amber-800"
                        onClick={() => {
                          setSelectedId(item.id);
                          addToBasket(item);
                        }}
                      >
                        + Panier {count > 0 ? `(${count})` : ""}
                      </button>
                      {count > 0 ? (
                        <button
                          type="button"
                          className="rounded-lg border border-black/20 bg-white px-2 py-1 text-[12px] font-semibold hover:bg-stone-100"
                          onClick={() => removeFromBasket(item.id)}
                          aria-label={`Remove one ${item.word}`}
                        >
                          −
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detailed Inspectable French Product Label + Basket & Recipe Sidebar */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border-2 border-amber-900/35 bg-[#fdf9ef] p-4 shadow-sm md:col-span-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={itemIcon(selectedItem.id)} alt="" className="h-16 w-16 object-contain" />
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-900">
                        Étiquette Produit · Supermarché de Saint-Aubin
                      </p>
                      <h3 className="ep-display text-[24px] leading-tight">{selectedItem.word}</h3>
                      <p className="text-[14px] font-medium text-stone-800">
                        Désignation : <strong>{selectedItem.fr}</strong> · Vendu à <strong>{selectedItem.unitFr}</strong>
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-amber-900/30 bg-white px-3 py-1.5 text-right">
                    <p className="text-[10px] uppercase tracking-wider text-stone-500">Prix TTC</p>
                    <p className="text-[20px] font-bold text-stone-900">{eurosInWords(selectedItem.price)}</p>
                  </div>
                </div>

                <p className="mt-2.5 rounded-lg bg-amber-100/60 px-3 py-2 text-[14px] text-stone-800">
                  📋 {LABEL_NOTES[selectedItem.id] ?? "Produit sélectionné · Origine France."}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="ep-button"
                    onClick={() =>
                      void hear(
                        "caissiere",
                        `${selectedItem.word}. ${selectedItem.fr}. ${LABEL_NOTES[selectedItem.id] ?? ""}`,
                        "any",
                      )
                    }
                  >
                    🔊 Lire l&apos;étiquette à voix haute
                  </button>
                  <button
                    type="button"
                    className="ep-button ep-primary"
                    onClick={() => addToBasket(selectedItem)}
                  >
                    🛒 Ajouter au panier ({qtyInBasket} dans le panier)
                  </button>
                  {qtyInBasket > 0 ? (
                    <button
                      type="button"
                      className="ep-button"
                      onClick={() => removeFromBasket(selectedItem.id)}
                    >
                      − Retirer 1
                    </button>
                  ) : null}
                </div>
              </div>

              <aside className="rounded-xl border border-black/15 bg-white/80 p-3.5">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ep-ink-soft)]">
                  Recette : {recipe.fr}
                </p>
                <ul className="mt-1.5 space-y-1 text-[14px]">
                  {recipe.lines.map((req) => {
                    const item = ITEM_BY_ID[req.itemId];
                    const have = basket.find((b) => b.itemId === req.itemId)?.qty ?? 0;
                    const done = have >= req.qty;
                    return (
                      <li key={req.itemId} className="flex items-center justify-between">
                        <span className={done ? "font-semibold text-emerald-900 line-through" : ""}>
                          {done ? "✓ " : "• "}
                          {req.qty} × {item?.word ?? req.itemId}
                        </span>
                        <span className="text-[12px] text-[var(--ep-ink-soft)]">
                          {have}/{req.qty}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {gotRecipeItems ? (
                  <p className="mt-2 rounded bg-emerald-100 px-2.5 py-1 text-[12px] font-semibold text-emerald-950">
                    ✓ Vous avez tous les ingrédients de la recette !
                  </p>
                ) : null}
                <div className="mt-3 border-t border-black/10 pt-2 text-[13px]">
                  <p className="font-semibold">
                    Panier ({basketCount}) : {eurosInWords(basketTotal)}
                  </p>
                </div>
              </aside>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-amber-900/25 bg-white/85 p-3.5">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--ep-ink-soft)]">
                🧾 Tapis de caisse ({basketCount} article{basketCount > 1 ? "s" : ""})
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2 text-[14px]">
                {basket.map((line) => {
                  const item = ITEM_BY_ID[line.itemId];
                  return (
                    <span key={line.itemId} className="rounded-full bg-amber-100/80 px-3 py-1 font-medium">
                      {line.qty} × {item?.word ?? line.itemId} ({eurosInWords((item?.price ?? 0) * line.qty)})
                    </span>
                  );
                })}
              </div>
              <p className="mt-2 text-[16px] font-bold">Total à payer : {eurosInWords(basketTotal)}</p>
            </div>

            {!paid && basketTotal > 0 ? (
              <div ref={payTrayRef} className="mt-3">
                <PaymentTray
                  till={basketTotal}
                  purse={purse}
                  busy={false}
                  onHandOver={handlePay}
                  title={`Régler à la caisse : ${eurosInWords(basketTotal)}`}
                />
              </div>
            ) : (
              <div className="rounded-xl bg-[var(--ep-walnut)] p-3">
                <Purse purse={purse} />
              </div>
            )}

            {payNotice ? (
              <p className="rounded-lg bg-emerald-900/10 p-2.5 text-[14px] font-medium text-emerald-950">
                {payNotice}
              </p>
            ) : null}

            <Conversation
              key="supermarche-cashier"
              title="Élodie"
              portrait="/sejour/people/lea.jpg"
              character="caissiere"
              role="cashier"
              who="caissiere"
              knownIds={knownIds}
              onMeet={onMeet}
              speakFirst
              memory={memory}
              listening={listening}
              context={buildCheckoutContext(paid)}
              paymentEvent={paymentEvent}
              canEnd={paid}
              blockedEndReason={`Your basket total is ${eurosInWords(basketTotal)}. Tap your coins/notes in the Payment Tray above and press "Hand over" to pay at the checkout before leaving!`}
              blockedActionLabel="💶 Scroll to Payment Tray ↑"
              onBlockedAction={() => payTrayRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
              endLabel="🛍️ Prendre le sac et rentrer cuisiner →"
              actionPrompt="✅ Payé à la caisse ! Press here to bring your groceries home:"
              onReply={handleCashierReply}
              onEnd={finishSupermarche}
            />
          </div>
        )}
      </div>
    </section>
  );
}
