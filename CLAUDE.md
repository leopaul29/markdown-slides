# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install
pnpm dev             # Vite dev server
pnpm build           # tsc --noEmit && vite build
pnpm typecheck       # type-check only
pnpm test            # vitest run (all tests)
pnpm test:watch
pnpm preview         # serve the production build

pnpm vitest run src/lib/search.test.ts        # one test file
pnpm vitest run -t 'creates one segment per'  # one test by name
```

**pnpm only.** `pnpm-lock.yaml` is the lockfile, the version is pinned by `packageManager` in
`package.json`, and CI runs `pnpm install --frozen-lockfile`. Do not introduce npm or yarn
lockfiles. Because pnpm's `node_modules` is not flat, a type package that used to arrive
transitively (`@types/mdast`, `@types/hast`) has to be an explicit devDependency.

CI (`.github/workflows/ci.yml`) runs typecheck, tests and build on every branch; `deploy.yml`
publishes `dist/` to GitHub Pages from `main` with `BASE_PATH=/<repo>/`.

## Architecture

Two layers with one direction of dependency: **`src/engine/` knows nothing about `src/render/`
or `src/components/`.** That is the v2 split, and `src/engine/boundary.test.ts` enforces it.

```text
markdown text
  → normalize()      unescape exporter-mangled punctuation, CRLF → LF   (engine/markdown.ts)
  → parseMarkdown()  remark + GFM → mdast Root                          (engine/markdown.ts)
  → strategy.divide()  mdast → sections, each already split into parts  (engine/strategies/)
  → compile()        the model: segments, sections, TOC                 (engine/compile.ts)
  ── engine ends here; everything below is a renderer ─────────────────────────────
  → nodesToHtml()    per-segment mdast slice → HTML, lazily             (render/html.ts)
  → useSegmentBodies()  injects that HTML into `[data-index]` bodies    (render/useSegmentBodies.ts)
  → Deck.tsx / BookView.tsx   the two views
  → enhanceSegmentBody()  DOM post-pass: table wrappers, code chrome    (render/enhance.ts)
```

`App.tsx` owns all application state (document, view, strategy, theme, current index, watch
handle, dialogs) and passes it down; there is no store or context. Both views implement the same
`ViewHandle` (`components/view.ts`) — `goTo(index)`, plus `toggleOverview()` for the
presentation — exposed with `forwardRef`. That handle is the only way the app moves a view.

### The model (`engine/model.ts`)

A `DocumentModel` is `segments` (reading order — a whole section, or one part of one),
`sections` (each pointing at the segment indices it owns), a `toc` and the strategy name.
`Segment.nodes` is mdast `RootContent[]`, never markup: that is what lets a non-HTML view
consume the same model. Reveal's coordinates are *derived* in `Deck.tsx` (`coordsOf` →
`[segment.section, segment.part - 1]`); the model has no `h`, `v` or `columns`.

`Deck` is now only the React component. The model type is `DocumentModel`.

### Segmentation strategies (`engine/strategies/`)

`headings` (default, the v1 rules), `h1` and `fixed-length`. A strategy is one function —
`divide(root, { maxWeight }) → sections with parts` — and shares `weightOf()` and
`splitByWeight()`/`chunkByWeight()` as helpers rather than as a pipeline it must implement.
The interface was extracted from three implementations, not predicted from one; keep it that
way when adding a fourth. Unknown names fall back to the default so a stale persisted setting
can never stop a document from opening.

### Views

* **`Deck.tsx`** — Reveal.js, one section per horizontal column, its parts stacked vertically.
* **`BookView.tsx`** — the whole document as one scrolling page. Two `IntersectionObserver`s:
  one renders bodies before they arrive, one reports the topmost segment in the top fifth of
  the viewport. Unrendered bodies stand in for their own height through a `--estimate` custom
  property, so the scrollbar is roughly honest before the document is in the DOM.

Anything that exists once per view — search, TOC, position, theme, keyboard — must stay shared.
`useSegmentBodies` is where that sharing lives for rendering.

### Loading and position state (all in `App.tsx`)

Four load paths — drop, picker, paste, `?src=` URL — can overlap, so every async one takes
`const token = ++loadToken.current` and bails on `token !== loadToken.current` after each `await`.
Any new load path must do the same, and any action that replaces the document synchronously must
bump the token so an in-flight fetch cannot win.

**Position is one number: a segment index.** That is what makes it survive a view switch, a
strategy change, a live reload and a `#/12` deep link — the restore effect hands the same index
to whichever view just mounted. It lives in `currentIndex` state, the `#/12` fragment (written
with `replaceState`, consumed once through the `pendingHash` ref) and each view's own idea of
where it is. The restore effect is guarded by a `restored` ref holding the model and view it
last ran for, because React remounts children without warning and the effect must never consume
the URL fragment twice.

Settings persist to `localStorage` under the `markdown-reader:` prefix (`lib/document.ts`) —
theme, sidebar, line numbers, `view` and `strategy`; the document itself is cached under
`markdown-reader:doc` unless it exceeds 4 M characters.

### Non-negotiable principles (from `ROADMAP.md`)

1. **Deterministic** — same document always produces the same output, for every strategy. No AI,
   no randomness, no time or network dependence. Enforced by `src/engine/compile.test.ts` and
   `src/engine/strategies/strategies.test.ts`.
2. **Read-only** — nothing may write to the source file. The one documented in-memory exception
   is `normalize()`, which repairs backslash-escaped Markdown when the pattern is dominant.
3. **Local** — browser only, no backend, no upload.
4. **No lock-in** — plain `.md` in, standard web out.

