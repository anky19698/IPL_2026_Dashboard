/* Data store — fetches and caches JSON data files */

const cache = {};

async function load(name) {
  if (cache[name]) return cache[name];
  const resp = await fetch(`data/${name}.json`);
  if (!resp.ok) throw new Error(`Failed to load ${name}: ${resp.status}`);
  cache[name] = await resp.json();
  return cache[name];
}

export async function teams()      { return load("teams"); }
export async function schedule()   { return load("schedule"); }
export async function squads()     { return load("squads"); }
export async function h2h()        { return load("h2h"); }
export async function venues()     { return load("venues"); }
export async function milestones() { return load("milestones"); }
export async function bvb()        { return load("bvb"); }
export async function bvbInnings() { return load("bvb_innings"); }
export async function batterTeam() { return load("batter_team"); }

export function logoUrl(code) {
  return `logos/${code}.png`;
}
