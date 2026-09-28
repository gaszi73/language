// Esti gyakorlás képernyővel: diktálás, kiejtés, fordítás szóban, gyors beszéd, minimálpárok.

import { PHRASES, TOPICS } from "../data/phrases.js";
import { CONNECTED, MINIMAL_PAIRS } from "../data/exercises.js";
import { compare, compareAlternatives, verdict } from "./score.js";
import { speak, listen, stopAll, support } from "./speech.js";
import { getSettings, pickCards, recordAnswer, logActivity, levelIndex, shuffle, cardStats } from "./storage.js";
import { html, mount, $, diffView, percent, VERDICT_TEXT } from "./ui.js";

const ROUND = 10;

const MODES = {
  dictation: { title: "Diktálás", icon: "🎧", desc: "Meghallgatod, begépeled. A hallás utáni értés legjobb edzése." },
  speak: { title: "Kiejtés", icon: "🗣️", desc: "Felolvasod a mondatot, a gép megmutatja, mit értett belőle." },
  translate: { title: "Mondd angolul", icon: "🔁", desc: "Magyar mondat → szóban angolul. Ez építi a beszédet." },
  connected: { title: "Gyors beszéd", icon: "⚡", desc: "gonna, wanna, whaddaya… ahogy a filmekben hallod." },
  pairs: { title: "Minimálpárok", icon: "👂", desc: "ship/sheep, three/tree – a hangok megkülönböztetése." },
};

