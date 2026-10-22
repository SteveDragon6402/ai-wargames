let chosen: SpeechSynthesisVoice | null = null;

function frenchVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  if (chosen) return chosen;
  const voices = window.speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith("fr"));
  const male = /thomas|nicolas|daniel|henri|paul|mathieu|jacques|male|homme/i;
  chosen =
    voices.find((voice) => voice.lang === "fr-FR" && male.test(voice.name)) ??
    voices.find((voice) => voice.lang === "fr-FR") ??
    voices[0] ??
    null;
  return chosen;
}

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speakFrench(text: string): void {
  if (!canSpeak() || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fr-FR";
  utterance.rate = 0.92;
  const voice = frenchVoice();
  if (voice) utterance.voice = voice;
  synth.speak(utterance);
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel();
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.addEventListener?.("voiceschanged", () => {
    chosen = null;
  });
}
