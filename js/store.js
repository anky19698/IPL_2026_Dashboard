/* Data store.

   The heavy per-player data is split into numbered shard files so a page only
   downloads the slice it needs. The index files say which shard a name is in. */

const cache = new Map();

function load(path) {
  if (!cache.has(path)) {
    cache.set(path, fetch(`data/${path}.json`).then(response => {
      if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
      return response.json();
    }).catch(err => { cache.delete(path); throw err; }));
  }
  return cache.get(path);
}

export const meta        = () => load("meta");
export const teams       = () => load("teams");
export const venues      = () => load("venues");
export const milestones  = () => load("milestones");
export const batterIndex = () => load("bat_index");
export const bowlerIndex = () => load("bowl_index");

/* Everything a single batter has done: "b" is per bowler, "t" is per team. */
export async function batterRecord(name) {
  const index = await batterIndex();
  const shard = index[name];
  if (shard === undefined) return null;
  const bundle = await load(`bat/${shard}`);
  return bundle[name] || null;
}

/* Everything a single bowler has done: "b" is per batter. */
export async function bowlerRecord(name) {
  const index = await bowlerIndex();
  const shard = index[name];
  if (shard === undefined) return null;
  const bundle = await load(`bowl/${shard}`);
  return bundle[name] || null;
}

/* Ball-by-ball innings for one batter-vs-bowler pairing.
   Venue names are stored once per shard and referenced by position. */
export async function matchupInnings(batter, bowler) {
  const index = await batterIndex();
  const shard = index[batter];
  if (shard === undefined) return {};
  const bundle = await load(`inn/${shard}`);
  const rows = bundle.m?.[`${batter}__${bowler}`];
  if (!rows) return {};

  const venueNames = bundle.v || [];
  const out = {};
  for (const [code, entries] of Object.entries(rows)) {
    out[code] = entries.map(([runs, balls, out_, date, venueIndex, fours, sixes]) => ({
      runs, balls, dismissed: !!out_, date,
      venue: venueNames[venueIndex] || "",
      fours, sixes,
    }));
  }
  return out;
}
