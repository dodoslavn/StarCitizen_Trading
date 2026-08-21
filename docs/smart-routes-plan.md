# Smart Routes — Implementation Plan

New touchportal tab that ranks trading routes by *aUEC per real-world hour*,
discounted for data-age confidence and adjusted for player constraints
(ship, wallet) and route risk. Sits alongside the existing best-routes page
`/touchportal/{scu}[/{system}]`, does not replace it.

Read `../CLAUDE.md` first for repo conventions, utilities, and reusable
helpers. Do NOT reinvent `escapeHtml`, `readable_number`, the shell/back-hub
pattern, etc.

Milestones are ordered such that each one is independently shippable — if
someone stops after M2, the tab still does something useful. Every milestone
ends with `master` green (tests pass, lint clean, page renders).

---

## Milestone 1 — Scaffolding

**Goal**: empty new tab, wired end-to-end, ready to receive real logic.

**Files to modify**
- `StarCitizen_Trading/handlers/touchportalHandler.js` — add case for `parts[1] === 'smart'`
- `StarCitizen_Trading/views/touchportal.js` — add third hub tile linking to `/touchportal/smart`
- `StarCitizen_Trading/views/touchportal-smart.js` — **NEW**, defines `touchportalSmart(cache, query)` view
- `StarCitizen_Trading/html.js` — re-export the new view

**Reuse from existing code**
- `shell()`, `escapeHtml`, back-hub link pattern — all in `views/touchportal.js` (import from there or extract to a shared helper if it starts to hurt)
- URL query-string parsing: use Node's `require('url').parse(req.url, true).query` in the handler; pass the query object into the view

**New signature**
```js
function touchportalSmart(cache, query) { /* returns HTML string */ }
```

**Acceptance checklist**
- [ ] Hub has three tiles now (Best Routes / Oldest Data / Smart Routes)
- [ ] Clicking "Smart Routes" opens `/touchportal/smart` and renders "Coming soon" or a placeholder heading
- [ ] Page has a back-to-hub button matching the other sub-pages
- [ ] `npm test` — 42 tests still pass
- [ ] `npm run lint` — 0 errors

**Tests to add**
- None strictly required for a placeholder page. Optional smoke: assert `html.touchportalSmart` is a function.

---

## Milestone 2 — Ranked list with confidence discount

**Goal**: an actual ranking, sorted by profit discounted for how stale the underlying data is.

**Files to modify**
- `StarCitizen_Trading/utils/formatters.js` — add `dataAgeConfidence(unixTs)` (see below)
- `StarCitizen_Trading/views/touchportal-smart.js` — build the ranked table
- `StarCitizen_Trading/tests/formatters.test.js` — tests for `dataAgeConfidence`

**Reuse from existing code**
- Iteration pattern from `calculateBestRoutes` in `views/touchportal.js` (nested loops over sell × buy per commodity, checking `commodity_name` and non-zero prices). Adapt, don't copy verbatim.
- Recency CSS classes (`.recent`, `.aging`, `.very-old`) from `views/touchportal.js` for the confidence badge colouring — either extract to shared styles or duplicate the small ruleset

**New function signature**
```js
// utils/formatters.js
/**
 * Confidence multiplier based on how stale a UEX date_modified is.
 * @param {number} unixTsSeconds
 * @returns {number} 0.05 - 1.0
 */
function dataAgeConfidence(unixTsSeconds) {
    if (!unixTsSeconds) return 0.05;
    const ageDays = (Date.now() - unixTsSeconds * 1000) / (24 * 3600 * 1000);
    if (ageDays < 1) return 1.0;
    if (ageDays < 7) return 0.7;
    if (ageDays < 30) return 0.3;
    return 0.05;
}
```

**Row shape (each ranked route)**
```js
{
    commodity, buyTerminal, sellTerminal,
    buyPrice, sellPrice, priceDelta,
    amount,           // min(scu_sell_stock, scu_buy) capped
    rawProfit,        // amount × priceDelta
    confidence,       // min of buy-side and sell-side dataAgeConfidence
    discountedProfit  // rawProfit × confidence
}
```

Sort by `discountedProfit` desc, take top 30.

**Table columns (in order)**
Commodity · Buy at · Sell at · Δ · Amount · Discounted profit · Confidence

**Acceptance checklist**
- [ ] Page shows 30 rows sorted by discounted profit
- [ ] Rows whose buy or sell data is >30 days old have a red confidence badge and score close to zero
- [ ] Rows with fresh data (<24h both sides) render at full profit
- [ ] `escapeHtml` used on every UEX-sourced string (terminal names, commodity names)
- [ ] Test: `dataAgeConfidence` returns 1.0 for now, 0.7 for 3 days ago, 0.3 for 14 days ago, 0.05 for 100 days ago
- [ ] `npm test && npm run lint` clean

