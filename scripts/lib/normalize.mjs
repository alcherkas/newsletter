import { createHash } from 'node:crypto';

const TRACKING_PARAMS = /^(utm_|ref$|ref_src$|fbclid$|gclid$|source$|si$)/;

/** Canonicalize a URL for dedup: strip trackers/hash, normalize arXiv links to /abs/ without version. */
export function canonicalizeUrl(rawUrl) {
	let url;
	try {
		url = new URL(rawUrl);
	} catch {
		return rawUrl;
	}
	url.hash = '';
	for (const key of [...url.searchParams.keys()]) {
		if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
	}
	url.hostname = url.hostname.toLowerCase();

	// arxiv.org/pdf/2507.01234v2(.pdf) | /html/2507.01234 → arxiv.org/abs/2507.01234
	if (url.hostname.endsWith('arxiv.org')) {
		const m = url.pathname.match(/^\/(?:abs|pdf|html)\/(\d{4}\.\d{4,5})(?:v\d+)?(?:\.pdf)?\/?$/);
		if (m) {
			url.hostname = 'arxiv.org';
			url.pathname = `/abs/${m[1]}`;
			url.search = '';
		}
	}

	let out = url.toString();
	if (out.endsWith('/') && url.pathname !== '/') out = out.slice(0, -1);
	return out;
}

export function sha1(text) {
	return createHash('sha1').update(text).digest('hex');
}

/** Hash of the title reduced to lowercase alphanumerics — catches same-story-different-URL dups. */
export function titleHash(title) {
	return sha1(title.toLowerCase().replace(/[^a-z0-9]+/g, ''));
}

/** Build a raw candidate (no id/score yet — the consolidation agent assigns those). */
export function makeCandidate({
	title,
	url,
	source,
	category,
	publishedAt,
	authors = [],
	summary = null,
	signals = {},
	canonicalUrl: canonicalOverride = null,
}) {
	const canonicalUrl = canonicalizeUrl(canonicalOverride ?? url);
	return {
		id: null,
		dedupKey: sha1(canonicalUrl),
		titleHash: titleHash(title),
		title: title.trim(),
		url,
		canonicalUrl,
		source,
		category,
		publishedAt,
		authors,
		summary,
		whyItMatters: null,
		score: null,
		signals: { hfUpvotes: null, hnPoints: null, redditScore: null, ...signals },
		tags: [],
		clusterId: null,
		relatedUrls: [],
		status: 'candidate',
	};
}
