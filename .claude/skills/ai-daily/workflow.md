# Daily research Workflow — script pattern

Pass this script (adapted with today's actual date and the failure list from
`data/candidates/<today>.raw.json` meta) to the Workflow tool. Phase A sweeps run in
parallel; Phase B joins on all of them plus the raw fetch.

Key contracts:

- Sweep agents return **JSON arrays in the candidate schema** (see CLAUDE.md) with
  `score: null` — scoring is Phase B's job. They cover the last ~24–48h only.
- Sweep agents write nothing to disk; they RETURN their JSON (use the `schema` option so
  output is validated).
- The consolidation agent reads `data/candidates/<today>.raw.json` and `data/seen.json`
  from disk, receives the sweep results in its prompt, and writes
  `data/candidates/<today>.json`.

```js
export const meta = {
  name: 'ai-daily-research',
  description: 'Sweep no-feed AI sources in parallel, then consolidate and score all candidates',
  phases: [
    { title: 'Sweep', detail: 'X posts, no-feed labs, press gap-fill' },
    { title: 'Consolidate', detail: 'merge, cluster, dedup, score' },
  ],
}

const CANDIDATES_SCHEMA = { /* JSON Schema: array of candidate objects — see CLAUDE.md */ }

phase('Sweep')
const sweeps = await parallel([
  () => agent(`Search X/Twitter for notable AI posts from the last 24-48h: model
    announcements, viral demos, notable researcher threads, benchmark claims. Use WebSearch
    with site:x.com queries plus news-echo searches ("announced on X", "twitter thread").
    Return candidates in the schema with source "agent:x", category "social".`,
    { label: 'sweep:x-posts', phase: 'Sweep', schema: CANDIDATES_SCHEMA }),
  () => agent(`WebFetch these lab news pages (no RSS feeds exist): anthropic.com/news,
    ai.meta.com/blog, mistral.ai/news, x.ai/news. Extract only items newly published in the
    last ~48h. Return candidates with source "agent:lab", category "release".`,
    { label: 'sweep:labs', phase: 'Sweep', schema: CANDIDATES_SCHEMA }),
  () => agent(`WebSearch the top AI stories of the last 24h in mainstream/tech press that
    RSS feeds might miss. ALSO cover these sources whose deterministic fetch failed today:
    <insert meta.failures list, e.g. "r/LocalLLaMA top posts">. Return candidates with
    source "agent:press", category "press" (or "community" for the failure coverage).`,
    { label: 'sweep:press', phase: 'Sweep', schema: CANDIDATES_SCHEMA }),
])

phase('Consolidate')
const result = await agent(`Read data/candidates/<today>.raw.json and data/seen.json.
  Here are additional candidates from live sweeps: ${JSON.stringify(sweeps.filter(Boolean).flat())}.
  1. Merge everything; cluster items covering the SAME story (same canonicalUrl, same
     titleHash, or obviously the same event) — keep the best-sourced item as the cluster
     head, fold the others' URLs into relatedUrls and their signals into signals.
  2. Drop anything whose dedupKey or titleHash appears in seen.json.
  3. Score every remaining item 0-100 per .claude/skills/ai-daily/scoring-rubric.md.
  4. Write a 1-2 sentence summary and one-line whyItMatters per item (reuse HF ai_summary
     where present). Assign tags from the controlled vocabulary in CLAUDE.md.
  5. Keep the top ≤40 by score, assign ids c-<today>-001..., sort desc, and write
     data/candidates/<today>.json as {"date": "<today>", "items": [...]}.
  Return {"count": N, "topTitle": "..."} as confirmation.`,
  { label: 'consolidate', phase: 'Consolidate', schema: { type: 'object',
    properties: { count: { type: 'number' }, topTitle: { type: 'string' } },
    required: ['count', 'topTitle'] } })

return result
```
