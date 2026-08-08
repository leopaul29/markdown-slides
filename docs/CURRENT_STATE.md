# Current State

## Objective

Markdown Reader is a local, deterministic reader that turns any Markdown document into something
navigable. The agreed direction is a read-only reader with several interchangeable views, with the
engine extracted alongside a second view rather than before one exists.

## Status

v1 (presentation view) is shipped and merged to `main`. **V2 — engine extraction + Book View — is
complete** on `claude/v2-engine-extraction-book-view-g3aofl`: the engine is split from the renderer
behind `compile()`, the Book View ships, three segmentation strategies are selectable, and position
survives switching between any of them. Typecheck, 87 tests and the production build pass, and the
work was verified by driving the app in a headless browser (both views, both themes, three
strategies, a 17,220-line document).

## Completed

- **Engine** (`src/engine/`) — `compile(markdown, options)` is the single entry point. The model is
  segments (reading order), sections (each owning its segment indices), a TOC and the strategy
  name; segments carry mdast nodes and no markup, no `h`/`v`, no `columns`.
- **Strategies** (`src/engine/strategies/`) — `headings` (the v1 rules, default), `h1` and
  `fixed-length`, sharing `weightOf()` and two splitters. The interface was extracted from the
  three, not predicted from one. Unknown names fall back to the default.
- **Boundary** — `src/engine/boundary.test.ts` fails if anything under `src/engine/` imports a
  view, a renderer, React, Reveal or a hast/lowlight package, or if a compiled model contains
  markup.
- **Renderer** (`src/render/`) — `html.ts` (AST → HTML, highlighting, URL allow-list), `enhance.ts`
  (table wrappers, code chrome, line numbers) and `useSegmentBodies.ts`, the lazy cached body
  injection shared by both views, including scroll anchoring.
- **Views** — `Deck.tsx` (Reveal.js, sections horizontal, parts vertical) and `BookView.tsx` (one
  scrolling page, two `IntersectionObserver`s, placeholder heights from a `--estimate` property).
  Both implement the same `ViewHandle`. The switcher is in the toolbar, bound to `V`, persisted.
- **Cross-view position** — one segment index owned by `App.tsx`, handed to whichever view just
  mounted. Covers view switching, strategy changes, live reload and `#/12` deep links.
- **Everything from v1** — TOC sidebar, ranked search, syntax highlighting, lightbox, themes, the
  four load paths, live reload, URL safety, pnpm toolchain, no CSS framework.

## In Progress

- Nothing. The branch is ready to push and open as a PR.

## Blockers

None.

## Risks

- **`compile()` is the entry point but still experimental.** Freezing it as a public API is worth
  doing only after the Outline view has pulled on it; until then its shape can still change.
- **A strategy change keeps the segment *index*, not the segment content.** Predictable, but a
  reader who switches strategies mid-document lands nearby rather than exactly where they were.
- **The sidebar does not scroll its active entry into view**, which is more noticeable now that a
  long document can be read continuously.
- **The app still reads `#/12` only on load.** Editing the fragment in the address bar of an open
  document does nothing; this predates v2.
- **Book view placeholder heights are estimates.** The scrollbar is honest, not exact, and a
  document of very uneven blocks will see it settle as bodies render.

## Next Actions

1. Push the branch and open a PR against `main`.
2. V3 — Outline view: a collapsible tree over the same model. It is the third consumer that should
   decide whether `compile()` is frozen as-is.
3. If the Outline view wants it, teach `Sidebar` to scroll the active entry into view — it will be
   shared by three views by then.
