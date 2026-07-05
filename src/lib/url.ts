/**
 * Join a site-absolute path onto Astro's configured base path.
 * Required for every internal link — the site deploys under /ai-daily/.
 */
export function withBase(path: string): string {
	const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
	return `${base}/${path.replace(/^\/+/, '')}`;
}
