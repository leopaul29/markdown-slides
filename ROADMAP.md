# Roadmap

This roadmap reflects the direction discussed after v1 was built: the product is a
**read-only Markdown reader with several visualization modes**, and the presentation view is
simply the first one.

Nothing here is a commitment to a date. The point is to make the *order* explicit so that
today's code does not block tomorrow's views.

---

## Principles

These hold for every version. If a feature breaks one of them, the feature is wrong.

1. **Deterministic.** Every visualization is generated from the Markdown document by pure
   rules. The same document always produces the same output. No AI, no heuristics that
   depend on time, randomness or network state.
2. **Read-only.** No visualization may modify the source Markdown. The file is the single
   source of truth; views are throwaway projections of it.
3. **Local.** Everything runs in the browser. No upload, no backend, no account.
4. **No lock-in.** Plain `.md` in, standard web out. Deleting this tool costs the user
   nothing.

One behaviour worth stating explicitly, because it is easy to mistake for a violation:
documents whose Markdown punctuation has been backslash-escaped by an exporter are repaired
before parsing (`normalize()` in `src/lib/markdown.ts`). This happens in memory, it is a pure
function of the input, and the file on disk is never touched — so both (1) and (2) hold. It is
documented rather than hidden because it means the model is derived from a repaired copy of
the source, not from the bytes verbatim.

---

## V1 — Presentation View ✅ shipped

The deterministic engine plus one view.

* Markdown → AST → section model → Reveal.js deck
* `#` opens a group, `##` opens a slide, `###`+ stay inside, oversized sections split into
  parts; code blocks and tables never split
* Table of contents, full-document search, keyboard navigation, light/dark themes,
  syntax highlighting, image lightbox, scrollable tables
* Load by drop / picker / paste / `?src=` URL, last document restored on reload
* Verified on a 12,800-line document: 1,040 slides, ~1.7 s to first paint, lazy body
  rendering keeps navigation instant

### v1 polish ✅ done

* **Deep links** — the URL carries `#/12`; reloading or sharing it opens that slide
* **Live reload** — files opened through the File System Access API are polled once a second
  and re-read on change, keeping the reader's position (Chromium; other browsers fall back to
  the plain picker)
* **Search snippets** — table cells join with ` | ` and blocks with newlines, so results are
  readable instead of welded together
* **Bundle size** — 206 kB → 192 kB gzipped by driving `lowlight` with an explicit language
  list instead of `rehype-highlight`, whose entry point statically imports every common grammar
* **Ranked, multi-term, fuzzy search** — whitespace separates terms and every term must match,
  `"quoted phrases"` are literal, and titles also accept a subsequence match so `authn` finds
  "Authentication" and `adr` finds "Architecture Decision Records". Results are scored (title
  over body, word-start over mid-word, exact over fuzzy, terms in one passage over scattered
  ones) and ties keep document order, so the same query always returns the same list. Bodies
  are matched literally only: in a long paragraph a subsequence match means nothing
* **Watching a dropped file** — `getAsFileSystemHandle()` is claimed on the drop event, so a
  dropped file live-reloads exactly like one opened through the picker (Chromium; elsewhere the
  drop still loads, just without watching)

### Still open from v1

Nothing. The v1 scope and its polish are complete.

---

## V2 — Engine extraction + Book View ✅ shipped

The first version with two views. **This is the version that justifies the abstractions**,
and it was built in that order: the engine was extracted *while* the second view was written,
not before.

* Engine split from the renderer:
  * `compile(markdown, options)` is the single entry point (`src/engine/`)
  * the model carries sections, segments and mdast nodes — no renderer-specific fields
  * Reveal is one consumer of that model; `src/render/` owns every line of HTML
  * the boundary is a test (`src/engine/boundary.test.ts`), not a paragraph: nothing under
    `src/engine/` may import a view, a renderer or React
* **Book View** — the whole document as one scrolling page, with the table of contents as its
  chapter navigation and bodies rendered as they approach the viewport
* View switcher in the toolbar (`V`), with the choice persisted
* Named strategies for how a document is divided — `headings` (the v1 rules), `h1` and
  `fixed-length` — selectable in the toolbar and persisted
* Position is one number, a segment index, so it survives switching views, changing strategy,
  a live reload and a `#/12` deep link

### Still open from v2

* `compile()` is the entry point but is still marked experimental. Freezing it as the public
  API is worth doing only once a third consumer — the Outline view — has pulled on it.
* The sidebar does not scroll the active entry into view, which is more noticeable now that a
  document can be read continuously.
* The app still ignores a hash typed into the address bar of an already-open document; deep
  links are read on load.

---

## V3 — Outline View

* Collapsible tree of the whole document; expand a node to read it in place
* Fastest way to answer "what is in this document" for a 3,000-line file
* Cross-view state: shipped in v2 — position is a segment index every view understands, so
  the outline gets it for free

---

## V4 — Desktop reader

* Package the app so a `.md` file can be opened directly from the OS
* Watch the file on disk; recent-documents list
* Offline by construction

---

## V5 — Editor integration

* VS Code extension: open the current Markdown file in any view, side by side with the source
* Follow the cursor: moving in the editor moves the view

---

## Backlog (not scheduled)

Valuable, but none of these should jump ahead of a second view — they widen v1 instead of
proving the architecture:

* CLI that renders a document to a static HTML file
* PDF export
* Mermaid diagrams, callouts, embedded video
* Presenter mode and speaker notes
* Theme system beyond light/dark
* Mini-map, reading analytics, command palette
* Plugin API — deliberately last: a plugin API is a promise about internals, and the
  internals should not be promised until V2 and V3 have reshaped them

---

## Non-goals

Unchanged from the original PRD, and worth restating because they are what keep the product
small:

* No AI summarization, rewriting or editing
* No authoring or presentation-building
* No collaboration
* No proprietary format

The tool never becomes the place where documents are written.
