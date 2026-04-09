import * as store from "../store.js";
import { matchDay, isUpcoming, stagger } from "../ui.js";

export async function render(el) {
  const [sched, teams] = await Promise.all([store.schedule(), store.teams()]);
  const upcoming = sched.filter(m => isUpcoming(m.date) && m.team1 !== "TBD");
  const past = sched.filter(m => !isUpcoming(m.date) && m.team1 !== "TBD");
  const playoffs = sched.filter(m => m.stage);

  let html = `<div class="page-header">
    <h1>📅 <span class="accent">Upcoming Matches</span></h1>
    <p>${upcoming.length} matches remaining in IPL 2026</p>
  </div>`;

  if (upcoming.length) {
    html += upcoming.map((m, i) => matchCard(m, teams, i)).join("");
  } else {
    html += `<div class="empty"><div class="empty__icon">🏆</div>
      <div class="empty__text">All league matches completed!</div></div>`;
  }

  if (playoffs.length) {
    html += `<h2 class="section-title" style="margin-top:2rem;">🏆 Playoffs</h2>`;
    html += playoffs.map((m, i) => {
      const badge = m.stage ? `<span class="match-card__badge">${m.stage}</span>` : "";
      return `<div class="card match-card animate-in" style="animation-delay:${i * 0.05}s; cursor:default;">
        <div class="match-card__team"><span style="font-weight:700;">TBD</span></div>
        <div class="match-card__vs">VS</div>
        <div class="match-card__team match-card__team--away"><span style="font-weight:700;">TBD</span></div>
        <div class="match-card__meta">
          <span>📅 ${matchDay(m.date)}</span><span>🕐 ${m.time} IST</span>${badge}
        </div>
      </div>`;
    }).join("");
  }

  el.innerHTML = html;
}

function matchCard(m, teams, i) {
  const t1 = teams[m.team1] || {};
  const t2 = teams[m.team2] || {};
  const c1 = t1.primary_color || "#888";
  const c2 = t2.primary_color || "#888";
  const badge = m.stage ? `<span class="match-card__badge">${m.stage}</span>` : "";

  return stagger(`<div class="card match-card"
    onclick="window.location.hash='preview/${m.team1}_${m.team2}_${m.match}'"
    style="cursor:pointer;">
    <div class="match-card__team">
      <img class="match-card__logo" src="logos/${m.team1}.png" alt="${m.team1}">
      <div>
        <div class="match-card__name" style="color:${c1};">${t1.short || m.team1}</div>
      </div>
    </div>
    <div class="match-card__vs">VS</div>
    <div class="match-card__team match-card__team--away">
      <div>
        <div class="match-card__name" style="color:${c2};">${t2.short || m.team2}</div>
      </div>
      <img class="match-card__logo" src="logos/${m.team2}.png" alt="${m.team2}">
    </div>
    <div class="match-card__meta">
      <span>📅 ${matchDay(m.date)}</span>
      <span>🕐 ${m.time} IST</span>
      <span>🏟 ${m.venue}</span>
      ${badge}
    </div>
  </div>`, i);
}
