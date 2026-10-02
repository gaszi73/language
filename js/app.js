// Belépési pont: egyszerű hash-alapú router és a kezdőlap / beállítások / terv nézetek.

import * as assessment from "./assessment.js";
import * as carmode from "./carmode.js";
import * as drills from "./drills.js";
import * as tutorView from "./tutorview.js";
import * as report from "./report.js";
import { activeWeakItems, logForDay } from "./mistakes.js";
import { LEVEL_TEXT } from "./assessment.js";
import { PHRASES } from "../data/phrases.js";
import { MODELS } from "./tutor.js";
import { speak, getVoices, setPreferredVoice, support, stopAll } from "./speech.js";
import {
  getSettings, updateSettings, latestAssessment, allAssessments, streak, activityDays,
  cardStats, exportData, importData, resetProgress, localDay,
} from "./storage.js";
import { html, mount, $, percent, toast } from "./ui.js";

const main = document.getElementById("main");
let cleanup = null;

const PHASES = [
  { weeks: [1, 4], name: "Alapozás", car: "Utánmondás lassú tempón + fordítós gyakorlat", evening: "Diktálás + minimálpárok (15 perc)" },
  { weeks: [5, 8], name: "Folyékonyság", car: "Természetes tempó, gyors beszéd, kérdés–válasz", evening: "Mondd angolul + 10 perc AI-beszélgetés" },
  { weeks: [9, 12], name: "Valós anyag", car: "AI-beszélgetés autóban + ismétlés", evening: "Filmjelenet angol felirattal, majd felirat nélkül + diktálás" },
];

export function currentWeek(firstDateIso, now = new Date()) {
  if (!firstDateIso) return 0;
  const days = Math.floor((now - new Date(firstDateIso)) / (24 * 60 * 60 * 1000));
  return Math.max(1, Math.floor(days / 7) + 1);
}

function phaseFor(week) {
  return PHASES.find((p) => week >= p.weeks[0] && week <= p.weeks[1]) || PHASES[PHASES.length - 1];
}

function home(container) {
  const last = latestAssessment();
  const all = allAssessments();
  const first = all[0];
  const week = currentWeek(first && first.date);
  const phase = phaseFor(week || 1);
  const stats = cardStats(PHRASES);
  const activity = activityDays();
  const todayKey = localDay();
  const today = activity[todayKey];
  const days = Object.keys(activity).sort().slice(-14);
  const settings = getSettings();
  const weakCount = activeWeakItems().length;
  const todayMistakes = new Set(logForDay(todayKey).map((e) => e.key)).size;

  mount(container, html`
    ${last ? "" : html`
      <section class="card highlight">
        <h2>Üdv! 👋 Kezdjük a szintfelméréssel</h2>
        <p>Kb. 15 perc. Ez alapján állítja be az app, milyen nehéz mondatokkal gyakorolj.</p>
        <a class="btn primary big" href="#/assessment">Szintfelmérés indítása</a>
      </section>`}
    <div class="grid two">
      <a class="tile big-tile car" href="#/car">
        <span class="tile-icon">🚗</span>
        <b>Autós mód</b>
        <span class="small">Kihangosított beszédgyakorlás (2×30 perc vezetés)</span>
      </a>
      <a class="tile big-tile" href="#/practice">
        <span class="tile-icon">🌙</span>
        <b>Esti gyakorlás</b>
        <span class="small">Diktálás, kiejtés, AI-beszélgetés</span>
      </a>
    </div>
    ${weakCount || todayMistakes ? html`
      <section class="card highlight">
        <h3>🎯 ${weakCount} makacs mondat vár</h3>
        <p>${todayMistakes ? `Ma ${todayMistakes} mondat nem ment. ` : ""}Egy 5 perces célzott kör sokat segít, hogy ezek is a helyükre kerüljenek.</p>
        <div class="row">
          ${weakCount ? html`<a class="btn primary" href="#/practice/mistakes">Gyakorold most</a>` : ""}
          <a class="btn" href="#/report">📋 Napi napló</a>
        </div>
      </section>` : ""}
    <section class="card">
      <h3>Állapot</h3>
      <div class="stats">
        <div><b>${settings.level}</b><span>gyakorlási szint</span></div>
        <div><b>${streak()}</b><span>nap sorozat</span></div>
        <div><b>${today ? Math.round(today.seconds / 60) : 0}</b><span>perc ma</span></div>
        <div><b>${stats.learned}</b><span>begyakorolt mondat</span></div>
      </div>
      ${days.length ? html`
        <div class="bars" aria-label="Utolsó 14 nap gyakorlása percben">
          ${days.map((d) => {
            const min = Math.round(activity[d].seconds / 60);
            return html`<div class="bar" title="${d}: ${min} perc"><span style="height:${Math.min(100, min)}%"></span><em>${d.slice(8)}</em></div>`;
          })}
        </div>` : ""}
    </section>
    ${week ? html`
      <section class="card">
        <h3>${week}. hét – ${phase.name}</h3>
        <p>🚗 <b>Autóban:</b> ${phase.car}</p>
        <p>🌙 <b>Este:</b> ${phase.evening}</p>
        ${week === 4 || week === 8 || week >= 12 ? html`<p class="highlight-text">Ezen a héten ismételd meg a szintfelmérést!</p>` : ""}
        <a href="#/plan">A teljes terv →</a>
      </section>` : ""}
    ${all.length ? html`
      <section class="card">
        <h3>Szintfelmérések</h3>
        <table class="results">
          <tr><th>Dátum</th><th>Hallás</th><th>Kiejtés</th><th>Beszéd</th></tr>
          ${all.slice(-5).map((a) => html`
            <tr>
              <td>${a.date.slice(0, 10)}</td>
              <td>${a.listening} <span class="muted small">${percent((a.scores.dictation + a.scores.dialogue) / 2)}</span></td>
              <td>${a.pronunciation || "–"} <span class="muted small">${a.pronunciation ? percent(a.scores.read) : ""}</span></td>
              <td>${a.speaking || "–"} <span class="muted small">${a.speaking ? percent(a.scores.translate) : ""}</span></td>
            </tr>`)}
        </table>
        <a class="btn" href="#/assessment">Új felmérés</a>
      </section>` : ""}
    ${support.tts && support.stt ? "" : html`
      <section class="card warn">
        Ez a böngésző nem támogat minden beszédfunkciót (${support.tts ? "" : "felolvasás "}${support.stt ? "" : "beszédfelismerés"}). Chrome vagy Edge ajánlott.
      </section>`}
  `);
  return () => {};
}

