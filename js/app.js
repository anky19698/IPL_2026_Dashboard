/* Cricket Analysis Hub — router and shell */

import * as strengthsPage from "./pages/strengths.js";
import * as weaknessPage from "./pages/weakness.js";
import * as batterTeamsPage from "./pages/batterteams.js";
import * as matchupPage from "./pages/matchup.js";
import * as bowlerPage from "./pages/bowler.js";
import * as milestonesPage from "./pages/milestones.js";
import * as venuesPage from "./pages/venues.js";
import * as store from "./store.js";

const content = document.getElementById("content");
const sidebar = document.getElementById("sidebar");
const menuToggle = document.getElementById("menuToggle");

const pages = {
  strengths:    strengthsPage,
  weakness:     weaknessPage,
  batterteams:  batterTeamsPage,
  matchup:      matchupPage,
  bowler:       bowlerPage,
  milestones:   milestonesPage,
  venues:       venuesPage,
};

const DEFAULT_PAGE = "strengths";

/* The page name is everything before the first slash; the rest is passed
   through so a link can carry the player already selected. */
async function route() {
  const hash = window.location.hash.slice(1) || DEFAULT_PAGE;
  const slash = hash.indexOf("/");
  const page = slash === -1 ? hash : hash.slice(0, slash);
  const params = slash === -1 ? null : hash.slice(slash + 1);

  if (!pages[page]) { window.location.hash = DEFAULT_PAGE; return; }

  updateNav(page);
  sidebar.classList.remove("open");
  content.innerHTML = `<div class="loader"><div class="loader__spinner"></div><p>Loading…</p></div>`;

  try {
    await pages[page].render(content, params || null);
  } catch (err) {
    console.error(err);
    content.innerHTML = `<div class="empty">
      <div class="empty__icon">⚠️</div>
      <div class="empty__text">Failed to load data. Run <code>python scripts/build_data.py</code> first.</div>
    </div>`;
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateNav(page) {
  document.querySelectorAll(".nav-link, .bnav").forEach(el => {
    el.classList.toggle("active", el.dataset.page === page);
  });
}

menuToggle?.addEventListener("click", event => {
  event.stopPropagation();
  sidebar.classList.toggle("open");
});

document.addEventListener("click", event => {
  if (!sidebar.contains(event.target) && !menuToggle.contains(event.target)) {
    sidebar.classList.remove("open");
  }
});

/* Only re-render when the page part of the hash changes — the pages update the
   hash themselves as you pick players, and that should not reload them. */
let lastPage = null;
window.addEventListener("hashchange", () => {
  const hash = window.location.hash.slice(1) || DEFAULT_PAGE;
  const page = hash.split("/")[0];
  if (page !== lastPage) { lastPage = page; route(); }
});

function describeAge(isoString) {
  const minutes = Math.floor((Date.now() - new Date(isoString)) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

async function showDataAge() {
  const badge = document.getElementById("dataAge");
  if (!badge) return;
  try {
    const meta = await store.meta();
    const total = Object.values(meta.match_counts || {}).reduce((a, b) => a + b, 0);
    badge.textContent = `Data: ${describeAge(meta.generated_at)}`;
    badge.title = `${total.toLocaleString()} matches · built ${new Date(meta.generated_at).toLocaleString()}`;
  } catch {
    badge.textContent = "Data: unknown";
  }
}

lastPage = (window.location.hash.slice(1) || DEFAULT_PAGE).split("/")[0];
route();
showDataAge();
