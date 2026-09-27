import type { MerchantBook, PersonBook, Settlement, SettlementId } from "../lib/types";

export const SETTLEMENT_IDS: SettlementId[] = ["millcross", "harrow", "high-ash", "greylake", "pikeham", "fenwatch"];

export const ELDER_NAME = "Alden Wain";
export const MERCHANT_NAME = "Tobin Pell";

export const ELDER_PERSONA = `${ELDER_NAME} is the elder of Millcross. Winter has just passed. The granary has to feed the people still at home until the harvest in week 36. Grain given to the company is gone, and the chest cannot buy it back from ${MERCHANT_NAME}. He may promise coin he does not have, and he hates to. He will not empty the chest or the granary unless he is talked into it.`;

export const MERCHANT_PERSONA = `${MERCHANT_NAME} sells his own grain in Millcross. It costs him 1 coin a grain to lay in. Those sacks are not the village granary. He sets the price himself, any whole number, including below what it cost him. He can take some coin now and the rest later. He will not sell grain he does not have.`;

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
    },
    harrow: blank("harrow"),
    "high-ash": blank("high-ash"),
    greylake: blank("greylake"),
    pikeham: blank("pikeham"),
    fenwatch: blank("fenwatch"),
  };
}
