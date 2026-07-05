#!/usr/bin/env node
/**
 * Deterministic candidate fetcher for /ai-daily.
 *
 * Pulls the feed/API sources (arXiv, HF Daily Papers, HN Algolia, Reddit, RSS list in
 * data/feeds.json), normalizes and dedups against data/seen.json, and writes
 * data/candidates/YYYY-MM-DD.raw.json. Judgment (scoring, clustering, summaries) is the
 * consolidation agent's job — this script only collects and filters.
 *
 * The fetch window is "since last successful run": min 48h (arXiv announcement lag skips
 * weekends/holidays — a strict 24h window returns zero papers), capped at 7 days.
 * meta.failures lists every source that failed so the skill's agent sweeps can compensate.
 *
 * Usage: node scripts/fetch-candidates.mjs [--dry]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	fetchArxiv,
	fetchHfPapers,
	fetchHackerNews,
	fetchReddit,
	fetchRssFeed,
} from './lib/sources.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry');

const MIN_WINDOW_H = 48;
const MAX_WINDOW_D = 7;

const readJson = (path) => JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
const writeJson = (path, value) =>
	writeFileSync(join(ROOT, path), JSON.stringify(value, null, 2) + '\n');

const state = readJson('data/state.json');
const seen = readJson('data/seen.json');
const { feeds } = readJson('data/feeds.json');

// --- Window: since last successful run, min 48h, cap 7d ---------------------
const now = new Date();
const minStart = new Date(now.getTime() - MIN_WINDOW_H * 3600_000);
const maxStart = new Date(now.getTime() - MAX_WINDOW_D * 24 * 3600_000);
let windowStart = state.lastFetchAt ? new Date(state.lastFetchAt) : minStart;
if (windowStart > minStart) windowStart = minStart;
if (windowStart < maxStart) windowStart = maxStart;

const today = now.toISOString().slice(0, 10);
console.log(`Fetch window: ${windowStart.toISOString()} → ${now.toISOString()}${DRY ? ' (dry run)' : ''}`);

// --- Fetch all sources in parallel, recording failures ----------------------
const tasks = [
	{ source: 'arxiv', optional: false, run: () => fetchArxiv(windowStart, now) },
	{ source: 'hf-papers', optional: false, run: () => fetchHfPapers() },
	{ source: 'hn', optional: false, run: () => fetchHackerNews(windowStart) },
	{ source: 'reddit-ml', optional: false, run: () => fetchReddit('MachineLearning', 'reddit-ml') },
	// Staggered start — six simultaneous Reddit hits trip its rate limiter.
	{ source: 'reddit-locallama', optional: false, run: () => fetchReddit('LocalLLaMA', 'reddit-locallama', 6000) },
	...feeds.map((feed) => ({
		source: `rss:${feed.id}`,
		optional: Boolean(feed.optional),
		run: () => fetchRssFeed(feed, windowStart),
	})),
];

const results = await Promise.allSettled(tasks.map((t) => t.run()));

const items = [];
const counts = {};
const failures = [];
results.forEach((result, i) => {
	const { source, optional } = tasks[i];
	if (result.status === 'fulfilled') {
		counts[source] = result.value.length;
		items.push(...result.value);
	} else {
		counts[source] = 0;
		failures.push({ source, optional, error: String(result.reason?.message ?? result.reason) });
	}
});

// --- Dedup: within this run (canonical URL, then title), then against seen.json
const seenHashes = new Set(seen.entries.map((e) => e.hash));
const seenTitles = new Set(seen.entries.map((e) => e.titleHash).filter(Boolean));

const byKey = new Map();
for (const item of items) {
	const existing = byKey.get(item.dedupKey);
	if (!existing) {
		byKey.set(item.dedupKey, item);
	} else {
		// Same story from two sources: keep the richer record, merge signals + alternate URL.
		const keep = existing.summary || !item.summary ? existing : item;
		const drop = keep === existing ? item : existing;
		for (const [k, v] of Object.entries(drop.signals)) {
			if (v != null && keep.signals[k] == null) keep.signals[k] = v;
		}
		if (drop.url !== keep.url) keep.relatedUrls.push(drop.url);
		byKey.set(item.dedupKey, keep);
	}
}

let seenBefore = 0;
const fresh = [];
for (const item of byKey.values()) {
	if (seenHashes.has(item.dedupKey) || seenTitles.has(item.titleHash)) {
		seenBefore++;
	} else {
		fresh.push(item);
	}
}
fresh.sort((a, b) => new Date(b.publishedAt ?? 0) - new Date(a.publishedAt ?? 0));
fresh.forEach((item, i) => {
	item.id = `c-${today}-${String(i + 1).padStart(3, '0')}`;
});

// --- Report ------------------------------------------------------------------
console.log('\nPer-source counts:');
for (const [source, count] of Object.entries(counts)) {
	console.log(`  ${source.padEnd(22)} ${count}`);
}
console.log(`\nTotal fetched: ${items.length}`);
console.log(`After in-run dedup: ${byKey.size}`);
console.log(`Dropped as seen-before: ${seenBefore}`);
console.log(`Fresh candidates: ${fresh.length}`);
if (failures.length > 0) {
	console.log('\nFailures (agent sweeps must compensate for non-optional ones):');
	for (const f of failures) {
		console.log(`  ${f.optional ? '(optional) ' : ''}${f.source}: ${f.error}`);
	}
}

if (DRY) {
	console.log('\nDry run — nothing written.');
	process.exit(0);
}

// --- Write outputs -------------------------------------------------------------
mkdirSync(join(ROOT, 'data/candidates'), { recursive: true });
writeJson(`data/candidates/${today}.raw.json`, {
	meta: {
		fetchedAt: now.toISOString(),
		window: { start: windowStart.toISOString(), end: now.toISOString() },
		counts,
		totals: { fetched: items.length, deduped: byKey.size, seenBefore, fresh: fresh.length },
		failures,
	},
	items: fresh,
});

// Advance the window only when every required source succeeded; otherwise the
// window keeps growing (capped at 7d) so tomorrow's run re-covers today's gap.
const requiredFailed = failures.some((f) => !f.optional);
if (!requiredFailed) {
	writeJson('data/state.json', { ...state, lastFetchAt: now.toISOString() });
} else {
	console.log('\nNOTE: required source failed — lastFetchAt not advanced; next run re-covers this window.');
}

console.log(`\nWrote data/candidates/${today}.raw.json`);
