# Markdown Reader

> Turn any Markdown document into a beautiful, navigable HTML reader.

Markdown Reader is an open-source tool that converts Markdown into an interactive document you
can read two ways: as a **presentation**, one section at a time, or as a **book**, one
continuous scrolling page. Both are generated from the same deterministic model, and your
place is kept when you switch.

Designed for developers, technical writers, and anyone reading long Markdown documents.

---

## Why?

AI coding assistants increasingly generate large Markdown documents:

* Product Requirement Documents (PRDs)
* Architecture Decision Records (ADRs)
* Design documents
* RFCs
* Research reports
* Meeting notes
* Implementation plans

These documents are easy to generate but often difficult to read.

Markdown Reader makes them enjoyable to explore.

---

## Features

* 📄 Works with standard GitHub Flavored Markdown
* 🎯 100% deterministic (no AI required)
* ⚡ Instant HTML rendering
* 🖥️ Two views — presentation and book — switched with `V`, your choice remembered
* ✂️ Three ways to divide a document — by headings, by `#` only, or into fixed-length pages
* ⌨️ Keyboard navigation
* 🔍 Ranked search across headings, prose, lists and code — multiple words, quoted phrases and
  fuzzy heading matches
* 📚 Collapsible table of contents
* 🌙 Light & dark themes
* 💻 Syntax-highlighted code blocks with optional line numbers
* 🖼️ Responsive images with fullscreen preview
* 📊 Scrollable tables
* 📱 Responsive layout
* 🔄 Live reload — edit the file in your editor and the view follows
* 🔗 Shareable `#/12` links to any segment, in either view
* 🔒 Runs entirely in your browser — nothing is uploaded

---

## Getting started

```bash
pnpm install
pnpm dev
```

Then open the printed URL and drop a `.md` file onto the page.

| Command            | What it does                               |
| ------------------ | ------------------------------------------ |
| `pnpm dev`         | Start the dev server with hot reload        |
| `pnpm build`       | Type-check and build to `dist/`             |
| `pnpm preview`     | Serve the production build locally          |
| `pnpm test`        | Run the engine, strategy, search and render suites |
| `pnpm typecheck`   | Type-check without emitting                 |

This project uses **pnpm** (`pnpm-lock.yaml` is the lockfile). The version is pinned through
`packageManager` in `package.json`, so `corepack enable` is enough to get the right one.

---

## Opening a document

There are four ways to load Markdown:

* **Drop a file** anywhere on the window.
* **Choose a file** with the *Open* button in the toolbar.
* **Paste Markdown** directly into the welcome screen.
* **Load a URL** — either from the welcome screen or with a query parameter:

  ```text
  http://localhost:5173/?src=https://raw.githubusercontent.com/user/repo/main/DESIGN.md
  ```

  GitHub `blob` links are rewritten to their raw equivalent automatically. Remote files must
  be served with permissive CORS headers.

The last document you opened is restored when you reload the page, and the URL carries the
segment you are on (`#/12`) — a whole section, or one part of a long one. Position is one number
in both views, so switching between them — or changing how the document is divided — keeps your
place, and the same link opens the same place in either.

### Live reload

In Chromium-based browsers both the *Open* button and a dropped file hand the app a File System
Access handle it can re-read. The file is polled once a second, so editing it in another window
updates the view and keeps your place. Toggle it with the eye button in the toolbar. Other
browsers still open the file — they just cannot watch it.

---

## Search

`Ctrl/⌘ K` (or `/`) opens the search palette. It looks at headings, prose, lists, tables and
code.

| Query | Finds |
| --- | --- |
| `webhook` | every segment containing "webhook" |
| `retry webhook` | only segments containing **both** words — terms narrow, in any order |
| `"exactly this"` | the phrase, matched literally and never fuzzily |
| `authn` | the heading "Authentication" — headings also match on subsequences |
| `adr` | the heading "Architecture Decision Records" — initials count |

Results are ranked rather than listed in document order. A term in a heading outranks the same
term in the body, a term starting a word outranks one buried mid-word, an exact match outranks
a fuzzy one, and a segment holding all the terms in a single passage outranks one where they are
scattered. Equally good matches stay in document order, so the same query always produces the
same list.

Bodies are matched literally only. A subsequence match is meaningful in a six-word heading and
meaningless in a six-hundred-word segment.

---

## Example

Input:

```markdown
# Authentication

Authentication is handled by Supabase Auth.

## Why

It reduces backend complexity.

## Alternatives

- Clerk
- Firebase Auth

# Database

PostgreSQL is the source of truth.
```

Output:

```text
Segment 1       Segment 2  Segment 3      Segment 4
Authentication  Why        Alternatives   Database
```

In the presentation each segment is a slide; in the book they follow one another down the page.
Sections too tall for one screen are split into parts — stacked vertically in the presentation,
reachable with `↑` / `↓`, and flowing into one another in the book.

---

## How It Works

```text
Markdown
     │
     ▼
Markdown Parser (remark + GFM)
     │
Markdown AST
     │
     ▼
compile() — a segmentation strategy, deterministic rules
     │
Document Model  (segments, sections, table of contents — AST nodes, no HTML)
     │
     ├──▶ Presentation view (Reveal.js)
     └──▶ Book view (one scrolling page)
```

The engine (`src/engine/`) never imports the render layer and never produces markup; a test
enforces it. Adding a view means consuming the model, not changing it.

