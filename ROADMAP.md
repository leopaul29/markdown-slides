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

### Remaining v1 polish

Small, user-visible gaps worth closing before starting v2:

* **Deep links** — `#/12` style URLs so a slide can be shared or bookmarked
  (Reveal's `hash` option is currently off)
* **Live reload** — re-read the same file on change via the File System Access API, so
  editing in another window updates the view without re-dropping the file
* **Search quality** — currently plain substring matching; table cells flatten without
  separators, which makes some snippets hard to read
* **Bundle size** — 206 kB gzipped, most of it `highlight.js` grammars; worth trimming the
  language set or loading grammars on demand

---

## V2 — Engine extraction + Book View

The first version with two views. **This is the version that justifies the abstractions**,
and it should be built in that order: extract the engine *while* writing the second view,
not before.

* Split the engine from the renderer:
  * `compile(markdown, options)` as the single public entry point
  * a document model that carries no renderer-specific fields
  * Reveal becomes one consumer of that model, not the shape of it
* **Book View** — continuous scrolling with chapter navigation, for readers who want flow
  rather than pagination
* View switcher in the toolbar, with the choice persisted
* Named strategies for how a document is divided (`h1`, `fixed-length`, …), selectable per
  document

---

## V3 — Outline View

* Collapsible tree of the whole document; expand a node to read it in place
* Fastest way to answer "what is in this document" for a 3,000-line file
* Cross-view state: the current position survives switching views

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
