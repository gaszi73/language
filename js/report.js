// Napi napló: mi nem ment ma, milyen hibaminták ismétlődnek, és mely mondatokat kell még begyakorolni.

import {
  analyze, logForDay, logSince, daysWithMistakes, activeWeakItems, masteredSince, removeWeakItem,
  patternInfo, addPracticeItems, MODE_NAME, MASTERED_STREAK,
} from "./mistakes.js";
import { activityDays, getSettings, load, save, localDay } from "./storage.js";
import { isConfigured, analyzeMistakes, parsePracticeLines } from "./tutor.js";
import { speak, stopAll } from "./speech.js";
import { html, mount, $, percent, toast } from "./ui.js";

const KIND_NAME = {
  car: "autós mód", dictation: "diktálás", speak: "kiejtés", translate: "fordítás", connected: "gyors beszéd",
  pairs: "minimálpárok", mistakes: "makacs mondatok", tutor: "AI-beszélgetés", assessment: "szintfelmérés",
};

function dayLabel(day) {
  const today = localDay();
  const yesterday = localDay(new Date(Date.now() - 86400000));
  if (day === today) return `ma (${day})`;
  if (day === yesterday) return `tegnap (${day})`;
  return day;
}

// Szöveges összefoglaló e-mailhez / megosztáshoz.
export function buildReportText(day, { entries, activity, weak, mastered, aiText } = {}) {
  const a = analyze(entries);
  const lines = [];
  lines.push(`Angol gyakorlás – napi napló, ${day}`);
  lines.push("");
  if (activity) {
    lines.push(`Gyakorlás: ${Math.round(activity.seconds / 60)} perc, ${activity.items} feladat.`);
  }
  lines.push(`Nem sikerült: ${a.total} próbálkozás, ${a.sentences.length} különböző mondat.`);
  if (a.patterns.length) {
    lines.push("");
    lines.push("HIBAMINTÁK");
    for (const p of a.patterns.slice(0, 5)) {
      const info = patternInfo(p.id);
      lines.push(`- ${info.name}: ${p.count}×`);
      if (info.tip) lines.push(`  Tipp: ${info.tip}`);
      for (const ex of p.examples.slice(0, 1)) lines.push(`  Pl.: „${ex.heard || "—"}” → ${ex.expected}`);
    }
  }
  if (a.sentences.length) {
    lines.push("");
    lines.push("MA NEM MENT");
    for (const s of a.sentences.slice(0, 20)) {
      lines.push(`- ${s.expected}${s.hu ? ` (${s.hu})` : ""}${s.count > 1 ? ` – ${s.count}×` : ""}`);
      if (s.heard.length) lines.push(`  Te: „${s.heard[0]}”`);
    }
  }
  if (a.words.length) {
    lines.push("");
    lines.push(`GYAKRAN KIMARADT SZAVAK: ${a.words.map(([w, n]) => `${w} (${n})`).join(", ")}`);
  }
  if (weak && weak.length) {
    lines.push("");
    lines.push(`MAKACS MONDATOK (még gyakorolni kell): ${weak.length} db`);
    for (const w of weak.slice(0, 10)) lines.push(`- ${w.en}${w.hu ? ` (${w.hu})` : ""} – ${w.fails}× nem ment`);
  }
  if (mastered && mastered.length) {
    lines.push("");
    lines.push(`BEGYAKOROLVA az elmúlt héten: ${mastered.map((m) => m.en).join(" · ")}`);
  }
  if (aiText) {
    lines.push("");
    lines.push("AI-ELEMZÉS");
    lines.push(aiText);
  }
  return lines.join("\n");
}

// A naplóból egy tömör szöveg az AI-nak.
function aiInput(entries) {
  return entries.slice(-80).map((e) => {
    const skill = ["dictation", "connected_typed", "pairs"].includes(e.mode) ? "heard/typed" : "said";
    return `[${MODE_NAME[e.mode] || e.mode}] expected: "${e.expected}" | ${skill}: "${e.heard || "(no answer)"}"${e.hu ? ` | HU: ${e.hu}` : ""}`;
  }).join("\n");
}

function aiStore() {
  const s = load();
  if (!s.aiAnalyses) s.aiAnalyses = {};
  return s;
}

