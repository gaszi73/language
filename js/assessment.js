// Szintfelmérés: hallás (diktálás + párbeszéd), kiejtés (felolvasás), aktív beszéd (fordítás szóban).

import { DICTATION, DIALOGUES, READ_ALOUD, TRANSLATE, LEVELS } from "../data/assessment.js";
import { compare, compareAlternatives } from "./score.js";
import { speak, listen, stopAll, support, wait } from "./speech.js";
import { addAssessment, getSettings, logActivity } from "./storage.js";
import { html, mount, $, diffView, percent } from "./ui.js";

// A legmagasabb szint, ameddig minden szinten legalább 60% az átlag.
export function computeLevel(results, threshold = 0.6) {
  let reached = "A0";
  for (const level of LEVELS) {
    const items = results.filter((r) => r.level === level);
    if (!items.length) continue;
    const avg = items.reduce((sum, r) => sum + r.score, 0) / items.length;
    if (avg >= threshold) reached = level;
    else break;
  }
  return reached;
}

export function practiceLevel(...levels) {
  const order = ["A0", ...LEVELS];
  const min = Math.min(...levels.map((l) => order.indexOf(l)));
  return order[Math.max(1, min)]; // gyakorláshoz legalább A1
}

export const LEVEL_TEXT = {
  A0: "kezdő (A1 alatt)",
  A1: "A1 – alapszint",
  A2: "A2 – alapszint+",
  B1: "B1 – középszint",
  B2: "B2 – középszint+",
};

