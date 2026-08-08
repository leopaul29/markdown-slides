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
pnpm vitest run -t 'creates one slide per'    # one test by name
```

**pnpm only.** `pnpm-lock.yaml` is the lockfile, the version is pinned by `packageManager` in
`package.json`, and CI runs `pnpm install --frozen-lockfile`. Do not introduce npm or yarn
lockfiles. Because pnpm's `node_modules` is not flat, a type package that used to arrive
transitively (`@types/mdast`, `@types/hast`) has to be an explicit devDependency.

CI (`.github/workflows/ci.yml`) runs typecheck, tests and build on every branch; `deploy.yml`
publishes `dist/` to GitHub Pages from `main` with `BASE_PATH=/<repo>/`.

## Architecture

One-way pipeline, no state flows backwards:

```
markdown text
  → normalize()      unescape exporter-mangled punctuation, CRLF → LF   (lib/markdown.ts)
  → parseMarkdown()  remark + GFM → mdast Root                          (lib/markdown.ts)
  → buildDeck()      mdast → Deck model (sections, parts, TOC)          (lib/slides.ts)
  → nodesToHtml()    per-slide mdast slice → HTML, lazily               (lib/markdown.ts)
  → Deck.tsx         injects HTML into Reveal.js sections
  → enhanceSlideBody() DOM post-pass: table wrappers, code chrome       (lib/enhance.ts)
```

`App.tsx` owns all application state (document, theme, current index, watch handle, dialogs) and
passes it down; there is no store or context. `Deck.tsx` exposes an imperative `DeckHandle`
(`goTo`/`toggleOverview`) via `forwardRef` — that is the only way the app moves the deck;
everything else is Reveal's own keyboard handling.

### Loading and position state (all in `App.tsx`)

Four load paths — drop, picker, paste, `?src=` URL — can overlap, so every async one takes
`const token = ++loadToken.current` and bails on `token !== loadToken.current` after each `await`.
Any new load path must do the same, and any action that replaces the document synchronously must
bump the token so an in-flight fetch cannot win.

Position lives in three places that must stay in sync: `currentIndex` state, the `#/12` URL
fragment (written with `replaceState`, consumed once per deck through the `pendingHash` ref), and
Reveal's own indices. A live reload re-arms `pendingHash` with the current slide so the reader
keeps their place across a file change.

Settings persist to `localStorage` under the `markdown-reader:` prefix (`lib/document.ts`); the
document itself is cached under `markdown-reader:doc` unless it exceeds 4 M characters.

### The engine/renderer boundary

`lib/slides.ts` must never import the render layer and must never know about HTML. `Slide.nodes`
carries mdast `RootContent[]`, not markup — that is what lets a future non-HTML view consume the
same model. Keep it that way.

Two names collide today: `Deck` is both the document model (`lib/slides.ts`) and the React
component that renders it (`components/Deck.tsx`).

`Slide.h` / `Slide.v` are gone — Reveal's coordinates are derived in `Deck.tsx` (`coordsOf`) from
the column list and `part - 1`. Two leaks remain, both listed as v2 work in `ROADMAP.md` and
`docs/architecture-notes.md`: `Deck.columns` (a Reveal layout concept) and `nodesToHtml` living
next to the parser.

### Non-negotiable principles (from `ROADMAP.md`)

1. **Deterministic** — same document always produces the same output. No AI, no randomness, no
   time or network dependence. Enforced by tests in `src/lib/slides.test.ts`.
2. **Read-only** — nothing may write to the source file. The one documented in-memory exception
   is `normalize()`, which repairs backslash-escaped Markdown when the pattern is dominant.
3. **Local** — browser only, no backend, no upload.
4. **No lock-in** — plain `.md` in, standard web out.

If a change breaks one of these, the change is wrong.

### Slide rules (`lib/slides.ts`)

`#` opens a group, `##` opens a slide, `###`+ stay inside the current slide, content before the
first heading becomes an opening slide. Sections heavier than `maxWeight` (default 26 "rendered
lines", estimated by `weightOf()` — no measurement) split into parts stacked on Reveal's vertical
axis. Individual blocks never split, so code blocks and tables stay intact; `rebalanceOrphanHeadings`
guarantees a slide never ends on a heading whose content is on the next slide.

## Gotchas that will bite

These were each discovered the hard way; `docs/LESSONS.md` and `docs/DECISIONS.md` have the full
accounts.

* **Never use `dangerouslySetInnerHTML` for slide bodies.** React 19 re-sets it on every render even
  when the HTML string is byte-identical, destroying the DOM enhancements. `Deck.tsx` hands React a
  childless `<div data-index>` and fills it in a layout effect, tracking `data-filled`. When the
  document changes, those markers must be wiped explicitly — React reuses the DOM nodes.
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
  scaled-to-fit canvases. The Reveal API ref is published only after `initialize()` resolves; jumps
  requested before that are queued in `pendingIndex` and *must* be cleared on teardown, or they
  replay against the next document.
* **Slide bodies render lazily** within `PRELOAD_RADIUS` (2) of the current slide and are cached for
  the document's lifetime. This is why a 12,000-line document opens in ~1.7 s; eager rendering
  destroys that.
* **Focus-trap visibility** uses `getClientRects().length > 0`, not `offsetParent` — the latter is
  `null` for fixed-position elements (`lib/useDialogFocus.ts`).
* **A dropped file's handle must be claimed synchronously.** `handleFromDrop(event)` calls
  `getAsFileSystemHandle()` before anything is awaited and returns a promise, because the browser
  neuters the `DataTransfer` the moment the drop handler returns. Awaiting first loses live reload.
* **Keyboard ownership is split.** Reveal handles `← → ↑ ↓ Home End F Esc`; `App.tsx` registers
  `Ctrl/⌘K`, `/`, `M` and `T` on `window` with `capture: true` so they run before Reveal's handler,
  and skips them while focus is in an input. New shortcuts go in that same listener, not in Reveal
  config.
* **There is no CSS framework.** `src/index.css` is hand-written: a short base block (box sizing,
  form-control fonts) on top of Reveal's reset, then semantic class names and CSS custom
  properties switched by `data-theme` on `<html>`. A new component gets a class and rules in
  `index.css`. Tailwind was removed because nothing used a utility class.
* **Modals use native `<dialog>` where they can.** `Lightbox` calls `showModal()` and gets the
  focus trap, Esc and backdrop for free. `useDialogFocus` remains only for `SearchPalette`, which
  needs combobox semantics a plain dialog does not provide.

## Testing

Tests are node-environment vitest, `src/lib/*.test.ts` only — pure model and search logic, no DOM.
The two most serious defects in this project's history were only observable in a rendered page, so
verify UI-affecting changes by driving the app in a browser as well as running the suite. Invariants
belong in tests rather than prose ("code blocks never split", "same input, same output").

## Docs

`ROADMAP.md` is the plan of record (v1 presentation view shipped; v2 = engine extraction *with*
Book View, not before it). `docs/architecture-notes.md` reviews the multi-view direction,
`docs/DECISIONS.md` records why things are the way they are, `docs/LESSONS.md` what went wrong.
`PRD.md` is the original v1 spec and is itself backslash-escaped — useful as test input.
