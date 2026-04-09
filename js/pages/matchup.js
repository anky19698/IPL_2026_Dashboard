import * as store from "../store.js";
import { hud, fmtDate, innRow, collapse } from "../ui.js";

export async function render(el) {
  const [bvbData, bvbInn] = await Promise.all([store.bvb(), store.bvbInnings()]);

  const batters = [...new Set(bvbData.filter(m => m.balls >= 6).map(m => m.batter))].sort();
  const bowlers = [...new Set(bvbData.filter(m => m.balls >= 6).map(m => m.bowler))].sort();

  let html = `<div class="page-header">
    <h1>⚔️ <span class="accent">Player Matchup</span></h1>
    <p>Search any batter vs bowler combination in IPL history</p>
  </div>
  <div class="grid-2" style="margin-bottom:1.5rem;">
    <div class="search-wrap">
      <span class="search-icon">🏏</span>
      <input class="search-input" id="batSearch" placeholder="Search batter..." autocomplete="off">
      <div class="dropdown" id="batDrop"></div>
    </div>
    <div class="search-wrap">
      <span class="search-icon">⚾</span>
      <input class="search-input" id="bowlSearch" placeholder="Search bowler..." autocomplete="off">
      <div class="dropdown" id="bowlDrop"></div>
    </div>
  </div>
  <div id="muResult"></div>`;

  el.innerHTML = html;

  let selectedBat = "", selectedBowl = "";

  setupSearch("batSearch", "batDrop", batters, v => { selectedBat = v; showMatchup(); });
  setupSearch("bowlSearch", "bowlDrop", bowlers, v => { selectedBowl = v; showMatchup(); });

  function showMatchup() {
    const out = document.getElementById("muResult");
    if (!selectedBat || !selectedBowl) {
      out.innerHTML = selectedBat || selectedBowl
        ? `<div class="empty"><div class="empty__text">Select both a batter and a bowler</div></div>` : "";
      return;
    }

    const m = bvbData.find(r => r.batter === selectedBat && r.bowler === selectedBowl);
    if (!m) {
      out.innerHTML = `<div class="empty"><div class="empty__icon">🚫</div>
        <div class="empty__text">No IPL data for <strong>${selectedBat}</strong> vs <strong>${selectedBowl}</strong></div></div>`;
      return;
    }

    const key = `${selectedBat}__${selectedBowl}`;
    const innings = bvbInn[key] || [];

    let h = `<div class="card card--flat animate-in" style="margin-bottom:1rem; text-align:center; padding:1.5rem;">
      <div style="font-size:1.3rem; font-weight:800;">
        🏏 <span style="color:var(--gold);">${m.batter}</span>
        <span style="color:var(--text-dim);"> vs </span>
        ⚾ <span>${m.bowler}</span>
      </div>
      <div style="color:var(--text-muted); font-size:0.82rem; margin-top:0.3rem;">All-Time IPL</div>
    </div>`;

    h += `<div class="hud-grid hud-grid--6 animate-in stagger-1">
      ${hud(m.balls, "Balls", "var(--text-muted)", "148,163,184")}
      ${hud(m.runs, "Runs", "var(--green)", "16,185,129")}
      ${hud(m.dismissals, "Dismissed", "var(--red)", "239,68,68")}
      ${hud(m.sr, "Strike Rate", "var(--blue)", "59,130,246")}
      ${hud(m.avg || "N/A", "Average", "var(--orange)", "245,158,11")}
      ${hud(m.dots, "Dot Balls", "var(--text-dim)", "71,85,105")}
    </div>`;

    h += `<div class="hud-grid hud-grid--3 animate-in stagger-2" style="margin-top:0.75rem;">
      ${hud(m.fours, "Fours", "var(--green)", "16,185,129")}
      ${hud(m.sixes, "Sixes", "var(--purple)", "168,85,247")}
      ${hud(m.balls ? (m.dots / m.balls * 100).toFixed(1) + "%" : "0%", "Dot Ball %", "var(--text-dim)", "71,85,105")}
    </div>`;

    if (innings.length) {
      h += `<div class="section-title animate-in stagger-3" style="margin-top:1.5rem;">
        📋 Innings Breakdown (${innings.length} encounters)
      </div>`;
      h += innings.map(inn => innRow(inn, true)).join("");
    }

    // Verdict
    if (m.dismissals >= 3 && m.sr < 120)
      h += `<div class="card animate-in" style="margin-top:1rem; border-left:3px solid var(--red); padding:0.8rem 1rem;"><strong>Verdict:</strong> ⚾ <strong>${m.bowler}</strong> dominates — ${m.dismissals} dismissals at SR ${m.sr}</div>`;
    else if (m.dismissals === 0 && m.sr > 140 && m.balls >= 12)
      h += `<div class="card animate-in" style="margin-top:1rem; border-left:3px solid var(--green); padding:0.8rem 1rem;"><strong>Verdict:</strong> 🏏 <strong>${m.batter}</strong> dominates — ${m.runs} runs at SR ${m.sr}, never dismissed</div>`;

    out.innerHTML = h;
  }
}

function setupSearch(inputId, dropId, items, onSelect) {
  const input = document.getElementById(inputId);
  const drop = document.getElementById(dropId);
  let filtered = [];

  input.addEventListener("input", () => {
    const q = input.value.toLowerCase().trim();
    if (q.length < 1) { drop.classList.remove("open"); return; }
    filtered = items.filter(n => n.toLowerCase().includes(q)).slice(0, 20);
    drop.innerHTML = filtered.map(n =>
      `<div class="dropdown__item">${n}</div>`
    ).join("");
    drop.classList.toggle("open", filtered.length > 0);
  });

  drop.addEventListener("click", e => {
    if (e.target.classList.contains("dropdown__item")) {
      input.value = e.target.textContent;
      drop.classList.remove("open");
      onSelect(e.target.textContent);
    }
  });

  input.addEventListener("blur", () => setTimeout(() => drop.classList.remove("open"), 200));
}
