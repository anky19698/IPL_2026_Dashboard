import * as store from "../store.js";

export async function render(el) {
  const msData = await store.milestones();

  let html = `<div class="page-header">
    <h1>🎯 <span class="accent">Milestones Approaching</span></h1>
    <p>Players on the verge of major IPL career milestones</p>
  </div>`;

  const imminent = msData.imminent || [];
  const watchlist = msData.watchlist || [];

  if (imminent.length) {
    html += `<div class="section-title">🔥 Imminent</div>`;
    html += imminent.map((m, i) => msRow(m, i)).join("");
  }

  if (watchlist.length) {
    html += `<div class="section-title" style="margin-top:2rem;">👀 On the Watchlist</div>`;
    html += watchlist.map((m, i) => msRow(m, i)).join("");
  }

  if (!imminent.length && !watchlist.length) {
    html += `<div class="empty"><div class="empty__icon">🎯</div>
      <div class="empty__text">No milestones approaching at the moment</div></div>`;
  }

  el.innerHTML = html;
}

function msRow(m, i) {
  return `<div class="ms-row animate-in" style="animation-delay:${i * 0.04}s;">
    <span class="ms-row__icon">${m.icon}</span>
    <img class="ms-row__team-logo" src="logos/${m.team}.png" alt="${m.team}">
    <div class="ms-row__info">
      <div class="ms-row__player">${m.player}</div>
      <div class="ms-row__detail">${m.detail}</div>
    </div>
    <div class="ms-row__needed">${m.needed}</div>
  </div>`;
}
