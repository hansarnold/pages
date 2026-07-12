# Hans — Systems Field Notes

A small, content-first notebook for technical notes and longer writing about
GPU drivers, firmware, Linux, and memory systems.

The site is built with Astro and deployed as a static GitHub Pages project at
`https://hansarnold.uk/`.

## Development

Node.js 24 and pnpm are used by the project.

```sh
pnpm install
pnpm dev
pnpm check
pnpm build
pnpm preview
```

Open `http://localhost:4321/` after starting Astro locally.

## Content

Content lives under `content/`:

- `notes/` for short observations
- `writing/` for long-form articles
- `topics/` for optional topic descriptions

Copy the examples in `content/_templates/` when starting a new entry. Drafts
are visible during local development and excluded from production builds.

## Deployment

The deploy workflow builds the static site and publishes `dist/` through
GitHub Pages. In repository settings, Pages must use **GitHub Actions** as its
source.

## Upstream

The initial scaffold is based on Astro Cactus `v8.1.0` at commit
`34d19f3dc77347dea537c8e92388ad3cfbbfad04`. Its MIT license is retained in
[LICENSE](LICENSE).
