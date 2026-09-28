// Apró DOM-segédfüggvények, hogy a nézetek rövidek maradjanak.

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Tagged template: a ${} értékeket automatikusan escape-eli, kivéve a raw() által jelölteket.
export function html(strings, ...values) {
  let out = "";
  strings.forEach((str, i) => {
    out += str;
    if (i < values.length) {
      const v = values[i];
      if (v && v.__raw) out += v.value;
      else if (Array.isArray(v)) out += v.map((x) => (x && x.__raw ? x.value : escapeHtml(x))).join("");
      else out += escapeHtml(v);
    }
  });
  return { __raw: true, value: out };
}

export function raw(value) {
  return { __raw: true, value: String(value) };
}

export function mount(container, template) {
  container.innerHTML = template.__raw ? template.value : escapeHtml(template);
}

export function $(root, selector) {
  return root.querySelector(selector);
}

// A várt mondat szavai, a hiányzók kiemelve.
export function diffView(tokens) {
  return raw(tokens
    .map((t) => `<span class="${t.ok ? "w-ok" : "w-miss"}">${escapeHtml(t.word)}</span>`)
    .join(" "));
}

export function percent(score) {
  return `${Math.round((score || 0) * 100)}%`;
}

export const VERDICT_TEXT = {
  correct: { hu: "Helyes!", en: "Correct!", cls: "good" },
  almost: { hu: "Majdnem!", en: "Almost!", cls: "mid" },
  wrong: { hu: "Még gyakorold!", en: "Listen again.", cls: "bad" },
};

export function toast(message, ms = 2500) {
  const box = document.createElement("div");
  box.className = "toast";
  box.textContent = message;
  document.body.appendChild(box);
  setTimeout(() => box.remove(), ms);
}