---

## Milestone 3 — Ship + wallet inputs

**Goal**: apply real player constraints. A route requiring 4M aUEC investment is dropped for a player with 100k wallet.

**Files to modify**
- `StarCitizen_Trading/handlers/touchportalHandler.js` — parse query params (`?ship=corsair&wallet=100000`)
- `StarCitizen_Trading/utils/validation.js` — add `validateShipId(input)` and `validateWallet(input)`
- `StarCitizen_Trading/views/touchportal-smart.js` — ship dropdown, wallet input, apply constraints, ROI column
- `StarCitizen_Trading/tests/formatters.test.js` (or new `tests/routes.test.js`) — usable-cargo calc test

**Reuse**
- `validateSCU` in `utils/validation.js` is a good template for the wallet validator
- ROI badge colouring can piggyback on existing `.stock-*` colours from `views/styles.js`

**Ships come from the UEX `/vehicles` endpoint**, not a hardcoded table. UEX exposes 280 vehicles with `scu`, `pad_type` (XS/S/M/L/XL), `container_sizes`, dimensions, and `is_*` flags. This means the ship dropdown updates automatically when CIG adds new ships and we don't drift from reality.

Fetch and cache at startup, same pattern as `fetchSolarSystems` / `fetchTerminals` in `services/uexApi.js`. Add:

```js
// services/uexApi.js
async function fetchVehicles(config) {
    const url = buildApiUrl(config, 'vehicles');
    return await downloadJson(url, config);
}
```

Add `"vehicles": "/vehicles"` to `config.json.example` under `api.endpoints`. **Remember to tell the user to add this key to their production deploy script** (see CLAUDE.md).

Extend `services/trading.js` `initializeData` to also fetch vehicles, filter to relevant cargo-capable spaceships, and cache in DataCache:

```js
function processVehicles(rawData) {
    if (!rawData || !Array.isArray(rawData.data)) return [];
    return rawData.data
        .filter(v => v.is_spaceship && v.is_quantum_capable && (v.scu || 0) > 0)
        .map(v => ({
            id: v.id,
            slug: v.slug,
            name: v.name_full || v.name,
            scu: Number(v.scu) || 0,
            pad_type: v.pad_type || '',        // 'XS' | 'S' | 'M' | 'L' | 'XL' | ''
            container_sizes: v.container_sizes || '',
            // Derived flags for the feasibility filter, not stored on the API.
            // XL-pad ships are typically capital-class that can't land on planetary
            // pads and need a docking port instead.
            canLand: ['XS', 'S', 'M', 'L'].includes(v.pad_type || ''),
            // Heuristic: 400 SCU+ is where manual loading becomes untenable.
            // Adjust or expose as a per-ship override if this misclassifies too often.
            needsAutoLoad: (Number(v.scu) || 0) >= 400
        }))
        .sort((a, b) => a.scu - b.scu);
}
```

Store on `DataCache` with `setVehicles(list)` / `getVehicles()` (mirror the existing accessor pattern).

**Ship dropdown**: read from `cache.getVehicles()`. Group by SCU brackets in the `<optgroup>` if it feels long — 124 ships is too many to browse flat.

**Fields worth surfacing next to the dropdown** (small text below): pad type, container sizes. Helps the player understand why a route was filtered out.

**Terminal capability metadata** — `processTerminals` in `services/trading.js` needs to preserve these UEX fields alongside the location fields it already stores:
- `has_freight_elevator` (0/1) — cargo can physically move in/out via elevator. 78% of commodity terminals have this.
- `has_docking_port` (0/1) — capital-ship docking port. ~14%, mostly big stations.
- `is_auto_load` (0/1) — transaction spawns cargo directly in ship hold. ~36% of commodity terminals; almost exclusively stations and big cities. **Zero moons/outposts have it** as of this writing.
- `has_loading_dock` (0/1) — rare (~8%). Truck-style loading dock. Treat as a variant of freight elevator for our purposes.

**Do NOT collapse these into one "supportsAutoLoad" flag.** They mean different things:
- `is_auto_load = 1` → truly fast (fixed ~4 min per side, cargo appears in hold)
- `has_freight_elevator = 1, is_auto_load = 0` → possible but manual (linear-in-SCU box-shuffling)
- Neither → the ship needs to physically fit cargo through the small terminal, only works for tiny loads
- `has_docking_port = 1` → what capital ships (890 Jump etc.) need to dock at all

