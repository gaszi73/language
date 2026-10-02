// Hibanapló: minden nem sikerült mondatot elment, felismeri a visszatérő hibamintákat,
// és nyilvántartja a „makacs” mondatokat, amíg háromszor egymás után nem sikerülnek.

import { load, save, localDay } from "./storage.js";
import { normalize } from "./score.js";
import { PHRASES } from "../data/phrases.js";

const LOG_LIMIT = 3000;
export const MASTERED_STREAK = 3; // ennyi egymás utáni helyes válasz után begyakoroltnak számít
const OK_SCORE = 0.9;
// Csak az számít begyakorlásnak, ha fejből (magyarból) mondod ki helyesen – az utánmondás
// vagy a diktálás sikere még nem jelenti, hogy használni is tudod.
const MASTERY_MODES = new Set(["translate", "review"]);

// Melyik gyakorlat melyik készséget méri.
export const MODE_SKILL = {
  dictation: "listening",
  connected_typed: "listening",
  pairs: "listening",
  shadow: "speaking",
  speak: "speaking",
  translate: "speaking",
  review: "speaking",
  connected: "speaking",
  ai: "speaking",
};

export const MODE_NAME = {
  dictation: "diktálás",
  connected_typed: "gyors beszéd (hallás)",
  pairs: "minimálpár",
  shadow: "utánmondás",
  speak: "kiejtés",
  translate: "fordítás szóban",
  review: "ismétlés",
  connected: "gyors beszéd",
  ai: "AI-beszélgetés",
};

const ARTICLES = new Set(["a", "an", "the"]);
const AUX = new Set(["am", "is", "are", "was", "were", "be", "been", "have", "has", "had", "will", "would", "do", "does", "did", "can", "could", "should"]);
const PREPS = new Set(["in", "on", "at", "to", "for", "of", "with", "by", "from", "about", "into", "up", "out"]);
const FUNCTION_WORDS = new Set([...ARTICLES, ...AUX, ...PREPS, "i", "you", "it", "not", "and", "me", "my"]);

export const PATTERNS = {
  silent: {
    name: "Nem jött válasz",
    tip: "Ezeket a mondatokat még nem tudod előhívni. Először csak hallgasd és mondd utána (utánmondás), aztán próbáld magyarból.",
  },
  article: {
    name: "Névelők (a / an / the)",
    tip: "Angolul megszámlálható főnév előtt szinte mindig kell névelő: a car, the station. Gyors beszédben alig hallatszik („ə”), ezért könnyű lemaradni róla.",
  },
  aux: {
    name: "Segédigék (am / is / are, have, will, did…)",
    tip: "Magyarul gyakran nincs ige („Fáradt vagyok” – I AM tired; „Hol vagy?” – Where ARE you?). Angolul kötelező, és gyakran összeolvad: I'm, I've, I'll, he's.",
  },
  prep: {
    name: "Elöljárószók (in, on, at, to, for…)",
    tip: "Ezek a magyar ragok (-ban, -on, -hoz) megfelelői, de nem szóról szóra. Kifejezésként tanuld őket: at work, on Monday, in the car, wait for.",
  },
  ending_s: {
    name: "-s végződés (he works, two cars)",
    tip: "E/3-ban (he / she / it) az ige -s-t kap, többes számban a főnév is. Beszédben is ejtsd ki tisztán a végét.",
  },
  ending_ed: {
    name: "Múlt idő -ed",
    tip: "A múlt idő jele a szó végén van (worked, called), és gyors beszédben alig hallatszik. Ejtsd ki: „workt”, „called”.",
  },
  ending_ing: {
    name: "-ing végződés",
    tip: "Folyamatos alaknál (I'm working) a szó végét ne nyeld el, és a segédigét se hagyd ki.",
  },
  th: {
    name: "th hang (think, the, three)",
    tip: "Nyelvhegy a fogak közé, és fújd ki a levegőt: think (zöngétlen), the (zöngés). Ne s, t, f vagy d legyen belőle.",
  },
  wv: {
    name: "w / v keverése",
    tip: "A w-nél nem ér a fogad az ajkadhoz: csücsörítsd az ajkad, mint az „u”-nál (west, wine). A v-nél a felső fog az alsó ajakra kerül (vest, vine).",
  },
  similar: {
    name: "Hasonló hangzású szót mondtál / értett a gép",
    tip: "A gép egy hasonló szót értett. Hallgasd meg lassan a mintát, és figyelj a magánhangzók hosszára (ship–sheep, full–fool) és a szó végére.",
  },
  order: {
    name: "Szórend",
    tip: "Minden szó megvolt, csak más sorrendben. Angolul a szórend kötött: alany – ige – tárgy – hely – idő. Kérdésben a segédige előre jön: Where ARE you going?",
  },
};

