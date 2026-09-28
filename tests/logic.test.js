import { test } from "node:test";
import assert from "node:assert/strict";

// localStorage pótlása Node alatt
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { normalize, compare, compareBest, compareAlternatives, verdict } = await import("../js/score.js");
const { computeLevel, practiceLevel } = await import("../js/assessment.js");
const { detectCommand, planSession } = await import("../js/carmode.js");
const storage = await import("../js/storage.js");
const { PHRASES } = await import("../data/phrases.js");

test("normalize: kisbetű, írásjelek, összevonások, számok", () => {
  assert.deepEqual(normalize("I'm going to London!"), ["i", "am", "going", "to", "london"]);
  assert.deepEqual(normalize("I don't know, I'm gonna wait."), ["i", "do", "not", "know", "i", "am", "going", "to", "wait"]);
  assert.deepEqual(normalize("It takes 10 minutes"), ["it", "takes", "ten", "minutes"]);
  assert.deepEqual(normalize("I’ll call"), ["i", "will", "call"]);
});

test("compare: teljes egyezés és hiányzó szavak", () => {
  const full = compare("Could you repeat that, please?", "could you repeat that please");
  assert.equal(full.score, 1);
  const partial = compare("Could you repeat that, please?", "could you repeat");
  assert.deepEqual(partial.missing, ["that", "please"]);
  assert.ok(partial.score > 0.5 && partial.score < 0.7);
  assert.equal(compare("Hello there", "").score, 0);
});

test("compare: a fölösleges szavak rontanak, de nem nullázzák", () => {
  const r = compare("I like tea", "well I really like green tea");
  assert.ok(r.score < 1 && r.score > 0.6, `score=${r.score}`);
  assert.deepEqual(r.extra, ["well", "really", "green"]);
});

test("compareBest / compareAlternatives: a legjobb változatot választja", () => {
  const best = compareBest(["I'm fine, thanks.", "I'm good, thanks."], "i'm good thanks");
  assert.equal(best.score, 1);
  assert.equal(best.expected, "I'm good, thanks.");
  const alt = compareAlternatives(["Where is the station?"], ["where is this station", "where is the station"]);
  assert.equal(alt.score, 1);
  assert.equal(alt.heard, "where is the station");
  assert.equal(compareAlternatives(["x"], []).score, 0);
});

test("verdict küszöbök", () => {
  assert.equal(verdict(0.95), "correct");
  assert.equal(verdict(0.7), "almost");
  assert.equal(verdict(0.2), "wrong");
});

test("computeLevel: az első bukott szintnél megáll", () => {
  const r = [
    { level: "A1", score: 1 }, { level: "A1", score: 0.8 },
    { level: "A2", score: 0.7 }, { level: "A2", score: 0.6 },
    { level: "B1", score: 0.2 }, { level: "B1", score: 0.4 },
    { level: "B2", score: 0.9 },
  ];
  assert.equal(computeLevel(r), "A2");
  assert.equal(computeLevel([{ level: "A1", score: 0.1 }]), "A0");
  assert.equal(practiceLevel("B1", "A0"), "A1");
  assert.equal(practiceLevel("B1", "A2"), "A2");
});

test("detectCommand: csak rövid parancsot ismer fel", () => {
  assert.equal(detectCommand("repeat"), "repeat");
  assert.equal(detectCommand("Repeat please"), "repeat");
  assert.equal(detectCommand("slower"), "slower");
  assert.equal(detectCommand("next"), "next");
  assert.equal(detectCommand("Stop."), "stop");
  assert.equal(detectCommand("I want to stop smoking next year"), null);
  assert.equal(detectCommand("where is the station"), null);
});

test("planSession: a blokkok kiadják az időtartamot", () => {
  const plan = planSession(30, { withAi: true });
  const total = plan.reduce((s, b) => s + b.seconds, 0);
  assert.ok(Math.abs(total - 1800) <= 5);
  assert.ok(plan.some((b) => b.kind === "ai"));
  assert.ok(planSession(30).some((b) => b.kind === "qa"));
});

test("phrases: egyedi azonosítók, kitöltött mezők", () => {
  const ids = new Set(PHRASES.map((p) => p.id));
  assert.equal(ids.size, PHRASES.length);
  assert.ok(PHRASES.length >= 200, `csak ${PHRASES.length} mondat`);
  for (const p of PHRASES) {
    assert.ok(p.hu && p.en.length >= 1, p.id);
    assert.match(p.level, /^(A1|A2|B1|B2)$/);
    // a mintaválasznak önmagával 100%-ot kell adnia
    assert.equal(compare(p.en[0], p.en[0]).score, 1, p.id);
  }
});

test("Leitner: jó válasz feljebb viszi, rossz visszaejti", () => {
  let card = storage.recordAnswer("t-1", 1);
  assert.equal(card.box, 1);
  card = storage.recordAnswer("t-1", 1);
  assert.equal(card.box, 2);
  card = storage.recordAnswer("t-1", 0.2);
  assert.equal(card.box, 0);
});

test("pickCards: a kért darabszámot adja, szint szerint szűr", () => {
  const picked = storage.pickCards(PHRASES, 10, { level: "A1" });
  assert.equal(picked.length, 10);
  assert.ok(picked.every((p) => ["A1", "A2"].includes(p.level)));
  assert.equal(new Set(picked.map((p) => p.id)).size, 10);
});

test("streak és aktivitás", () => {
  storage.logActivity("car", 600, 20);
  assert.equal(storage.streak(), 1);
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(storage.activityDays()[today].seconds, 600);
});
