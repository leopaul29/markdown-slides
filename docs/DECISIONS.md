# Decisions

## 2026-08-08

### Decision
Split the engine from the renderer as `src/engine/` and `src/render/`, with `compile()` as the
single entry point, and enforce the boundary with a test rather than a paragraph.

### Context
V2 required "a document model that carries no renderer-specific fields". Three leaks were on
record: `Deck.columns` (a Reveal layout concept), `nodesToHtml` living next to the parser, and
the name `Deck` meaning both the model and the React component.

### Reasoning
The rule the split exists to protect — the engine knows nothing about how anything is drawn —
is exactly the kind of rule prose does not hold. `src/engine/boundary.test.ts` walks every
source file under `src/engine/` and asserts that none of them imports a view, a renderer, React,
Reveal or any hast/lowlight package, and that a compiled model contains no markup. A directory
boundary makes the rule visible; the test makes it enforceable.

### Consequences
`Deck.columns` is gone: a section owns its segment indices, and Reveal's coordinates are derived
in the view as `[segment.section, segment.part - 1]` — an O(1) lookup that used to be a scan.
The model type is `DocumentModel` and `Deck` now means only the component. Adding a renderer that
is not HTML costs nothing in the engine; adding an import to it fails CI.

---

### Decision
Ship three segmentation strategies (`headings`, `h1`, `fixed-length`) and extract the strategy
interface from them, rather than defining the interface first.

### Context
`docs/architecture-notes.md` argued that an interface derived from a single implementation gets
shaped like that implementation, and advised writing the second strategy before extracting
anything.

### Reasoning
Writing all three first showed what they actually share, which is not a pipeline of hooks: it is
`weightOf()` and two splitters. `fixed-length` in particular does not want the heading-aware
splitter at all — it packs blocks to a budget and lets headings only *name* the pages. Had the
interface been drawn from `headings` alone it would have imposed that splitter on everyone. The
interface that survived is one function, `divide(root, { maxWeight }) → sections with parts`.

### Consequences
The strategy is chosen in the toolbar and persisted. An unknown persisted name falls back to the
default rather than throwing, so a stale setting can never stop a document opening. Every
strategy is held to the same invariants by one parameterised test file — code blocks never split,
part numbering is consistent, output is deterministic.

---

### Decision
Make the reader's position a single segment index, owned by `App.tsx`, and give every view the
same `goTo(index)` handle.

### Context
The architecture notes named cross-view position — "I was here in Presentation, put me here in
Book" — as a genuine design problem to decide before Book View, not during.

### Reasoning
Because both views consume the same model, an index into `model.segments` means the same thing
in both. No translation, no per-view position state, and the `#/12` fragment keeps working
unchanged. The restore effect hands that index to whichever view just mounted, which covers view
switching, strategy changes, live reload and deep links with one code path.

### Consequences
A strategy change moves the reader to the segment with the same index rather than to the same
*content*, which is approximate but predictable. The effect is guarded by a ref holding the model
and view it last ran for, because React remounts children freely and the URL fragment must never
be consumed twice.

---

### Decision
Render the book view lazily with two `IntersectionObserver`s and placeholder heights, and correct
`scrollTop` after any fill above the reader.

### Context
Lazy rendering is why a 12,000-line document opens in under two seconds. A continuous page makes
it harder: an unrendered body has no height, so either everything renders at once or the page
grows under the reader as bodies arrive.

### Reasoning
An unrendered body stands in for its own estimated height through a `--estimate` custom property
derived from the segment's text — deterministic, and it measures nothing. One observer renders
bodies as they approach the viewport, a second reports the topmost segment in the top fifth of
the page. Scroll anchoring is then a measurement, not a guess: `useSegmentBodies` records where
the anchor segment sat before the fill and shifts the container by whatever it moved.

### Consequences
A 17,000-line document mounts the book view in ~0.2 s with five bodies rendered. The estimate is
approximate, so the scrollbar is honest rather than exact. Any future view that scrolls as one
page has to pass an anchor to the hook.

---

### Decision
Have the deck slide to `(0, 0)` after initialization when it has no jump of its own to replay,
overriding whatever Reveal read from the URL.

### Context
Switching to the book view and back moved the reader forward by two or three sections, and a
`#/9` deep link opened at the wrong place. Reveal was reading the app's own `#/12` fragment as
its own slide index: `Location.readURL()` is called unconditionally in Reveal's `start()`, so
`hash: false` does not prevent it, and `#/12` is exactly the format Reveal parses.

### Reasoning
Three fixes were possible: change the app's fragment format so Reveal cannot parse it, patch
around Reveal's location controller, or state plainly in the view that the app owns the
position. The fragment is a shipped, shareable v1 URL format and is not worth breaking, and
reaching into Reveal's internals would break on any upgrade. Sliding to the start unless told
otherwise costs one line and makes the ownership explicit: the URL is read by `App.tsx`, and
`Deck.tsx` only ever goes where the app sends it.

