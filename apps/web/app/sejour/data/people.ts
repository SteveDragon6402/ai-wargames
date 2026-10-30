export interface Person {
  id: string;
  name: string;
  young: boolean;
  place: string;
  blurb: string;
  image: string;
}

export const PEOPLE: Person[] = [
  { id: "lea", name: "Léa", young: true, place: "the bakery counter", image: "/sejour/places/bakery.jpg", blurb: "Seventeen, works Saturdays at the bakery, talks fast, laughs at her own jokes." },
  { id: "marc", name: "Marc", young: true, place: "the football pitch", image: "/sejour/places/pitch.jpg", blurb: "Twenty-two, plays for the village side, a bit shy until football comes up." },
  { id: "ines", name: "Inès", young: true, place: "the library", image: "/sejour/places/library.jpg", blurb: "Nineteen, studies in the city and comes home at weekends, dry sense of humour." },
  { id: "paul", name: "Paul", young: true, place: "the river", image: "/sejour/places/river.jpg", blurb: "Sixteen, fishes with his uncle, curious, asks blunt questions." },
  { id: "chloe", name: "Chloé", young: true, place: "the café", image: "/sejour/places/cafe.jpg", blurb: "Twenty-four, pulls espresso, collects vinyl, a little sarcastic." },
  { id: "henri", name: "Henri", young: false, place: "the square", image: "/sejour/places/square.jpg", blurb: "Sixty-eight, retired postman, knows every street and will tell you." },
  { id: "monique", name: "Monique", young: false, place: "the church steps", image: "/sejour/places/church.jpg", blurb: "Seventy-four, sings in the choir, warm, corrects your French without meaning to." },
  { id: "yves", name: "Yves", young: false, place: "the allotments", image: "/sejour/places/allotment.jpg", blurb: "Sixty-one, grows tomatoes he is proud of, slow talker." },
  { id: "nadine", name: "Nadine", young: false, place: "the market stall", image: "/sejour/places/market.jpg", blurb: "Fifty-five, sells cheese two days a week, direct, a little loud." },
  { id: "luc", name: "Luc", young: false, place: "the garage", image: "/sejour/places/garage.jpg", blurb: "Forty-eight, fixes scooters, short sentences, kind underneath." },
];

export const PERSON_BY_ID: Record<string, Person> = Object.fromEntries(PEOPLE.map((person) => [person.id, person]));

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Three people for the evening. Unmet ones come first, unless everyone has been met. */
export function pickFriends(day: number, met: readonly string[]): string[] {
  const random = mulberry32(day * 997 + 13);
  const seen = new Set(met);
  const unmet = PEOPLE.filter((person) => !seen.has(person.id));
  const pool = (unmet.length >= 3 ? unmet : PEOPLE).map((person) => person.id);
  const bag = [...pool];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag.slice(0, 3);
}
