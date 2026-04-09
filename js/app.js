/* IPL 2026 Dashboard — Main App */

import * as schedulePage from "./pages/schedule.js";
import * as previewPage from "./pages/preview.js";
import * as matchupPage from "./pages/matchup.js";
import * as bowlerPage from "./pages/bowler.js";
import * as batterPage from "./pages/batter.js";
import * as milestonesPage from "./pages/milestones.js";
import * as venuesPage from "./pages/venues.js";

const content = document.getElementById("content");
const sidebar = document.getElementById("sidebar");
const menuToggle = document.getElementById("menuToggle");

const pages = {
  schedule:   schedulePage,
  preview:    previewPage,
  matchup:    matchupPage,
  bowler:     bowlerPage,
  batter:     batterPage,
  milestones: milestonesPage,
  venues:     venuesPage,
};

let currentPage = "";

async function route() {
  const hash = window.location.hash.slice(1) || "schedule";
  const [page, ...rest] = hash.split("/");
  const params = rest.join("/");

  if (!pages[page]) { window.location.hash = "schedule"; return; }

  updateNav(page);
  sidebar.classList.remove("open");
  content.innerHTML = `<div class="loader"><div class="loader__spinner"></div><p>Loading...</p></div>`;

  try {
    await pages[page].render(content, params || null);
  } catch (err) {
    console.error(err);
    content.innerHTML = `<div class="empty">
      <div class="empty__icon">⚠️</div>
      <div class="empty__text">Failed to load data. Run <code>python scripts/build_data.py</code> first.</div>
    </div>`;
  }

  currentPage = page;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateNav(page) {
  document.querySelectorAll(".nav-link, .bnav").forEach(el => {
    el.classList.toggle("active", el.dataset.page === page);
  });
}

menuToggle?.addEventListener("click", () => sidebar.classList.toggle("open"));
document.addEventListener("click", e => {
  if (!sidebar.contains(e.target) && e.target !== menuToggle && !menuToggle.contains(e.target))
    sidebar.classList.remove("open");
});

window.addEventListener("hashchange", route);
route();