export function itemKey({ itemId, expected }) {
  return itemId || `t:${normalize(expected).join(" ")}`;
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

const TH_VARIANTS = ["t", "d", "s", "f", "z", "v"];

// Egy hibás válaszból kiolvasható hibaminták azonosítói.
export function detectPatterns({ expected, heard, missing = [], extra = [], score = 0 }) {
  const found = new Set();
  const heardWords = normalize(heard);
  if (!heardWords.length) {
    found.add("silent");
    return [...found];
  }
  // ugyanazok a szavak, csak más sorrendben → szórendi hiba (és nem „hiányzó” szó)
  const exp = normalize(expected);
  if (score < OK_SCORE && exp.length === heardWords.length && [...exp].sort().join(" ") === [...heardWords].sort().join(" ")) {
    return ["order"];
  }
  const extraSet = new Set(extra);
  for (const w of missing) {
    if (ARTICLES.has(w)) found.add("article");
    if (AUX.has(w)) found.add("aux");
    if (PREPS.has(w)) found.add("prep");
    for (const x of extraSet) {
      if (x.length < 3) continue; // rövid szavaknál (is, it, a) túl sok a véletlen egyezés
      if (w === `${x}s` || w === `${x}es`) found.add("ending_s");
      else if (w === `${x}ed` || w === `${x}d`) found.add("ending_ed");
      else if (w === `${x}ing` || w === `${x.replace(/e$/, "")}ing`) found.add("ending_ing");
      else if (w.includes("th") && TH_VARIANTS.some((v) => w.replace(/th/g, v) === x)) found.add("th");
      else if ((w[0] === "w" && x === `v${w.slice(1)}`) || (w[0] === "v" && x === `w${w.slice(1)}`)) found.add("wv");
      else if (w.length >= 3 && x.length >= 3 && w[0] === x[0] && levenshtein(w, x) <= (w.length >= 4 ? 2 : 1)) found.add("similar");
    }
  }
  return [...found];
}

function state() {
  const s = load();
  if (!s.mistakeLog) s.mistakeLog = [];
  if (!s.weakItems) s.weakItems = {};
  return s;
}

function todayKey(date = new Date()) {
  return localDay(date);
}

/**
 * Egy válasz eredményének rögzítése.
 * result: a score.js compare()/compareAlternatives() eredménye (score, missing, extra, heard?, expected?)
 */
export function recordResult({ mode, itemId, expected, hu = "", heard = "", result, extraPatterns = [] }) {
  const s = state();
  const score = result ? result.score : 0;
  const exp = (result && result.expected) || expected;
  const said = heard || (result && result.heard) || "";
  const key = itemKey({ itemId, expected: exp });
  const weak = s.weakItems[key];

  if (score >= OK_SCORE) {
    // magyar fordítás nélküli (pl. AI-javításból származó) mondatnál az utánmondás is számít
    if (weak && (MASTERY_MODES.has(mode) || !weak.hu)) {
      weak.streak = (weak.streak || 0) + 1;
      weak.lastOk = Date.now();
      if (weak.streak >= MASTERED_STREAK && !weak.masteredAt) weak.masteredAt = Date.now();
      save();
    }
    return null;
  }

  const patterns = [...detectPatterns({ expected: exp, heard: said, missing: result?.missing, extra: result?.extra, score }), ...extraPatterns];
  const entry = {
    ts: Date.now(),
    day: todayKey(),
    mode,
    key,
    itemId: itemId || null,
    expected: exp,
    hu,
    heard: said,
    score: Math.round(score * 100) / 100,
    missing: result?.missing || [],
    patterns,
  };
  s.mistakeLog.push(entry);
  if (s.mistakeLog.length > LOG_LIMIT) s.mistakeLog.splice(0, s.mistakeLog.length - LOG_LIMIT);

  // az utánmondás és a hallás hibái csak naplózódnak; a makacs mondatok listájába
  // azok kerülnek, amiket magadtól kellett volna kimondani
  const practicable = mode !== "pairs";
  if (practicable) {
    const w = weak || { key, itemId: itemId || null, en: exp, hu, mode, fails: 0, firstFail: Date.now() };
    w.fails++;
    w.streak = 0;
    w.lastFail = Date.now();
    w.lastHeard = said;
    w.masteredAt = null;
    if (hu && !w.hu) w.hu = hu;
    s.weakItems[key] = w;
  }
  save();
  return entry;
}

// AI-beszélgetésből: „Small tip: say '...'” → a javasolt mondat bekerül a makacsok közé.
export function extractAiTip(reply) {
  const m = /small tip:\s*say\s*["'“‘]([^"'”’]+)["'”’]/i.exec(reply || "");
  return m ? m[1].trim() : null;
}

export function recordAiCorrection(userText, reply) {
  const tip = extractAiTip(reply);
  if (!tip) return null;
  return recordResult({
    mode: "ai",
    expected: tip,
    heard: userText,
    result: { score: 0, missing: [], extra: [], expected: tip, heard: userText },
  });
}

export function addPracticeItems(items) {
  const s = state();
  let added = 0;
  for (const { en, hu } of items) {
    const key = itemKey({ expected: en });
    if (s.weakItems[key]) continue;
    s.weakItems[key] = { key, itemId: null, en, hu, mode: "ai", fails: 1, streak: 0, firstFail: Date.now(), lastFail: Date.now(), lastHeard: "", masteredAt: null, fromAi: true };
    added++;
  }
  save();
  return added;
}

export function logForDay(day) {
  return state().mistakeLog.filter((e) => e.day === day);
}

export function logSince(days) {
  const from = Date.now() - days * 24 * 60 * 60 * 1000;
  return state().mistakeLog.filter((e) => e.ts >= from);
}

export function daysWithMistakes() {
  return [...new Set(state().mistakeLog.map((e) => e.day))].sort().reverse();
}

// A még nem begyakorolt makacs mondatok: a többször rontottak előre.
export function activeWeakItems() {
  return Object.values(state().weakItems)
    .filter((w) => (w.streak || 0) < MASTERED_STREAK)
    .sort((a, b) => b.fails - a.fails || Number(Boolean(a.fromAi)) - Number(Boolean(b.fromAi)) || b.lastFail - a.lastFail);
}

export function masteredSince(days) {
  const from = Date.now() - days * 24 * 60 * 60 * 1000;
  return Object.values(state().weakItems).filter((w) => w.masteredAt && w.masteredAt >= from);
}

export function removeWeakItem(key) {
  const s = state();
  delete s.weakItems[key];
  save();
}

// Összesítés egy naplórészletből: mondatok, minták, gyakran kimaradó szavak.
export function analyze(entries) {
  const byKey = new Map();
  const patterns = new Map();
  const words = new Map();
  for (const e of entries) {
    const g = byKey.get(e.key) || { key: e.key, expected: e.expected, hu: e.hu, count: 0, heard: [], modes: new Set() };
    g.count++;
    if (e.heard && !g.heard.includes(e.heard)) g.heard.push(e.heard);
    g.modes.add(e.mode);
    if (e.hu && !g.hu) g.hu = e.hu;
    byKey.set(e.key, g);

    for (const p of e.patterns || []) {
      const skill = MODE_SKILL[e.mode] || "speaking";
      const id = p;
      const pat = patterns.get(id) || { id, count: 0, listening: 0, speaking: 0, examples: [] };
      pat.count++;
      pat[skill]++;
      if (pat.examples.length < 3 && !pat.examples.some((x) => x.expected === e.expected)) {
        pat.examples.push({ expected: e.expected, heard: e.heard });
      }
      patterns.set(id, pat);
    }
    for (const w of e.missing || []) {
      if (FUNCTION_WORDS.has(w) || w.length < 3) continue;
      words.set(w, (words.get(w) || 0) + 1);
    }
  }
  return {
    total: entries.length,
    sentences: [...byKey.values()].sort((a, b) => b.count - a.count),
    patterns: [...patterns.values()].sort((a, b) => b.count - a.count),
    words: [...words.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15),
  };
}

export function patternInfo(id) {
  if (PATTERNS[id]) return PATTERNS[id];
  if (id.startsWith("sound:")) {
    return { name: `Hangpár: ${id.slice(6)}`, tip: "A minimálpár-gyakorlatban ezt a két hangot keverted. Hallgasd meg többször egymás után a két szót, és mondd ki mindkettőt." };
  }
  return { name: id, tip: "" };
}

// A makacs mondatok gyakorló elemmé alakítva (a gyűjtemény mondatainál az összes elfogadott változattal).
export function weakAsItems(weak = activeWeakItems()) {
  return weak.map((w) => {
    const phrase = w.itemId && PHRASES.find((p) => p.id === w.itemId);
    if (phrase) return { ...phrase, weak: true };
    return { id: w.itemId || w.key, en: [w.en], hu: w.hu || "", level: "A1", weak: true };
  });
}