function plan(container) {
  mount(container, html`
    <section class="card prose">
      <h2>12 hetes terv</h2>
      <p><b>Kiindulás:</b> olvasás B2 körül, hallás és beszéd A1–A2. A cél, hogy a meglévő passzív tudás (szókincs, nyelvtan) „aktiválódjon”: halld meg és ki tudd mondani, amit írásban már értesz.</p>
      <h3>Napi ritmus</h3>
      <ul>
        <li><b>Reggel, autóban (30 perc):</b> Autós mód – utánmondás, fordítás szóban, gyors beszéd, kérdés–válasz.</li>
        <li><b>Délután, autóban (30 perc):</b> Autós mód újra (a hibázott mondatok visszajönnek), vagy AI-beszélgetés; heti 1-2× angol podcast lassított tempón.</li>
        <li><b>Este (15–20 perc):</b> diktálás vagy minimálpárok + „Mondd angolul” + néha AI-beszélgetés gépelve/szóban.</li>
        <li><b>Hetente 1×:</b> egy sorozatepizód angol hanggal és <i>angol</i> felirattal.</li>
      </ul>
      ${PHASES.map((p) => html`
        <h3>${p.weeks[0]}–${p.weeks[1]}. hét: ${p.name}</h3>
        <p>🚗 ${p.car}<br>🌙 ${p.evening}</p>`)}
      <h3>Mérföldkövek</h3>
      <ul>
        <li>0. hét: szintfelmérés.</li>
        <li>4. hét: újrafelmérés – cél: diktálás +15%, legalább 60 begyakorolt mondat.</li>
        <li>8. hét: újrafelmérés – cél: 5 perces AI-beszélgetés megakadás nélkül.</li>
        <li>12. hét: újrafelmérés – cél: egy ismert sorozat jelenetét angol felirattal nagyrészt érted.</li>
      </ul>
      <p class="muted">A részletes terv a <code>docs/TANULASI_TERV.md</code> fájlban van.</p>
    </section>`);
  return () => {};
}