Skip `mcs` (max container size) — the field exists in the UEX schema but is 0 for every commodity terminal in the current dataset. Revisit if it starts getting populated.

**Feasibility filter** (applied in M3 before the constraint stack):
```js
function terminalReachable(terminalInit, terminalPricesRow, ship) {
    // XL-pad / non-landing capital ships need either a space station OR a
    // docking port. Ground terminals without either are physically unreachable.
    if (!ship.canLand) {
        if (terminalInit?.space_station_name) return true;
        if (terminalInit?.has_docking_port)   return true;
        return false;
    }
    // Ships that need auto-load can't function at manual-load terminals -
    // moving 500+ SCU by hand isn't practical.
    if (ship.needsAutoLoad && !terminalInit?.is_auto_load) return false;
    return true;
}

/**
 * Container-size fit: both the ship and the terminal list which SCU box sizes
 * they accept. If the intersection is empty, no boxes can move between them.
 * (Rare in practice - most cargo ships accept 1,2,4 and most terminals do too -
 * but the fields exist so we may as well use them.)
 */
function containerSizesCompatible(shipSizesCsv, terminalRow) {
    if (!shipSizesCsv || !terminalRow?.container_sizes) return true; // unknown -> assume ok
    const shipSizes = new Set(shipSizesCsv.split(',').map(s => s.trim()));
    return terminalRow.container_sizes.split(',').some(s => shipSizes.has(s.trim()));
}

// Drop the route if EITHER terminal is unreachable or container-incompatible.
if (!terminalReachable(buyInit,  buyRow,  ship)) return null;
if (!terminalReachable(sellInit, sellRow, ship)) return null;
if (!containerSizesCompatible(ship.container_sizes, buyRow))  return null;
if (!containerSizesCompatible(ship.container_sizes, sellRow)) return null;
```

**Constraint stack** (compute per candidate route):
```js
const stockCap    = row.scu_sell_stock;           // buy-side
const demandCap   = row.scu_buy_max || Infinity;  // sell-side (from max_inventory)
const shipCap     = SHIPS[ship].scu;
const walletCap   = wallet > 0 ? Math.floor(wallet / row.price_buy) : Infinity;
const amount      = Math.min(stockCap, demandCap, shipCap, walletCap);
if (amount <= 0) return null;   // infeasible
```

Container-size fit is a stretch for this milestone — skip unless it fits easily.

**URL** (query string, not path segments)
- `/touchportal/smart?ship=corsair&wallet=100000&sort=profit`
- Defaults: `ship=cutlass`, `wallet=` (empty = unlimited), `sort=profit`

**New columns**
- Investment (`amount × price_buy`)
- ROI % (`(sellPrice - buyPrice) / buyPrice × 100`)

**Sort toggle** — two links at top of table: "Sort by profit" | "Sort by ROI"

**Acceptance checklist**
- [ ] Ship dropdown populated from `cache.getVehicles()`, not a hardcoded array
- [ ] Startup logs "Loaded N vehicles from UEX" and N is 100+
- [ ] Ship dropdown changes what's shown (SCU cap tightens for smaller ships)
- [ ] Wallet field limits `amount` such that `investment ≤ wallet`
- [ ] Empty wallet = unlimited (matches Milestone 2 behavior)
- [ ] Infeasible routes are dropped entirely (not shown greyed)
- [ ] Picking an XL-pad ship (e.g. 890 Jump) drops routes to moon outposts
- [ ] Picking a 400+ SCU ship drops routes to non-auto-load terminals
- [ ] Sort toggle switches between absolute profit and ROI
- [ ] Query params survive round-trips (change ship, ship stays selected)
- [ ] Test: constraint stack returns min of all caps
- [ ] Test: `terminalReachable` returns false for XL ship at outpost, true at station-with-docking-port
- [ ] Test: `containerSizesCompatible` returns true when overlap exists, false when disjoint
- [ ] `npm test && npm run lint` clean

---

## Milestone 4 — Trip time + aUEC/hour

**Goal**: rank by profit **per hour of real playtime**, not per trip.

**Files to modify**
- `StarCitizen_Trading/utils/travelTime.js` — **NEW**, estimator functions
- `StarCitizen_Trading/views/touchportal-smart.js` — new columns, new default sort
- `StarCitizen_Trading/tests/travelTime.test.js` — **NEW**

**Terminal type classifier** (feed from `cachedInitData[terminal_name]`):
```js
function classifyTerminal(initEntry) {
    if (initEntry?.space_station_name) return 'station'; // dockable
    if (initEntry?.city_name)          return 'city';    // big landing pad
    if (initEntry?.moon_name)          return 'moon';    // surface pad
    if (initEntry?.outpost_name)       return 'outpost'; // remote surface
    return 'unknown';                                     // default to city-ish
}
```

