import * as store from "../store.js";
import { hud, fmtDate, isUpcoming, innRow, collapse, teamColor } from "../ui.js";

export async function render(el, params) {
  const [sched, teams, squadsData, h2hData, venueData, bvbData, msData] = await Promise.all([
    store.schedule(), store.teams(), store.squads(),
    store.h2h(), store.venues(), store.bvb(), store.milestones(),
  ]);

  const upcoming = sched.filter(m => isUpcoming(m.date) && m.team1 !== "TBD");

  let selected = null;
  if (params) {
    const [t1, t2] = params.split("_");
    selected = sched.find(m => m.team1 === t1 && m.team2 === t2);
  }

  let html = `<div class="page-header">
    <h1>🔍 <span class="accent">Match Preview</span></h1>
    <p>Select a match to view detailed analysis</p>
  </div>`;

  html += `<div class="select-wrap" style="max-width:500px; margin-bottom:1.5rem;">
    <select id="matchSelect">
      <option value="">Choose a match...</option>
      ${upcoming.map(m => {
        const val = `${m.team1}_${m.team2}_${m.match}`;
        const sel = selected && selected.match === m.match ? "selected" : "";
        return `<option value="${val}" ${sel}>Match ${m.match}: ${m.team1} vs ${m.team2} — ${fmtDate(m.date)}</option>`;
      }).join("")}
    </select>
  </div>`;

  if (!selected && upcoming.length) selected = upcoming[0];

  if (selected) {
    const t1 = selected.team1, t2 = selected.team2;
    html += renderPreview(t1, t2, selected, teams, h2hData, venueData, bvbData, squadsData, msData);
  }

  el.innerHTML = html;

  document.getElementById("matchSelect")?.addEventListener("change", e => {
    if (e.target.value) window.location.hash = `preview/${e.target.value}`;
  });

  el.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const group = btn.closest(".tabs").parentElement;
      group.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      group.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      group.querySelector(`#${btn.dataset.tab}`).classList.add("active");
    });
  });
}

function renderPreview(t1, t2, match, teams, h2hData, venueData, bvbData, squadsData, msData) {
  const tm1 = teams[t1] || {}, tm2 = teams[t2] || {};
  const c1 = tm1.primary_color || "#888", c2 = tm2.primary_color || "#888";

  let html = `<div class="tabs">
    <button class="tab-btn active" data-tab="tab-h2h">⚔️ Head-to-Head</button>
    <button class="tab-btn" data-tab="tab-venue">🏟 Venue</button>
    <button class="tab-btn" data-tab="tab-matchups">⚡ Matchups</button>
    <button class="tab-btn" data-tab="tab-milestones">🎯 Milestones</button>
  </div>`;

  html += `<div class="tab-panel active" id="tab-h2h">${renderH2H(t1, t2, teams, h2hData)}</div>`;
  html += `<div class="tab-panel" id="tab-venue">${renderVenue(match.venue, venueData)}</div>`;
  html += `<div class="tab-panel" id="tab-matchups">${renderMatchups(t1, t2, teams, bvbData, squadsData)}</div>`;
  html += `<div class="tab-panel" id="tab-milestones">${renderMilestones(t1, t2, teams, msData)}</div>`;

  return html;
}

function renderH2H(t1, t2, teams, h2hData) {
  const key = [t1, t2].sort().join("_");
  const rec = h2hData[key];
  if (!rec) return `<div class="empty"><div class="empty__icon">📊</div><div class="empty__text">No H2H data available</div></div>`;

  const tm1 = teams[t1] || {}, tm2 = teams[t2] || {};
  const w1 = rec.team1 === t1 ? rec.team1_wins : rec.team2_wins;
  const w2 = rec.team1 === t1 ? rec.team2_wins : rec.team1_wins;
  const c1 = tm1.primary_color || "#888", c2 = tm2.primary_color || "#888";

  let html = `<div class="h2h-hero">
    <div class="h2h-hero__team">
      <img class="h2h-hero__logo" src="logos/${t1}.png" alt="${t1}">
      <div class="h2h-hero__name" style="color:${c1};">${tm1.short || t1}</div>
      <div class="h2h-hero__wins" style="color:${c1};">${w1}</div>
    </div>
    <div style="text-align:center;">
      <div class="h2h-hero__vs">VS</div>
      <div style="font-size:0.75rem; color:var(--text-dim); margin-top:0.5rem;">${rec.total} matches</div>
    </div>
    <div class="h2h-hero__team">
      <img class="h2h-hero__logo" src="logos/${t2}.png" alt="${t2}">
      <div class="h2h-hero__name" style="color:${c2};">${tm2.short || t2}</div>
      <div class="h2h-hero__wins" style="color:${c2};">${w2}</div>
    </div>
  </div>`;

  const results = rec.results || [];
  if (results.length) {
    html += `<div class="section-title">Last ${Math.min(5, results.length)} Results</div>`;
    const last5 = results.slice(0, 5);
    html += last5.map(r => resultRow(r, t1)).join("");

    if (results.length > 5) {
      html += collapse(`📋 View All ${results.length} Results`, results.slice(5).map(r => resultRow(r, t1)).join(""));
    }
  }

  const kp = [...(tm1.key_players || []).map(p => ({p, t: t1})),
              ...(tm2.key_players || []).map(p => ({p, t: t2}))];
  if (kp.length) {
    html += `<div class="section-title" style="margin-top:1.5rem;">⭐ Key Players</div>`;
    html += `<div style="display:flex; flex-wrap:wrap; gap:0.5rem;">`;
    kp.forEach(({p, t}) => {
      html += `<span class="team-badge" style="background:rgba(${hexToRgb(teamColor(teams, t))},0.12); color:${teamColor(teams, t)};">
        <img src="logos/${t}.png" style="width:18px; height:18px; object-fit:contain;"> ${p}
      </span>`;
    });
    html += `</div>`;
  }

  return html;
}

