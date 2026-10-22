export interface ListEntry {
  itemId: string;
  qty: number;
  /** How Madame Rousseau wrote it on the note. */
  text: string;
  /** Her extra scribble, shown when you look closer. */
  note: string;
}

export interface DayList {
  title: string;
  entries: ListEntry[];
}

/** Every purse is the same: what Madame Rousseau leaves on the table each morning. */
export const DAILY_PURSE: number[] = [1000, 500, 200, 200, 100, 100, 50, 50, 20, 20, 10, 10, 5, 5];

export const LISTS: DayList[] = [
  {
    title: "Monday",
    entries: [
      { itemId: "baguette", qty: 1, text: "Bread, the long kind", note: "Not the round loaf. The long thin one everyone carries under their arm." },
      { itemId: "eggs", qty: 1, text: "A box of eggs", note: "Six is plenty. For the omelette tonight." },
      { itemId: "lemon", qty: 2, text: "2 lemons", note: "Two. One for the fish, one for my tea." },
      { itemId: "camembert", qty: 1, text: "A round cheese", note: "The soft one in the little wooden box. Ask him, he'll know." },
    ],
  },
  {
    title: "Tuesday",
    entries: [
      { itemId: "croissant", qty: 2, text: "2 croissants", note: "One for you, one for me. Don't eat mine on the walk back." },
      { itemId: "milk", qty: 1, text: "Milk", note: "One bottle." },
      { itemId: "honey", qty: 1, text: "Honey", note: "He gets it from the beekeeper up the hill. Worth every centime." },
      { itemId: "onion", qty: 3, text: "3 onions", note: "Three. Soup tonight." },
    ],
  },
  {
    title: "Wednesday",
    entries: [
      { itemId: "sardines", qty: 1, text: "A tin of sardines", note: "For the cat. Don't tell him it's for the cat." },
      { itemId: "wine", qty: 1, text: "A bottle of red", note: "Nothing fancy, it's for cooking. Mostly." },
      { itemId: "garlic", qty: 1, text: "Garlic", note: "One head is enough." },
      { itemId: "envelope", qty: 2, text: "2 envelopes", note: "Two. I owe the mayor a letter." },
    ],
  },
];

export function listForDay(day: number): DayList {
  return LISTS[((day % LISTS.length) + LISTS.length) % LISTS.length];
}