**Approach/land/dock time table** (minutes, per terminal touched)
```js
const APPROACH_TIME_MIN = { station: 3, city: 8, moon: 10, outpost: 15, unknown: 8 };
```

**Loading time** (per terminal touched — loading AND unloading count)

Loading is a huge chunk of trip time and depends on whether auto-load is
available AND the ship can use it. Fixed cost for auto-load; linear-in-SCU
for manual.

```js
const AUTO_LOAD_MIN           = 4;    // is_auto_load = 1: transaction spawns cargo in hold, ~4 min door-to-door
const MANUAL_LOAD_SETUP_MIN   = 3;    // hangar spawn, tractor/vehicle spawn, positioning
const MANUAL_LOAD_MIN_PER_SCU = 0.15; // rough - 500 SCU manual = ~75 min per side

function loadTimeMin(terminalInit, ship, scuAmount) {
    if (terminalInit?.is_auto_load)    return AUTO_LOAD_MIN;
    // Feasibility filter (M3) already drops manual-load terminals for auto-load-only ships,
    // so if we get here we're loading manually. Freight elevator vs no freight elevator
    // doesn't change loading TIME much - it changes whether cargo physically fits,
    // and that's covered by the feasibility filter's has_docking_port check for capitals.
    return MANUAL_LOAD_SETUP_MIN + scuAmount * MANUAL_LOAD_MIN_PER_SCU;
}
```

**QT/travel time between terminals**
```js
function travelTimeMin(fromInit, toInit) {
    if (fromInit?.name !== toInit?.name)               return 20; // cross-system
    if (fromInit?.planet_name !== toInit?.planet_name) return 10; // cross-planet
    return 5; // same orbit
}
```

**Score** — sum of both sides' approach + load, plus in-between travel:
```js
const totalMin  = APPROACH_TIME_MIN[classifyTerminal(buyInit)]
               + loadTimeMin(buyInit, ship, amount)
               + travelTimeMin(buyInit, sellInit)
               + APPROACH_TIME_MIN[classifyTerminal(sellInit)]
               + loadTimeMin(sellInit, ship, amount);
const perHour   = discountedProfit / (totalMin / 60);
```

Loading time being amount-dependent means the aUEC/hour ranking may
prefer smaller loads at auto-load terminals over huge loads at manual-only
ones, which is realistic.

**New columns**
- Est. time (formatted `~18 min`)
- aUEC/hour

**New default sort**: aUEC/hour (add to the sort toggle from M3)

**Acceptance checklist**
- [ ] Every row has an est. time (10 min to ~2 hours for heavy manual loads)
- [ ] aUEC/hour column populated for every row
- [ ] Default sort changed to aUEC/hour
- [ ] Cross-system routes have longer times than intra-system
- [ ] Auto-load ↔ auto-load routes have shortest total times
- [ ] Loading time visibly dominates trip time for big manual loads (e.g. C2 at a mining outpost)
- [ ] Tests for `classifyTerminal`, `travelTimeMin`, `loadTimeMin` (with both auto-load and manual cases)
- [ ] `npm test && npm run lint` clean

---

## Milestone 5 — System filter + risk

**Goal**: safety-vs-profit tradeoff visible; player can filter "safe only".

**Files to modify**
- `StarCitizen_Trading/utils/risk.js` — **NEW**, per-system survival multipliers
- `StarCitizen_Trading/handlers/touchportalHandler.js` — parse `system`, `safe`, `sameSystem` query params
- `StarCitizen_Trading/views/touchportal-smart.js` — filter buttons, safe-only toggle, risk column
- `StarCitizen_Trading/tests/risk.test.js` — **NEW**

**Risk table** (hand-curated, adjust based on community feedback)
```js
const SYSTEM_SURVIVAL = {
    Stanton: 0.98,
    Pyro:    0.60,
    Nyx:     0.65
    // Crusader is a planet in Stanton, not a system - don't confuse
};
const DEFAULT_SURVIVAL = 0.90;

function routeSurvival(buyInit, sellInit) {
    const buySurv  = SYSTEM_SURVIVAL[buyInit?.name]  ?? DEFAULT_SURVIVAL;
    const sellSurv = SYSTEM_SURVIVAL[sellInit?.name] ?? DEFAULT_SURVIVAL;
    return Math.min(buySurv, sellSurv);
}
```

**Score becomes**
```js
const expectedProfit = discountedProfit * routeSurvival(buyInit, sellInit);
const perHour        = expectedProfit / (totalMin / 60);
```

