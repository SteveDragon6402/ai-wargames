"use client";

import { useState } from "react";
import { hear } from "../lib/voice";

interface SignUpFormProps {
  kind: "speedfriending" | "sport";
  initialValues?: Record<string, string>;
  onPhrase?: (phrases: { fr: string; en: string }[], source: string) => void;
  onSubmit: (values: Record<string, string>) => void;
  onCancel?: () => void;
}

const WORD_GLOSS: Record<string, string> = {
  civilite: "Civilité = Title (M. / Mme)",
  nom: "Nom de famille = Surname / family name",
  prenom: "Prénom = First name",
  age: "Âge = Age",
  nationalite: "Nationalité = Nationality",
  ville: "Ville et pays d'origine = Hometown and country",
  profession: "Profession / Occupation = Job or student status",
  loisirs: "Centres d'intérêt / Loisirs = Hobbies & interests",
  dispo: "Disponibilités = When you are available",
};

export function SignUpForm({ kind, initialValues, onPhrase, onSubmit, onCancel }: SignUpFormProps) {
  const [values, setValues] = useState<Record<string, string>>({
    civilite: initialValues?.civilite ?? "",
    nom: initialValues?.nom ?? "",
    prenom: initialValues?.prenom ?? "",
    age: initialValues?.age ?? "",
    nationalite: initialValues?.nationalite ?? "",
    ville: initialValues?.ville ?? "",
    profession: initialValues?.profession ?? "",
    loisirs: initialValues?.loisirs ?? "",
    dispo: initialValues?.dispo ?? "",
  });
  const [askedField, setAskedField] = useState<string | null>(null);
  const [helpMode, setHelpMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField(key: string, val: string) {
    setError(null);
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  function explainField(key: string, labelFr: string) {
    setAskedField(key);
    void hear("rousseau", labelFr, "any");
    const gloss = WORD_GLOSS[key];
    if (gloss) {
      onPhrase?.([{ fr: labelFr, en: gloss.split("=")[1]?.trim() ?? gloss }], "Formulaire");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.nom?.trim() || !values.prenom?.trim() || !values.nationalite?.trim() || !values.loisirs?.trim()) {
      setError("Fiche incomplète : veuillez remplir les champs obligatoires (*).");
      return;
    }
    onSubmit(values);
  }

  const isSport = kind === "sport";

  return (
    <section
      aria-label={isSport ? "Bulletin d'adhésion" : "Fiche d'inscription"}
      className="mx-auto max-w-2xl rounded-sm border border-stone-800/80 bg-[#f9f6ee] p-5 text-stone-900 shadow-[0_10px_28px_rgba(0,0,0,0.28)] sm:p-7"
    >
      {/* Top administrative header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-stone-900 pb-4">
        <div className="font-mono text-[11px] uppercase leading-snug tracking-wider text-stone-700">
          <p className="font-bold text-stone-950">Commune de Saint-Aubin-sur-Loire</p>
          <p>{isSport ? "Service des Sports · Stade Municipal" : "Comité des Fêtes · Salle Polyvalente"}</p>
          <p className="mt-1 text-[10px]">Formulaire N° {isSport ? "AS-14B" : "CF-08A"} — À remplir en français</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rotate-[-4deg] border-2 border-red-900/70 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-red-900/80">
            Mairie · Saint-Aubin
          </div>
          <button
            type="button"
            onClick={() => setHelpMode((prev) => !prev)}
            className="rounded border border-stone-700 bg-white px-2.5 py-1 text-[12px] font-medium text-stone-800 hover:bg-stone-100"
          >
            {helpMode ? "Masquer l'aide" : "Besoin d'aide ?"}
          </button>
        </div>
      </div>

      {/* Form Title Banner */}
      <div className="my-4 border border-stone-900 bg-stone-900/5 px-4 py-2.5 text-center">
        <h2 className="font-serif text-[21px] font-bold uppercase tracking-[0.12em] text-stone-950">
          {isSport ? "Bulletin d'Inscription — Football à 5" : "Fiche d'Inscription — Rencontres au Village"}
        </h2>
        <p className="mt-0.5 font-mono text-[11px] text-stone-600">
          Écrire lisiblement. Les rubriques marquées d&apos;un astérisque (*) sont obligatoires.
        </p>
      </div>

      {helpMode ? (
        <div className="mb-4 border border-amber-900/40 bg-amber-50/90 px-3.5 py-2.5 text-[13px] text-amber-950">
          <p className="font-medium">
            Click any <strong>[?]</strong> next to a French label on the sheet to hear it read aloud and see what that heading means.
          </p>
          {askedField && WORD_GLOSS[askedField] ? (
            <p className="mt-1 font-mono text-[12px] font-bold text-amber-900">
              → {WORD_GLOSS[askedField]}
            </p>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* CADRE A — ÉTAT CIVIL */}
        <fieldset className="border border-stone-800">
          <legend className="ml-3 bg-[#f9f6ee] px-2 font-mono text-[11px] font-bold uppercase tracking-wider text-stone-900">
            Cadre A — Identité du participant
          </legend>

          {/* Row 1: Civilité */}
          <div className="flex flex-wrap items-center gap-4 border-b border-stone-400 px-3.5 py-2.5 text-[13px]">
            <span className="font-mono text-[12px] font-bold uppercase tracking-wide text-stone-800">
              Civilité :
              {helpMode ? (
                <button
                  type="button"
                  onClick={() => explainField("civilite", "Civilité")}
                  className="ml-1 text-amber-800 underline"
                >
                  [?]
                </button>
              ) : null}
            </span>
            {(["M.", "Mme"] as const).map((opt) => (
              <label key={opt} className="inline-flex cursor-pointer items-center gap-1.5 font-mono text-[13px]">
                <input
                  type="radio"
                  name="civilite"
                  checked={values.civilite === opt}
                  onChange={() => setField("civilite", opt)}
                  className="h-3.5 w-3.5 accent-stone-900"
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>

          {/* Row 2: NOM & PRÉNOM */}
          <div className="grid grid-cols-1 border-b border-stone-400 sm:grid-cols-2">
            <div className="border-b border-stone-400 px-3.5 py-2.5 sm:border-b-0 sm:border-r">
              <label htmlFor="form-nom" className="block font-mono text-[11px] font-bold uppercase tracking-wide text-stone-800">
                Nom de famille * :
                {helpMode ? (
                  <button
                    type="button"
                    onClick={() => explainField("nom", "Nom de famille")}
                    className="ml-1 text-amber-800 underline"
                  >
                    [?]
                  </button>
                ) : null}
              </label>
              <input
                id="form-nom"
                type="text"
                autoComplete="off"
                value={values.nom ?? ""}
                onChange={(e) => setField("nom", e.target.value)}
                className="mt-1 w-full border-b border-dotted border-stone-700 bg-transparent px-1 py-1 font-serif text-[16px] text-stone-950 focus:border-solid focus:border-stone-950 focus:outline-none"
              />
            </div>

            <div className="px-3.5 py-2.5">
              <label htmlFor="form-prenom" className="block font-mono text-[11px] font-bold uppercase tracking-wide text-stone-800">
                Prénom * :
                {helpMode ? (
                  <button
                    type="button"
                    onClick={() => explainField("prenom", "Prénom")}
                    className="ml-1 text-amber-800 underline"
                  >
                    [?]
                  </button>
                ) : null}
              </label>
              <input
                id="form-prenom"
                type="text"
                autoComplete="off"
                value={values.prenom ?? ""}
                onChange={(e) => setField("prenom", e.target.value)}
                className="mt-1 w-full border-b border-dotted border-stone-700 bg-transparent px-1 py-1 font-serif text-[16px] text-stone-950 focus:border-solid focus:border-stone-950 focus:outline-none"
              />
            </div>
          </div>

          {/* Row 3: ÂGE & NATIONALITÉ */}
          <div className="grid grid-cols-1 border-b border-stone-400 sm:grid-cols-3">
            <div className="border-b border-stone-400 px-3.5 py-2.5 sm:border-b-0 sm:border-r">
              <label htmlFor="form-age" className="block font-mono text-[11px] font-bold uppercase tracking-wide text-stone-800">
                Âge :
                {helpMode ? (
                  <button
                    type="button"
                    onClick={() => explainField("age", "Âge")}
                    className="ml-1 text-amber-800 underline"
                  >
                    [?]
                  </button>
                ) : null}
              </label>
              <input
                id="form-age"
                type="text"
                autoComplete="off"
                value={values.age ?? ""}
                onChange={(e) => setField("age", e.target.value)}
                className="mt-1 w-full border-b border-dotted border-stone-700 bg-transparent px-1 py-1 font-serif text-[16px] text-stone-950 focus:border-solid focus:border-stone-950 focus:outline-none"
              />
            </div>

            <div className="px-3.5 py-2.5 sm:col-span-2">
              <label htmlFor="form-nationalite" className="block font-mono text-[11px] font-bold uppercase tracking-wide text-stone-800">
                Nationalité * :
                {helpMode ? (
                  <button
                    type="button"
                    onClick={() => explainField("nationalite", "Nationalité")}
                    className="ml-1 text-amber-800 underline"
                  >
                    [?]
                  </button>
                ) : null}
              </label>
              <input
                id="form-nationalite"
                type="text"
                autoComplete="off"
                value={values.nationalite ?? ""}
                onChange={(e) => setField("nationalite", e.target.value)}
                className="mt-1 w-full border-b border-dotted border-stone-700 bg-transparent px-1 py-1 font-serif text-[16px] text-stone-950 focus:border-solid focus:border-stone-950 focus:outline-none"
              />
            </div>
          </div>

          {/* Row 4: VILLE & PROFESSION */}
          <div className="grid grid-cols-1 sm:grid-cols-2">
            <div className="border-b border-stone-400 px-3.5 py-2.5 sm:border-b-0 sm:border-r">
              <label htmlFor="form-ville" className="block font-mono text-[11px] font-bold uppercase tracking-wide text-stone-800">
                Ville et pays d&apos;origine :
                {helpMode ? (
                  <button
                    type="button"
                    onClick={() => explainField("ville", "Ville et pays d'origine")}
                    className="ml-1 text-amber-800 underline"
                  >
                    [?]
                  </button>
                ) : null}
              </label>
              <input
                id="form-ville"
                type="text"
                autoComplete="off"
                value={values.ville ?? ""}
                onChange={(e) => setField("ville", e.target.value)}
                className="mt-1 w-full border-b border-dotted border-stone-700 bg-transparent px-1 py-1 font-serif text-[16px] text-stone-950 focus:border-solid focus:border-stone-950 focus:outline-none"
              />
            </div>

            <div className="px-3.5 py-2.5">
              <label htmlFor="form-prof" className="block font-mono text-[11px] font-bold uppercase tracking-wide text-stone-800">
                Profession / Occupation :
                {helpMode ? (
                  <button
                    type="button"
                    onClick={() => explainField("profession", "Profession")}
                    className="ml-1 text-amber-800 underline"
                  >
                    [?]
                  </button>
                ) : null}
              </label>
              <input
                id="form-prof"
                type="text"
                autoComplete="off"
                value={values.profession ?? ""}
                onChange={(e) => setField("profession", e.target.value)}
                className="mt-1 w-full border-b border-dotted border-stone-700 bg-transparent px-1 py-1 font-serif text-[16px] text-stone-950 focus:border-solid focus:border-stone-950 focus:outline-none"
              />
            </div>
          </div>
        </fieldset>

        {/* CADRE B — PRÉSENTATION & LOISIRS */}
        <fieldset className="border border-stone-800 px-3.5 py-3">
          <legend className=" bg-[#f9f6ee] px-2 font-mono text-[11px] font-bold uppercase tracking-wider text-stone-900">
            Cadre B — Renseignements
          </legend>

          <label htmlFor="form-loisirs" className="block font-mono text-[11px] font-bold uppercase tracking-wide text-stone-800">
            {isSport ? "Sports pratiqués / Poste souhaité * :" : "Centres d'intérêt / Loisirs * :"}
            {helpMode ? (
              <button
                type="button"
                onClick={() => explainField("loisirs", "Centres d'intérêt et loisirs")}
                className="ml-1 text-amber-800 underline"
              >
                [?]
              </button>
            ) : null}
          </label>
          <textarea
            id="form-loisirs"
            rows={2}
            value={values.loisirs ?? ""}
            onChange={(e) => setField("loisirs", e.target.value)}
            className="mt-1 w-full resize-none border-b border-dotted border-stone-700 bg-transparent px-1 py-1 font-serif text-[16px] leading-relaxed text-stone-950 focus:border-solid focus:border-stone-950 focus:outline-none"
          />

          <div className="mt-3 border-t border-stone-300 pt-2.5">
            <span className="block font-mono text-[11px] font-bold uppercase tracking-wide text-stone-800">
              Disponibilités :
              {helpMode ? (
                <button
                  type="button"
                  onClick={() => explainField("dispo", "Disponibilités")}
                  className="ml-1 text-amber-800 underline"
                >
                  [?]
                </button>
              ) : null}
            </span>
            <div className="mt-1.5 flex flex-wrap gap-5 font-mono text-[12px]">
              {["En semaine", "Ce soir", "Samedi", "Dimanche"].map((slot) => (
                <label key={slot} className="inline-flex cursor-pointer items-center gap-1.5">
                  <input
                    type="radio"
                    name="dispo"
                    checked={values.dispo === slot}
                    onChange={() => setField("dispo", slot)}
                    className="h-3.5 w-3.5 accent-stone-900"
                  />
                  <span>{slot}</span>
                </label>
              ))}
            </div>
          </div>
        </fieldset>

        {error ? (
          <p className="border border-red-800/40 bg-red-50 px-3 py-2 font-mono text-[12px] text-red-900">{error}</p>
        ) : null}

        {/* CADRE C — SIGNATURE */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-t-2 border-stone-900 pt-4">
          <div className="font-serif text-[13px] italic text-stone-700">
            <p>Fait à Saint-Aubin-sur-Loire</p>
            <p className="mt-0.5 font-mono text-[11px] not-italic uppercase text-stone-500">
              Signature du déclarant :
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onCancel ? (
              <button type="button" className="ep-button" onClick={onCancel}>
                Annuler
              </button>
            ) : null}
            <button type="submit" className="ep-button ep-primary">
              ✍️ Signer et remettre la fiche
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
