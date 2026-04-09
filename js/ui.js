/* Shared UI helpers */

export function hud(value, label, color = "var(--gold)", rgb = "255,215,0") {
  return `<div class="hud" style="--hud-color:${color}; --hud-rgb:${rgb};">
    <div class="hud__value">${value}</div>
    <div class="hud__label">${label}</div>
  </div>`;
}

export function fmtDate(raw) {
  if (!raw) return "";
  const d = new Date(raw.split(" ")[0] + "T00:00:00");
  if (isNaN(d)) return raw;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function fmtDateShort(raw) {
  if (!raw) return "";
  const d = new Date(raw.split(" ")[0] + "T00:00:00");
  if (isNaN(d)) return raw;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function matchDay(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d)) return "";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function isUpcoming(dateStr) {
  const d = new Date(dateStr + "T23:59:59");
  return d >= new Date();
}

export function teamColor(teams, code) {
  return teams[code]?.primary_color || "#FFD700";
}

export function stagger(html, i) {
  const cls = i < 6 ? ` stagger-${i + 1}` : "";
  return html.replace('class="', `class="animate-in${cls} `);
}

export function innRow(inn, showVenue = false) {
  const sr = inn.balls ? (inn.runs / inn.balls * 100).toFixed(1) : 0;
  const extras = [];
  if (inn.fours) extras.push(`${inn.fours}×4`);
  if (inn.sixes) extras.push(`${inn.sixes}×6`);
  const ex = extras.length ? ` (${extras.join(", ")})` : "";
  const outTag = inn.dismissed ? '<span class="inn-row__badge">OUT</span>' : "";
  const venuePart = showVenue && inn.venue ? ` · 🏟 ${inn.venue}` : "";

  return `<div class="inn-row${inn.dismissed ? " inn-row--out" : ""}">
    <div style="flex:1;">
      <div class="inn-row__score">${inn.runs} off ${inn.balls} balls${ex}${outTag}</div>
      <div class="inn-row__detail">SR: ${sr} · 📅 ${fmtDate(inn.date)}${venuePart}</div>
    </div>
  </div>`;
}

let _collapseId = 0;
export function collapse(toggleText, bodyHtml) {
  const id = `col_${++_collapseId}`;
  return `<button class="collapse-toggle" onclick="(function(e){
    e.classList.toggle('open');
    document.getElementById('${id}').classList.toggle('open');
  })(this)"><span class="arrow">▸</span> ${toggleText}</button>
  <div class="collapse-body" id="${id}">${bodyHtml}</div>`;
}
