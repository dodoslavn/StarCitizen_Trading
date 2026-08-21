# CLAUDE.md

Guidance for AI coding sessions working on this repo. Loads automatically into
context — keep it terse and high-leverage.

## What this project is

Node.js web app that displays real-time Star Citizen commodity trading data
sourced from the [UEX Corp API](https://uexcorp.space/api/documentation).
Deployed at https://sctrading.dodoslav.eu (production, redeploy triggered by
push to `master` → Jenkins). App root is in the `StarCitizen_Trading/` subdir
of the repo — most `cd` and `npm` commands need that prefix.

## Repo layout (only the app subdir matters day-to-day)

```
StarCitizen_Trading/
├── server.js               entry point
├── scan-max-inventory.js   standalone scanner (CI only, not run by server)
├── config.js               shared config.json loader
├── config.json             LOCAL, gitignored - copy from config.json.example
├── config.json.example     source of truth for available config keys
├── max_inventory.json      committed data file, updated by GitHub Action
├── dataCache.js            in-memory cache class
├── html.js                 re-exports view functions
├── logger.js               Winston logger
├── handlers/               one file per URL: mainHandler, aboutHandler, etc.
├── routes.js               URL → handler map
├── views/                  HTML generators (commodities, profits, touchportal, ...)
├── services/               trading.js (business logic), uexApi.js (API client)
├── utils/                  formatters.js, validation.js
└── tests/                  Jest, one file per module under test
```

Deploy workflow lives in `.github/workflows/scan-max-inventory.yml` at repo
root (not the app subdir).

## Conventions

- **ESLint config**: single quotes, 4-space indent, semicolons required,
  `no-var`, prefer `const`. Run `npm run lint` before committing; 0 warnings
  is the current baseline.
- **Testing**: Jest, files at `tests/<module>.test.js`. `npm test`.
- **Always run `npm test && npm run lint` before every commit.** The tree is
  currently green — keep it that way.
- **Commit style**: subject line ≤72 chars, then a blank line, then body
  explaining *why*. Look at `git log --oneline` for tone.
- **AI-authored commits**: `git config user.name "Claude" && git config user.email "noreply@anthropic.com"`.
  Already set on this local clone; verify with `git config user.name` before
  first commit if you're unsure.

## Security & correctness gotchas

- **Always `escapeHtml()` anything from the UEX API before interpolating into
  HTML.** Terminal names and commodity names are community-submitted; treat
  them as untrusted. `escapeHtml` lives in `utils/formatters.js`.
