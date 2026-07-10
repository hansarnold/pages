import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

function normalizeTopics(array: string[]) {
	return [...new Set(array.map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

const titleSchema = z.string().min(1).max(100);
const dateSchema = z.coerce.date();
const optionalDateSchema = z
	.union([z.string(), z.date()])
	.optional()
	.transform((value) => (value ? new Date(value) : undefined));

const baseSchema = z.object({
	title: titleSchema,
});

const writing = defineCollection({
	loader: glob({ base: "./content/writing", pattern: "**/*.{md,mdx}" }),
	schema: ({ image }) =>
		baseSchema.extend({
			description: z.string().min(20).max(220),
			coverImage: z
				.object({
					alt: z.string(),
					src: image(),
				})
				.optional(),
			draft: z.boolean().default(false),
			featured: z.boolean().default(false),
			ogImage: z.string().optional(),
			publishDate: dateSchema,
			series: z.string().optional(),
			tags: z.array(z.string()).default([]).transform(normalizeTopics),
			updatedDate: optionalDateSchema,
		}),
});

const note = defineCollection({
	loader: glob({ base: "./content/notes", pattern: "**/*.{md,mdx}" }),
	schema: baseSchema.extend({
		description: z.string().max(220).optional(),
		draft: z.boolean().default(false),
		publishDate: dateSchema,
		tags: z.array(z.string()).default([]).transform(normalizeTopics),
		updatedDate: optionalDateSchema,
	}),
});

const project = defineCollection({
	loader: glob({ base: "./content/projects", pattern: "**/*.{md,mdx}" }),
	schema: z.object({
		description: z.string().min(10).max(240),
		draft: z.boolean().default(false),
		featured: z.boolean().default(false),
		homepage: z.url().optional(),
		name: z.string().min(1).max(80),
		order: z.number().int().default(100),
		relationship: z.enum(["built", "maintained", "experiment", "studied", "forked", "configured"]),
		repository: z.url(),
		status: z.enum(["active", "study", "archived"]).default("active"),
		topics: z.array(z.string()).default([]).transform(normalizeTopics),
	}),
});

const topic = defineCollection({
	loader: glob({ base: "./content/topics", pattern: "**/*.{md,mdx}" }),
	schema: z.object({
		title: titleSchema.optional(),
		description: z.string().optional(),
	}),
});

export const collections = { note, project, topic, writing };
