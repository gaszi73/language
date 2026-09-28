// Autós mód: teljesen kihangosított beszédgyakorlás. Indítás után nem kell hozzányúlni.
// Hangparancsok (angolul): "repeat", "slower", "next" / "skip", "pause", "stop".

import { PHRASES } from "../data/phrases.js";
import { CONNECTED, QUESTIONS } from "../data/exercises.js";
import { compareAlternatives, normalize, verdict } from "./score.js";
import { speak, listen, stopAll, support, getVoices, wait } from "./speech.js";
import { getSettings, updateSettings, pickCards, recordAnswer, logActivity, getCard, levelIndex, shuffle } from "./storage.js";
import { createTutor, isConfigured, SCENARIOS } from "./tutor.js";
import { html, mount, $ } from "./ui.js";

class Stopped extends Error {}

const COMMANDS = {
  repeat: ["repeat", "again", "once more", "one more time", "say again", "say it again"],
  slower: ["slower", "slowly", "slow down", "more slowly"],
  next: ["next", "skip", "pass", "next one"],
  pause: ["pause", "wait", "hold on"],
  stop: ["stop", "finish", "end", "quit", "stop practice"],
};

// Csak rövid megszólalást tekintünk parancsnak, hogy a válaszokat ne értsük félre.
export function detectCommand(transcript) {
  const words = normalize(transcript);
  if (!words.length || words.length > 4) return null;
  const text = words.join(" ");
  for (const [cmd, phrases] of Object.entries(COMMANDS)) {
    if (phrases.some((p) => text === p || text === `${p} please` || text === `please ${p}`)) return cmd;
  }
  return null;
}

// A menet blokkjai és időarányuk.
export function planSession(minutes, { withAi = false } = {}) {
  const blocks = [
    { kind: "shadow", name: "Bemelegítés: hallgasd és ismételd", weight: 0.15 },
    { kind: "translate", name: "Fordítós gyakorlat", weight: 0.3 },
    { kind: "connected", name: "Gyors, összevont beszéd", weight: 0.15 },
    withAi
      ? { kind: "ai", name: "Beszélgetés az AI-val", weight: 0.25 }
      : { kind: "qa", name: "Kérdés–válasz", weight: 0.25 },
    { kind: "review", name: "Ismétlés: a hibázott mondatok", weight: 0.15 },
  ];
  return blocks.map((b) => ({ ...b, seconds: Math.round(minutes * 60 * b.weight) }));
}