function resultRow(r, teamA) {
  const winClass = r.winner === teamA ? "result-row--win" : r.winner ? "result-row--loss" : "";
  return `<div class="result-row ${winClass}">
    <div class="result-row__main">
      <div class="result-row__text">${r.result_text}</div>
      <div class="result-row__sub">📅 ${fmtDate(r.date)} · 🏟 ${r.venue}</div>
    </div>
  </div>`;
}

function renderVenue(venueName, venueData) {
  const stats = venueData[venueName];
  if (!stats) return `<div class="empty"><div class="empty__icon">🏟</div>
    <div class="empty__text">No venue data for ${venueName}</div></div>`;

  const natureCls = stats.nature === "Chase-Friendly" ? "var(--green)"
    : stats.nature === "Defend-Friendly" ? "var(--orange)" : "var(--blue)";

  return `<div class="card card--flat" style="margin-bottom:1rem;">
    <h3 style="font-size:1.1rem; margin-bottom:0.5rem;">🏟 ${venueName}</h3>
    <span class="team-badge" style="background:rgba(255,255,255,0.05); color:${natureCls}; border-color:${natureCls};">
      ${stats.nature}
    </span>
  </div>
  <div class="hud-grid hud-grid--4">
    ${hud(stats.matches, "Matches", "var(--blue)", "59,130,246")}
    ${hud(stats.avg_1st_innings, "Avg 1st Inn", "var(--green)", "16,185,129")}
    ${hud(stats.avg_2nd_innings, "Avg 2nd Inn", "var(--orange)", "245,158,11")}
    ${hud(stats.bat_first_pct + "%", "Bat First Win%", "var(--gold)", "255,215,0")}
  </div>
  <div class="hud-grid hud-grid--3" style="margin-top:0.75rem;">
    ${hud(stats.bat_first_wins, "Bat 1st Wins", "var(--green)", "16,185,129")}
    ${hud(stats.bat_second_wins, "Chase Wins", "var(--blue)", "59,130,246")}
    ${hud(stats.bat_second_pct + "%", "Chase Win%", "var(--purple)", "168,85,247")}
  </div>`;
}

function renderMatchups(t1, t2, teams, bvbData, squadsData) {
  const s1 = new Set(squadsData[t1] || []);
  const s2 = new Set(squadsData[t2] || []);

  let matchups = bvbData.filter(m =>
    (s1.has(m.batter) && s2.has(m.bowler)) || (s2.has(m.batter) && s1.has(m.bowler))
  ).filter(m => m.balls >= 3);

  matchups = matchups.filter(m => m.dismissals > 0 || m.runs > 150);
  matchups.sort((a, b) => b.dismissals - a.dismissals || b.balls - a.balls);
  matchups = matchups.slice(0, 15);

  if (!matchups.length) return `<div class="empty"><div class="empty__icon">⚡</div>
    <div class="empty__text">No significant matchups found</div></div>`;

  return matchups.map((m, i) => {
    const batTeam = s1.has(m.batter) ? t1 : t2;
    const bowlTeam = s2.has(m.bowler) ? t2 : t1;
    return `<div class="mu-card">
      <div class="mu-card__header">
        <span class="mu-card__rank">#${i + 1}</span>
        <img src="logos/${batTeam}.png" style="width:20px; height:20px; object-fit:contain;">
        <span class="mu-card__name" style="color:var(--gold);">${m.batter}</span>
        <span class="mu-card__vs">vs</span>
        <img src="logos/${bowlTeam}.png" style="width:20px; height:20px; object-fit:contain;">
        <span class="mu-card__name">${m.bowler}</span>
        <span class="mu-card__dismiss">${m.dismissals} dismissals</span>
      </div>
      <div class="hud-grid hud-grid--5">
        ${hud(m.balls, "Balls", "var(--text-muted)", "148,163,184")}
        ${hud(m.runs, "Runs", "var(--green)", "16,185,129")}
        ${hud(m.dismissals, "Dismissed", "var(--red)", "239,68,68")}
        ${hud(m.sr, "SR", "var(--blue)", "59,130,246")}
        ${hud(m.dots, "Dots", "var(--text-dim)", "71,85,105")}
      </div>
    </div>`;
  }).join("");
}

function renderMilestones(t1, t2, teams, msData) {
  const relevant = [...(msData.imminent || []), ...(msData.watchlist || [])]
    .filter(m => m.team === t1 || m.team === t2);

  if (!relevant.length) return `<div class="empty"><div class="empty__icon">🎯</div>
    <div class="empty__text">No approaching milestones for these teams</div></div>`;

  return relevant.map(m => `<div class="ms-row">
    <span class="ms-row__icon">${m.icon}</span>
    <img class="ms-row__team-logo" src="logos/${m.team}.png" alt="${m.team}">
    <div class="ms-row__info">
      <div class="ms-row__player">${m.player}</div>
      <div class="ms-row__detail">${m.detail}</div>
    </div>
    <div class="ms-row__needed">${m.needed}</div>
  </div>`).join("");
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