- **UEX field semantics** — the confusing bit. Fields are named from the
  *player's* action, not the terminal's:
  - `price_buy` / `scu_buy` — relevant when **the player buys** from the
    terminal (this is the player's *cost*). Verified by cross-referencing
    UEX's own website: the page titled "Buy" for a commodity displays
    `price_buy`/`scu_buy` values (checked against raw API data for two
    independent commodity/terminal pairs, 2026-08-21).
  - `price_sell` / `scu_sell` / `scu_sell_stock` — relevant when **the
    player sells** to the terminal (this is the player's *revenue*). The
    page titled "Sell" displays these.
  - **Do not "fix" `profit = sell.price_sell - buy.price_buy` in
    `calculateBestRoutes`/`calculateSmartRoutes`/`calculateProfit` thinking
    the subtraction looks backward** - it is not. `sell.price_sell` is
    revenue (disposal terminal), `buy.price_buy` is cost (acquisition
    terminal); revenue minus cost is correct. This looks backward if you
    assume `price_buy` means "terminal buys" rather than "player buys" -
    that assumption is wrong, verify against the live site before touching
    this formula.
  - Separately, `scu_sell_stock` is the terminal's real current inventory
    count; `scu_sell` is a much less reliable player-reported *transaction*
    size (often 0). Same relationship holds for `scu_buy` (no
    `scu_buy_stock` field exists - `scu_buy` is the only "current" figure
    on that side). Bug we already hit: reading `scu_sell` when
    `scu_sell_stock` was meant.
- **`date_modified`** on price rows is Unix seconds (not ms) and reflects when
  a player last submitted a report for that commodity/terminal pair.
- **Terminal loading fields** from `/terminals` are three orthogonal booleans,
  not synonyms:
  - `has_freight_elevator` — cargo can physically transit via elevator
  - `has_docking_port` — capital-ship docking (890 Jump / Hull-D class)
  - `is_auto_load` — the transaction spawns cargo directly in the ship's
    hold (fast). Currently `1` at ~36% of terminals, almost exclusively
    stations and big cities. Never at moons/outposts.
- **`mcs`** (max container size on terminals) — field exists but the API returns
  `0` for every commodity terminal today. Skip until it starts getting populated.
- **Ship metadata**: UEX `/vehicles` returns ~280 ships/vehicles. Filter to
  `is_spaceship && is_quantum_capable && scu > 0` for cargo-relevant ships
  (~124). Each has `scu`, `pad_type` ('XS'|'S'|'M'|'L'|'XL'|''),
  `container_sizes`, plus dimensions and dozens of `is_*` flags. Prefer this
  over hardcoded ship tables — new ships get added over time.

## Reusable utilities — check before writing your own

From `utils/formatters.js`:
- `readable_number(n)` — thousand-separated with spaces (`12 345`)
- `escapeHtml(str)` — HTML-safe escape, always use for UEX strings
- `getStalenessLevel(unix_ts, { stale, veryStale })` — returns `fresh`/`stale`/`very-stale`
- `formatDateTime(unix_ts)` — Slovak locale, UTC, `d. M. yyyy HH:mm UTC`
- `formatContainerSizes(csv_string)` — `"1,2,4" → "1, 2, 4 SCU"`
- `estimateMaxInventory(stock, status)` — 0 if no signal, else `stock / (status/7)`
- `getStockUsageClass(stock, max, side, staleness)` — returns CSS class for stock cell tint

From `dataCache.js`: standard class with getters/setters plus
`getConfirmedMax(key, side)` for max-inventory lookup, where `key` is
`"idCommodity_idTerminal"`.

## Runtime architecture, in one paragraph

Server calls the UEX bulk endpoints every 1 minute (`refreshData`) and
keeps everything in a `DataCache` instance. It **never writes** to
`max_inventory.json` — that file is populated by the standalone
`scan-max-inventory.js` script, run daily by a GitHub Action and committed
back to master. On startup the server reads `max_inventory.json` for
confirmed max-stock values, and falls back to estimates from
`estimateMaxInventory()` when no confirmed value exists. If you add another
long-running scan-like job, do the same split: separate script, separate
CI job, commit results, server reads only.

## HTML rendering style

Views return plain template-literal strings. No framework. Consistent
patterns to follow:
- Wrap UEX-sourced strings in `escapeHtml()`
- Reuse the `shell()` helper in `views/touchportal.js` for any new
  touchportal sub-page (keeps the styling consistent)
- Table cells use `<td class="..." title="tooltip text">value</td>`

## What's on the touchportal today

- `/touchportal` — hub (landscape tile grid)
- `/touchportal/{scu}[/{system}]` — best routes (legacy iterator, simple profit
  ranking; system-filterable)
- `/touchportal/stale[/{system}]` — terminals sorted by most-recent update,
  aggregated by terminal, grouped into per-planet columns when a system is
  picked; recency-tinted rows

If you're adding a new touchportal sub-page: add a hub tile, add a case in
`handlers/touchportalHandler.js`, add a view function in
`views/touchportal.js`, re-export from `html.js`.

## Deployment quick facts

- Push to `master` → Jenkins builds Docker image → deploys to
  sctrading.dodoslav.eu
- Version tag visible on `/about` page (comes from a `VERSION` file the
  deploy script writes, falling back to `package.json` version)
- Config: the production deploy script creates `config.json` from scratch;
  when you add a new config key, mention it in the response so the user knows
  to add it to their deploy script
- Auto-refresh: main page uses `<meta http-equiv="refresh" content="300">`

## Commit / push safety

- Never push to `master` without user confirmation first — the deploy pipeline
  fires on every master push
- Never delete `max_inventory.json`; it costs ~2 minutes of API calls to
  regenerate
- Don't commit `config.json`, `VERSION`, `*.log`, or `package-lock.json`
  (all gitignored, verify with `git status` before `git add`)
