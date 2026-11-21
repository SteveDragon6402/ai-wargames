import type { OutingId } from "../world/places";

export interface Person {
  id: string;
  name: string;
  age: number;
  young: boolean;
  place: string;
  blurb: string;
  image: string;
  portrait: string;
  favoriteOuting: OutingId;
}

/** Five villagers at speed friending, spanning ages and personalities, each with a completely unique portrait. Names stay ??? until they say them. */
export const PEOPLE: Person[] = [
  {
    id: "paul",
    name: "Paul",
    age: 19,
    young: true,
    place: "the river bank",
    image: "/sejour/places/river.jpg",
    portrait: "/sejour/people/paul.jpg",
    blurb: "Nineteen, landscaper's apprentice, easygoing, loves walking his dog Pistache and throwing a frisbee in the park.",
    favoriteOuting: "parc",
  },
  {
    id: "marc",
    name: "Marc",
    age: 22,
    young: true,
    place: "the football pitch",
    image: "/sejour/places/pitch.jpg",
    portrait: "/sejour/people/marc.jpg",
    blurb: "Twenty-two, plays five-a-side for the village club, a bit shy until football comes up.",
    favoriteOuting: "sport",
  },
  {
    id: "chloe",
    name: "Chloé",
    age: 24,
    young: true,
    place: "the café",
    image: "/sejour/places/cafe.jpg",
    portrait: "/sejour/people/chloe.jpg",
    blurb: "Twenty-four, pulls espresso at the café, collects vinyl and old French film posters, a little sarcastic.",
    favoriteOuting: "cinema",
  },
  {
    id: "luc",
    name: "Luc",
    age: 52,
    young: false,
    place: "the small garage",
    image: "/sejour/places/garage.jpg",
    portrait: "/sejour/people/luc.jpg",
    blurb: "Fifty-two, mends scooters and lawnmowers at the village garage, dry humour, patient, walks in the park after work.",
    favoriteOuting: "parc",
  },
  {
    id: "henri",
    name: "Henri",
    age: 68,
    young: false,
    place: "the square",
    image: "/sejour/places/square.jpg",
    portrait: "/sejour/people/henri.jpg",
    blurb: "Sixty-eight, retired postman, knows every street in Saint-Aubin and loves the old village cinema.",
    favoriteOuting: "cinema",
  },
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
  const seen = new Set(met.filter((id) => Boolean(PERSON_BY_ID[id])));
  const unmet = PEOPLE.filter((person) => !seen.has(person.id));
  const pool = (unmet.length >= 3 ? unmet : PEOPLE).map((person) => person.id);
  const bag = [...pool];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag.slice(0, 3);
}
