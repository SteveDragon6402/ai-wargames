let chosen: SpeechSynthesisVoice | null = null;
let request: AbortController | null = null;
let clip: HTMLAudioElement | null = null;
let clipUrl: string | null = null;

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

function speakInBrowser(text: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fr-FR";
  utterance.rate = 0.92;
  const voice = frenchVoice();
  if (voice) utterance.voice = voice;
  synth.speak(utterance);
}

export function canSpeak(): boolean {
  return typeof window !== "undefined" && (typeof Audio !== "undefined" || "speechSynthesis" in window);
}

export function stopSpeaking(): void {
  request?.abort();
  request = null;
  if (clip) {
    clip.pause();
    clip.src = "";
    clip = null;
  }
  if (clipUrl) {
    URL.revokeObjectURL(clipUrl);
    clipUrl = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

async function play(text: string, controller: AbortController): Promise<void> {
  try {
    const res = await fetch("/api/epicerie/voice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    if (controller.signal.aborted) return;
    if (!res.ok) {
      speakInBrowser(text);
      return;
    }
    const blob = await res.blob();
    if (controller.signal.aborted) return;
    clipUrl = URL.createObjectURL(blob);
    clip = new Audio(clipUrl);
    clip.onended = () => {
      if (clipUrl) URL.revokeObjectURL(clipUrl);
      clipUrl = null;
      clip = null;
    };
    await clip.play();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    if (!controller.signal.aborted) speakInBrowser(text);
  }
}

export function speakFrench(text: string): void {
  const line = text.trim();
  if (!canSpeak() || !line) return;
  stopSpeaking();
  const controller = new AbortController();
  request = controller;
  void play(line, controller);
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.addEventListener?.("voiceschanged", () => {
    chosen = null;
  });
}