export function render(container) {
  const results = { dictation: [], dialogue: [], read: [], translate: [] };
  const started = Date.now();
  let cancelled = false;

  function intro() {
    mount(container, html`
      <section class="card">
        <h2>Szintfelmérés</h2>
        <p>Kb. 15 perc. Négy rész, mindegyik könnyűtől nehézig halad. Nem baj, ha a végén már nem megy – pont ezt mérjük.</p>
        <ol>
          <li><b>Diktálás</b> – meghallgatsz egy mondatot, begépeled.</li>
          <li><b>Párbeszéd</b> – meghallgatsz egy rövid beszélgetést, kérdésekre válaszolsz.</li>
          <li><b>Felolvasás</b> – angol mondatot olvasol fel a mikrofonba (kiejtés).</li>
          <li><b>Szóban fordítás</b> – magyar mondatot mondasz el angolul.</li>
        </ol>
        <p class="muted">Az olvasást nem mérjük – azt írtad, a normál szövegeket megérted (kb. B2).</p>
        ${support.stt ? "" : html`<p class="warn">Ez a böngésző nem támogatja a beszédfelismerést, így a 3–4. részt kihagyjuk. Használj Chrome-ot vagy Edge-et.</p>`}
        <button class="btn primary big" id="start">Kezdjük</button>
      </section>`);
    $(container, "#start").onclick = () => dictation(0);
  }

  function dictation(i) {
    if (cancelled) return;
    if (i >= DICTATION.length) return dialogue(0);
    const item = DICTATION[i];
    let plays = 0;
    mount(container, html`
      <section class="card">
        <p class="step">1. rész – Diktálás · ${i + 1}/${DICTATION.length}</p>
        <p>Hallgasd meg, és írd le, amit hallottál. Egyszer újrahallgathatod.</p>
        <div class="row">
          <button class="btn" id="play">▶ Lejátszás</button>
          <span class="muted" id="plays"></span>
        </div>
        <input type="text" id="answer" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Ide írd, amit hallottál…">
        <div class="row">
          <button class="btn primary" id="check">Ellenőrzés</button>
          <button class="btn ghost" id="skip">Nem értettem</button>
        </div>
        <div id="feedback"></div>
      </section>`);
    const play = async () => {
      if (plays >= 2) return;
      plays++;
      $(container, "#plays").textContent = plays >= 2 ? "(többször nem játszható le)" : "";
      $(container, "#play").disabled = plays >= 2;
      await speak(item.text, { rate: item.rate });
      $(container, "#answer").focus();
    };
    $(container, "#play").onclick = play;
    const finish = (typed) => {
      const res = compare(item.text, typed);
      results.dictation.push({ level: item.level, score: res.score });
      $(container, "#feedback").innerHTML = html`
        <div class="feedback">
          <p>Eredeti: ${diffView(res.tokens)}</p>
          <p class="muted">Egyezés: ${percent(res.score)}</p>
          <button class="btn primary" id="next">Tovább</button>
        </div>`.value;
      $(container, "#check").disabled = true;
      $(container, "#skip").disabled = true;
      $(container, "#next").onclick = () => dictation(i + 1);
      $(container, "#next").focus();
    };
    $(container, "#check").onclick = () => finish($(container, "#answer").value);
    $(container, "#skip").onclick = () => finish("");
    $(container, "#answer").onkeydown = (e) => { if (e.key === "Enter" && !$(container, "#check").disabled) finish(e.target.value); };
    play();
  }

  async function playDialogue(d) {
    for (const [who, line] of d.lines) {
      if (cancelled) return;
      await speak(line, { rate: d.rate, voiceIndex: who === "A" ? 0 : 1, pitch: who === "A" ? 1 : 0.85 });
      await wait(250);
    }
  }

  function dialogue(i) {
    if (cancelled) return;
    if (i >= DIALOGUES.length) return support.stt ? readAloud(0) : results_();
    const d = DIALOGUES[i];
    let plays = 0;
    mount(container, html`
      <section class="card">
        <p class="step">2. rész – Párbeszéd · ${i + 1}/${DIALOGUES.length}</p>
        <p>Hallgasd meg a beszélgetést (kétszer lehet), aztán válaszolj.</p>
        <button class="btn" id="play">▶ Lejátszás</button>
        <form id="qs">
          ${d.questions.map((q, qi) => html`
            <fieldset>
              <legend>${q.q}</legend>
              ${q.options.map((o, oi) => html`<label class="opt"><input type="radio" name="q${qi}" value="${oi}"> ${o}</label>`)}
            </fieldset>`)}
          <button class="btn primary" type="submit">Tovább</button>
        </form>
        <details class="muted"><summary>Szöveg megmutatása (csak válasz után)</summary><div id="script"></div></details>
      </section>`);
    const playBtn = $(container, "#play");
    playBtn.onclick = async () => {
      if (plays >= 2) return;
      plays++;
      playBtn.disabled = true;
      await playDialogue(d);
      playBtn.disabled = plays >= 2;
    };
    $(container, "#qs").onsubmit = (e) => {
      e.preventDefault();
      d.questions.forEach((q, qi) => {
        const chosen = container.querySelector(`input[name=q${qi}]:checked`);
        results.dialogue.push({ level: d.level, score: chosen && Number(chosen.value) === q.answer ? 1 : 0 });
      });
      stopAll();
      dialogue(i + 1);
    };
    playBtn.onclick();
  }

  function micStep({ step, title, prompt, expected, level, onDone, target, allowRetry = true }) {
    let attempts = 0;
    let best = null;
    mount(container, html`
      <section class="card">
        <p class="step">${step}</p>
        <p>${title}</p>
        <p class="prompt">${prompt}</p>
        <div class="row">
          <button class="btn primary big" id="rec">🎤 Beszélj</button>
          <button class="btn ghost" id="skip">Kihagyom</button>
        </div>
        <p class="muted" id="status"></p>
        <div id="feedback"></div>
      </section>`);
    const status = $(container, "#status");
    const next = () => { target.push({ level, score: best ? best.score : 0 }); onDone(); };
    $(container, "#skip").onclick = next;
    $(container, "#rec").onclick = async () => {
      const btn = $(container, "#rec");
      btn.disabled = true;
      status.textContent = "Hallgatlak…";
      const { transcripts, error } = await listen({ timeoutMs: 9000 });
      if (cancelled) return;
      attempts++;
      if (!transcripts.length) {
        status.textContent = error === "not-allowed"
          ? "Nincs mikrofon-engedély. Engedélyezd a böngészőben."
          : "Nem hallottam semmit. Próbáld újra, hangosabban.";
        btn.disabled = false;
        return;
      }
      const res = compareAlternatives(expected, transcripts);
      if (!best || res.score > best.score) best = res;
      status.textContent = "";
      $(container, "#feedback").innerHTML = html`
        <div class="feedback">
          <p>Ezt értettem: <i>${res.heard}</i></p>
          <p>Várt mondat: ${diffView(res.tokens)}</p>
          <p class="muted">Egyezés: ${percent(res.score)}</p>
          <div class="row">
            ${allowRetry && attempts < 2 && res.score < 0.9 ? html`<button class="btn" id="retry">Még egyszer</button>` : ""}
            <button class="btn primary" id="next">Tovább</button>
          </div>
        </div>`.value;
      const retry = $(container, "#retry");
      if (retry) retry.onclick = () => { $(container, "#feedback").innerHTML = ""; btn.disabled = false; btn.onclick(); };
      $(container, "#next").onclick = next;
    };
  }

  function readAloud(i) {
    if (cancelled) return;
    if (i >= READ_ALOUD.length) return translate(0);
    const item = READ_ALOUD[i];
    micStep({
      step: `3. rész – Felolvasás · ${i + 1}/${READ_ALOUD.length}`,
      title: "Nyomd meg a gombot, és olvasd fel hangosan, természetes tempóban:",
      prompt: item.text,
      expected: [item.text],
      level: item.level,
      target: results.read,
      onDone: () => readAloud(i + 1),
    });
  }

  function translate(i) {
    if (cancelled) return;
    if (i >= TRANSLATE.length) return results_();
    const item = TRANSLATE[i];
    micStep({
      step: `4. rész – Szóban fordítás · ${i + 1}/${TRANSLATE.length}`,
      title: "Mondd el angolul (nem kell szóról szóra):",
      prompt: item.hu,
      expected: item.en,
      level: item.level,
      target: results.translate,
      allowRetry: false,
      onDone: () => translate(i + 1),
    });
  }

  function results_() {
    const listening = computeLevel([...results.dictation, ...results.dialogue]);
    const hasSpeech = results.read.length > 0;
    const pronunciation = hasSpeech ? computeLevel(results.read) : null;
    const speaking = hasSpeech ? computeLevel(results.translate) : null;
    const level = practiceLevel(listening, speaking || listening);
    const avg = (list) => (list.length ? list.reduce((s, r) => s + r.score, 0) / list.length : 0);
    const summary = {
      listening,
      pronunciation,
      speaking,
      level,
      scores: {
        dictation: avg(results.dictation),
        dialogue: avg(results.dialogue),
        read: avg(results.read),
        translate: avg(results.translate),
      },
    };
    addAssessment(summary);
    logActivity("assessment", (Date.now() - started) / 1000, 1);

    mount(container, html`
      <section class="card">
        <h2>Eredmény</h2>
        <table class="results">
          <tr><th>Készség</th><th>Becsült szint</th><th>Átlag</th></tr>
          <tr><td>Olvasás (önbevallás)</td><td>B2</td><td>–</td></tr>
          <tr><td>Hallás utáni értés</td><td>${LEVEL_TEXT[listening]}</td><td>${percent((summary.scores.dictation + summary.scores.dialogue) / 2)}</td></tr>
          ${hasSpeech ? html`
          <tr><td>Kiejtés</td><td>${LEVEL_TEXT[pronunciation]}</td><td>${percent(summary.scores.read)}</td></tr>
          <tr><td>Aktív beszéd</td><td>${LEVEL_TEXT[speaking]}</td><td>${percent(summary.scores.translate)}</td></tr>` : ""}
        </table>
        <p>A gyakorlások ettől a szinttől indulnak: <b>${level}</b>. (A Beállításokban módosíthatod.)</p>
        <p class="muted">Tipp: 4 hét múlva és a 12. hét végén ismételd meg a felmérést – a Kezdőlapon látod majd a fejlődést.</p>
        <div class="row">
          <a class="btn primary" href="#/car">Autós mód</a>
          <a class="btn" href="#/">Kezdőlap</a>
        </div>
      </section>`);
  }

  getSettings();
  intro();
  return () => {
    cancelled = true;
    stopAll();
  };
}
