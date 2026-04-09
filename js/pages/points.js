import * as store from "../store.js";
import { fmtDate } from "../ui.js";

export async function render(el) {
  const [ptData, teams] = await Promise.all([store.pointsTable(), store.teams()]);
  const standings = ptData.standings || [];
  const teamResults = ptData.team_results || {};

  let html = `<div class="page-header">
    <h1>🏆 <span class="accent">Points Table 2026</span></h1>
    <p>Live IPL 2026 standings — click any team to view match results</p>
  </div>`;

  if (!standings.length) {
    html += `<div class="empty"><div class="empty__icon">🏆</div>
      <div class="empty__text">No IPL 2026 results available yet</div></div>`;
    el.innerHTML = html;
    return;
  }

  html += `<div class="pts-table">`;

  // Header
  html += `<div class="pts-row pts-row--header">
    <div class="pts-cell pts-cell--pos">#</div>
    <div class="pts-cell pts-cell--team">Team</div>
    <div class="pts-cell">P</div>
    <div class="pts-cell">W</div>
    <div class="pts-cell">L</div>
    <div class="pts-cell">NR</div>
    <div class="pts-cell pts-cell--pts">Pts</div>
    <div class="pts-cell">NRR</div>
    <div class="pts-cell pts-cell--form">Recent</div>
  </div>`;

  standings.forEach((s, i) => {
    const tm = teams[s.team] || {};
    const color = tm.primary_color || "#888";
    const results = teamResults[s.team] || [];
    const recentForm = results.slice(0, 5).map(r =>
      `<span class="form-dot form-dot--${r.result.toLowerCase()}">${r.result}</span>`
    ).join("");

    const nrrStr = s.nrr >= 0 ? `+${s.nrr.toFixed(3)}` : s.nrr.toFixed(3);
    const nrrColor = s.nrr >= 0 ? "var(--green)" : "var(--red)";

    const qualifyClass = i < 4 ? " pts-row--qualify" : "";
    const rowId = `pts_row_${s.team}`;
    const bodyId = `pts_body_${s.team}`;

    html += `<div class="pts-row-wrap">
      <div class="pts-row${qualifyClass}" id="${rowId}" data-body="${bodyId}" style="cursor:pointer;">
        <div class="pts-cell pts-cell--pos">${i + 1}</div>
        <div class="pts-cell pts-cell--team">
          <img src="logos/${s.team}.png" class="pts-logo" alt="${s.team}">
          <span class="pts-name" style="color:${color};">${tm.short || s.team}</span>
          <span class="pts-fullname">${tm.name || ""}</span>
        </div>
        <div class="pts-cell">${s.p}</div>
        <div class="pts-cell" style="color:var(--green); font-weight:700;">${s.w}</div>
        <div class="pts-cell" style="color:var(--red);">${s.l}</div>
        <div class="pts-cell">${s.nr}</div>
        <div class="pts-cell pts-cell--pts">${s.pts}</div>
        <div class="pts-cell" style="color:${nrrColor}; font-weight:600;">${nrrStr}</div>
        <div class="pts-cell pts-cell--form">${recentForm}</div>
      </div>
      <div class="pts-results" id="${bodyId}">
        ${renderTeamResults(results, s.team, teams)}
      </div>
    </div>`;
  });

  html += `</div>`;

  // Inject custom styles for points table
  html += `<style>
    .pts-table { border-radius: var(--radius); overflow: hidden; border: 1px solid var(--border); }
    .pts-row {
      display: grid;
      grid-template-columns: 40px 2fr repeat(5, 1fr) 1fr 120px;
      align-items: center; padding: 0.8rem 1rem;
      border-bottom: 1px solid var(--border);
      transition: all var(--transition);
    }
    .pts-row:hover { background: rgba(255,255,255,0.02); }
    .pts-row--header {
      background: rgba(255,215,0,0.05); font-size: 0.72rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted);
      cursor: default !important;
    }
    .pts-row--header:hover { background: rgba(255,215,0,0.05); }
    .pts-row--qualify { border-left: 3px solid var(--green); }
    .pts-cell { text-align: center; font-size: 0.88rem; }
    .pts-cell--pos { font-weight: 800; color: var(--text-dim); font-size: 0.82rem; }
    .pts-cell--team { text-align: left; display: flex; align-items: center; gap: 0.6rem; }
    .pts-cell--pts { font-weight: 900; font-size: 1.05rem; color: var(--gold);
      text-shadow: 0 0 12px rgba(255,215,0,0.3); }
    .pts-cell--form { display: flex; gap: 3px; justify-content: center; }
    .pts-logo { width: 32px; height: 32px; object-fit: contain; }
    .pts-name { font-weight: 700; font-size: 0.95rem; }
    .pts-fullname { font-size: 0.7rem; color: var(--text-dim); display: none; }
    .form-dot {
      display: inline-flex; align-items: center; justify-content: center;
      width: 20px; height: 20px; border-radius: 4px; font-size: 0.6rem;
      font-weight: 800; letter-spacing: 0;
    }
    .form-dot--w { background: rgba(16,185,129,0.15); color: var(--green); }
    .form-dot--l { background: rgba(239,68,68,0.15); color: var(--red); }
    .form-dot--nr { background: rgba(100,116,139,0.15); color: var(--text-muted); }
    .pts-results { display: none; background: rgba(0,0,0,0.2); border-bottom: 1px solid var(--border); }
    .pts-results.open { display: block; animation: fadeIn 0.3s ease; }
    .pts-results__inner { padding: 0.75rem 1rem 0.75rem 3.5rem; }
    .pts-res-row {
      display: flex; align-items: center; gap: 0.7rem; padding: 0.5rem 0.75rem;
      border-radius: var(--radius-xs); margin-bottom: 0.3rem;
      background: rgba(255,255,255,0.02);
      border-left: 3px solid var(--text-dim);
    }
    .pts-res-row--w { border-left-color: var(--green); }
    .pts-res-row--l { border-left-color: var(--red); }
    .pts-res-badge {
      display: inline-flex; align-items: center; justify-content: center;
      width: 24px; height: 24px; border-radius: 6px;
      font-size: 0.7rem; font-weight: 800; flex-shrink: 0;
    }
    .pts-res-badge--w { background: rgba(16,185,129,0.15); color: var(--green); }
    .pts-res-badge--l { background: rgba(239,68,68,0.15); color: var(--red); }
    .pts-res-badge--nr { background: rgba(100,116,139,0.15); color: var(--text-muted); }
    @media (max-width: 768px) {
      .pts-row { grid-template-columns: 28px 1.5fr repeat(5, 1fr) 0.8fr 90px; padding: 0.6rem 0.5rem; }
      .pts-cell { font-size: 0.78rem; }
      .pts-logo { width: 24px; height: 24px; }
      .pts-name { font-size: 0.82rem; }
      .pts-cell--form { display: none; }
      .pts-results__inner { padding-left: 1rem; }
    }
  </style>`;

  el.innerHTML = html;

  // Toggle results on row click
  el.querySelectorAll(".pts-row:not(.pts-row--header)").forEach(row => {
    row.addEventListener("click", () => {
      const bodyId = row.dataset.body;
      const body = document.getElementById(bodyId);
      const wasOpen = body.classList.contains("open");
      el.querySelectorAll(".pts-results").forEach(r => r.classList.remove("open"));
      if (!wasOpen) body.classList.add("open");
    });
  });
}

function renderTeamResults(results, teamCode, teams) {
  if (!results.length) return `<div class="pts-results__inner" style="color:var(--text-muted); font-size:0.85rem;">No matches played yet</div>`;

  let html = `<div class="pts-results__inner">`;
  results.forEach(r => {
    const opp = teams[r.opponent] || {};
    const oppColor = opp.primary_color || "#888";
    const rc = r.result.toLowerCase();
    html += `<div class="pts-res-row pts-res-row--${rc}">
      <span class="pts-res-badge pts-res-badge--${rc}">${r.result}</span>
      <img src="logos/${r.opponent}.png" style="width:22px; height:22px; object-fit:contain;">
      <div style="flex:1;">
        <div style="font-size:0.85rem; font-weight:600;">
          vs <span style="color:${oppColor};">${opp.short || r.opponent}</span>
          <span style="color:var(--text-dim); font-weight:400;"> — ${r.result_text}</span>
        </div>
        <div style="font-size:0.7rem; color:var(--text-muted);">
          📅 ${fmtDate(r.date)} · 🏟 ${r.venue}
        </div>
      </div>
    </div>`;
  });
  html += `</div>`;
  return html;
}
