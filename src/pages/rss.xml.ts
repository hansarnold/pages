import rss from "@astrojs/rss";
import { getAllNotes, getAllWriting } from "@/data/content";
import { siteConfig } from "@/site.config";
import { withBase } from "@/utils/url";

export const GET = async () => {
	const [writing, notes] = await Promise.all([getAllWriting(), getAllNotes()]);
	const items = [
		...writing.map((entry) => ({
			title: entry.data.title,
			description: entry.data.description,
			pubDate: entry.data.publishDate,
			link: new URL(withBase(`/writing/${entry.id}/`), siteConfig.url).href,
		})),
		...notes.map((note) => ({
			title: note.data.title,
			description: note.data.description ?? "A short field note from Hans.",
			pubDate: note.data.publishDate,
			link: new URL(withBase(`/notes/${note.id}/`), siteConfig.url).href,
		})),
	].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

	return rss({
		title: siteConfig.title,
		description: siteConfig.description,
		site: new URL(import.meta.env.BASE_URL, siteConfig.url).href,
		items,
	});
};
