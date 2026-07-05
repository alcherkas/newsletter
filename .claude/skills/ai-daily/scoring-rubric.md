# Candidate scoring rubric (0–100)

Score = significance for a practitioner tracking AI seriously. Start from the base for the
item's strongest applicable row, then apply modifiers. Clamp to [0, 100].

## Base scores

| Signal | Base |
|---|---|
| Frontier-lab model release or major capability announcement (OpenAI, Anthropic, Google, Meta, Mistral, xAI) | 85 |
| Notable open-weights release (usable model, real benchmarks) | 75 |
| Paper with strong external validation (HF upvotes ≥ 30, or HN ≥ 150 on the paper itself) | 70 |
| Industry-shifting business/policy news (major acquisition, regulation, compute deal) | 65 |
| Significant tooling/infra release (frameworks, serving, agents SDKs) | 60 |
| Paper with moderate signal (HF upvotes 10–29) or from a top lab | 55 |
| High-engagement community story (HN ≥ 300 or Reddit ≥ 500) | 55 |
| Viral social post with substance (real demo, real numbers — not hype) | 45 |
| Ordinary paper / press piece / community thread | 30 |

## Modifiers

- **+10** covered by ≥3 independent sources (cluster size) — cross-source recurrence is the
  strongest single signal
- **+10** introduces a genuinely new capability or result (not an increment)
- **+5** directly relevant to agents/LLM engineering (this digest's center of gravity)
- **−10** incremental result dressed as a breakthrough; benchmark-only claim with no artifact
- **−15** pure hype/speculation, no verifiable substance
- **−20** older than the window, resurfaced (check publishedAt)

## Category quotas for the ≤40 dashboard cut

Avoid a papers-only wall: aim for at most ~15 papers, ~10 releases, ~8 community, ~5 press,
~4 social. If a category has fewer good items, give its slots to the next-best scored items
of any category. Never pad with low-substance items to fill a quota.
