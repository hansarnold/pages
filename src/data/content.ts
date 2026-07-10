import { type CollectionEntry, getCollection } from "astro:content";

type DatedEntry = CollectionEntry<"note"> | CollectionEntry<"writing">;

function isPublic(data: { draft: boolean }) {
	return import.meta.env.PROD ? !data.draft : true;
}

export function newestFirst<T extends DatedEntry>(a: T, b: T) {
	return b.data.publishDate.getTime() - a.data.publishDate.getTime();
}

export async function getAllWriting() {
	const entries = await getCollection("writing", ({ data }) => isPublic(data));
	return entries.sort(newestFirst);
}

export async function getAllNotes() {
	const entries = await getCollection("note", ({ data }) => isPublic(data));
	return entries.sort(newestFirst);
}

export async function getAllProjects() {
	const entries = await getCollection("project", ({ data }) => isPublic(data));
	return entries.sort(
		(a, b) => a.data.order - b.data.order || a.data.name.localeCompare(b.data.name),
	);
}

export function groupByYear<T extends DatedEntry>(entries: T[]) {
	return entries.reduce<Record<string, T[]>>((groups, entry) => {
		const year = entry.data.publishDate.getFullYear().toString();
		groups[year] ??= [];
		groups[year].push(entry);
		return groups;
	}, {});
}

export async function getTopicsWithCount() {
	const [writing, notes] = await Promise.all([getAllWriting(), getAllNotes()]);
	const counts = new Map<string, number>();

	for (const topic of [...writing, ...notes].flatMap((entry) => entry.data.tags)) {
		counts.set(topic, (counts.get(topic) ?? 0) + 1);
	}

	return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export async function getTopicMeta(topic: string) {
	const entries = await getCollection("topic", ({ id }) => id === topic);
	return entries[0];
}
