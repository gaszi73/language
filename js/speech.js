// A böngésző beépített beszédfunkciói (Web Speech API) köré írt egyszerű réteg.
// speak(): felolvasás, listen(): beszédfelismerés. Mindkettő Promise-t ad vissza.

const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
const RecognitionCtor = typeof window !== "undefined"
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : undefined;

let voices = [];
let activeRecognition = null;
let pendingSpeechResolve = null;

export const support = {
  tts: Boolean(synth),
  stt: Boolean(RecognitionCtor),
};

function loadVoices() {
  if (!synth) return;
  voices = synth.getVoices();
}

if (synth) {
  loadVoices();
  if (typeof synth.addEventListener === "function") {
    synth.addEventListener("voiceschanged", loadVoices);
  } else {
    synth.onvoiceschanged = loadVoices;
  }
}

export function getVoices(langPrefix) {
  if (!voices.length) loadVoices();
  return voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith(langPrefix.toLowerCase()));
}

const preferred = { en: null, hu: null };

export function setPreferredVoice(lang, voiceName) {
  preferred[lang] = voiceName || null;
}

// voiceIndex > 0: egy másik hangot választ (párbeszédeknél a második szereplőnek).
function pickVoice(lang, voiceIndex = 0) {
  const prefix = lang.slice(0, 2);
  const list = getVoices(prefix);
  if (!list.length) return null;
  if (voiceIndex > 0 && list.length > 1) {
    const main = pickVoice(lang, 0);
    const others = list.filter((v) => v !== main);
    return others[(voiceIndex - 1) % others.length];
  }
  if (preferred[prefix]) {
    const chosen = list.find((v) => v.name === preferred[prefix]);
    if (chosen) return chosen;
  }
  // Angolnál az amerikai/brit természetes hangokat részesítjük előnyben.
  const exact = list.filter((v) => v.lang.toLowerCase() === lang.toLowerCase());
  const pool = exact.length ? exact : list;
  return pool.find((v) => /natural|google|premium|enhanced/i.test(v.name)) || pool[0];
}

export function speak(text, { lang = "en-US", rate = 1, pitch = 1, voiceIndex = 0 } = {}) {
  return new Promise((resolve) => {
    if (!synth || !text) {
      resolve({ ok: false });
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = pitch;
    const voice = pickVoice(lang, voiceIndex);
    if (voice) utterance.voice = voice;

    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      clearTimeout(watchdog);
      if (pendingSpeechResolve === finish) pendingSpeechResolve = null;
      resolve(result);
    };
    // Néhány böngésző nem küld "end" eseményt; biztonsági időkorlát.
    const estimatedMs = 2500 + (text.length * 90) / rate;
    const watchdog = setTimeout(() => finish({ ok: true, timeout: true }), estimatedMs);

    utterance.onend = () => finish({ ok: true });
    utterance.onerror = (e) => finish({ ok: false, error: e.error });
    pendingSpeechResolve = finish;
    synth.speak(utterance);
  });
}

export function stopSpeaking() {
  if (synth) synth.cancel();
  if (pendingSpeechResolve) pendingSpeechResolve({ ok: false, aborted: true });
}

// Egy megszólalást hallgat meg. Eredmény: { transcripts: [...], error? }
export function listen({ lang = "en-US", timeoutMs = 8000, maxAlternatives = 3 } = {}) {
  return new Promise((resolve) => {
    if (!RecognitionCtor) {
      resolve({ transcripts: [], error: "not-supported" });
      return;
    }
    stopListening();
    const rec = new RecognitionCtor();
    rec.lang = lang;
    rec.interimResults = false;
    rec.continuous = false;
    rec.maxAlternatives = maxAlternatives;
    activeRecognition = rec;

    let transcripts = [];
    let error = null;
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (activeRecognition === rec) activeRecognition = null;
      resolve(error ? { transcripts, error } : { transcripts });
    };
    const timer = setTimeout(() => {
      error = error || "timeout";
      try { rec.stop(); } catch { /* már leállt */ }
      setTimeout(settle, 600);
    }, timeoutMs);

    rec.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      transcripts = Array.from(result).map((alt) => alt.transcript.trim()).filter(Boolean);
    };
    rec.onerror = (event) => {
      error = event.error || "error";
    };
    rec.onend = settle;
    try {
      rec.start();
    } catch (e) {
      error = e.message || "start-failed";
      settle();
    }
  });
}

export function stopListening() {
  if (activeRecognition) {
    try { activeRecognition.abort(); } catch { /* nem fut */ }
    activeRecognition = null;
  }
}

export function stopAll() {
  stopSpeaking();
  stopListening();
}

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Egy tipikus mikrofon-engedély kérés (a felismerés első indítása előtt hasznos).
export async function requestMicrophone() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}
