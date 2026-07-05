// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://alcherkas.github.io',
	base: '/newsletter',
	integrations: [
		starlight({
			title: 'AI Daily',
			description:
				'A curated daily digest of AI research, model releases, and news — papers, lab announcements, community signal, and press, hand-picked every day.',
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/alcherkas/newsletter' },
			],
			customCss: ['./src/styles/custom.css'],
			components: {
				Hero: './src/components/DailyHero.astro',
			},
			sidebar: [
				{ label: 'Daily', collapsed: false, items: [{ autogenerate: { directory: 'daily' } }] },
				{ label: 'Weekly', collapsed: false, items: [{ autogenerate: { directory: 'weekly' } }] },
				{ label: 'Archive', link: '/archive/' },
				{ label: 'Tags', link: '/tags/' },
				{ label: 'About', link: '/about/' },
			],
		}),
	],
});
