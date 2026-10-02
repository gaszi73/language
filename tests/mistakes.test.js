import { test } from "node:test";
import assert from "node:assert/strict";

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { compare, compareAlternatives } = await import("../js/score.js");
const m = await import("../js/mistakes.js");
const { parsePracticeLines } = await import("../js/tutor.js");
const { buildReportText } = await import("../js/report.js");

const patternsFor = (expected, heard) => {
  const r = compare(expected, heard);
  return m.detectPatterns({ expected, heard, missing: r.missing, extra: r.extra, score: r.score });
};

test("hibaminták felismerése", () => {
  assert.deepEqual(patternsFor("Where is the station?", ""), ["silent"]);
  assert.ok(patternsFor("I'm very tired today.", "I very tired today").includes("aux"));
  assert.ok(patternsFor("Can I have a coffee?", "can I have coffee").includes("article"));
  assert.ok(patternsFor("I'm waiting for the bus.", "I'm waiting the bus").includes("prep"));
  assert.ok(patternsFor("He works in London.", "he work in London").includes("ending_s"));
  assert.ok(patternsFor("I worked yesterday.", "I work yesterday").includes("ending_ed"));
  assert.ok(patternsFor("I think so.", "I sink so").includes("th"));
  assert.ok(patternsFor("We live in the west.", "we live in the vest").includes("wv"));
  assert.ok(patternsFor("Where are you going?", "where you are going").includes("order"));
  assert.ok(patternsFor("I need to leave now.", "I need to live now").includes("similar"));
  assert.deepEqual(patternsFor("Good morning", "good morning"), []);
});

test("makacs mondat: hiba után bekerül, 3 helyes fordítás után begyakorolt", () => {
  const bad = compareAlternatives(["I'm fine, thanks."], ["I fine"]);
  m.recordResult({ mode: "translate", itemId: "basics-2", expected: "I'm fine, thanks.", hu: "Jól vagyok, köszönöm.", result: bad });
  m.recordResult({ mode: "translate", itemId: "basics-2", expected: "I'm fine, thanks.", hu: "Jól vagyok, köszönöm.", result: bad });
  let weak = m.activeWeakItems().find((w) => w.key === "basics-2");
  assert.equal(weak.fails, 2);
  assert.equal(weak.lastHeard, "I fine");

  const good = compareAlternatives(["I'm fine, thanks."], ["I'm fine thanks"]);
  // utánmondás sikere még nem számít begyakorlásnak
  m.recordResult({ mode: "shadow", itemId: "basics-2", expected: "I'm fine, thanks.", result: good });
  assert.equal(m.activeWeakItems().find((w) => w.key === "basics-2").streak || 0, 0);
  for (let i = 0; i < 3; i++) {
    m.recordResult({ mode: "review", itemId: "basics-2", expected: "I'm fine, thanks.", result: good });
  }
  assert.equal(m.activeWeakItems().find((w) => w.key === "basics-2"), undefined);
  assert.ok(m.masteredSince(1).some((w) => w.key === "basics-2"));

  // újabb hiba: visszakerül
  m.recordResult({ mode: "translate", itemId: "basics-2", expected: "I'm fine, thanks.", result: bad });
  weak = m.activeWeakItems().find((w) => w.key === "basics-2");
  assert.equal(weak.fails, 3);
  assert.equal(weak.streak, 0);
});

test("minimálpár hiba csak naplózódik, nem lesz makacs mondat", () => {
  m.recordResult({
    mode: "pairs", itemId: "m1", expected: "ship", heard: "sheep",
    result: { score: 0, missing: ["ship"], extra: ["sheep"] }, extraPatterns: ["sound:i: / ɪ"],
  });
  assert.equal(m.activeWeakItems().find((w) => w.key === "m1"), undefined);
  const today = m.logForDay(m.daysWithMistakes()[0]);
  assert.ok(today.some((e) => e.patterns.includes("sound:i: / ɪ")));
});

test("AI-javítás kiolvasása és felvétele", () => {
  assert.equal(m.extractAiTip("Small tip: say 'I went to work.' Nice! Where do you work?"), "I went to work.");
  assert.equal(m.extractAiTip("Small tip: say “I have been there.” Great."), "I have been there.");
  assert.equal(m.extractAiTip("Great answer! What else?"), null);
  m.recordAiCorrection("I go to work yesterday", "Small tip: say 'I went to work yesterday.' What did you do?");
  assert.ok(m.activeWeakItems().some((w) => w.en === "I went to work yesterday." && w.lastHeard === "I go to work yesterday"));
});

test("AI gyakorló mondatok feldolgozása", () => {
  const text = "1. Névelők...\n\nGYAKORLÓ MONDATOK\nEN: I need a new car. | HU: Kell egy új autó.\n- EN: She works at a bank. | HU: Bankban dolgozik.\nvalami más";
  const items = parsePracticeLines(text);
  assert.deepEqual(items, [
    { en: "I need a new car.", hu: "Kell egy új autó." },
    { en: "She works at a bank.", hu: "Bankban dolgozik." },
  ]);
  assert.equal(m.addPracticeItems(items), 2);
  assert.equal(m.addPracticeItems(items), 0);
  assert.ok(m.weakAsItems().some((it) => it.en[0] === "She works at a bank." && it.hu === "Bankban dolgozik."));
});

test("weakAsItems: gyűjteménybeli mondatnál az összes elfogadott változat", () => {
  m.recordResult({ mode: "translate", itemId: "basics-1", expected: "Hi, how are you?", result: { score: 0.2, missing: [], extra: [] } });
  const item = m.weakAsItems().find((it) => it.id === "basics-1");
  assert.ok(item.en.length > 1);
  assert.equal(item.hu, "Szia, hogy vagy?");
});

test("analyze + napi szöveges napló", () => {
  const day = m.daysWithMistakes()[0];
  const entries = m.logForDay(day);
  const a = m.analyze(entries);
  assert.ok(a.total >= 4);
  assert.equal(a.sentences[0].expected, "I'm fine, thanks.");
  const text = buildReportText(day, { entries, activity: { seconds: 1800, items: 40 }, weak: m.activeWeakItems(), mastered: m.masteredSince(7) });
  assert.match(text, /30 perc, 40 feladat/);
  assert.match(text, /MA NEM MENT/);
  assert.match(text, /MAKACS MONDATOK/);
  assert.match(text, /Segédigék/);
});
