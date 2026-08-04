# Current State

## Objective

Markdown Reader is a local, deterministic reader that turns any Markdown document into a
navigable slide deck. v1 (presentation view) is the shipped scope; the agreed direction is to
grow it into a read-only Markdown reader with several interchangeable views, with the engine
extracted in V2 alongside a second view rather than before one exists.

## Status

v1 is built, reviewed, and merged to `main` via PR #1. A follow-up round of review fixes is
pushed and open as PR #2, awaiting merge. Typecheck, 26 tests and the production build all
pass; behaviour is verified in Chromium against the production bundle.

## Completed

- **Slide engine** (`src/lib/slides.ts`) — deterministic rules: `#` opens a group, `##` opens a
  slide, `###`+ stay inside, content before the first heading gets an opening slide, oversized
  sections split into parts. Code blocks and tables never split; no slide ends on an orphan
  heading.
- **Reader** — Reveal.js with `disableLayout`; sections on the horizontal axis, split parts on
  the vertical. TOC sidebar with breadcrumbs, `Ctrl/⌘K` search over headings/prose/lists/code,
  syntax highlighting with optional line numbers, scrollable tables, image lightbox,
  light/dark themes.
- **Loading** — drop, file picker, paste, and `?src=` URL (GitHub blob links rewritten to raw),
  with a 20s fetch timeout and last-document restore on reload.
- **Security** — raw HTML dropped; link and image URLs restricted to an allow-list
  (`http`, `https`, `mailto`, `tel`, relative, fragments; `data:image/*` for images).
- **Accessibility** — modal focus trap and restore for both dialogs, combobox/listbox semantics
  in the palette, aria-labels on icon-only buttons, `:focus-visible` indicators.
- **Verified at scale** — 12,798-line document → 1,040 slides, ~1.7 s to first paint, ~13k DOM
  nodes, 3 slide bodies materialized initially.
- **Docs** — `README.md`, `ROADMAP.md`, `docs/architecture-notes.md` (review of the multi-view
  proposal), CI workflow and a GitHub Pages deploy workflow with least-privilege permissions.

## In Progress

- `docs/DECISIONS.md` and `docs/LESSONS.md` are written but untracked — not yet committed.
- PR #2 (`claude/markdown-html-slides-explorer-c9r31r` → `main`) is open with the five
  follow-up fixes: stale jump replay on teardown, load-token invalidation on synchronous
  document swaps, `srcset` array handling in the URL guard, `getClientRects()` visibility in
  the focus trap, and corrected focus-restore semantics.

## Blockers

None. PR #2 needs a merge, not a decision.

## Risks

- **Reveal-shaped model.** `Slide.h`, `Slide.v` and `Deck.columns` are Reveal coordinates, and
  `nodesToHtml` sits next to the parser. These are the leaks to unpick before a second view;
  roughly an hour of work, cheap now and progressively less so.
- **Repo name still `markdown-slides`.** The product is now Markdown Reader in the app, the
  package and the docs, but the GitHub repository and its Pages URL keep the old slug. Renaming
  the repo is a one-click change that also updates `BASE_PATH` automatically.
- **Second view is unproven.** The roadmap's abstractions are justified by Book View existing;
  if it never ships, the current direct structure is the right one.

## Next Actions

1. Merge PR #2.
2. Commit `docs/DECISIONS.md`, `docs/LESSONS.md` and this snapshot — the container is
   ephemeral, so anything uncommitted is lost.
3. Rename the GitHub repository to match (`markdown-reader`); the deploy workflow derives
   `BASE_PATH` from the repo name, so nothing else needs editing.
4. Close the remaining v1 polish: deep links (`hash`), live reload via the File System Access
   API, table-cell separators in search snippets, and trimming the highlight.js language set.
5. When starting V2: write the `fixed-length` strategy first, then extract the strategy
   interface from the two implementations — not before.
