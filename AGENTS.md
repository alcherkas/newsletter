# CLAUDE.md

## What this repo is

"AI Daily" — a curated daily digest of AI research/releases/news, published as an Astro
Starlight site to GitHub Pages at **https://alcherkas.github.io/newsletter/** (repo name is
`newsletter`, site brand is "AI Daily", the daily skill is `/ai-daily`).

Architecture: content lives in `src/content/docs/{daily,weekly}/`, machine state in
`data/`, UI components in `src/components/`. **CI (`.github/workflows/deploy.yml`) only
builds the committed tree** — all fetching, curation, and page generation happen locally
via the `/ai-daily` and `/ai-weekly` skills, then get committed and pushed. Never move
fetching into CI.

## Commands

- `npm run fetch` / `npm run fetch:dry` — deterministic candidate fetcher (arXiv, HF daily
  papers, HN Algolia, Reddit, RSS list in `data/feeds.json`) → `data/candidates/<date>.raw.json`
- `npm run dev` — local preview (note the `/newsletter/` base in URLs); when starting the
  dev server from an agent, use `astro dev --background` (manage with `astro dev stop|status|logs`)
- `npm run build` — must pass before every push
- `/ai-daily` — the daily digest workflow (fetch → agent sweeps → dashboard → user selection
  → write-ups → publish); `/ai-weekly` — weekly synthesis of the dailies

## Invariants

- **Daily pages are append-only history** — never edit a past day's page except to fix a
  build-breaking error.
- **`data/latest.json` is the only input to the landing hero** (`DailyHero.astro` and
  `LatestDigest.astro` import it at build time). Never hand-edit `src/content/docs/index.mdx`
  to change the hero.
- Every digest page's frontmatter MUST include `digest`, `date`, `tags`, `itemCount`,
  `topStory`, and `sidebar: { label, order: -<YYYYMMDD> }` (negative date keeps the sidebar
  newest-first; weekly pages use `-<yyyyww>`).
- Weekly filenames are lowercase: `2026-w28.mdx` (slugs get lowercased; uppercase W breaks
  the sidebar link).
- `data/seen.json` is append-and-prune only (30-day rolling window); ALL candidates get
  appended after a run, not just selected ones.
- Internal links in components go through `withBase()` from `src/lib/url.ts` — the site
  serves from a subpath.
- The fetcher advances `data/state.json.lastFetchAt` only when every required source
  succeeded; a failed source means the next run's window re-covers the gap (capped at 7 days).
  arXiv returning 0 on weekends/Mondays is announcement lag, not a failure.

## Candidate schema

Defined by `scripts/lib/normalize.mjs` (`makeCandidate`). Key fields: `id` (`c-<date>-NNN`),
`dedupKey` (sha1 of canonical URL), `titleHash`, `canonicalUrl` (trackers stripped, arXiv
pdf/html→abs), `source`, `category` (`paper|release|community|press|social`), `score`
(0–100 per `.claude/skills/ai-daily/scoring-rubric.md`), `signals`, `tags`, `clusterId`,
`relatedUrls`, `status` (`candidate|selected|rejected|seen-before`).

## Controlled tag vocabulary

Agents pick tags ONLY from this list (adding a tag = edit this list first):

`llm`, `agents`, `multimodal`, `open-weights`, `training`, `inference`, `rag`,
`fine-tuning`, `evals`, `benchmarks`, `safety`, `alignment`, `policy`, `infra`, `hardware`,
`robotics`, `audio`, `vision`, `coding`, `science`, `product`, `business`, `research`,
`tooling`

## Commit conventions

- `daily: YYYY-MM-DD (n items)` — a daily digest publish
- `weekly: YYYY-Www` — a weekly recap publish
- Anything else: normal descriptive messages
