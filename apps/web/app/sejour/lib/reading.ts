/** Notifies the stay that the learner chose to read NPC text, which caps listening credit. */
const listeners = new Set<() => void>();

export function flagReadingAssist() {
  for (const listener of listeners) listener();
}

export function subscribeReadingAssist(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
