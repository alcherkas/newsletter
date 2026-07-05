import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		schema: docsSchema({
			extend: z.object({
				/** Marks digest pages so archive/tags pages can find them. */
				digest: z.enum(['daily', 'weekly']).optional(),
				/** The digest date (daily) or the Monday of the ISO week (weekly). */
				date: z.coerce.date().optional(),
				tags: z.array(z.string()).default([]),
				itemCount: z.number().optional(),
				topStory: z.string().optional(),
			}),
		}),
	}),
};
