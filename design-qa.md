# Design QA — Field Index system

## Comparison target

- Source visual truth: `/Users/arnold/.codex/generated_images/01a03ed7-ebd6-73d2-8963-161b75642930/exec-48421d78-f0b2-47db-aeb1-be1801b4aa6d.png`
- Browser-rendered implementation: `http://127.0.0.1:4321/`
- Final desktop screenshot: `/Users/arnold/proj/pages/.codex-audits/home-redesign-elements-2026-08-27/13-implementation-desktop-final.png`
- Final mobile screenshot: `/Users/arnold/proj/pages/.codex-audits/home-redesign-elements-2026-08-27/17-implementation-mobile-320.png`
- Viewport/state: desktop, 1448 × 1086 CSS px, light theme, home route, no focus or hover state
- Source pixels: 1448 × 1086
- Implementation pixels: 1448 × 1086
- Density normalization: the in-app browser reported a 1.2 device scale during the final capture. The browser capture was already normalized to 1448 × 1086 output pixels. For the frame-only comparison, both paper frames were cropped and normalized to 1088 × 1020 before being placed side by side.

## Evidence

- Full-view comparison: `/Users/arnold/proj/pages/.codex-audits/home-redesign-elements-2026-08-27/15-shell-comparison-normalized.png`
- Focused header/intro comparison: `/Users/arnold/proj/pages/.codex-audits/home-redesign-elements-2026-08-27/16-focused-header-final.png`
- Responsive evidence:
  - Tablet, 820 × 1000: `/Users/arnold/proj/pages/.codex-audits/home-redesign-elements-2026-08-27/10-implementation-tablet.png`
  - Mobile top, 390 × 844: `/Users/arnold/proj/pages/.codex-audits/home-redesign-elements-2026-08-27/06-implementation-mobile.png`
  - Mobile lower content: `/Users/arnold/proj/pages/.codex-audits/home-redesign-elements-2026-08-27/09-implementation-mobile-bottom.png`
  - Minimum supported width, 320 × 844 CSS px: `/Users/arnold/proj/pages/.codex-audits/home-redesign-elements-2026-08-27/17-implementation-mobile-320.png`
- Focused region comparison was required because the navigation, small metadata, line rhythm, and sidebar figures were too small to judge reliably in the full-view pair. The focused comparison shows the shared paper frame, five-cell navigation, asymmetric content grid, compact mono hierarchy, semantic color strip, and ruled sidebar.

## Required fidelity surfaces

- Fonts and typography: IBM Plex Mono supplies the mechanical display and UI voice; IBM Plex Sans is retained only for explanatory copy and article readability. Weights, tracking, line heights, truncation, and heading wraps remain legible at desktop and 320 px.
- Spacing and layout: the implementation preserves the reference's centered paper frame, black hairline perimeter, numbered five-tab header, narrow coordinate rail, wide notebook column, and narrow philosophy/figure column. Desktop fits in one 1448 × 1086 view; tablet moves the sidebar below the index; mobile becomes a single column without horizontal overflow.
- Colors and tokens: the off-white paper, gray outer canvas, black rules, and small semantic red/yellow/green/blue signals match the source's restrained print-system intent. Dark-mode support remains available but was not used for the fidelity comparison.
- Image quality and asset fidelity: the source's photography was intentionally replaced with three real, project-owned vector architecture diagrams rather than invented personal images. SVGs stay sharp, use consistent crops, and open to their full-size originals.
- Copy and content: the mock's placeholder identity was replaced with real site content. The title, current technical threads, latest notebook entries, public links, and working principles are coherent with the existing About page and published notes.
- Icons and controls: the existing search and theme icons remain consistent in stroke weight and provide real functionality. Mobile menu, search, theme states, and navigation links were exercised.
- Accessibility: semantic headings/sections, descriptive image alt text, visible focus treatment, reduced-motion support, labeled controls, keyboard-capable links, and 44 px mobile action targets are present.

## Comparison history

### Iteration 1 — blocked

- [P2] Desktop vertical density exceeded the source frame. The first render showed five notebook rows and a taller intro, producing a 1500 px document against the 1086 px reference.
- Fix: reduced the notebook preview to three entries, tightened the top bar and intro, and clamped desktop summaries to one line.
- Post-fix evidence: `/Users/arnold/proj/pages/.codex-audits/home-redesign-elements-2026-08-27/05-desktop-comparison-final.png` showed the complete page and footer fitting the intended desktop frame.

### Iteration 2 — blocked

- [P2] The first headline read like a category list rather than the reference's direct personal statement, and mobile header actions were below a practical 44 px target.
- Fix: changed the title to “Tracing the layers where software meets the machine.” and raised mobile icon/menu targets to 44 px.
- Post-fix evidence: `/Users/arnold/proj/pages/.codex-audits/home-redesign-elements-2026-08-27/15-shell-comparison-normalized.png` and `/Users/arnold/proj/pages/.codex-audits/home-redesign-elements-2026-08-27/17-implementation-mobile-320.png`.