export function render(container) {
  let cancelled = false;
  const today = localDay();
  const days = [...new Set([today, ...daysWithMistakes(), ...Object.keys(activityDays())])].sort().reverse();
  let day = today;

  function draw() {
    const entries = logForDay(day);
    const a = analyze(entries);
    const week = analyze(logSince(7));
    const activity = activityDays()[day];
    const weak = activeWeakItems();
    const mastered = masteredSince(7);
    const aiText = aiStore().aiAnalyses[day] || "";
    const okRate = activity && activity.items ? Math.max(0, 1 - a.total / activity.items) : null;

    mount(container, html`
      <section class="card">
        <h2>📋 Napi napló</h2>
        <label>Nap
          <select id="day">${days.map((d) => html`<option value="${d}" ${d === day ? "selected" : ""}>${dayLabel(d)}</option>`)}</select>
        </label>
        <div class="stats">
          <div><b>${activity ? Math.round(activity.seconds / 60) : 0}</b><span>perc</span></div>
          <div><b>${activity ? activity.items : 0}</b><span>feladat</span></div>
          <div><b>${a.sentences.length}</b><span>mondat nem ment</span></div>
          <div><b>${okRate === null ? "–" : percent(okRate)}</b><span>sikeres</span></div>
        </div>
        ${activity ? html`<p class="muted small">${Object.entries(activity.kinds || {}).map(([k, n]) => `${KIND_NAME[k] || k}: ${n}`).join(" · ")}</p>` : ""}
        <div class="row">
          <a class="btn primary" href="#/practice/mistakes">🎯 Gyakorold most</a>
          <a class="btn" href="#/car">🚗 Célzott autós menet</a>
        </div>
        <div class="row">
          <button class="btn" id="share">📤 Megosztás</button>
          <button class="btn" id="mail">✉️ E-mail</button>
          <button class="btn ghost" id="copy">📋 Másolás</button>
        </div>
      </section>

      <section class="card">
        <h3>🔍 Hibaminták</h3>
        ${a.patterns.length ? html`
          <p class="muted small">Ma (zárójelben az elmúlt 7 nap). A beszédfelismerés néha téved, ezért az ismétlődő mintákra figyelj.</p>
          ${a.patterns.map((p) => {
            const info = patternInfo(p.id);
            const weekCount = (week.patterns.find((x) => x.id === p.id) || {}).count || p.count;
            return html`
              <div class="pattern">
                <p><b>${info.name}</b> – ${p.count}× <span class="muted">(${weekCount}× a héten)</span>
                  ${p.listening && p.speaking ? "" : html`<span class="tag">${p.listening ? "hallás" : "beszéd"}</span>`}</p>
                <p class="small">${info.tip}</p>
                ${p.examples.map((ex) => html`<p class="small example">„${ex.heard || "—"}” → <b>${ex.expected}</b></p>`)}
              </div>`;
          })}` : html`<p class="muted">${entries.length ? "Nem találtam ismétlődő mintát." : "Ezen a napon nem volt hiba (vagy nem volt gyakorlás)."}</p>`}
        ${a.words.length ? html`<p><b>Gyakran kimaradt szavak:</b> ${a.words.map(([w, n]) => html`<span class="chip">${w}${n > 1 ? ` ×${n}` : ""}</span>`)}</p>` : ""}
      </section>

      <section class="card">
        <h3>❌ Ami nem ment</h3>
        ${a.sentences.length ? html`
          <ul class="mistakes">
            ${a.sentences.map((s) => html`
              <li>
                <button class="icon" data-say="${s.expected}" title="Meghallgatás">🔊</button>
                <div>
                  <b>${s.expected}</b>${s.count > 1 ? html` <span class="tag bad">${s.count}×</span>` : ""}
                  ${s.hu ? html`<div class="muted small">${s.hu}</div>` : ""}
                  ${s.heard.length ? html`<div class="small">Te: <i>${s.heard.slice(0, 2).join(" / ")}</i></div>` : html`<div class="small muted">nem jött válasz</div>`}
                  <div class="muted small">${[...s.modes].map((m) => MODE_NAME[m] || m).join(", ")}</div>
                </div>
              </li>`)}
          </ul>` : html`<p class="muted">Ezen a napon minden ment. 👏</p>`}
      </section>

      <section class="card">
        <h3>🎯 Makacs mondatok (${weak.length})</h3>
        <p class="muted small">Addig maradnak itt, amíg ${MASTERED_STREAK}× egymás után fejből (magyarból) helyesen ki nem mondod őket. Ha a gép tévesen tett ide valamit, a ✕-szel törölheted.</p>
        ${weak.length ? html`
          <ul class="mistakes">
            ${weak.slice(0, 30).map((w) => html`
              <li>
                <button class="icon" data-say="${w.en}" title="Meghallgatás">🔊</button>
                <div>
                  <b>${w.en}</b> <span class="tag bad">${w.fails}×</span> <span class="tag">${w.streak || 0}/${MASTERED_STREAK}</span>
                  ${w.hu ? html`<div class="muted small">${w.hu}</div>` : ""}
                  ${w.lastHeard ? html`<div class="small">Utoljára: <i>${w.lastHeard}</i></div>` : ""}
                </div>
                <button class="icon" data-remove="${w.key}" title="Törlés a listáról">✕</button>
              </li>`)}
          </ul>` : html`<p class="muted">Nincs makacs mondat.</p>`}
        ${mastered.length ? html`<p>✅ <b>Begyakorolva a héten (${mastered.length}):</b> ${mastered.map((m) => html`<span class="chip good">${m.en}</span>`)}</p>` : ""}
      </section>

      <section class="card">
        <h3>🤖 AI-elemzés</h3>
        ${isConfigured() ? html`
          <p class="muted small">Az AI átnézi a nap hibáit, magyarul elmagyarázza a visszatérő mintákat, és ír rájuk gyakorló mondatokat.</p>
          <button class="btn" id="ai" ${entries.length ? "" : "disabled"}>${aiText ? "Újraelemzés" : "Elemezd a napot"}</button>
          <p class="muted" id="ai-status"></p>
          ${aiText ? html`
            <div class="ai-text">${aiText}</div>
            ${parsePracticeLines(aiText).length ? html`<button class="btn primary" id="ai-add">➕ A ${parsePracticeLines(aiText).length} gyakorló mondat felvétele a makacsok közé</button>` : ""}` : ""}
        ` : html`<p class="muted small">Ha a Beállításokban megadod a Claude API kulcsot, az AI is elemzi a napot, és gyakorló mondatokat ír a hibáidra.</p>`}
      </section>`);

    $(container, "#day").onchange = (e) => { day = e.target.value; draw(); };
    container.querySelectorAll("[data-say]").forEach((b) => {
      b.onclick = () => speak(b.dataset.say, { rate: getSettings().rate });
    });
    container.querySelectorAll("[data-remove]").forEach((b) => {
      b.onclick = () => { removeWeakItem(b.dataset.remove); draw(); };
    });

    const text = () => buildReportText(day, { entries, activity, weak, mastered, aiText });
    const subject = `Angol napló – ${day}`;
    $(container, "#share").onclick = async () => {
      if (navigator.share) {
        try { await navigator.share({ title: subject, text: text() }); } catch { /* bezárta */ }
      } else {
        mailTo(subject, text());
      }
    };
    $(container, "#mail").onclick = () => mailTo(subject, text());
    $(container, "#copy").onclick = async () => {
      try {
        await navigator.clipboard.writeText(text());
        toast("Vágólapra másolva");
      } catch {
        toast("A másolás nem sikerült");
      }
    };

    const aiBtn = $(container, "#ai");
    if (aiBtn) {
      aiBtn.onclick = async () => {
        aiBtn.disabled = true;
        $(container, "#ai-status").textContent = "Elemzés folyamatban… (fél perc is lehet)";
        try {
          const result = await analyzeMistakes(aiInput(entries), { level: getSettings().level });
          if (cancelled) return;
          aiStore().aiAnalyses[day] = result;
          save();
          draw();
        } catch (err) {
          if (cancelled) return;
          $(container, "#ai-status").textContent = err.message;
          aiBtn.disabled = false;
        }
      };
    }
    const addBtn = $(container, "#ai-add");
    if (addBtn) {
      addBtn.onclick = () => {
        const n = addPracticeItems(parsePracticeLines(aiText));
        toast(n ? `${n} új gyakorló mondat felvéve` : "Ezek már a listán vannak");
        draw();
      };
    }
  }

  function mailTo(subject, body) {
    const to = getSettings().reportEmail || "";
    // a levelezők a túl hosszú mailto-linket levághatják
    const max = 1800;
    const trimmed = body.length > max ? `${body.slice(0, max)}\n…\n(A teljes napló az appban: Napló menü)` : body;
    location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(trimmed)}`;
  }

  draw();
  return () => {
    cancelled = true;
    stopAll();
  };
}
