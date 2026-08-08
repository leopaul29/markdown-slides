# Current State

## Objective

Markdown Reader is a local, deterministic, read-only reader that turns any Markdown document into
something navigable. The direction is one engine feeding several interchangeable views, with the
engine extracted alongside a second view rather than ahead of one.

## Status

**V2 is complete**: the engine is split from the renderer behind `compile()`, the Book View ships,
three segmentation strategies are selectable, and the reader's position survives switching between
any of them. `db97e6a` is committed and pushed to
`origin/claude/v2-engine-extraction-book-view-g3aofl`; no PR is open. Typecheck, 87 tests and the
production build pass, and the work was verified in a headless browser across both views, both
themes, three strategies and a 17,220-line document. Only the three wrap-up doc files are
uncommitted.

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

- `docs/DECISIONS.md` and `docs/LESSONS.md` carry uncommitted wrap-up additions, and this snapshot
  is uncommitted. Nothing else is mid-change.

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

1. Commit the three wrap-up doc files and push.
2. Open a PR against `main` for `claude/v2-engine-extraction-book-view-g3aofl`.
3. Start V3 (Outline view) against the same model; treat it as the test of whether `compile()` can
   be frozen as-is.
4. If the Outline view wants it, teach `Sidebar` to scroll its active entry into view — it will be
   shared by three views by then.
