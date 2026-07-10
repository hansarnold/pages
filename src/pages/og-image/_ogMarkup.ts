import { html } from "satori-html";
import { siteConfig } from "@/site.config";

// OG image markup, use https://og-playground.vercel.app/ to design your own.
export const ogMarkup = (title: string, pubDate: string) =>
	html`<div tw="flex flex-col w-full h-full bg-[#0b0f0c] text-[#dce3dc]">
		<div tw="flex items-center w-full px-14 pt-12 text-2xl">
			<span tw="text-[#9bdc52]">hans@machine</span><span>:~$ read</span>
		</div>
		<div tw="flex flex-col flex-1 w-full px-14 justify-center">
			<p tw="text-2xl mb-6 text-[#9aa49b]">${pubDate}</p>
			<h1 tw="text-6xl font-bold leading-snug text-[#eef5ed]">${title}</h1>
		</div>
		<div tw="flex items-center justify-between w-full px-14 py-10 border-t border-[#2b352d]">
			<p tw="text-2xl font-semibold">Systems Field Notes</p>
			<p tw="text-xl text-[#9bdc52]">${siteConfig.author}_</p>
		</div>
	</div>`;

export const siteOgMarkup = () =>
	html`<div tw="flex flex-col w-full h-full bg-[#0b0f0c] text-[#dce3dc]">
		<div tw="flex items-center w-full px-14 pt-12 text-2xl">
			<span tw="text-[#9bdc52]">hans@machine</span><span>:~$ whoami</span>
		</div>
		<div tw="flex flex-col flex-1 w-full px-14 justify-center">
			<h1 tw="text-7xl font-bold leading-tight text-[#eef5ed]">Systems field notes.</h1>
			<p tw="text-3xl mt-8 text-[#9aa49b]">Learning the layers where software meets the machine.</p>
		</div>
		<div tw="flex items-center justify-between w-full px-14 py-10 border-t border-[#2b352d]">
			<p tw="text-xl">GPU · hardware · Rust · Linux</p>
			<p tw="text-xl text-[#9bdc52]">hans_</p>
		</div>
	</div>`;
