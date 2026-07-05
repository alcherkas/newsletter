import Parser from 'rss-parser';
import { makeCandidate } from './normalize.mjs';

const USER_AGENT = 'ai-daily-digest/1.0 (personal digest; contact cherkasalexandr@gmail.com)';
const TIMEOUT_MS = 20_000;

async function fetchText(url, headers = {}) {
	const res = await fetch(url, {
		headers: { 'User-Agent': USER_AGENT, ...headers },
		signal: AbortSignal.timeout(TIMEOUT_MS),
		redirect: 'follow',
	});
	if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
	return res.text();
}

async function fetchJson(url, headers = {}) {
	const res = await fetch(url, {
		headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...headers },
		signal: AbortSignal.timeout(TIMEOUT_MS),
		redirect: 'follow',
	});
	if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
	return res.json();
}

const parser = new Parser({ timeout: TIMEOUT_MS });

/**
 * arXiv cs.AI/cs.CL/cs.LG submissions in the window. Atom API; window uses submittedDate.
 * Paginated to 400 — a normal weekday window has ~370 submissions/day, so a single
 * 200-item page would silently clip the tail.
 */
export async function fetchArxiv(windowStart, windowEnd) {
	const fmt = (d) =>
		d.toISOString().replace(/[-:]/g, '').replace('T', '').slice(0, 12); // YYYYMMDDHHMM
	const query = `(cat:cs.AI+OR+cat:cs.CL+OR+cat:cs.LG)+AND+submittedDate:[${fmt(windowStart)}+TO+${fmt(windowEnd)}]`;
	const PAGE = 200;
	const MAX = 400;
	const all = [];
	for (let start = 0; start < MAX; start += PAGE) {
		const url =
			`https://export.arxiv.org/api/query?search_query=${query}` +
			`&sortBy=submittedDate&sortOrder=descending&start=${start}&max_results=${PAGE}`;
		const xml = await fetchText(url);
		const feed = await parser.parseString(xml);
		const items = feed.items ?? [];
		all.push(...items);
		if (items.length < PAGE) break;
	}
	return all.map((item) =>
		makeCandidate({
			title: item.title?.replace(/\s+/g, ' ') ?? 'Untitled',
			url: item.link ?? item.id,
			source: 'arxiv',
			category: 'paper',
			publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : null,
			authors: item.author ? [item.author] : [],
			summary: item.contentSnippet?.replace(/\s+/g, ' ').slice(0, 400) ?? null,
		})
	);
}

/** Hugging Face Daily Papers — current list; cross-day repeats are handled by seen.json. */
export async function fetchHfPapers() {
	const data = await fetchJson('https://huggingface.co/api/daily_papers');
	return (Array.isArray(data) ? data : []).map((entry) => {
		const paper = entry.paper ?? entry;
		const isArxivId = /^\d{4}\.\d{4,5}$/.test(paper.id ?? '');
		return makeCandidate({
			title: paper.title ?? 'Untitled',
			url: `https://huggingface.co/papers/${paper.id}`,
			// Canonicalize onto arXiv so the same paper from the arXiv sweep dedups.
			canonicalUrl: isArxivId ? `https://arxiv.org/abs/${paper.id}` : null,
			source: 'hf-papers',
			category: 'paper',
			publishedAt: paper.publishedAt ?? entry.publishedAt ?? null,
			authors: (paper.authors ?? []).map((a) => a.name).filter(Boolean),
			summary: (entry.ai_summary ?? paper.ai_summary ?? paper.summary ?? '')
				.replace(/\s+/g, ' ')
				.slice(0, 400) || null,
			signals: { hfUpvotes: paper.upvotes ?? entry.upvotes ?? null },
		});
	});
}

const HN_QUERIES = ['LLM', 'AI', 'GPT', 'Claude', 'Gemini', 'open source model', 'OpenAI', 'Anthropic'];

/** Hacker News via Algolia: AI-keyword stories in the window with >20 points, unioned by id. */
export async function fetchHackerNews(windowStart) {
	const since = Math.floor(windowStart.getTime() / 1000);
	const byId = new Map();
	for (const q of HN_QUERIES) {
		const url =
			`https://hn.algolia.com/api/v1/search_by_date?tags=story&query=${encodeURIComponent(q)}` +
			`&numericFilters=created_at_i>${since},points>20&hitsPerPage=100`;
		const data = await fetchJson(url);
		for (const hit of data.hits ?? []) {
			if (!byId.has(hit.objectID)) byId.set(hit.objectID, hit);
		}
	}
	return [...byId.values()].map((hit) =>
		makeCandidate({
			title: hit.title ?? 'Untitled',
			url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
			source: 'hn',
			category: 'community',
			publishedAt: new Date(hit.created_at_i * 1000).toISOString(),
			signals: { hnPoints: hit.points ?? null },
		})
	);
}

/**
 * Reddit top-of-day; rate-limit fragile — tries JSON (www, then old), then the RSS
 * variant (no score signal). Caller catches and records total failure.
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchReddit(subreddit, sourceId, initialDelayMs = 0) {
	if (initialDelayMs > 0) await sleep(initialDelayMs);
	const jsonUrls = [
		`https://www.reddit.com/r/${subreddit}/top.json?limit=25&t=day`,
		`https://old.reddit.com/r/${subreddit}/top.json?limit=25&t=day`,
	];
	let lastError;
	for (const url of jsonUrls) {
		try {
			const data = await fetchJson(url);
			return (data?.data?.children ?? []).map(({ data: post }) =>
				makeCandidate({
					title: post.title ?? 'Untitled',
					url:
						post.is_self || !post.url
							? `https://www.reddit.com${post.permalink}`
							: post.url,
					source: sourceId,
					category: 'community',
					publishedAt: new Date(post.created_utc * 1000).toISOString(),
					signals: { redditScore: post.score ?? null },
				})
			);
		} catch (error) {
			lastError = error;
			await sleep(1500);
		}
	}
	try {
		const xml = await fetchText(`https://www.reddit.com/r/${subreddit}/top/.rss?t=day`, {
			Accept: 'application/atom+xml, application/xml',
		});
		const feed = await parser.parseString(xml);
		return (feed.items ?? []).map((item) =>
			makeCandidate({
				title: item.title ?? 'Untitled',
				url: item.link,
				source: sourceId,
				category: 'community',
				publishedAt: item.isoDate ? new Date(item.isoDate).toISOString() : null,
			})
		);
	} catch (error) {
		lastError = error;
	}
	throw lastError ?? new Error(`Reddit fetch failed for r/${subreddit}`);
}

/** One configured RSS/Atom feed; only items published inside the window. */
export async function fetchRssFeed(feedConfig, windowStart) {
	const xml = await fetchText(feedConfig.url, { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' });
	const feed = await parser.parseString(xml);
	return (feed.items ?? [])
		.filter((item) => {
			const date = item.isoDate ?? item.pubDate;
			return date && new Date(date) >= windowStart;
		})
		.sort((a, b) => new Date(b.isoDate ?? b.pubDate) - new Date(a.isoDate ?? a.pubDate))
		.map((item) =>
			makeCandidate({
				title: item.title?.replace(/\s+/g, ' ') ?? 'Untitled',
				url: item.link,
				source: `rss:${feedConfig.id}`,
				category: feedConfig.category ?? 'press',
				publishedAt: new Date(item.isoDate ?? item.pubDate).toISOString(),
				summary: item.contentSnippet?.replace(/\s+/g, ' ').slice(0, 400) ?? null,
			})
		);
}