### Consequences
Position is now single-sourced. A view added later inherits the same rule for free, because it
gets its position from the app rather than from the address bar. The cost is that anyone reading
`Deck.tsx` must be told why the redundant-looking `slide(0, 0)` is there — hence the comment and
the entry in `CLAUDE.md`.

---

### Decision
Tag a jump queued before Reveal is ready with the model it belongs to, instead of clearing it on
teardown.

### Context
`docs/LESSONS.md` records the original rule: a jump queued for one document must never replay
against the next, so the pending index was wiped in the effect's cleanup. That rule threw the
reader's position away whenever the deck remounted without the document changing — which React
StrictMode does on every mount, and which now happens on every view switch.

### Reasoning
The property that actually matters is "this jump belongs to *that* document", not "no jump
survives a teardown". Storing `{ model, index }` and replaying only when the model matches keeps
the original guarantee by identity while surviving a remount. Clearing on teardown was a proxy
for the same idea that stopped being true the moment a second view existed.

### Consequences
Deep links and view switches restore reliably in both the dev build and production. The
superseded rule is called out in `CLAUDE.md` so it is not "fixed" back to clearing on teardown by
someone who finds the old note in `docs/LESSONS.md`.

---

## 2026-08-03

### Decision
Build the v1 reader with Reveal.js in `disableLayout` mode, mapping sections to the
horizontal axis and split parts to the vertical axis.

### Context
The PRD named Reveal.js in the tech stack and specified `← →` for slides and `↑ ↓` for
subsections. Reveal's default layout scales slides to a fixed canvas, which is wrong for
reading long documents — text would shrink instead of the slide scrolling.

### Reasoning
`disableLayout: true` hands sizing back to CSS, so each slide can be a full-size page with
its own scrollbar. Mapping H1/H2 sections to horizontal and auto-split continuation parts to
vertical makes Reveal's built-in key bindings match the PRD's table exactly, with no custom
keyboard code. The alternative — a hand-written viewer — was rejected because Reveal already
supplies keyboard handling, overview mode, transitions, touch and fullscreen.

### Consequences
The slide model carries Reveal-shaped coordinates (`h`, `v`, `columns`), which is the main
thing to unpick if a second view is ever added. Reveal's CSS reset also has to be countered
in a few places (list markers, `font: inherit` on inline elements, viewport background).

---

### Decision
Inject slide HTML directly into the DOM under a layout effect instead of using
`dangerouslySetInnerHTML`.

### Context
Toggling any unrelated piece of state (line numbers, theme) silently destroyed the code-block
wrappers, language badges and table scroll containers added by the enhancement pass.

### Reasoning
Instrumenting the page proved React 19 re-sets `dangerouslySetInnerHTML` on every render even
when the HTML string is byte-identical — a `MutationObserver` caught it replacing 7 children
with 7 identical ones, with React frames in the stack. Since React owns that property, any
DOM enhancement inside it is transient. Giving React a childless `<div data-index>` and
filling it ourselves means React never touches those children.

### Consequences
Slide bodies track their own `data-filled` marker, and the deck-change effect must wipe them
explicitly because React reuses the DOM nodes across documents. The enhancement pass was made
idempotent so re-running it is harmless.

---

### Decision
Repair backslash-escaped Markdown punctuation in memory before parsing, but only when the
pattern is dominant in the document.

### Context
This repository's own `PRD.md` and `README.md` are escape-mangled (`\# Title`, `\* item`).
Parsed literally, every heading disappears and the whole document collapses to one slide.

### Reasoning
The repair is a pure function of the input and never touches the file, so both the
determinism and read-only principles still hold. Gating it on "more escaped headings than
real ones" avoids corrupting ordinary documents that legitimately escape a `\*` or `\#`.

### Consequences
The model is derived from a repaired copy of the source rather than the bytes verbatim. This
is documented in `ROADMAP.md` rather than hidden, since an undocumented exception to a stated
principle erodes trust in the principle.

---

### Decision
Restrict link and image URLs to an allow-list of schemes in the render pipeline, rather than
adding `rehype-sanitize`.

### Context
The v1 claim "opening an untrusted document is safe" rested on raw HTML being dropped. Review
pointed out that Markdown links are not raw HTML; a probe confirmed
`<a href="javascript:alert(document.cookie)">` survived into `innerHTML`, reachable remotely
through `?src=`.

### Reasoning
Fixing it in the mdast → hast pipeline covers every URL-bearing attribute in one place,
independent of which renderer consumes the tree. `rehype-sanitize` was rejected because its
default schema strips the `hljs-*` classes and heading ids the reader depends on, so it would
have meant maintaining a custom schema for a strictly larger change.

