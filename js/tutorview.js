// AI beszélgetés képernyője (esti gyakorláshoz): beszélhetsz vagy írhatsz, a válasz felolvasható.

import { createTutor, isConfigured, SCENARIOS } from "./tutor.js";
import { speak, listen, stopAll, support } from "./speech.js";
import { getSettings, logActivity } from "./storage.js";
import { html, mount, $ } from "./ui.js";

export function render(container) {
  let cancelled = false;
  let turns = 0;
  const started = Date.now();

  if (!isConfigured()) {
    mount(container, html`
      <section class="card">
        <h2>🤖 AI beszélgetés</h2>
        <p>Ehhez egy saját Claude API kulcs kell. A kulcsot a <a href="https://console.anthropic.com/" target="_blank" rel="noopener">console.anthropic.com</a> oldalon hozhatod létre, majd add meg a Beállításokban.</p>
        <p class="muted small">A kulcs csak ebben a böngészőben tárolódik. A használat díjköteles (egy 10 perces beszélgetés jellemzően néhány cent).</p>
        <a class="btn primary" href="#/settings">Beállítások</a>
      </section>`);
    return () => {};
  }

  function setup() {
    mount(container, html`
      <section class="card">
        <h2>🤖 AI beszélgetés</h2>
        <label>Téma
          <select id="scenario">${SCENARIOS.map((s) => html`<option value="${s.id}">${s.label}</option>`)}</select>
        </label>
        <label class="check"><input type="checkbox" id="autospeak" checked> Válaszok felolvasása</label>
        <button class="btn primary big" id="go">Kezdés</button>
      </section>`);
    $(container, "#go").onclick = () => chat($(container, "#scenario").value, $(container, "#autospeak").checked);
  }

  function chat(scenarioId, autoSpeak) {
    const tutor = createTutor({ level: getSettings().level, scenarioId, spoken: false });
    mount(container, html`
      <section class="card chat">
        <p class="step"><a href="#/tutor" id="back">← Téma</a> · ${tutor.scenario.label}</p>
        <div class="chat-log" id="log"></div>
        <p class="muted small" id="status"></p>
        <div class="chat-input">
          ${support.stt ? html`<button class="btn primary" id="mic" title="Beszélj">🎤</button>` : ""}
          <input type="text" id="text" placeholder="Írj vagy beszélj angolul…" autocomplete="off">
          <button class="btn" id="send">Küld</button>
        </div>
      </section>`);
    const log = $(container, "#log");
    const status = $(container, "#status");
    const input = $(container, "#text");
    $(container, "#back").onclick = (e) => { e.preventDefault(); stopAll(); setup(); };

    const addBubble = (who, text) => {
      const div = document.createElement("div");
      div.className = `bubble ${who}`;
      div.textContent = text;
      if (who === "ai") {
        const btn = document.createElement("button");
        btn.className = "icon";
        btn.textContent = "🔊";
        btn.title = "Felolvasás";
        btn.onclick = () => speak(div.dataset.text || text, { rate: getSettings().rate });
        div.appendChild(btn);
      }
      log.appendChild(div);
      log.scrollTop = log.scrollHeight;
      return div;
    };

    const busy = (on) => {
      container.querySelectorAll(".chat-input button, .chat-input input").forEach((el) => { el.disabled = on; });
      status.textContent = on ? "Gondolkodik…" : "";
    };

    async function ask(userText) {
      busy(true);
      const bubble = addBubble("ai", "");
      const textNode = document.createTextNode("");
      bubble.prepend(textNode);
      let streamed = "";
      try {
        const onText = (delta) => {
          streamed += delta;
          textNode.textContent = streamed;
          log.scrollTop = log.scrollHeight;
        };
        const answer = userText === null
          ? await tutor.start({ onText })
          : await tutor.reply(userText, { onText });
        if (cancelled) return;
        textNode.textContent = answer;
        bubble.dataset.text = answer;
        if (autoSpeak) speak(answer, { rate: getSettings().rate });
      } catch (err) {
        bubble.remove();
        busy(false);
        status.textContent = err.message;
        return;
      }
      busy(false);
      input.focus();
    }

    const send = (text) => {
      const clean = text.trim();
      if (!clean) return;
      stopAll();
      addBubble("me", clean);
      input.value = "";
      turns++;
      ask(clean);
    };

    $(container, "#send").onclick = () => send(input.value);
    input.onkeydown = (e) => { if (e.key === "Enter") send(input.value); };
    const mic = $(container, "#mic");
    if (mic) {
      mic.onclick = async () => {
        stopAll();
        mic.disabled = true;
        status.textContent = "Hallgatlak…";
        const { transcripts } = await listen({ timeoutMs: 15000, maxAlternatives: 1 });
        mic.disabled = false;
        status.textContent = "";
        if (transcripts.length) send(transcripts[0]);
        else status.textContent = "Nem hallottam semmit.";
      };
    }
    ask(null);
  }

  setup();
  return () => {
    cancelled = true;
    stopAll();
    if (turns) logActivity("tutor", (Date.now() - started) / 1000, turns);
  };
}

