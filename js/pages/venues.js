import * as store from "../store.js";
import { hud } from "../ui.js";

export async function render(el) {
  const venueData = await store.venues();
  const venueNames = Object.keys(venueData).sort();

  let html = `<div class="page-header">
    <h1>🏟 <span class="accent">Venue Explorer</span></h1>
    <p>Explore batting and bowling conditions at IPL venues</p>
  </div>
  <div class="select-wrap" style="max-width:500px; margin-bottom:1.5rem;">
    <select id="venueSel">
      <option value="">Choose a venue...</option>
      ${venueNames.map(v => `<option value="${v}">${v}</option>`).join("")}
    </select>
  </div>
  <div id="venueResult"></div>`;

  el.innerHTML = html;

  document.getElementById("venueSel").addEventListener("change", e => {
    showVenue(e.target.value, venueData);
  });
}

function showVenue(name, venueData) {
  const out = document.getElementById("venueResult");
  if (!name) { out.innerHTML = ""; return; }
  const s = venueData[name];
  if (!s) { out.innerHTML = `<div class="empty"><div class="empty__text">No data for this venue</div></div>`; return; }

  const natureCls = s.nature === "Chase-Friendly" ? "var(--green)"
    : s.nature === "Defend-Friendly" ? "var(--orange)" : "var(--blue)";

  out.innerHTML = `
  <div class="card card--flat animate-in" style="margin-bottom:1rem;">
    <h3 style="font-size:1.15rem; margin-bottom:0.5rem;">🏟 ${name}</h3>
    <span class="team-badge" style="background:rgba(255,255,255,0.05); color:${natureCls}; border-color:${natureCls}; font-size:0.8rem;">
      ${s.nature}
    </span>
  </div>
  <div class="hud-grid hud-grid--4 animate-in stagger-1">
    ${hud(s.matches, "Total Matches", "var(--blue)", "59,130,246")}
    ${hud(s.avg_1st_innings, "Avg 1st Innings", "var(--green)", "16,185,129")}
    ${hud(s.avg_2nd_innings, "Avg 2nd Innings", "var(--orange)", "245,158,11")}
    ${hud(s.bat_first_pct + "%", "Bat First Win%", "var(--gold)", "255,215,0")}
  </div>
  <div class="hud-grid hud-grid--4 animate-in stagger-2" style="margin-top:0.75rem;">
    ${hud(s.bat_first_wins, "Bat 1st Wins", "var(--green)", "16,185,129")}
    ${hud(s.bat_second_wins, "Chase Wins", "var(--blue)", "59,130,246")}
    ${hud(s.bat_second_pct + "%", "Chase Win%", "var(--purple)", "168,85,247")}
    ${hud(Math.round((s.avg_1st_innings + s.avg_2nd_innings) / 2), "Avg Score", "var(--text)", "226,232,240")}
  </div>`;
}
