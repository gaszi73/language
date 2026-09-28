// AI beszélgetőpartner a Claude API-val (opcionális, saját API kulccsal).
// A kulcs csak ebben a böngészőben tárolódik, és közvetlenül az Anthropic API-nak megy.

import { getSettings } from "./storage.js";

const SDK_URL = "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk/+esm";

export const MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 (legjobb minőség)" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (olcsóbb, gyors)" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 (leggyorsabb, legolcsóbb)" },
];

// Ezeken a modelleken bekapcsoljuk a szerveroldali tartalék modellt elutasítás esetére.
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-sonnet-5-5"]);

export const SCENARIOS = [
  { id: "free", label: "Kötetlen beszélgetés", prompt: "Have a friendly, casual conversation. Start by asking how the learner's day is going." },
  { id: "car", label: "Autós beszélgetés (mindennapok)", prompt: "The learner is driving to or from work. Chat about their day, their plans, work, family and hobbies. Start by asking where they are driving." },
  { id: "work", label: "Munkahelyi megbeszélés", prompt: "Role-play a work meeting. You are a friendly colleague from the UK discussing a project deadline. Start the meeting." },
  { id: "shop", label: "Vásárlás / ügyintézés", prompt: "Role-play: you are a shop assistant in a clothes shop in London. Greet the customer." },
  { id: "doctor", label: "Orvosnál", prompt: "Role-play: you are a GP (doctor) in England. The learner is your patient. Greet them and ask what the problem is." },
  { id: "hotel", label: "Szálloda, utazás", prompt: "Role-play: you are a hotel receptionist. The learner is checking in. Greet them." },
  { id: "film", label: "Filmekről, sorozatokról", prompt: "Talk about films and TV series. Ask what they like watching and why. Occasionally use common everyday expressions from films and explain them simply if asked." },
];

let sdkPromise = null;

async function loadSdk() {
  if (!sdkPromise) {
    sdkPromise = import(/* @vite-ignore */ SDK_URL).then((mod) => mod.default || mod.Anthropic);
  }
  return sdkPromise;
}

export function isConfigured() {
  return Boolean(getSettings().apiKey);
}

export function systemPrompt({ level, scenario, spoken }) {
  return [
    `You are an English conversation partner for a Hungarian adult learner.`,
    `Their reading is good (about B2), but their speaking and listening are weak: roughly ${level} level. The goal is to build speaking confidence.`,
    scenario.prompt,
    ``,
    `How to reply:`,
    `- Keep every reply short: one to three sentences, at most about 40 words.`,
    `- Use vocabulary and grammar suitable for ${level}; speak naturally, but avoid rare idioms unless you explain them.`,
    `- Usually end with a simple question so the learner has to speak again.`,
    `- If the learner's last message had a clear mistake, begin with one brief correction in this form: "Small tip: say '...'" and then continue the conversation. Correct at most one thing per reply, and skip small slips.`,
    `- If the learner writes in Hungarian or asks what something means, explain very briefly in Hungarian, then return to English.`,
    spoken
      ? `- Your reply will be read aloud by a speech synthesizer while the learner is driving: plain sentences only, no lists, no markdown, no emojis, no brackets.
- The learner's messages come from speech recognition, so ignore missing punctuation and capital letters, and guess sensibly if a word looks misheard.`
      : `- Write plain text without markdown headings or lists.`,
  ].join("\n");
}

function extractText(content) {
  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

// Egy beszélgetés állapota. reply(): felhasználói üzenet → válasz szövege.
export function createTutor({ level = "A2", scenarioId = "free", spoken = false } = {}) {
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) || SCENARIOS[0];
  const system = systemPrompt({ level, scenario, spoken });
  const messages = [];

  async function reply(userText, { onText } = {}) {
    const settings = getSettings();
    if (!settings.apiKey) throw new Error("Nincs megadva Claude API kulcs (Beállítások).");
    const Anthropic = await loadSdk();
    const client = new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true });

    messages.push({ role: "user", content: userText });
    const model = settings.model || MODELS[0].id;
    const params = { model, max_tokens: 1024, system, messages };
    // Rövid, gyors válaszok kellenek (autóban is): alacsony effort. A Haiku 4.5 ezt nem támogatja.
    if (!model.startsWith("claude-haiku")) params.output_config = { effort: "low" };

    try {
      let stream;
      if (FALLBACK_MODELS.has(model)) {
        stream = client.beta.messages.stream({
          ...params,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
        });
      } else {
        stream = client.messages.stream(params);
      }
      if (onText) stream.on("text", (delta) => onText(delta));
      const message = await stream.finalMessage();
      // A teljes választ (nem csak a szöveget) küldjük vissza a következő körben.
      messages.push({ role: "assistant", content: message.content });
      if (message.stop_reason === "refusal") {
        return "Sorry, I can't talk about that. Let's talk about something else. What did you do today?";
      }
      return extractText(message.content);
    } catch (err) {
      messages.pop(); // a sikertelen kérést ne tartsuk meg az előzményekben
      throw friendlyError(err);
    }
  }

  // A beszélgetést a tanár nyitja.
  function start(opts) {
    return reply("(The learner is ready. Please start the conversation.)", opts);
  }

  return { reply, start, messages, scenario };
}

function friendlyError(err) {
  const status = err && (err.status || (err.error && err.error.status));
  if (status === 401) return new Error("Érvénytelen API kulcs. Ellenőrizd a Beállításokban.");
  if (status === 429) return new Error("Túl sok kérés vagy elfogyott a keret. Várj egy kicsit.");
  if (status === 400) return new Error(`Hibás kérés: ${err.message || ""}`);
  if (status >= 500) return new Error("Az API szerver épp nem elérhető. Próbáld újra később.");
  if (err && /fetch|network|Failed to fetch|import/i.test(String(err.message))) {
    return new Error("Nincs internetkapcsolat, vagy nem tölthető be az Anthropic SDK.");
  }
  return err instanceof Error ? err : new Error(String(err));
}
