/** Prices as a shopkeeper would say them. Digits never reach the learner. */

function underHundred(n: number): string {
  const ones = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize"];
  if (n < 17) return ones[n] ?? "zéro";
  if (n < 20) return `dix-${ones[n - 10]}`;
  const tens = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];
  const ten = Math.floor(n / 10);
  const unit = n % 10;
  if (ten === 7) {
    const rest = n - 60;
    return rest === 11 ? "soixante et onze" : `soixante-${underHundred(rest)}`;
  }
  if (ten === 9) return `quatre-vingt-${underHundred(n - 80)}`;
  if (ten === 8) return unit === 0 ? "quatre-vingts" : `quatre-vingt-${ones[unit]}`;
  if (unit === 0) return tens[ten] ?? "zéro";
  if (unit === 1) return `${tens[ten]} et un`;
  return `${tens[ten]}-${ones[unit]}`;
}

export function frenchNumber(n: number): string {
  const value = Math.max(0, Math.round(n));
  if (value < 100) return underHundred(value);
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  const head = hundreds === 1 ? "cent" : `${underHundred(hundreds)} cent${rest === 0 ? "s" : ""}`;
  return rest === 0 ? head : `${head} ${underHundred(rest)}`;
}

/** Cents, said the way a till is read out: "quatre euros quarante". */
export function eurosInWords(cents: number): string {
  const amount = Math.max(0, Math.round(cents));
  const euros = Math.floor(amount / 100);
  const centimes = amount % 100;
  if (euros === 0 && centimes === 0) return "zéro euro";
  if (euros === 0) return `${frenchNumber(centimes)} centime${centimes > 1 ? "s" : ""}`;
  const euroPart = euros === 1 ? "un euro" : `${frenchNumber(euros)} euros`;
  if (centimes === 0) return euroPart;
  return `${euroPart} ${frenchNumber(centimes)}`;
}

function moneyFrom(euros: string, centimes: string): string {
  const cents = centimes.padEnd(2, "0").slice(0, 2);
  return eurosInWords(Number(euros) * 100 + Number(cents));
}

/** Rewrite digit prices in a spoken line. Leaves every other word alone. */
export function spellMoneyInSpeech(line: string): string {
  return line
    .replace(/€\s*(\d{1,3})\s*[,.]\s*(\d{1,2})/gi, (_, euros: string, centimes: string) => moneyFrom(euros, centimes))
    .replace(/(\d{1,3})\s*[,.]\s*(\d{1,2})\s*(?:€|euros?)?/gi, (_, euros: string, centimes: string) => moneyFrom(euros, centimes))
    .replace(/(\d{1,3})\s*euros?(?:\s*(?:et\s*)?(\d{1,2})\s*centimes?)?/gi, (_, euros: string, centimes?: string) =>
      centimes ? moneyFrom(euros, centimes) : eurosInWords(Number(euros) * 100),
    )
    .replace(/(\d{1,3})\s*centimes?/gi, (_, centimes: string) => eurosInWords(Number(centimes)));
}