export function render(container, mode) {
  let cancelled = false;
  let started = Date.now();
  let done = 0;

  if (!mode || !MODES[mode]) {
    const stats = cardStats(PHRASES);
    mount(container, html`
      <section class="card">
        <h2>Esti gyakorlás</h2>
        <p class="muted">Napi 15–20 perc: egy kör diktálás + egy kör „Mondd angolul” + 5 perc AI-beszélgetés ideális.</p>
        <p class="muted small">Mondatok: ${stats.started}/${stats.total} elkezdve, ${stats.learned} begyakorolva.</p>
      </section>
      <div class="grid">
        ${Object.entries(MODES).map(([key, m]) => html`
          <a class="tile" href="#/practice/${key}">
            <span class="tile-icon">${m.icon}</span>
            <b>${m.title}</b>
            <span class="muted small">${m.desc}</span>
          </a>`)}
        <a class="tile" href="#/tutor">
          <span class="tile-icon">🤖</span>
          <b>AI beszélgetés</b>
          <span class="muted small">Szabad beszélgetés javításokkal (API kulccsal).</span>
        </a>
      </div>`);
    return () => {};
  }

  const settings = getSettings();
  const level = settings.level;
  const maxLevel = levelIndex(level) + 1;

  function header(i, total) {
    return html`<p class="step"><a href="#/practice">← Gyakorlás</a> · ${MODES[mode].title} · ${i + 1}/${total}</p>`;
  }

  function roundEnd(scores) {
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    logActivity(mode, (Date.now() - started) / 1000, done);
    done = 0;
    started = Date.now();
    mount(container, html`
      <section class="card">
        <h2>Kör vége</h2>
        <p>Átlag: <b>${percent(avg)}</b> (${scores.length} feladat)</p>
        <div class="row">
          <button class="btn primary" id="again">Még egy kör</button>
          <a class="btn" href="#/practice">Vissza</a>
        </div>
      </section>`);
    // a router újrarajzolja a nézetet (és lefuttatja a takarítást)
    $(container, "#again").onclick = () => window.dispatchEvent(new HashChangeEvent("hashchange"));
  }

  // ---- Diktálás ----
  function dictation() {
    const items = pickCards(PHRASES, ROUND, { level });
    const scores = [];
    let slow = false;
    const step = (i) => {
      if (cancelled) return;
      if (i >= items.length) return roundEnd(scores);
      const item = items[i];
      const text = item.en[0];
      mount(container, html`
        <section class="card">
          ${header(i, items.length)}
          <div class="row">
            <button class="btn" id="play">▶ Lejátszás</button>
            <button class="btn" id="slow">🐢 Lassan</button>
          </div>
          <input type="text" id="answer" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Írd le, amit hallasz…">
          <div class="row"><button class="btn primary" id="check">Ellenőrzés</button></div>
          <div id="feedback"></div>
        </section>`);
      const play = (r) => speak(text, { rate: r }).then(() => $(container, "#answer")?.focus());
      $(container, "#play").onclick = () => play(settings.rate);
      $(container, "#slow").onclick = () => { slow = true; play(settings.slowRate); };
      const submit = () => {
        const res = compare(text, $(container, "#answer").value);
        // lassított meghallgatással kevesebbet ér
        const score = slow ? res.score * 0.8 : res.score;
        scores.push(score);
        recordAnswer(item.id, score);
        done++;
        $(container, "#check").disabled = true;
        $(container, "#feedback").innerHTML = html`
          <div class="feedback">
            <p>${diffView(res.tokens)}</p>
            <p class="muted">${item.hu} · ${percent(res.score)}</p>
            <div class="row">
              <button class="btn" id="replay">▶ Még egyszer</button>
              <button class="btn primary" id="next">Tovább</button>
            </div>
          </div>`.value;
        $(container, "#replay").onclick = () => speak(text, { rate: settings.rate });
        $(container, "#next").onclick = () => { slow = false; step(i + 1); };
        $(container, "#next").focus();
      };
      $(container, "#check").onclick = submit;
      $(container, "#answer").onkeydown = (e) => {
        if (e.key === "Enter" && !$(container, "#check").disabled) submit();
      };
      play(settings.rate);
    };
    step(0);
  }

  // ---- Közös mikrofonos lépés ----
  function micDrill({ items, prompt, expected, onScore, model }) {
    const scores = [];
    const step = (i) => {
      if (cancelled) return;
      if (i >= items.length) return roundEnd(scores);
      const item = items[i];
      mount(container, html`
        <section class="card">
          ${header(i, items.length)}
          ${prompt(item)}
          <div class="row">
            <button class="btn primary big" id="rec">🎤 Beszélj</button>
            <button class="btn" id="hint">💡 Minta</button>
            <button class="btn ghost" id="skip">Kihagy</button>
          </div>
          <p class="muted" id="status"></p>
          <div id="feedback"></div>
        </section>`);
      const status = $(container, "#status");
      $(container, "#hint").onclick = () => speak(model(item), { rate: settings.slowRate });
      $(container, "#skip").onclick = () => step(i + 1);
      $(container, "#rec").onclick = async () => {
        const btn = $(container, "#rec");
        btn.disabled = true;
        status.textContent = "Hallgatlak…";
        const { transcripts, error } = await listen({ timeoutMs: 9000 });
        if (cancelled) return;
        btn.disabled = false;
        if (!transcripts.length) {
          status.textContent = error === "not-allowed" ? "Nincs mikrofon-engedély." : "Nem hallottam semmit, próbáld újra.";
          return;
        }
        status.textContent = "";
        const res = compareAlternatives(expected(item), transcripts);
        const v = VERDICT_TEXT[verdict(res.score)];
        scores.push(res.score);
        onScore(item, res.score);
        done++;
        $(container, "#feedback").innerHTML = html`
          <div class="feedback">
            <p class="verdict ${v.cls}">${v.hu} ${percent(res.score)}</p>
            <p>Ezt értettem: <i>${res.heard}</i></p>
            <p>${diffView(res.tokens)}</p>
            <div class="row">
              <button class="btn" id="listen">▶ Helyes kiejtés</button>
              <button class="btn primary" id="next">Tovább</button>
            </div>
          </div>`.value;
        $(container, "#listen").onclick = () => speak(res.expected, { rate: settings.rate });
        $(container, "#next").onclick = () => step(i + 1);
        speak(res.expected, { rate: settings.rate });
      };
    };
    step(0);
  }

  function speakDrill() {
    micDrill({
      items: pickCards(PHRASES, ROUND, { level }),
      prompt: (item) => html`<p class="prompt">${item.en[0]}</p><p class="muted">${item.hu}</p>`,
      expected: (item) => [item.en[0]],
      model: (item) => item.en[0],
      onScore: (item, score) => recordAnswer(item.id, Math.min(score, 0.85)),
    });
  }

  function translateDrill() {
    micDrill({
      items: pickCards(PHRASES, ROUND, { level }),
      prompt: (item) => html`<p class="prompt">${item.hu}</p><p class="muted small">${TOPICS[item.topic].name} · ${item.level}</p>`,
      expected: (item) => item.en,
      model: (item) => item.en[0],
      onScore: (item, score) => recordAnswer(item.id, score),
    });
  }

  // ---- Gyors beszéd ----
  function connected() {
    const items = shuffle(CONNECTED.filter((c) => levelIndex(c.level) <= maxLevel)).slice(0, ROUND);
    const scores = [];
    const step = (i) => {
      if (cancelled) return;
      if (i >= items.length) return roundEnd(scores);
      const item = items[i];
      mount(container, html`
        <section class="card">
          ${header(i, items.length)}
          <p>Gyors tempóban hallod. Írd le rendes (teljes) alakban!</p>
          <div class="row">
            <button class="btn" id="fast">▶ Gyorsan</button>
            <button class="btn" id="slow">🐢 Lassan</button>
          </div>
          <input type="text" id="answer" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="pl. I am going to…">
          <div class="row"><button class="btn primary" id="check">Ellenőrzés</button></div>
          <div id="feedback"></div>
        </section>`);
      $(container, "#fast").onclick = () => speak(item.clear, { rate: 1.2 });
      $(container, "#slow").onclick = () => speak(item.clear, { rate: settings.slowRate });
      const submit = () => {
        const res = compare(item.clear, $(container, "#answer").value);
        scores.push(res.score);
        done++;
        $(container, "#check").disabled = true;
        $(container, "#feedback").innerHTML = html`
          <div class="feedback">
            <p>${diffView(res.tokens)}</p>
            <p>Így hangzik: <b>${item.fast}</b> <span class="muted">(${item.tip})</span></p>
            <p class="muted">${item.hu}</p>
            <div class="row">
              ${support.stt ? html`<button class="btn" id="say">🎤 Mondd gyorsan</button>` : ""}
              <button class="btn primary" id="next">Tovább</button>
            </div>
            <p id="sayres" class="muted"></p>
          </div>`.value;
        const sayBtn = $(container, "#say");
        if (sayBtn) {
          sayBtn.onclick = async () => {
            sayBtn.disabled = true;
            const { transcripts } = await listen({ timeoutMs: 7000 });
            sayBtn.disabled = false;
            const r = compareAlternatives([item.clear], transcripts);
            $(container, "#sayres").textContent = transcripts.length
              ? `Ezt értettem: „${r.heard}” – ${percent(r.score)}`
              : "Nem hallottam semmit.";
          };
        }
        $(container, "#next").onclick = () => step(i + 1);
      };
      $(container, "#check").onclick = submit;
      $(container, "#answer").onkeydown = (e) => {
        if (e.key === "Enter" && !$(container, "#check").disabled) submit();
      };
      speak(item.clear, { rate: 1.2 });
    };
    step(0);
  }

  // ---- Minimálpárok ----
  function pairs() {
    const items = shuffle(MINIMAL_PAIRS).slice(0, ROUND);
    const scores = [];
    const step = (i) => {
      if (cancelled) return;
      if (i >= items.length) return roundEnd(scores);
      const item = items[i];
      const target = Math.random() < 0.5 ? "a" : "b";
      const word = item[target];
      mount(container, html`
        <section class="card">
          ${header(i, items.length)}
          <p>Melyik szót hallod? <span class="muted small">(${item.sound})</span></p>
          <button class="btn" id="play">▶ Lejátszás</button>
          <div class="row pair">
            <button class="btn big" data-choice="a">${item.a}<br><span class="muted small">${item.huA}</span></button>
            <button class="btn big" data-choice="b">${item.b}<br><span class="muted small">${item.huB}</span></button>
          </div>
          <div id="feedback"></div>
        </section>`);
      $(container, "#play").onclick = () => speak(word, { rate: 0.8 });
      container.querySelectorAll("[data-choice]").forEach((btn) => {
        btn.onclick = () => {
          const ok = btn.dataset.choice === target;
          scores.push(ok ? 1 : 0);
          done++;
          container.querySelectorAll("[data-choice]").forEach((b) => { b.disabled = true; });
          $(container, "#feedback").innerHTML = html`
            <div class="feedback">
              <p class="verdict ${ok ? "good" : "bad"}">${ok ? "Helyes!" : `Nem, ez volt: ${word}`}</p>
              <div class="row">
                <button class="btn" id="both">▶ Mindkettő</button>
                ${support.stt ? html`<button class="btn" id="say">🎤 Mondd: ${word}</button>` : ""}
                <button class="btn primary" id="next">Tovább</button>
              </div>
              <p id="sayres" class="muted"></p>
            </div>`.value;
          $(container, "#both").onclick = async () => {
            await speak(item.a, { rate: 0.8 });
            await speak(item.b, { rate: 0.8 });
          };
          const sayBtn = $(container, "#say");
          if (sayBtn) {
            sayBtn.onclick = async () => {
              sayBtn.disabled = true;
              const { transcripts } = await listen({ timeoutMs: 5000, maxAlternatives: 5 });
              sayBtn.disabled = false;
              const heardOk = transcripts.some((t) => compare(word, t).score === 1);
              const heardOther = transcripts[0] || "";
              $(container, "#sayres").textContent = heardOk
                ? `Szuper, „${word}”-nek hallottam.`
                : transcripts.length ? `Ezt hallottam: „${heardOther}”. Próbáld újra!` : "Nem hallottam semmit.";
            };
          }
          $(container, "#next").onclick = () => step(i + 1);
        };
      });
      speak(word, { rate: 0.8 });
    };
    step(0);
  }

  const needsMic = mode === "speak" || mode === "translate";
  if (needsMic && !support.stt) {
    mount(container, html`
      <section class="card">
        <p class="warn">Ehhez beszédfelismerés kell. Használj Chrome-ot vagy Edge-et (Androidon Chrome).</p>
        <a class="btn" href="#/practice">Vissza</a>
      </section>`);
    return () => {};
  }

  ({ dictation, speak: speakDrill, translate: translateDrill, connected, pairs })[mode]();

  return () => {
    cancelled = true;
    stopAll();
    if (done) logActivity(mode, (Date.now() - started) / 1000, done);
  };
}