No AI.

No proprietary format.

The only transformations applied before parsing are deterministic and in memory: line endings
are normalised, and documents whose Markdown punctuation was backslash-escaped by an exporter
are repaired. Your file on disk is never modified, and it remains the single source of truth.

---

## How a document is divided

Division is deterministic, and which rules are used is your choice — the strategy selector sits
in the toolbar and is remembered.

| Strategy | Rule |
| --- | --- |
| **Headings** (default) | `#` starts a group, `##` starts a section, `###`+ stay inside it |
| **Top level only** | only `#` starts a section; `##` and deeper stay inside it |
| **Fixed length** | even pages packed to the same height, wherever the headings fall |

Whichever is chosen:

* Content before the first heading becomes an opening section.
* Large sections are automatically split into parts.
* Code blocks never split.
* Tables remain intact whenever possible.
* A part never ends on a heading whose content lives in the next one.

The same document and the same strategy always produce the same result.

---

## Keyboard Shortcuts

| Key          | Action                                        |
| ------------ | --------------------------------------------- |
| ← →          | Previous / next section *(presentation)*      |
| ↑ ↓          | Previous / next part *(presentation)*         |
| Page ↑ ↓ · space | Scroll *(book)*                           |
| Home         | Start of the document                         |
| End          | End of the document                           |
| F            | Fullscreen                                    |
| Esc          | Exit fullscreen / overview                    |
| Ctrl/Cmd + K | Search                                        |
| /            | Search                                        |
| V            | Switch between the presentation and the book  |
| M            | Toggle table of contents                      |
| T            | Toggle light / dark theme                     |

---

## Project structure

```text
src/
  engine/               Markdown → document model. Knows nothing about HTML.
    compile.ts          The entry point: compile(markdown, options)
    model.ts            DocumentModel, Section, Segment, TocEntry
    markdown.ts         Markdown → AST, normalisation, searchable text
    weight.ts           Deterministic height estimate for a block
    strategies/         headings · h1 · fixed-length, and their shared splitters
    boundary.test.ts    Enforces that none of the above imports a renderer
  render/               The HTML renderer, shared by every HTML view.
    html.ts             AST slice → HTML, syntax highlighting, URL allow-list
    enhance.ts          Table wrappers, code chrome, line numbers
    useSegmentBodies.ts Lazy, cached body injection with scroll anchoring
  components/
    Deck.tsx            The presentation view (Reveal.js)
    BookView.tsx        The book view (one scrolling page)
    view.ts             ViewHandle and the list of views
    Sidebar.tsx         Table of contents
    SearchPalette.tsx
    Welcome.tsx         Drop zone and loaders
    Lightbox.tsx        Fullscreen image preview
  lib/
    search.ts           Ranked multi-term search, with fuzzy heading matching
    document.ts         File / URL loading, watching and persistence
  examples/
    tour.md             The bundled example document
```

### Performance notes

Bodies are converted to HTML only when they are needed — within two segments of the current
position in the presentation, and as they approach the viewport in the book. A 17,000-line
document (602 sections) opens in about 1.1 s with three bodies materialised, and the book view
mounts over it in about 0.2 s. Rendered bodies are cached for the lifetime of the document, and
unrendered ones stand in for their own estimated height so the scrollbar stays honest.

Syntax highlighting drives `lowlight` directly with an explicit language list rather than
`rehype-highlight`, whose default import pulls in every common highlight.js grammar. The
production bundle is 189 kB gzipped.

Search scores every segment on every keystroke. The expensive parts are avoided rather than
optimised: the searchable text of a segment is derived once and cached, fuzzy matching is gated
behind a linear subsequence pre-check that rejects almost every segment, its scoring matrix reuses
buffers instead of allocating them, and snippets are built only for the results that are shown.
A query against a 1,000-section document costs about 1 ms, worst case 3 ms.

Opening an untrusted document does not let it run script: raw HTML embedded in the Markdown is
dropped rather than executed, and link and image URLs are restricted to safe schemes, so a
`[click](javascript:…)` link cannot fire. Remote images may still be fetched when their segment
renders; links are only followed when you activate them.

---

## Philosophy

Markdown Reader is **not** another presentation editor.

Write your content in Markdown using your favorite editor.

Read it as slides or as a book whenever you want.

Markdown stays the source of truth.

---

## Use Cases

* Reading AI-generated PRDs
* Exploring Architecture Decision Records (ADRs)
* Reviewing RFCs
* Technical documentation
* Research reports
* Long README files
* Internal engineering documentation
* Meeting notes
* Learning material

---

## Deployment

`pnpm build` produces a static site in `dist/`. The included GitHub Actions workflow
publishes it to GitHub Pages on every push to `main`, setting `BASE_PATH` so assets resolve
under `/<repository>/`.

---

## Roadmap

[`ROADMAP.md`](./ROADMAP.md) is the plan of record. In short: v1 (the presentation view) and v2
(the engine/renderer split plus the Book View and named strategies) are complete; v3 adds an
Outline view; v4 packages a desktop reader and v5 an editor integration.

---

## Tech Stack

* React
* TypeScript
* Vite
* Remark / Unified / Rehype
* Reveal.js
* Hand-written CSS — no framework

---

## Contributing

Contributions are welcome.

Whether it's a bug report, feature request, documentation improvement, or new theme, we'd love
your help.

---

## License

MIT