If a change breaks one of these, the change is wrong.

### Division rules (`engine/strategies/`)

Under `headings`: `#` opens a group, `##` opens a section, `###`+ stay inside it, content before
the first heading becomes an opening section. Sections heavier than `maxWeight` (default 26
"rendered lines", estimated by `weightOf()` — no measurement) split into parts. Individual blocks
never split, so code blocks and tables stay intact; `rebalanceOrphanHeadings` guarantees a part
never ends on a heading whose content is in the next one. Those last two invariants hold for
every strategy and are tested for every strategy.

## Gotchas that will bite

These were each discovered the hard way; `docs/LESSONS.md` and `docs/DECISIONS.md` have the full
accounts.

* **Never use `dangerouslySetInnerHTML` for segment bodies.** React 19 re-sets it on every render
  even when the HTML string is byte-identical, destroying the DOM enhancements. Views hand React a
  childless `<div data-index>` and `useSegmentBodies` fills it in a layout effect, tracking
  `data-filled`. When the document changes, those markers must be wiped explicitly — React reuses
  the DOM nodes. Both views go through that hook; do not re-implement the fill in a new view.
* **URL safety lives in the mdast → hast pipeline**, not in the DOM pass. Dropping raw HTML is not
  enough: `[click](javascript:…)` is a Markdown link, not raw HTML. `rehypeSafeUrls` + `isSafeUrl()`
  own the scheme allow-list; hast stores `srcset` as an *array*, so a `typeof === 'string'` guard
  would silently skip it. `rehype-sanitize` was rejected because its default schema strips the
  `hljs-*` classes and heading ids the reader needs.
* **Syntax highlighting drives `lowlight` directly** with an explicit language list. Do not switch to
  `rehype-highlight` — its entry point statically imports every common grammar and roughly doubles
  the bundle.
* **Reveal ships Eric Meyer's CSS reset**, which applies `font: inherit` to inline elements and
  `list-style: none` to lists. `src/index.css` counters this; bold, italic and list markers break
  silently if those overrides are removed.
* **Reveal runs with `disableLayout: true`** so slides are full-size scrollable pages rather than
  scaled-to-fit canvases. The Reveal API ref is published only after `initialize()` resolves; a jump
  requested before that is queued in `pendingJump` *tagged with its model*, so it can replay after a
  remount but never against the next document. Do not go back to clearing it on teardown: React
  remounts the deck (StrictMode does it on every mount) and the reader's position went with it.
* **Reveal reads `location.hash` at startup whatever `hash: false` says** (`Location.readURL()` is
  called unconditionally in `start()`), and the app's own `#/12` fragment is exactly the format it
  parses — so it would silently open at horizontal slide 12. `Deck.tsx` therefore slides to `(0, 0)`
  when it has no pending jump. The app owns the position, not the URL.
* **Segment bodies render lazily** — within `PRELOAD_RADIUS` of the current position in the
  presentation, and as they approach the viewport in the book — and are cached for the document's
  lifetime. This is why a 17,000-line document opens in ~1.1 s; eager rendering destroys that.
* **A body that fills in above the reader would slide the page under them.** `useSegmentBodies`
  takes an optional anchor element, measures its position before and after the fill and corrects
  `scrollTop` by the difference. The book view passes the segment the reader is on; a view that
  scrolls as one page needs to do the same.
* **Focus-trap visibility** uses `getClientRects().length > 0`, not `offsetParent` — the latter is
  `null` for fixed-position elements (`lib/useDialogFocus.ts`).
* **A dropped file's handle must be claimed synchronously.** `handleFromDrop(event)` calls
  `getAsFileSystemHandle()` before anything is awaited and returns a promise, because the browser
  neuters the `DataTransfer` the moment the drop handler returns. Awaiting first loses live reload.
* **Keyboard ownership is split.** In the presentation, Reveal handles `← → ↑ ↓ Home End F Esc`;
  `App.tsx` registers `Ctrl/⌘K`, `/`, `M`, `T` and `V` on `window` with `capture: true` so they run
  before Reveal's handler, and skips them while focus is in an input. New shortcuts go in that same
  listener, not in Reveal config. The book view has no keyboard code at all: it focuses its scroll
  container on mount, which is what makes Page Up/Down, Home/End and the space bar work.
* **There is no CSS framework.** `src/index.css` is hand-written: a short base block (box sizing,
  form-control fonts) on top of Reveal's reset, then semantic class names and CSS custom
  properties switched by `data-theme` on `<html>`. A new component gets a class and rules in
  `index.css`. Tailwind was removed because nothing used a utility class.
* **Modals use native `<dialog>` where they can.** `Lightbox` calls `showModal()` and gets the
  focus trap, Esc and backdrop for free. `useDialogFocus` remains only for `SearchPalette`, which
  needs combobox semantics a plain dialog does not provide.

## Testing

Tests are node-environment vitest, `src/**/*.test.ts` — pure model, strategy, search and rendering
logic, no DOM.
The two most serious defects in this project's history were only observable in a rendered page, so
verify UI-affecting changes by driving the app in a browser as well as running the suite. Invariants
belong in tests rather than prose ("code blocks never split", "same input, same output", "the
engine never imports a renderer").

## Docs

`ROADMAP.md` is the plan of record (v1 presentation view and v2 engine extraction + Book View
both shipped; v3 = Outline view). `docs/architecture-notes.md` reviews the multi-view direction,
`docs/DECISIONS.md` records why things are the way they are, `docs/LESSONS.md` what went wrong.
`PRD.md` is the original v1 spec and is itself backslash-escaped — useful as test input.
