export interface SiteConfig {
	author: string;
	base: string;
	currentFocus: string[];
	date: {
		options: Intl.DateTimeFormatOptions;
	};
	description: string;
	github: string;
	lang: string;
	ogLocale: string;
	repository: string;
	shortTitle: string;
	title: string;
	url: string;
}

export interface SiteMeta {
	articleDate?: string | undefined;
	description?: string;
	ogImage?: string | undefined;
	title: string;
}

export type AdmonitionType = "tip" | "note" | "important" | "caution" | "warning";