## Findings

- No actionable P0, P1, or P2 differences remain.
- [P3] The reference uses tactile photography to add an off-screen/personal register, while the implementation uses existing technical diagrams to avoid fabricating hobbies or personal images. If a real photo set becomes available later, one or two figures could be swapped without changing the grid.

## Interaction and runtime checks

- Main navigation reaches `/notes/`.
- Search control reaches `/search/`.
- Theme control cycles light → dark → system → light and updates its accessible label.
- Mobile menu expands and exposes Index, Notes, Writing, Topics, and About.
- Desktop, tablet, 390 px mobile, and 320 px mobile show no horizontal overflow.
- Browser console: no warnings or errors.
- `pnpm run check`: passed.
- `pnpm run build`: passed, including Pagefind generation.

## Open questions

- The figure rail is intentionally technical until real hobby, travel, reading, or everyday-life photography is supplied. No placeholder personal content was invented.

## Implementation checklist

- [x] Match the selected editorial paper/grid direction.
- [x] Preserve the existing Astro content, routes, search, RSS, and theme behavior.
- [x] Replace mock content with real entries and project-owned artwork.
- [x] Verify desktop, tablet, and mobile layouts.
- [x] Verify navigation, menu, search, and theme interactions.
- [x] Pass type, lint, build, browser, and visual checks.

## About migration — 2026-08-27

### Comparison target

- Source visual truth: `/Users/arnold/.codex/generated_images/01a03ed7-ebd6-73d2-8963-161b75642930/exec-48421d78-f0b2-47db-aeb1-be1801b4aa6d.png`
- Browser-rendered implementation: `http://127.0.0.1:4321/about/`
- Desktop implementation: `/Users/arnold/proj/pages/.codex-audits/about-desktop-viewport.png`
- Mobile implementation: `/Users/arnold/proj/pages/.codex-audits/about-mobile-viewport.png`
- Combined reference/implementation input: `/Users/arnold/proj/pages/.codex-audits/about-reference-comparison.png`
- Desktop comparison state: 1280 × 720 CSS px, light theme, About route, no focus or hover state. The 1448 × 1086 source was scaled to 1280 px wide and cropped from the top to the same 1280 × 720 comparison frame.

### Visual and responsive evidence

- Desktop full document: `/Users/arnold/proj/pages/.codex-audits/about-desktop-full.png`
- Mobile top, 390 × 844: `/Users/arnold/proj/pages/.codex-audits/about-mobile-viewport.png`
- Mobile mid-page: `/Users/arnold/proj/pages/.codex-audits/about-mobile-bottom.png`
- Mobile figure/rotation/footer: `/Users/arnold/proj/pages/.codex-audits/about-mobile-footer.png`
- Mobile DOM metrics: 390 px viewport width, 390 px document width, no horizontal overflow.

### Asset decisions

- The main GPU hierarchy and sidebar Tensor Memory plate were generated as original raster redraws with the built-in image-generation workflow.
- The SemiAnalysis figures were used only as technical-content references. Their watermark, handwriting, layout, and illustration style were not retained.
- Final project assets:
  - `public/images/reference/gpu-execution-hierarchy.webp`
  - `public/images/reference/blackwell-tmem-path.webp`
- Prompt intent: original technical-manual diagrams on warm paper, precise black rules, condensed monospaced labels, restrained blue/yellow/green/red coding, no watermark, no logo, no signature, no 3D, and no decorative imagery.
- Both plates have descriptive alt text and a visible linked source-reference caption to the SemiAnalysis Tensor Core article.

### Comparison history

- [P2] The original About route used a generic oversized “About” heading and centered prose, which did not share the homepage's coordinate rail, ruled grid, asymmetric columns, or compact index hierarchy.
- Fix: rebuilt the route as a full-width field profile using the homepage's structural primitives, then added profile facts, focus rows, a reading plate, working principles, listening rotation, and public-link index.
- [P2] The first architecture candidates carried SemiAnalysis watermarks and visually read as republished source material.
- Fix: replaced every downloaded candidate with an original image-generation redraw. No watermarked candidate remains in the project.
- [P2] The full portrait diagram needed to remain legible at 390 px without a horizontal scroll or a destructive crop.
- Fix: preserved its intrinsic aspect ratio, used `object-fit: contain`, supplied dimensions to reserve layout space, and stacked captions and metadata at the mobile breakpoint.

### Findings

- No actionable P0, P1, or P2 visual difference remains.
- The About page now uses the same paper frame, five-cell navigation, narrow coordinate rail, black rules, compact mono hierarchy, semantic color strip, and asymmetric main/sidebar proportion as the selected reference.
- The images introduce visual density without pretending to be personal photography; the music list supplies a smaller personal register without inventing album art or opinions.
- Browser console: no errors.
- `pnpm run check`: passed with zero errors, warnings, or hints.
- `pnpm run build`: passed, including Pagefind generation.

final result: passed