**New columns**
- Risk badge (green ≥0.95 / yellow ≥0.80 / red <0.80)
- Capital at risk (`investment × (1 - survival)`) — small text, only shown for wallet-constrained runs

**UI additions**
- System filter buttons like `/touchportal/stale` has (Stanton / Pyro / Nyx / All)
- Toggle chip: "Safe routes only" (filters `survival >= 0.90`)
- Toggle chip: "Same system only" (filters routes where `buyInit.name === sellInit.name`)

**URL** — add to query string:
- `system=Stanton` (or omit for all)
- `safe=1`
- `sameSystem=1`

**Acceptance checklist**
- [ ] Filter buttons reload the page with the correct query param
- [ ] "Safe only" hides all Pyro/Nyx-touching routes
- [ ] "Same system only" hides all cross-system routes
- [ ] Risk badge visible and colored per row
- [ ] Test: `routeSurvival` returns min of both sides
- [ ] Test: unknown system falls back to `DEFAULT_SURVIVAL`
- [ ] `npm test && npm run lint` clean

---

## Milestone 6 — Real distances from UEX (optional, stretch)

**Goal**: replace M4's classification-based time with actual UEX distances and per-ship QT speed.

**Files to modify / create**
- `StarCitizen_Trading/services/uexApi.js` — add `fetchTerminalDistances(config)` (endpoint `/terminals_distances`)
- `StarCitizen_Trading/scan-terminal-distances.js` — **NEW**, mirrors `scan-max-inventory.js` structure
- `StarCitizen_Trading/terminals_distances.json` — **NEW**, committed data file
- `StarCitizen_Trading/dataCache.js` — add load/store methods for distance data
- `StarCitizen_Trading/services/trading.js` — add `loadTerminalDistances(cache)` mirror of `loadConfirmedMaxInventory`
- `StarCitizen_Trading/server.js` — call the new loader at startup
- `StarCitizen_Trading/config.json.example` — add `terminals_distances` endpoint
- `StarCitizen_Trading/utils/travelTime.js` — swap heuristic for lookup
- `StarCitizen_Trading/utils/ships.js` — add `qtSpeed` (km/s) per ship
- `.github/workflows/scan-terminal-distances.yml` — **NEW**, mirrors max-inventory workflow

**Ship QT speeds** (approximate, from wiki — verify)
```js
{ id: 'cutlass', qtSpeed: 55_000_000 },     // 55 Mm/s (Aegis military)
{ id: 'corsair', qtSpeed: 178_000_000 },    // 178 Mm/s (Drake XL-1 large-tank)
// etc.
```

**Time calc**
```js
function travelTimeMin(fromTerminal, toTerminal, ship, distances) {
    const key = `${fromTerminal}__${toTerminal}`;
    const km = distances[key] ?? distances[`${toTerminal}__${fromTerminal}`];
    if (!km) return heuristicTime(fromInit, toInit); // fallback
    const seconds = (km * 1_000) / SHIPS[ship].qtSpeed;
    return seconds / 60;
}
```

**Acceptance checklist**
- [ ] Fresh `terminals_distances.json` committed by the scan
- [ ] Server startup logs "Loaded N terminal distances"
- [ ] Time column changes when ship dropdown changes ship
- [ ] Fallback to M4 heuristic when a pair isn't in the distance data
- [ ] `npm test && npm run lint` clean

**Skip this milestone if** the M4 heuristic feels close enough. It adds a
second scan pipeline and a second data file to maintain.

---

## What NOT to do (guardrails for every milestone)

- No multi-hop route optimization (A→B→C→A). Whole separate feature.
- No server-side user prefs storage. URL query params only — bookmarkable.
- No live updates on the smart page. Static per request like the existing
  pages. Rely on the meta-refresh in the shared shell.
- No UEX ship-metadata API. Baked-in ship table is fine.
- Do not touch the existing `/touchportal/{scu}[/{system}]` page — Smart Routes
  is a parallel experiment, not a replacement.
- Do not modify the max-inventory pipeline while working on this feature.

## When starting each milestone

1. `git pull` — someone else's work may have landed
2. Read `../CLAUDE.md` and this file
3. Read whichever existing view/handler is most similar to what you're building
   (`views/touchportal.js` is the reference)
4. Small self-tests: run `npm test && npm run lint` **before** you touch anything
   to confirm the baseline is green
5. Do the milestone's checklist, don't scope-creep
6. `npm test && npm run lint` again, both clean
7. Commit with a subject line naming the milestone (e.g.
   `Smart routes: M3 - ship and wallet inputs`)
8. Push only after user confirmation (deploys automatically)
