# Decisions

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
