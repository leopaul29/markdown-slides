# Current State

## Objective

Markdown Reader is a local, deterministic, read-only reader that turns any Markdown document into
something navigable. The direction is one engine feeding several interchangeable views, with the
engine extracted alongside a second view rather than ahead of one.

## Status

**V2 is complete and in review**: the engine is split from the renderer behind `compile()`, the
Book View ships, three segmentation strategies are selectable, and the reader's position survives
switching between any of them. It is [PR #4](https://github.com/leopaul29/markdown-reader/pull/4),
open against `main` from `claude/v2-engine-extraction-book-view-g3aofl`, with CI green. Typecheck,
96 tests and the production build pass, and the work was verified in a headless browser across
both views, both themes, three strategies and a 17,220-line document.

The first CodeRabbit review has been worked through: it found one genuine defect (a part that was
only an orphan heading, predating v2) and one real gap in the boundary test (re-exports and dynamic
imports went uninspected); both are fixed with tests. Two findings were declined on the record —
reformatting `docs/DECISIONS.md` for MD024, which CodeRabbit then withdrew, and remapping position
through the section on a strategy change.

## Completed

- **Engine** (`src/engine/`) — `compile(markdown, options)` as the single entry point. The model is
  segments, sections, a TOC and the strategy name; segments carry mdast nodes and no markup, no
  `h`/`v`, no `columns`. `boundary.test.ts` fails the build if the engine imports a view, a
  renderer, React, Reveal or a hast/lowlight package, or if a compiled model contains markup.
- **Strategies** (`src/engine/strategies/`) — `headings` (v1 rules, default), `h1` and
  `fixed-length`, sharing `weightOf()` and two splitters; unknown names fall back to the default.
- **Renderer** (`src/render/`) — `html.ts`, `enhance.ts`, and `useSegmentBodies.ts` (lazy cached
  body injection plus scroll anchoring), shared by both views.
- **Views** — `Deck.tsx` (Reveal.js) and `BookView.tsx` (one scrolling page, two
  IntersectionObservers, `--estimate` placeholder heights), behind one `ViewHandle`. Switcher in the
  toolbar, bound to `V`, persisted.
- **Position** — one segment index owned by `App.tsx`, covering view switches, strategy changes,
  live reload and `#/12` deep links. Reveal no longer steers itself from the URL fragment, and a
  jump queued before init is tagged with its model instead of cleared on teardown.
- **Everything from v1** — TOC sidebar, ranked search, highlighting, lightbox, themes, four load
  paths, live reload, URL safety, pnpm toolchain, no CSS framework.
- **Docs** — `README.md`, `ROADMAP.md` (V2 marked shipped), `CLAUDE.md`, `docs/architecture-notes.md`
  (leaks marked resolved) all updated in `db97e6a`.

## In Progress

- Review follow-ups on PR #4 as they arrive. Nothing else is mid-change; the working tree is
  clean apart from this snapshot.

## Blockers

None.

## Risks

- **`compile()` is the entry point but still marked experimental.** Freezing it as a public API is
  worth doing only after a third consumer — the Outline view — has pulled on it.
- **A strategy change keeps the segment *index*, not the segment content**, so a reader who switches
  mid-document lands nearby rather than exactly where they were.
- **Book view placeholder heights are estimates**, so the scrollbar is honest rather than exact and
  settles as bodies render.
- **The sidebar does not scroll its active entry into view**, more noticeable now that a long
  document can be read continuously.
- **`#/12` is read only on load** — editing the fragment in an open document does nothing. Predates
  v2.

## Next Actions

1. Merge PR #4 once the review settles.
2. Start V3 (Outline view) against the same model; treat it as the test of whether `compile()` can
   be frozen as-is.
3. If the Outline view wants it, teach `Sidebar` to scroll its active entry into view — it will be
   shared by three views by then.
4. Optional, raised in review: anchor the position on the source line of a segment's first node
   (`nodes[0].position`) so a strategy change lands on the same *content* rather than the same
   index.
