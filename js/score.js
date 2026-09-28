// Szövegösszevetés: a hallott/gépelt szöveget hasonlítja a várt mondathoz.
// Szó szintű LCS-illesztést használ, így a sorrendhibákat és hiányzó szavakat is jelzi.

const CONTRACTIONS = {
  "i'm": "i am", "you're": "you are", "we're": "we are", "they're": "they are",
  "he's": "he is", "she's": "she is", "it's": "it is", "that's": "that is",
  "what's": "what is", "where's": "where is", "who's": "who is", "there's": "there is",
  "how's": "how is", "here's": "here is", "let's": "let us",
  "i've": "i have", "you've": "you have", "we've": "we have", "they've": "they have",
  "i'll": "i will", "you'll": "you will", "we'll": "we will", "they'll": "they will",
  "he'll": "he will", "she'll": "she will", "it'll": "it will",
  "i'd": "i would", "you'd": "you would", "we'd": "we would", "they'd": "they would",
  "he'd": "he would", "she'd": "she would",
  "don't": "do not", "doesn't": "does not", "didn't": "did not",
  "isn't": "is not", "aren't": "are not", "wasn't": "was not", "weren't": "were not",
  "haven't": "have not", "hasn't": "has not", "hadn't": "had not",
  "won't": "will not", "wouldn't": "would not", "can't": "can not", "cannot": "can not",
  "couldn't": "could not", "shouldn't": "should not", "mustn't": "must not",
  "gonna": "going to", "wanna": "want to", "gotta": "got to", "kinda": "kind of",
  "gimme": "give me", "lemme": "let me", "dunno": "do not know", "ya": "you",
  "ok": "okay", "o.k.": "okay", "mr": "mister", "mrs": "missus", "dr": "doctor",
};

const NUMBERS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
  "eighteen", "nineteen", "twenty",
];

export function normalize(text) {
  if (!text) return [];
  const cleaned = String(text)
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ");
  const words = [];
  for (const raw of cleaned.split(/\s+/)) {
    const w = raw.replace(/^'+|'+$/g, "");
    if (!w) continue;
    if (CONTRACTIONS[w]) {
      words.push(...CONTRACTIONS[w].split(" "));
    } else if (/^\d+$/.test(w) && Number(w) <= 20) {
      words.push(NUMBERS[Number(w)]);
    } else if (w.endsWith("'s")) {
      // birtokos 's: "John's" ~ "johns"
      words.push(w.slice(0, -2) + "s");
    } else {
      words.push(w.replace(/'/g, ""));
    }
  }
  return words;
}

// LCS a két szólistán; visszaadja a várt szavak közül az eltalált indexeket.
function lcsMatches(expected, heard) {
  const n = expected.length;
  const m = heard.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = expected[i] === heard[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const matchedExpected = new Set();
  const matchedHeard = new Set();
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (expected[i] === heard[j]) {
      matchedExpected.add(i);
      matchedHeard.add(j);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return { matchedExpected, matchedHeard };
}

// Összevet egy választ egy várt mondattal.
// score: 0..1 — a várt szavak arányában, a fölösleges szavak kicsit rontják.
export function compare(expectedText, heardText) {
  const expected = normalize(expectedText);
  const heard = normalize(heardText);
  if (expected.length === 0) {
    return { score: heard.length === 0 ? 1 : 0, tokens: [], missing: [], extra: heard };
  }
  const { matchedExpected, matchedHeard } = lcsMatches(expected, heard);
  const tokens = expected.map((word, idx) => ({ word, ok: matchedExpected.has(idx) }));
  const missing = tokens.filter((t) => !t.ok).map((t) => t.word);
  const extra = heard.filter((_, idx) => !matchedHeard.has(idx));
  const recall = matchedExpected.size / expected.length;
  const penalty = Math.min(0.3, (extra.length / Math.max(expected.length, 1)) * 0.5);
  const score = Math.max(0, Math.min(1, recall - penalty));
  return { score, tokens, missing, extra };
}

// Több elfogadott változat közül a legjobb egyezést adja vissza.
export function compareBest(variants, heardText) {
  const list = Array.isArray(variants) ? variants : [variants];
  let best = null;
  for (const v of list) {
    const result = { ...compare(v, heardText), expected: v };
    if (!best || result.score > best.score) best = result;
  }
  return best;
}

// Több felismerési alternatívát (a böngésző adhat többet) is figyelembe vesz.
export function compareAlternatives(variants, alternatives) {
  const alts = Array.isArray(alternatives) && alternatives.length ? alternatives : [""];
  let best = null;
  for (const heard of alts) {
    const result = { ...compareBest(variants, heard), heard };
    if (!best || result.score > best.score) best = result;
  }
  return best;
}

export function verdict(score) {
  if (score >= 0.9) return "correct";
  if (score >= 0.6) return "almost";
  return "wrong";
}
