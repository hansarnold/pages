import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { instance } from "@viz-js/viz";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const diagramsDirectory = path.join(root, "diagrams");
const outputDirectory = path.join(root, "public", "diagrams");

const descriptions = {
	"dkms-contract-map": {
		title: "DKMS build, initramfs, and boot-time module selection flow",
		description:
			"A flowchart from the NVIDIA driver package through DKMS and Kbuild, into the real-root module tree and initramfs snapshot, then through early or late modprobe to kernel admission and the resident NVIDIA driver runtime.",
	},
	"nvidia-ko-anatomy": {
		title: "NVIDIA kernel object build and admission flow",
		description:
			"A flowchart from NVIDIA source and the target kernel build contract through Kbuild, MODPOST, linking, signing and compression, followed by kernel identity, trust, symbol and relocation gates before NVIDIA device initialization.",
	},
};

const requestedSources = process.argv.slice(2).filter((argument) => argument !== "--");
const sources = requestedSources.length
	? requestedSources
	: (await readdir(diagramsDirectory))
			.filter((file) => file.endsWith(".dot"))
			.map((file) => path.join("diagrams", file));

const viz = await instance();

for (const source of sources) {
	const sourcePath = path.resolve(root, source);
	const basename = path.basename(sourcePath, ".dot");
	const dot = await readFile(sourcePath, "utf8");
	const rendered = stripXmlProlog(viz.renderString(dot, { engine: "dot", format: "svg" }));
	const metadata = descriptions[basename];
	const svg = metadata ? addAccessibilityMetadata(rendered, basename, metadata) : rendered;
	const outputPath = path.join(outputDirectory, `${basename}.svg`);

	await writeFile(outputPath, svg);
	console.log(`${path.relative(root, sourcePath)} -> ${path.relative(root, outputPath)}`);
}

function stripXmlProlog(svg) {
	return svg.replace(/^<\?xml[^>]*>\s*/, "").replace(/^<!DOCTYPE svg[^>]*>\s*/s, "");
}

function addAccessibilityMetadata(svg, id, metadata) {
	const titleId = `${id}-title`;
	const descriptionId = `${id}-description`;
	const openingTag = /<svg\b([^>]*)>/;
	const accessibleTag = `<svg$1 role="img" aria-labelledby="${titleId} ${descriptionId}">`;
	const accessibleContent = `<title id="${titleId}">${escapeXml(metadata.title)}</title>\n<desc id="${descriptionId}">${escapeXml(metadata.description)}</desc>`;

	return svg.replace(openingTag, `${accessibleTag}\n${accessibleContent}`);
}

function escapeXml(value) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");
}