### Consequences
`javascript:`, `data:text/html`, `vbscript:` and `file:` links have their attribute removed —
the link text still renders but does nothing. Images additionally accept `data:image/*`.
Seven tests lock the allow-list, including control-character evasion.

---

### Decision
Publish the Reveal API ref only after `initialize()` resolves, and queue any jump requested
before that.

### Context
`revealRef.current` was assigned synchronously after construction, so a TOC click during
startup could call `slide()` on an uninitialized deck.

### Reasoning
Simply dropping early calls would silently lose the click. Queuing the requested index and
replaying it once Reveal is ready preserves the user's intent — verified by clicking a TOC
entry in the same tick the sidebar first paints and landing on the right slide.

### Consequences
The queued index must be cleared on teardown, or loading a different document replays it
against the new deck and opens an unrelated slide — a bug this introduced and a later review
round caught.

---

### Decision
Record the post-v1 "multi-view reader" direction as notes and a roadmap, without refactoring
the code yet.

### Context
The user brought back a ten-point proposal to reposition the product as a Markdown reader
with interchangeable views, strategies and renderers, and asked for the direction plus
concerns to be written down for later reading.

### Reasoning
Roughly two thirds of the proposal is naming and documentation, which is free and changes how
future decisions get made. The remaining third introduces three abstractions with one
implementation each. An interface derived from a single implementation is a guess; extracting
it from two real strategies produces a validated one. A `Renderer` interface in particular
would carry no leverage, because Reveal supplies keyboard, overview, transitions and touch
that a PDF or book renderer shares none of.

### Consequences
`ROADMAP.md` sequences the engine extraction into V2 alongside Book View rather than as
standalone work. `docs/architecture-notes.md` records which parts of the proposal the code
already satisfies, the three renderer-specific leaks (`h`/`v`, `columns`, `nodesToHtml`), and
the naming trade-off. No code was restructured in this session.

---

## 2026-08-08

### Decision
Use pnpm as the only package manager: delete `package-lock.json`, keep `pnpm-lock.yaml`, pin the
version through `packageManager` in `package.json`, and move both CI workflows to
`pnpm/action-setup` with `pnpm install --frozen-lockfile`.

### Context
The repository had accumulated both lockfiles — `package-lock.json`, tracked and used by CI, and
an untracked `pnpm-lock.yaml` from local installs. Two lockfiles describing the same dependency
graph drift apart silently, and CI was validating only one of them.

### Reasoning
Either manager would have worked; the user chose pnpm. What made the choice cheap to act on is
that nothing in the project depends on npm-specific behaviour. Pinning through `packageManager`
means `corepack enable` is the whole contributor setup, and `pnpm/action-setup` reads that same
field, so the version lives in exactly one place.

### Consequences
pnpm's `node_modules` is not flat, so type packages that used to arrive transitively through
remark stopped resolving: `@types/mdast` and `@types/hast` had to become explicit
devDependencies. That is the general shape of the migration cost — anything imported directly
must now be declared directly. Contributors following the old `npm install` instructions would
produce a lockfile CI rejects, so the README and `CLAUDE.md` name pnpm explicitly.

---

### Decision
Remove Tailwind CSS entirely — the `tailwindcss` and `@tailwindcss/vite` dependencies, the Vite
plugin and the `@import 'tailwindcss'` — and replace what it actually provided with a fifteen-line
base block in `src/index.css`.

### Context
A repo-wide over-engineering audit found the project used zero Tailwind utility classes, zero
`@apply` and zero `@theme`. Every `className` value was a hand-written semantic name, and the
theme was already CSS custom properties switched by `data-theme` on `<html>`. The framework was
contributing only its preflight reset.

### Reasoning
A CSS framework earns its place through utilities; one used solely for its reset is a dependency,
a build plugin and bundle weight in exchange for about fifteen lines of CSS. The real risk was
that preflight was load-bearing in ways the hand-written CSS silently assumed. Reveal.js already
imports Eric Meyer's reset, which covers margins, padding and inline fonts; the gaps preflight
filled were box sizing, form-control font inheritance and button chrome, so those were written
out explicitly rather than inherited from a framework.

### Consequences
Two devDependencies and a Vite plugin gone; the CSS bundle is 14.65 kB gzipped. The base block is
now the project's own responsibility — a future component that assumes a framework normalization
it does not contain will need that rule added by hand. The change is verified by the build only,
not in a browser.

---

### Decision
Stop carrying Reveal.js coordinates in the document model: delete `Slide.h` and `Slide.v`, and
derive them in `Deck.tsx` through a `coordsOf()` helper.

### Context
`ROADMAP.md` and `docs/architecture-notes.md` had both listed `h`/`v` as the main renderer leak to
unpick before a second view exists, estimated at about an hour. The audit surfaced it again as
redundant state: `h` is the index of the slide's column, `v` is `part - 1`.

