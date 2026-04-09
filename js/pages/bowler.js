import * as store from "../store.js";
import { hud } from "../ui.js";

let showCount = 10;

export async function render(el) {
  const bvbData = await store.bvb();
  const bowlers = [...new Set(bvbData.filter(m => m.balls >= 6).map(m => m.bowler))].sort();

  let html = `<div class="page-header">
    <h1>⚾ <span class="accent">Bowler Strengths</span></h1>
    <p>Select a bowler to see every batter they've dismissed 2+ times in IPL history</p>
  </div>
  <div class="search-wrap" style="max-width:500px;">
    <span class="search-icon">⚾</span>
    <input class="search-input" id="bowlPick" placeholder="Search bowler..." autocomplete="off">
    <div class="dropdown" id="bowlPickDrop"></div>
  </div>
  <div id="bowlResult"></div>`;

  el.innerHTML = html;

  const input = document.getElementById("bowlPick");
  const drop = document.getElementById("bowlPickDrop");

  input.addEventListener("input", () => {
    const q = input.value.toLowerCase().trim();
    if (q.length < 1) { drop.classList.remove("open"); return; }
    const filtered = bowlers.filter(n => n.toLowerCase().includes(q)).slice(0, 20);
    drop.innerHTML = filtered.map(n => `<div class="dropdown__item">${n}</div>`).join("");
    drop.classList.toggle("open", filtered.length > 0);
  });

  drop.addEventListener("click", e => {
    if (e.target.classList.contains("dropdown__item")) {
      input.value = e.target.textContent;
      drop.classList.remove("open");
      showCount = 10;
      showBowler(e.target.textContent, bvbData);
    }
  });

  input.addEventListener("blur", () => setTimeout(() => drop.classList.remove("open"), 200));
}

function showBowler(bowlerName, bvbData) {
  const out = document.getElementById("bowlResult");
  let strengths = bvbData
    .filter(m => m.bowler === bowlerName && m.dismissals >= 2)
    .sort((a, b) => b.dismissals - a.dismissals || b.balls - a.balls);

  if (!strengths.length) {
    out.innerHTML = `<div class="empty" style="margin-top:1rem;"><div class="empty__icon">🚫</div>
      <div class="empty__text">No batters dismissed 2+ times by <strong>${bowlerName}</strong></div></div>`;
    return;
  }

  const display = strengths.slice(0, showCount);

  let h = `<p style="color:var(--text-muted); font-size:0.9rem; margin:1rem 0;">
    <strong style="color:var(--gold);">${bowlerName}</strong> has dismissed
    <strong>${strengths.length}</strong> batters 2+ times in IPL
  </p>`;

  h += display.map((m, i) => `<div class="mu-card animate-in" style="animation-delay:${i * 0.04}s;">
    <div class="mu-card__header">
      <span class="mu-card__rank">#${i + 1}</span>
      <span class="mu-card__name" style="color:var(--gold);">🏏 ${m.batter}</span>
      <span class="mu-card__dismiss">${m.dismissals} dismissals</span>
    </div>
    <div class="hud-grid hud-grid--5">
      ${hud(m.balls, "Balls", "var(--text-muted)", "148,163,184")}
      ${hud(m.runs, "Runs", "var(--green)", "16,185,129")}
      ${hud(m.dismissals, "Dismissed", "var(--red)", "239,68,68")}
      ${hud(m.sr, "Strike Rate", "var(--blue)", "59,130,246")}
      ${hud(m.dots, "Dot Balls", "var(--text-dim)", "71,85,105")}
    </div>
  </div>`).join("");

  if (showCount < strengths.length) {
    const remaining = strengths.length - showCount;
    h += `<div style="text-align:center; margin-top:1rem;">
      <button class="btn btn--outline" id="loadMoreBowl">Load More (${remaining} remaining)</button>
    </div>`;
  }

  out.innerHTML = h;

  document.getElementById("loadMoreBowl")?.addEventListener("click", () => {
    showCount += 10;
    showBowler(bowlerName, bvbData);
  });
}
