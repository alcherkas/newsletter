---
name: ai-weekly
description: Compile this week's daily digests into a weekly synthesis page — themes,
  top papers, top news, and stats — and publish it. Use when the user runs /ai-weekly,
  typically on Sunday. Accepts an optional past week argument like 2026-W27.
---

# AI Weekly recap

Synthesizes the week's daily selections into `src/content/docs/weekly/<yyyy>-w<ww>.mdx`
(lowercase filename — slugs are lowercased). Read `CLAUDE.md` for invariants first.

## What to do each run

1. **Resolve the week.** Default = the current ISO week (`YYYY-Www`); accept an argument for
   a past week. Collect that week's `data/selections/*.json` (primary, structured input) and
   the matching daily MDX pages (secondary, for prose context). If fewer than 3 dailies
   exist, warn the user and ask whether to proceed anyway. If the weekly page already
   exists, offer regenerate or abort.

2. **Synthesize 3–5 themes of the week.** Cross-day clusters, not a re-listing — e.g.
   "three labs shipped agentic browser features" or "small-model efficiency results piled
   up". Each theme: a heading, a paragraph of synthesis, and inline links to the involved
   stories' daily pages.

3. **Rank top 5 papers and top 5 news** from the week's selected items. Ranking signal:
   score, cross-day recurrence (same topic resurfacing), and the fact the user selected it.
   Render each as a compact `<StoryCard>` (reuse the summary/whyItMatters already written in
   the selections files — don't re-fetch sources).

4. **Compute stats** from the selections files: candidates reviewed vs selected per day,
   category split of selections, top tags by frequency. Render as a small markdown table.

5. **Write the page** from `templates/weekly-page.mdx`. Frontmatter: `digest: weekly`,
   `date` = the week's Monday, union `tags`, `itemCount` = total selected,
   `topStory` = the #1 ranked item, `sidebar: { label: "Week <ww>, <yyyy>", order: -<yyyyww> }`.
   End with a linked list of the week's daily pages.

6. **Update `data/latest.json`**: set `weekly` to
   `{ "week": "<YYYY-Www>", "pagePath": "/weekly/<yyyy>-w<ww>/" }` (the hero shows a
   secondary "Weekly recap" action).

7. **Verify and publish.** `npm run build` must pass, then
   `git add -A && git commit -m "weekly: <YYYY-Www>" && git push`. Report the page URL:
   `https://alcherkas.github.io/newsletter/weekly/<yyyy>-w<ww>/`.
