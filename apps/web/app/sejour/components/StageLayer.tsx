"use client";

import type { StageCall } from "../world/stage";

const IMAGE_MAP: Record<string, { src: string; captionFr: string; captionEn: string }> = {
  boulangerie: { src: "/sejour/v2/scenes/boulangerie.jpg", captionFr: "La boulangerie de Martine", captionEn: "Martine's bakery" },
  baguette: { src: "/epicerie/items/baguette.png", captionFr: "Une baguette tradition", captionEn: "A traditional baguette" },
  croissant: { src: "/epicerie/items/croissant.png", captionFr: "Un croissant au beurre", captionEn: "A butter croissant" },
  brioche: { src: "/sejour/v2/items/brioche.png", captionFr: "Une brioche dorée", captionEn: "A golden brioche" },
  dining: { src: "/sejour/v2/scenes/dining.jpg", captionFr: "La salle à manger", captionEn: "The dining room" },
  kitchen: { src: "/sejour/v2/scenes/cooking.jpg", captionFr: "La cuisine de Madame Rousseau", captionEn: "Madame Rousseau's kitchen" },
  parc: { src: "/sejour/v2/scenes/parc.jpg", captionFr: "Le parc du village", captionEn: "The village park" },
  dog: { src: "/sejour/v2/scenes/parc.jpg", captionFr: "Pistache le chien", captionEn: "Pistache the dog" },
  cinema: { src: "/sejour/v2/scenes/cinema.jpg", captionFr: "Le cinéma de Saint-Aubin", captionEn: "The village cinema" },
  pharmacie: { src: "/sejour/v2/scenes/pharmacie.jpg", captionFr: "La pharmacie Moreau", captionEn: "Moreau's pharmacy" },
  camille: { src: "/sejour/v2/people/camille.jpg", captionFr: "Camille, la petite-fille de Madame Rousseau", captionEn: "Camille, Madame Rousseau's granddaughter" },
  football: { src: "/sejour/v2/scenes/football.jpg", captionFr: "Le terrain de foot", captionEn: "The football pitch" },
};

export function StageLayer({ stage, onDismiss }: { stage: StageCall | null; onDismiss: () => void }) {
  if (!stage) return null;
  const img = stage.kind === "image" ? IMAGE_MAP[stage.id] : null;
  if (!img) return null;

  return (
    <div className="my-3 flex items-center justify-between gap-3 rounded-xl border border-amber-900/25 bg-white/90 p-3 shadow-md">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img.src} alt={img.captionFr} className="h-16 w-24 rounded-md object-cover" />
        <div>
          <p className="text-[15px] font-semibold">{img.captionFr}</p>
          <p className="text-[13px] text-[var(--ep-ink-soft)]">{img.captionEn}</p>
        </div>
      </div>
      <button type="button" className="ep-button text-[13px]" onClick={onDismiss}>
        Close
      </button>
    </div>
  );
}
