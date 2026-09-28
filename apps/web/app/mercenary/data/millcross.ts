import { millcrossPeople } from "./people";
import type { MerchantBook, PersonBook, Settlement, SettlementId } from "../lib/types";

export const SETTLEMENT_IDS: SettlementId[] = ["millcross", "harrow", "high-ash", "greylake", "pikeham", "fenwatch"];

export const ELDER_NAME = "Alden Wain";
export const MERCHANT_NAME = "Tobin Pell";

export const ELDER_PERSONA = `${ELDER_NAME} is the elder of Millcross. Winter has just passed. He keeps the chest, the granary, and the count of men still at home. The harvest is week 36. He is careful with all three. Grain he hands over is gone.`;

export const MERCHANT_PERSONA = `${MERCHANT_NAME} sells his own grain in Millcross. Those sacks are not the village granary. He keeps his coins, what the grain cost him, and the price he has posted.`;

function blankPerson(name = ""): PersonBook {
  return { name, coins: 0, notes: [] };
}

function blankMerchant(): MerchantBook {
  return { name: "", coins: 0, grain: 0, cost: 1, price: null, notes: [] };
}

function blank(id: SettlementId): Settlement {
  return {
    id,
    populated: false,
    mouths: 0,
    granary: 0,
    able: 0,
    elder: blankPerson(),
    merchant: blankMerchant(),
    debts: [],
    nextDebtId: 1,
    muster: null,
    people: [],
    labor: "",
    heard: [],
  };
}

export function freshSettlements(): Record<SettlementId, Settlement> {
  return {
    millcross: {
      ...blank("millcross"),
      populated: true,
      mouths: 50,
      granary: 36 * 50,
      able: 30,
      elder: { name: ELDER_NAME, coins: 200, notes: [] },
      merchant: { name: MERCHANT_NAME, coins: 30, grain: 100, cost: 1, price: null, notes: [] },
      people: millcrossPeople(),
      labor: "The village is tilling.",
    },
    harrow: blank("harrow"),
    "high-ash": blank("high-ash"),
    greylake: blank("greylake"),
    pikeham: blank("pikeham"),
    fenwatch: blank("fenwatch"),
  };
}