function settingsView(container) {
  const s = getSettings();
  const enVoices = getVoices("en");
  const huVoices = getVoices("hu");
  mount(container, html`
    <section class="card">
      <h2>Beállítások</h2>
      <label>Gyakorlási szint
        <select id="level">${["A1", "A2", "B1", "B2"].map((l) => html`<option value="${l}" ${l === s.level ? "selected" : ""}>${LEVEL_TEXT[l]}</option>`)}</select>
      </label>
      <label>Normál tempó: <span id="rate-v">${s.rate}</span>
        <input type="range" id="rate" min="0.6" max="1.2" step="0.05" value="${s.rate}">
      </label>
      <label>Lassú tempó: <span id="slow-v">${s.slowRate}</span>
        <input type="range" id="slow" min="0.5" max="0.9" step="0.05" value="${s.slowRate}">
      </label>
      <label>Angol hang
        <select id="en-voice">
          <option value="">Automatikus</option>
          ${enVoices.map((v) => html`<option value="${v.name}" ${v.name === s.enVoice ? "selected" : ""}>${v.name} (${v.lang})</option>`)}
        </select>
      </label>
      <label>Magyar hang
        <select id="hu-voice">
          <option value="">${huVoices.length ? "Automatikus" : "Nincs telepítve magyar hang"}</option>
          ${huVoices.map((v) => html`<option value="${v.name}" ${v.name === s.huVoice ? "selected" : ""}>${v.name}</option>`)}
        </select>
      </label>
      <div class="row">
        <button class="btn" id="test-en">▶ Angol hang próba</button>
        <button class="btn" id="test-hu">▶ Magyar hang próba</button>
      </div>
    </section>
    <section class="card">
      <h3>AI beszélgetőpartner (opcionális)</h3>
      <p class="muted small">Claude API kulcs: <a href="https://console.anthropic.com/" target="_blank" rel="noopener">console.anthropic.com</a> → API Keys. A kulcs csak ebben a böngészőben tárolódik, és közvetlenül az Anthropic API-hoz megy. Ne használd megosztott gépen.</p>
      <label>API kulcs
        <input type="password" id="apikey" value="${s.apiKey}" placeholder="sk-ant-..." autocomplete="off">
      </label>
      <label>Modell
        <select id="model">${MODELS.map((m) => html`<option value="${m.id}" ${m.id === s.model ? "selected" : ""}>${m.label}</option>`)}</select>
      </label>
      <button class="btn primary" id="save-ai">Mentés</button>
    </section>
    <section class="card">
      <h3>Napi napló</h3>
      <label>E-mail cím a napló küldéséhez (opcionális)
        <input type="text" id="report-email" inputmode="email" value="${s.reportEmail || ""}" placeholder="pl. te@gmail.com" autocomplete="email">
      </label>
      <p class="muted small">A Napló oldalon az „E-mail” gomb ezzel a címzettel nyitja meg a levelezőt, kitöltött összefoglalóval.</p>
    </section>
    <section class="card">
      <h3>Adatok</h3>
      <p class="muted small">A haladás ebben a böngészőben tárolódik. Másik eszközre exporttal/importtal viheted át.</p>
      <div class="row">
        <button class="btn" id="export">Exportálás</button>
        <label class="btn">Importálás<input type="file" id="import" accept="application/json" hidden></label>
        <button class="btn danger" id="reset">Haladás törlése</button>
      </div>
    </section>`);

  $(container, "#level").onchange = (e) => { updateSettings({ level: e.target.value }); toast("Mentve"); };
  $(container, "#rate").oninput = (e) => { $(container, "#rate-v").textContent = e.target.value; updateSettings({ rate: Number(e.target.value) }); };
  $(container, "#slow").oninput = (e) => { $(container, "#slow-v").textContent = e.target.value; updateSettings({ slowRate: Number(e.target.value) }); };
  $(container, "#en-voice").onchange = (e) => { updateSettings({ enVoice: e.target.value }); setPreferredVoice("en", e.target.value); };
  $(container, "#hu-voice").onchange = (e) => { updateSettings({ huVoice: e.target.value }); setPreferredVoice("hu", e.target.value); };
  $(container, "#test-en").onclick = () => speak("Hello! This is how I sound. Could you repeat that, please?", { rate: getSettings().rate });
  $(container, "#test-hu").onclick = () => speak("Szia! Így hangzik a magyar hang.", { lang: "hu-HU" });
  $(container, "#report-email").onchange = (e) => { updateSettings({ reportEmail: e.target.value.trim() }); toast("Mentve"); };
  $(container, "#save-ai").onclick = () => {
    updateSettings({ apiKey: $(container, "#apikey").value.trim(), model: $(container, "#model").value });
    toast("Mentve");
  };
  $(container, "#export").onclick = () => {
    const blob = new Blob([exportData()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `angol-haladas-${localDay()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  $(container, "#import").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      importData(await file.text());
      toast("Importálva");
      route();
    } catch {
      toast("Hibás fájl");
    }
  };
  $(container, "#reset").onclick = () => {
    if (confirm("Biztosan törlöd a haladást és a felméréseket? (A beállítások megmaradnak.)")) {
      resetProgress();
      toast("Törölve");
    }
  };
  return () => {};
}

const ROUTES = {
  "": home,
  assessment: (c) => assessment.render(c),
  car: (c) => carmode.render(c),
  practice: (c, sub) => drills.render(c, sub),
  tutor: (c) => tutorView.render(c),
  report: (c) => report.render(c),
  plan,
  settings: settingsView,
};

function route() {
  if (cleanup) {
    try { cleanup(); } catch (e) { console.error(e); }
    cleanup = null;
  }
  stopAll();
  const [, name = "", sub] = (location.hash || "#/").split("/");
  const view = ROUTES[name] || home;
  document.querySelectorAll("nav a").forEach((a) => {
    a.classList.toggle("active", a.getAttribute("href") === `#/${name}`);
  });
  document.body.classList.toggle("driving", name === "car");
  main.scrollTop = 0;
  window.scrollTo(0, 0);
  cleanup = view(main, sub) || null;
}

const s = getSettings();
setPreferredVoice("en", s.enVoice);
setPreferredVoice("hu", s.huVoice);
window.addEventListener("hashchange", route);
route();

// a hanglista később töltődik be; ha a beállítások nyitva vannak, rajzoljuk újra
if (window.speechSynthesis) {
  window.speechSynthesis.addEventListener?.("voiceschanged", () => {
    if (location.hash.startsWith("#/settings")) route();
  });
}

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
