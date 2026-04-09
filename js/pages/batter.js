import * as store from "../store.js";
import { hud, fmtDate, innRow, collapse } from "../ui.js";

export async function render(el) {
  const [bvbData, btData, teams] = await Promise.all([store.bvb(), store.batterTeam(), store.teams()]);
  const batters = [...new Set(bvbData.filter(m => m.balls >= 6).map(m => m.batter))].sort();
  const teamList = Object.entries(teams).map(([k, v]) => ({ code: k, name: v.name, color: v.primary_color }));

  let html = `<div class="page-header">
    <h1>🏏 <span class="accent">Batter vs Team</span></h1>
    <p>Select a batter and opponent team to see career breakdown</p>
  </div>
  <div class="grid-2" style="margin-bottom:1.5rem;">
    <div class="search-wrap">
      <span class="search-icon">🏏</span>
      <input class="search-input" id="btBat" placeholder="Search batter..." autocomplete="off">
      <div class="dropdown" id="btBatDrop"></div>
    </div>
    <div class="select-wrap">
      <select id="btTeam">
        <option value="">Choose opponent team...</option>
        ${teamList.map(t => `<option value="${t.code}">${t.code} — ${t.name}</option>`).join("")}
      </select>
    </div>
  </div>
  <div id="btResult"></div>`;

  el.innerHTML = html;

  let selectedBat = "";

  const input = document.getElementById("btBat");
  const drop = document.getElementById("btBatDrop");
  const teamSel = document.getElementById("btTeam");

  input.addEventListener("input", () => {
    const q = input.value.toLowerCase().trim();
    if (q.length < 1) { drop.classList.remove("open"); return; }
    const filtered = batters.filter(n => n.toLowerCase().includes(q)).slice(0, 20);
    drop.innerHTML = filtered.map(n => `<div class="dropdown__item">${n}</div>`).join("");
    drop.classList.toggle("open", filtered.length > 0);
  });

  drop.addEventListener("click", e => {
    if (e.target.classList.contains("dropdown__item")) {
      input.value = e.target.textContent;
      drop.classList.remove("open");
      selectedBat = e.target.textContent;
      showResult();
    }
  });

  input.addEventListener("blur", () => setTimeout(() => drop.classList.remove("open"), 200));
  teamSel.addEventListener("change", showResult);

  function showResult() {
    const out = document.getElementById("btResult");
    const teamCode = teamSel.value;
    if (!selectedBat || !teamCode) {
      out.innerHTML = selectedBat || teamCode
        ? `<div class="empty"><div class="empty__text">Select both a batter and a team</div></div>` : "";
      return;
    }

    const key = `${selectedBat}__${teamCode}`;
    const data = btData[key];
    if (!data) {
      out.innerHTML = `<div class="empty"><div class="empty__icon">🚫</div>
        <div class="empty__text">No data for <strong>${selectedBat}</strong> vs <strong>${teams[teamCode]?.name || teamCode}</strong></div></div>`;
      return;
    }

    const tm = teams[teamCode] || {};
    const tc = tm.primary_color || "#888";

    let h = `<div class="card card--flat animate-in" style="margin-bottom:1rem; text-align:center; padding:1.5rem;">
      <div style="font-size:1.3rem; font-weight:800;">
        🏏 <span style="color:var(--gold);">${data.batter}</span>
        <span style="color:var(--text-dim);"> vs </span>
        <img src="logos/${teamCode}.png" style="width:28px; height:28px; object-fit:contain; vertical-align:middle;">
        <span style="color:${tc};">${tm.name || teamCode}</span>
      </div>
      <div style="color:var(--text-muted); font-size:0.82rem; margin-top:0.3rem;">${data.matches} match(es) — All-Time IPL</div>
    </div>`;

    h += `<div class="hud-grid hud-grid--6 animate-in stagger-1">
      ${hud(data.balls, "Balls", "var(--text-muted)", "148,163,184")}
      ${hud(data.runs, "Runs", "var(--green)", "16,185,129")}
      ${hud(data.dismissals, "Dismissed", "var(--red)", "239,68,68")}
      ${hud(data.sr, "Strike Rate", "var(--blue)", "59,130,246")}
      ${hud(data.avg || "N/A", "Average", "var(--orange)", "245,158,11")}
      ${hud(data.dots, "Dot Balls", "var(--text-dim)", "71,85,105")}
    </div>`;

    h += `<div class="hud-grid hud-grid--3 animate-in stagger-2" style="margin-top:0.75rem;">
      ${hud(data.fours, "Fours", "var(--green)", "16,185,129")}
      ${hud(data.sixes, "Sixes", "var(--purple)", "168,85,247")}
      ${hud(data.balls ? (data.dots / data.balls * 100).toFixed(1) + "%" : "0%", "Dot Ball %", "var(--text-dim)", "71,85,105")}
    </div>`;

    const innings = data.innings || [];
    if (innings.length) {
      const last5 = innings.slice(0, 5);
      h += `<div class="section-title animate-in stagger-3" style="margin-top:1.5rem;">📋 Last ${Math.min(5, innings.length)} Innings</div>`;
      h += last5.map(inn => innRow(inn, true)).join("");

      if (innings.length > 5) {
        h += collapse(`📋 View All ${innings.length} Innings`, innings.slice(5).map(inn => innRow(inn, true)).join(""));
      }
    }

    out.innerHTML = h;
  }
}
