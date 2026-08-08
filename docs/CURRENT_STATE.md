# Current State

## Objective

Markdown Reader is a local, deterministic reader that turns any Markdown document into a
navigable slide deck. v1 (presentation view) is the shipped scope. The agreed direction is a
read-only reader with several interchangeable views, with the engine extracted in V2 alongside a
second view rather than before one exists.

## Status

v1 is shipped and merged to `main`. Work since then sits on
`claude/roadmap-engine-renderer-split-xi5px6`, two commits ahead of `origin`: a `CLAUDE.md` for
future sessions, and an over-engineering cleanup that migrated the project to pnpm, removed
Tailwind, and cut the model down to what the app uses. Typecheck, 50 tests and the production
build pass.

## Completed

- **Slide engine** (`src/lib/slides.ts`) — deterministic rules: `#` opens a group, `##` opens a
  slide, `###`+ stay inside, content before the first heading gets an opening slide, oversized
  sections split into parts. Code blocks and tables never split; no slide ends on an orphan
  heading. The model carries mdast nodes and no renderer-specific coordinates.
- **Reader** — Reveal.js with `disableLayout`; sections horizontal, split parts vertical. TOC
  sidebar, `Ctrl/⌘K` ranked search over headings/prose/lists/code, syntax highlighting with
  optional line numbers, scrollable tables, native-`<dialog>` image lightbox, light/dark themes.
- **Loading** — drop, picker, paste and `?src=` URL, live reload through the File System Access
  API, `#/12` deep links, last document restored on reload.
- **Security** — raw HTML dropped; link and image URLs restricted to an allow-list in the
  mdast → hast pipeline.
- **Toolchain** — pnpm only, pinned by `packageManager`; CI and the Pages deploy both run
  `pnpm install --frozen-lockfile`. No CSS framework: `src/index.css` is a small base block plus
  hand-written semantic classes and `data-theme` custom properties.
- **Records** — `README.md`, `ROADMAP.md`, `CLAUDE.md`, `docs/DECISIONS.md`, `docs/LESSONS.md`
  and `docs/architecture-notes.md`.

## In Progress

- This snapshot is uncommitted; everything else on the branch is committed.

## Blockers

None.

## Risks

- **The cleanup is not browser-verified.** Removing Tailwind and rebuilding the lightbox on
  `<dialog>` both change rendering, and the test suite is node-only. This project's own history
  says its worst defects were visible only in a rendered page.
- **`Deck.columns` is the last Reveal-shaped field in the model**, and `nodesToHtml` still sits
  next to the parser. Both are V2 work.
- **`docs/architecture-notes.md` is stale in one detail** — it still lists `h`/`v` among the
  open leaks, which this cleanup closed.
- **Second view is unproven.** The roadmap's abstractions are justified by Book View existing; if
  it never ships, the current direct structure is the right one.
- **Repo slug still `markdown-slides`** while the product is Markdown Reader everywhere else.
  Renaming the repository also updates `BASE_PATH`, which the deploy workflow derives.

## Next Actions

1. Commit this snapshot and push the branch; open a PR against `main`.
2. Run the app in a browser and confirm the styling and the lightbox after the Tailwind and
   `<dialog>` changes.
3. Fix the stale `h`/`v` line in `docs/architecture-notes.md`.
4. Rename the GitHub repository to `markdown-reader`.
5. When starting V2: write the `fixed-length` strategy first, then extract the strategy interface
   from the two implementations — not before.
