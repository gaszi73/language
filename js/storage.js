// Haladás és beállítások tárolása a böngészőben (localStorage).
// Semmi nem megy ki szerverre; a Claude API kulcs is csak itt tárolódik.

const KEY = "angol-beszed-v1";
const DAY = 24 * 60 * 60 * 1000;
// Leitner-dobozok: hány nap múlva jöjjön újra a mondat.
const BOX_INTERVAL_DAYS = [0, 1, 3, 7, 14, 30];

const defaults = () => ({
  settings: {
    rate: 0.85,
    slowRate: 0.65,
    apiKey: "",
    model: "claude-opus-5-5",
    enVoice: "",
    huVoice: "",
    level: "A2",
    carBlockMinutes: 5,
  },
  assessments: [],
  cards: {},
  activity: {},
});

let memory = null;

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw);
    const base = defaults();
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...(parsed.settings || {}) },
    };
  } catch {
    return defaults();
  }
}

export function load() {
  if (!memory) memory = read();
  return memory;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // privát mód / tele a tárhely: a munkamenet memóriában megy tovább
  }
}

export function getSettings() {
  return load().settings;
}

export function updateSettings(patch) {
  const state = load();
  state.settings = { ...state.settings, ...patch };
  save();
  return state.settings;
}

export function addAssessment(result) {
  const state = load();
  state.assessments.push({ ...result, date: new Date().toISOString() });
  if (result.level) state.settings.level = result.level;
  save();
}

export function latestAssessment() {
  const list = load().assessments;
  return list.length ? list[list.length - 1] : null;
}

export function allAssessments() {
  return load().assessments;
}

// Helyi idő szerinti nap (YYYY-MM-DD), hogy az éjfél utáni gyakorlás is a jó napra kerüljön.
export function localDay(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function today() {
  return localDay();
}

// Egy gyakorlás rögzítése a napi statisztikába.
export function logActivity(kind, seconds = 0, items = 1) {
  const state = load();
  const day = today();
  const entry = state.activity[day] || { seconds: 0, items: 0, kinds: {} };
  entry.seconds += Math.round(seconds);
  entry.items += items;
  entry.kinds[kind] = (entry.kinds[kind] || 0) + items;
  state.activity[day] = entry;
  save();
}

export function activityDays() {
  return load().activity;
}

export function streak() {
  const activity = load().activity;
  let count = 0;
  const d = new Date();
  // ha ma még nem volt gyakorlás, tegnaptól számolunk
  if (!activity[localDay(d)]) d.setDate(d.getDate() - 1);
  while (activity[localDay(d)]) {
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

// ---- Ismétlési rendszer (Leitner) ----

export function getCard(id) {
  return load().cards[id] || null;
}

export function recordAnswer(id, score) {
  const state = load();
  const card = state.cards[id] || { box: 0, due: 0, seen: 0, correct: 0, lastScore: 0 };
  card.seen++;
  card.lastScore = Math.round(score * 100) / 100;
  if (score >= 0.9) {
    card.correct++;
    card.box = Math.min(card.box + 1, BOX_INTERVAL_DAYS.length - 1);
  } else if (score >= 0.6) {
    card.box = Math.max(card.box, 1);
  } else {
    card.box = 0;
  }
  card.due = Date.now() + BOX_INTERVAL_DAYS[card.box] * DAY;
  state.cards[id] = card;
  save();
  return card;
}

const LEVEL_ORDER = ["A1", "A2", "B1", "B2"];

export function levelIndex(level) {
  const idx = LEVEL_ORDER.indexOf(level);
  return idx < 0 ? 1 : idx;
}

// Kiválaszt n kártyát: először az esedékes ismétlések, aztán új, a szinthez illő mondatok.
export function pickCards(items, n, { level, random = Math.random } = {}) {
  const state = load();
  const maxLevel = levelIndex(level || state.settings.level) + 1; // egy szinttel feljebb is jöhet
  const now = Date.now();
  const eligible = items.filter((it) => levelIndex(it.level) <= maxLevel);
  const due = [];
  const fresh = [];
  for (const it of eligible) {
    const card = state.cards[it.id];
    if (!card) fresh.push(it);
    else if (card.due <= now) due.push({ it, card });
  }
  due.sort((a, b) => a.card.box - b.card.box || a.card.due - b.card.due);
  const picked = due.slice(0, Math.ceil(n * 0.6)).map((d) => d.it);
  // új mondatok: könnyebbek előbb, azon belül keverve
  const shuffledFresh = shuffle(fresh, random).sort((a, b) => levelIndex(a.level) - levelIndex(b.level));
  for (const it of shuffledFresh) {
    if (picked.length >= n) break;
    picked.push(it);
  }
  for (const d of due.slice(picked.length)) {
    if (picked.length >= n) break;
    if (!picked.includes(d.it)) picked.push(d.it);
  }
  if (picked.length < n) {
    for (const it of shuffle(eligible, random)) {
      if (picked.length >= n) break;
      if (!picked.includes(it)) picked.push(it);
    }
  }
  return shuffle(picked, random);
}

export function shuffle(list, random = Math.random) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function cardStats(items) {
  const state = load();
  let learned = 0;
  let started = 0;
  for (const it of items) {
    const card = state.cards[it.id];
    if (!card) continue;
    started++;
    if (card.box >= 3) learned++;
  }
  return { learned, started, total: items.length };
}

export function exportData() {
  return JSON.stringify(load(), null, 2);
}

export function importData(json) {
  const parsed = JSON.parse(json);
  memory = { ...defaults(), ...parsed, settings: { ...defaults().settings, ...(parsed.settings || {}) } };
  save();
}

export function resetProgress() {
  const settings = load().settings;
  memory = { ...defaults(), settings };
  save();
}
