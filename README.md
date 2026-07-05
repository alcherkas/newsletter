# AI Daily

A curated daily digest of AI research, model releases, and news — published at
**https://alcherkas.github.io/newsletter/**.

Every day, a [Claude Code](https://claude.com/claude-code) workflow (`/ai-daily`) sweeps
arXiv, Hugging Face Daily Papers, lab blogs, Hacker News, Reddit, newsletters, tech press,
and notable X posts; deduplicates and scores the candidates; and presents them in a review
dashboard. Hand-picked items get full write-ups and are published here. A weekly workflow
(`/ai-weekly`) compiles the dailies into themed recaps.

Built with [Astro Starlight](https://starlight.astro.build). CI only builds the committed
tree — all fetching and curation happens locally. See `CLAUDE.md` for how it works.

## Commands

| Command | Action |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run fetch:dry` | Test the candidate fetcher (writes nothing) |
| `npm run dev` | Local preview at `localhost:4321/newsletter/` |
| `npm run build` | Production build to `./dist/` |
| `/ai-daily` | Run today's digest (in Claude Code) |
| `/ai-weekly` | Compile this week's recap (in Claude Code) |