export function render(container) {
  const settings = getSettings();
  let hasHu = getVoices("hu").length > 0;
  let running = false;
  let paused = false;
  let resumeWaiter = null;
  let wakeLock = null;
  let startedAt = 0;
  let stats = { items: 0, correct: 0 };
  let rate = settings.rate;

  function setup() {
    hasHu = getVoices("hu").length > 0;
    const aiReady = isConfigured();
    mount(container, html`
      <section class="card">
        <h2>🚗 Autós mód</h2>
        <p>Kihangosított gyakorlás vezetés közben: az app beszél, te válaszolsz, magától halad tovább. Indítás után <b>ne nyúlj a telefonhoz</b>.</p>
        <ul class="muted small">
          <li>Tedd a telefont tartóba, kösd a kocsi hangszórójára (Bluetooth), a képernyő maradjon bekapcsolva.</li>
          <li>Hangparancsok angolul: <b>“repeat”</b> (ismét), <b>“slower”</b> (lassabban), <b>“next”</b> (következő), <b>“pause”</b>, <b>“stop”</b>.</li>
          <li>Ha nem értett meg, nem baj – ilyenkor elmondja a helyes választ, és megy tovább.</li>
        </ul>
        ${support.stt ? "" : html`<p class="warn">Ez a böngésző nem támogatja a beszédfelismerést: csak meghallgatós mód lesz (a válaszokat nem ellenőrzi). Androidon Chrome ajánlott.</p>`}
        ${hasHu ? "" : html`<p class="warn">Nincs magyar felolvasó hang telepítve: a magyar mondatokat nem tudja kimondani, ezért a fordítós rész helyett utánmondás lesz. (Android: Beállítások → Szövegfelolvasás → Google → magyar hang letöltése.)</p>`}
        <label>Időtartam
          <select id="minutes">
            <option value="10">10 perc</option>
            <option value="15">15 perc</option>
            <option value="30" selected>30 perc</option>
            <option value="45">45 perc</option>
          </select>
        </label>
        <label>Tempó
          <select id="rate">
            ${[0.7, 0.8, 0.85, 0.9, 1].map((r) => html`<option value="${r}" ${r === Number(settings.rate) ? "selected" : ""}>${r === 1 ? "természetes (1.0)" : r}</option>`)}
          </select>
        </label>
        <label class="check"><input type="checkbox" id="ai" ${aiReady ? "" : "disabled"}> AI beszélgetés a kérdés–válasz rész helyett ${aiReady ? "" : html`<span class="muted">(ehhez API kulcs kell a Beállításokban)</span>`}</label>
        <label id="scenario-wrap" hidden>Téma
          <select id="scenario">${SCENARIOS.map((s) => html`<option value="${s.id}" ${s.id === "car" ? "selected" : ""}>${s.label}</option>`)}</select>
        </label>
        <button class="btn primary huge" id="start">▶ Indítás</button>
      </section>`);
    $(container, "#ai").onchange = (e) => { $(container, "#scenario-wrap").hidden = !e.target.checked; };
    $(container, "#start").onclick = () => {
      const minutes = Number($(container, "#minutes").value);
      rate = Number($(container, "#rate").value);
      updateSettings({ rate });
      const withAi = $(container, "#ai").checked;
      const scenarioId = $(container, "#scenario").value;
      start(minutes, withAi, scenarioId);
    };
  }

  function driveScreen() {
    mount(container, html`
      <section class="drive">
        <p class="drive-block" id="block">Indul…</p>
        <p class="drive-text" id="text"></p>
        <p class="drive-hu" id="hu"></p>
        <p class="drive-status" id="status"></p>
        <p class="drive-stats" id="stats"></p>
        <div class="drive-buttons">
          <button class="btn huge" id="pause">⏸ Szünet</button>
          <button class="btn huge danger" id="stop">■ Vége</button>
        </div>
      </section>`);
    $(container, "#pause").onclick = () => (paused ? resume() : pause());
    $(container, "#stop").onclick = () => finish();
  }

  const show = (id, text) => {
    const node = $(container, `#${id}`);
    if (node) node.textContent = text || "";
  };
  const updateStats = () => {
    const mins = Math.floor((Date.now() - startedAt) / 60000);
    show("stats", `${mins} perc · ${stats.items} mondat · ${stats.correct} helyes`);
  };

  function check() {
    if (!running) throw new Stopped();
  }

  async function gate() {
    check();
    while (paused) {
      await new Promise((resolve) => { resumeWaiter = resolve; });
      check();
    }
  }

  function pause() {
    paused = true;
    stopAll();
    show("status", "Szünet – mondd: “continue”, vagy nyomd meg a gombot.");
    $(container, "#pause").textContent = "▶ Folytatás";
    listenForResume();
  }

  async function listenForResume() {
    // szünetben is figyel a "continue" szóra
    while (running && paused) {
      const { transcripts } = await listen({ timeoutMs: 7000 });
      if (!running || !paused) return;
      const words = normalize(transcripts.join(" "));
      if (words.some((w) => ["continue", "resume", "go", "start"].includes(w))) {
        resume();
        return;
      }
      if (words.includes("stop")) {
        finish();
        return;
      }
      if (!support.stt) await wait(1000);
    }
  }

  function resume() {
    paused = false;
    stopAll();
    const btn = $(container, "#pause");
    if (btn) btn.textContent = "⏸ Szünet";
    show("status", "");
    if (resumeWaiter) resumeWaiter();
  }

  // Ha közben szünetet nyomtak, a félbeszakadt mondatot folytatáskor újra elmondja.
  async function say(text, opts = {}) {
    let result;
    do {
      await gate();
      result = await speak(text, { rate, ...opts });
      check();
    } while (result.aborted && paused);
  }

  async function sayHu(text) {
    if (!hasHu || !text) return gate();
    let result;
    do {
      await gate();
      result = await speak(text, { lang: "hu-HU", rate: 1 });
      check();
    } while (result.aborted && paused);
  }

  // Meghallgat egy választ. Parancs esetén { cmd }, egyébként { transcripts }.
  async function hear(timeoutMs = 8000) {
    await gate();
    if (!support.stt) {
      show("status", "…");
      await wait(Math.min(timeoutMs, 4000));
      check();
      return { transcripts: [] };
    }
    show("status", "🎤 Te jössz…");
    const { transcripts } = await listen({ timeoutMs });
    check();
    show("status", "");
    if (paused) {
      await gate();
      return { cmd: "repeat" };
    }
    for (const t of transcripts) {
      const cmd = detectCommand(t);
      if (cmd === "stop") { await finish(); throw new Stopped(); }
      if (cmd === "pause") { pause(); await gate(); return { cmd: "repeat" }; }
      if (cmd) return { cmd };
    }
    return { transcripts };
  }

  // Egy ellenőrzött válasz: megismétli, ha kérik, legfeljebb néhányszor.
  async function prompted(promptFn, expected, { timeoutMs = 8000 } = {}) {
    for (let tries = 0; tries < 4; tries++) {
      await promptFn();
      const res = await hear(timeoutMs);
      if (res.cmd === "repeat") continue;
      if (res.cmd === "slower") { rate = Math.max(0.6, rate - 0.1); continue; }
      if (res.cmd === "next") return { skipped: true };
      if (!res.transcripts.length) return { score: 0, heard: "", silent: true };
      return compareAlternatives(expected, res.transcripts);
    }
    return { skipped: true };
  }

  async function feedback(result, model) {
    const v = verdict(result.score || 0);
    stats.items++;
    if (v === "correct") {
      stats.correct++;
      await say(pick(["Correct!", "Great!", "Perfect!", "Well done!", "Exactly!"]), { rate: 1 });
      await say(model);
    } else if (v === "almost") {
      await say("Almost. Listen:", { rate: 1 });
      await say(model);
    } else {
      await say(result.silent ? "Listen:" : "Not quite. Listen:", { rate: 1 });
      await say(model, { rate: Math.max(0.6, rate - 0.1) });
    }
    updateStats();
    return v;
  }

  // ---- Blokkok ----

  async function shadowItem(item) {
    const model = item.en[0];
    show("text", model);
    show("hu", item.hu);
    const result = await prompted(() => say(model, { rate: settings.slowRate }), [model]);
    if (result.skipped) return;
    if (verdict(result.score) === "wrong" && !result.silent) {
      await say("Once more:", { rate: 1 });
      const again = await prompted(() => say(model, { rate: settings.slowRate }), [model]);
      if (!again.skipped && again.score > result.score) Object.assign(result, again);
    }
    stats.items++;
    if (result.score >= 0.9) stats.correct++;
    updateStats();
    await say(model); // természetes tempóban még egyszer
    recordAnswer(item.id, Math.min(result.score, 0.85)); // az utánmondás nem jelenti, hogy "tudja" a mondatot
  }

  async function translateItem(item) {
    const model = item.en[0];
    show("text", "");
    show("hu", item.hu);
    if (!hasHu) return shadowItem(item);
    const result = await prompted(() => sayHu(item.hu), item.en);
    if (result.skipped) return;
    show("text", model);
    const v = await feedback(result, model);
    recordAnswer(item.id, result.score);
    if (v !== "correct") {
      await say("Now you say it.", { rate: 1 });
      const again = await prompted(async () => {}, [model], { timeoutMs: 7000 });
      if (!again.skipped && again.score >= 0.9) await say("Good.", { rate: 1 });
    }
  }

  async function connectedItem(item) {
    show("text", item.clear);
    show("hu", `${item.fast} — ${item.hu}`);
    await say("Slow:", { rate: 1 });
    await say(item.clear, { rate: settings.slowRate });
    await say("Fast:", { rate: 1 });
    await say(item.clear, { rate: 1.15 });
    const result = await prompted(async () => { await say(item.clear, { rate: 1.1 }); }, [item.clear]);
    if (!result.skipped) {
      stats.items++;
      if (result.score >= 0.9) stats.correct++;
      updateStats();
      if (!result.silent && result.score >= 0.9) await say("Nice!", { rate: 1 });
    }
    await sayHu(item.hu);
  }

  async function qaItem(item) {
    show("text", item.q);
    show("hu", "");
    let answered = false;
    for (let tries = 0; tries < 3 && !answered; tries++) {
      await say(item.q);
      const res = await hear(15000);
      if (res.cmd === "repeat") continue;
      if (res.cmd === "slower") { rate = Math.max(0.6, rate - 0.1); continue; }
      if (res.cmd === "next") return;
      answered = true;
      const words = normalize(res.transcripts.join(" "));
      if (words.length >= 3) await say(pick(["Thank you.", "Good answer.", "Nice.", "Okay, good."]), { rate: 1 });
    }
    show("text", item.sample);
    await say("Here is an example answer:", { rate: 1 });
    await say(item.sample);
    await say("Now you try.", { rate: 1 });
    await hear(15000);
    stats.items++;
    updateStats();
  }

  async function aiBlock(seconds, scenarioId) {
    const tutor = createTutor({ level: getSettings().level, scenarioId, spoken: true });
    const until = Date.now() + seconds * 1000;
    let text;
    try {
      show("status", "AI gondolkodik…");
      text = await tutor.start();
    } catch (err) {
      show("status", err.message);
      await say("The AI partner is not available now. Let's do questions instead.", { rate: 1 });
      return runItems("qa", seconds);
    }
    let silentRounds = 0;
    while (Date.now() < until) {
      show("text", text);
      show("hu", "");
      await say(text);
      const res = await hear(15000);
      if (res.cmd === "repeat") continue;
      if (res.cmd === "slower") { rate = Math.max(0.6, rate - 0.1); continue; }
      if (res.cmd === "next") break;
      const userText = res.transcripts[0] || "";
      if (!userText) {
        silentRounds++;
        if (silentRounds >= 2) break;
        text = "Take your time. " + text;
        continue;
      }
      silentRounds = 0;
      stats.items++;
      updateStats();
      show("hu", `Te: ${userText}`);
      try {
        show("status", "AI gondolkodik…");
        text = await tutor.reply(userText);
        check();
        show("status", "");
      } catch (err) {
        if (err instanceof Stopped) throw err;
        show("status", err.message);
        await say("Sorry, there was a connection problem.", { rate: 1 });
        break;
      }
    }
    await say("Great conversation. Let's continue.", { rate: 1 });
  }

  function itemsFor(kind) {
    const level = getSettings().level;
    if (kind === "shadow" || kind === "translate") return pickCards(PHRASES, 60, { level });
    if (kind === "review") {
      const mistakes = PHRASES.filter((p) => {
        const c = getCard(p.id);
        return c && c.box <= 1 && c.seen > 0;
      });
      // ha még nincs hibázott mondat, új fordítós mondatok jönnek
      return mistakes.length ? shuffle(mistakes) : pickCards(PHRASES, 60, { level });
    }
    const maxLevel = levelIndex(level) + 1;
    if (kind === "connected") return shuffle(CONNECTED.filter((c) => levelIndex(c.level) <= maxLevel));
    if (kind === "qa") return shuffle(QUESTIONS.filter((q) => levelIndex(q.level) <= maxLevel));
    return [];
  }

  async function runItems(kind, seconds) {
    const until = Date.now() + seconds * 1000;
    const handlers = { shadow: shadowItem, translate: translateItem, review: translateItem, connected: connectedItem, qa: qaItem };
    const items = itemsFor(kind);
    for (const item of items) {
      if (Date.now() >= until) break;
      await handlers[kind](item);
      await wait(400);
    }
  }

  async function start(minutes, withAi, scenarioId) {
    running = true;
    paused = false;
    hasHu = getVoices("hu").length > 0;
    startedAt = Date.now();
    stats = { items: 0, correct: 0 };
    driveScreen();
    await requestWakeLock();
    const plan = planSession(minutes, { withAi });
    try {
      await say("Let's practise English. Here we go!", { rate: 1 });
      for (const block of plan) {
        show("block", block.name);
        if (block.kind === "shadow") { await sayHu("Hallgasd meg, és ismételd utánam."); }
        if (block.kind === "translate" || block.kind === "review") { await sayHu(hasHu ? "Mondd angolul!" : ""); }
        if (block.kind === "connected") { await sayHu("Gyors beszéd: előbb lassan, aztán gyorsan hallod. Ismételd a gyorsat."); }
        if (block.kind === "qa") { await sayHu("Kérdéseket hallasz. Válaszolj szabadon, egész mondatokban."); }
        if (block.kind === "ai") await aiBlock(block.seconds, scenarioId);
        else await runItems(block.kind, block.seconds);
      }
      await say(`That's all for today. You practised ${stats.items} sentences. Well done!`, { rate: 1 });
      await finish();
    } catch (err) {
      if (!(err instanceof Stopped)) {
        console.error(err);
        show("status", `Hiba: ${err.message}`);
      }
    }
  }

  async function finish() {
    if (!running) return;
    running = false;
    paused = false;
    if (resumeWaiter) resumeWaiter();
    stopAll();
    releaseWakeLock();
    const seconds = (Date.now() - startedAt) / 1000;
    logActivity("car", seconds, stats.items);
    mount(container, html`
      <section class="card">
        <h2>Szép volt! 👏</h2>
        <p>${Math.round(seconds / 60)} perc gyakorlás, ${stats.items} mondat, ebből ${stats.correct} elsőre helyes.</p>
        <p class="muted">A hibázott mondatok a következő menet „Ismétlés” részében újra előjönnek.</p>
        <div class="row">
          <button class="btn primary" id="again">Új menet</button>
          <a class="btn" href="#/">Kezdőlap</a>
        </div>
      </section>`);
    $(container, "#again").onclick = setup;
  }

  async function requestWakeLock() {
    try {
      if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
    } catch {
      wakeLock = null;
    }
  }

  function releaseWakeLock() {
    if (wakeLock) wakeLock.release().catch(() => {});
    wakeLock = null;
  }

  const onVisibility = () => {
    if (document.visibilityState === "visible" && running) requestWakeLock();
  };
  document.addEventListener("visibilitychange", onVisibility);

  setup();
  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    if (running) {
      running = false;
      if (resumeWaiter) resumeWaiter();
      stopAll();
      releaseWakeLock();
      logActivity("car", (Date.now() - startedAt) / 1000, stats.items);
    }
  };
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

