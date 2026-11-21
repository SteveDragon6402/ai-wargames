/** Every number that decides when something opens. Tune here, nowhere else. */
export const TUNING = {
  /** Introduce yourself at level 2 once → boulangerie and speed friending. */
  intro: { skill: "intro", min: 2, times: 1 },
  /** Order bread at level 2 once at the boulangerie → épicerie (grocer & cooking). */
  bread: { skill: "ordering", min: 2, times: 1, scene: "boulangerie" },
  /** Shop at the épicerie once → the casual bistro. */
  bistroAfterShops: 1,
  /** Formal restaurant: one bistro visit plus politeness at 2, once. */
  formal: { visits: 1, skill: "register", min: 2, times: 1 },
  /** Self-service supermarket unlocks way later: after 2 grocer trips and 4 rated conversations. */
  supermarche: { epicerieVisits: 2, convos: 4 },
  /** Small talk at level 2 once at speed friending → invitations. */
  friends: { skill: "smalltalk", min: 2, times: 1, scene: "speedfriending" },
  /** Family visit: three rated conversations averaging 1.8. */
  family: { convos: 3, average: 1.8 },
  /** Madame is sick: five rated conversations averaging 2.0, after the family visit. */
  sick: { convos: 5, average: 2.0 },
  /** Only the latest assessments count toward averages. */
  averageWindow: 6,
  /** Surface unlocked place chips right after Madame's opening morning line so the player is never waiting. */
  nudgeTurns: 1,
} as const;