### Reasoning
The fields were not merely redundant — they were the model asserting something only Reveal
believes, that a document has a horizontal and a vertical axis. Deriving them at the call site
puts Reveal-specific knowledge in the Reveal-specific file, which is where a Book View would
simply not look. Only two of the three call sites talk to Reveal at all; the third was the
sidebar's "is this section current" test, which turned out to be expressible in reading order as
`currentIndex` within `[slideIndex, slideIndex + partCount)`.

### Consequences
`Deck.columns` remains the last structural leak, because Reveal needs the grouping to build its
stacked sections. `coordsOf()` scans the column list once per jump, which is negligible at jump
frequency and would not be at keystroke frequency. The determinism test now asserts on
`index`/`part` instead of `h`/`v`.

---

### Decision
Flatten the table of contents from a two-level tree (`TocEntry.children`) to a flat list carrying
`level`.

### Context
`buildToc()` attached `##` entries as children of the preceding `#` entry, and `Sidebar` rendered
them through a recursive `TocNode` component.

### Reasoning
The recursion produced no nested markup: children were rendered into a bare fragment, and the only
visual difference between a parent and a child was the `level-N` class both already carried. It
was a data structure whose shape never reached the output.

### Consequences
`Sidebar` loses the recursive component and its prop drilling; `buildToc` becomes a `map`. A view
that genuinely wants nesting — the Outline view in V3 — will rebuild the tree from `level`, which
is a few lines and belongs in the view that needs it.

---

### Decision
Rebuild the image lightbox on the native `<dialog>` element with `showModal()`.

### Context
`Lightbox` was a hand-built `role="dialog"` overlay wired to `useDialogFocus` for its focus trap,
plus a capture-phase `keydown` listener for Escape.

### Reasoning
`showModal()` supplies the focus trap, Escape-to-close and the backdrop as platform behaviour, and
the lightbox has no interactive content for a custom trap to manage — it is one image. The
handwritten version was reimplementing three things the browser already does correctly.

### Consequences
The Escape listener and the focus-hook usage are gone from the component. The CSS moved to
`.lightbox[open]` and `::backdrop`, because a `<dialog>` is `display: none` until opened and the
old `display: flex` would have forced it visible. `useDialogFocus` survives for `SearchPalette`,
which needs combobox semantics a plain dialog does not give.

---

### Decision
Delete model and API surface nothing consumes: `Slide.headings` with `SlideHeading` and
`collectHeadings`, `SearchResult.titleMatch`, the `DocSource` union, the `rehype-slug` dependency,
and the `buildDeckFromRoot` / `weightOf` exports.

### Context
The audit checked each exported symbol against its call sites. Several existed only for a test, or
were written and never read: `headings` had one test assertion and no renderer, `titleMatch` no
component, `DocSource` was set four ways and branched on once (`=== 'url'`), and `rehype-slug`
generated heading ids nothing links to, because navigation is by slide index.

### Reasoning
Unused surface is not free: it is what a future refactor must preserve, and what a reader assumes
is load-bearing. Each was replaced by whatever already carried the same information — `doc.url`
presence instead of `source === 'url'`, the mdast nodes instead of a parallel heading list, score
ordering instead of a `titleMatch` flag.

### Consequences
`SearchResult.score` was deliberately kept although no component reads it either: the determinism
test uses it as its probe, and dropping it would have weakened that assertion to bare ordering. If
in-document `#anchor` links are ever supported, `rehype-slug` comes back.

---

### Decision
Keep personal agent configuration out of the repository — undo the two commits that added the
caveman skills and the ponytail plugin setting, and enable both plugins at user level — while
tracking project workflow skills under `.claude/skills/`.

### Context
Two unpushed commits had added `.claude/skills/` (seven caveman skill copies, 1,928 lines), a
`skills-lock.json`, and a `.claude/settings.json` enabling the ponytail plugin. The user asked
whether, for an open-source project, skills should be shared through the repository or left to
each contributor's own configuration.

### Reasoning
The two categories behave differently. Caveman and ponytail change how an assistant writes prose
and reviews code; committing them imposes one contributor's interaction style on everyone and adds
noise to diffs. The session-record skills (`session-to-decisions`, `session-to-lessons-learned`,
`session-to-current-state`, `session-wrap-up`) encode this project's own conventions — where its
records live and what belongs in them — and are worth little to their author alone. The line is
not "agent config in or out", it is personal style versus project workflow.

### Consequences
`git reset --soft` removed both commits while the branch was still local, so no history rewrite
reached the remote. `.gitignore` excludes `.claude/settings.json` and `.claude/settings.local.json`
while tracking `.claude/skills/`. The plugins moved to `~/.claude/settings.json`, so they follow
the user across projects instead of the project across users.
