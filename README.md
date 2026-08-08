# Markdown Reader

> Turn any Markdown document into a beautiful, navigable HTML presentation.

Markdown Reader is an open-source tool that converts Markdown into an interactive slide deck.
Instead of scrolling through thousands of lines, browse your document one section at a time.

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
* ⚡ Instant HTML presentation
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
* 🔗 Shareable `#/12` links to any slide
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
| `pnpm test`        | Run the slide-builder and search test suite |
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
slide you are on (`#/12`), so a position can be bookmarked or shared.

### Live reload

In Chromium-based browsers both the *Open* button and a dropped file hand the app a File System
Access handle it can re-read. The file is polled once a second, so editing it in another window
updates the deck and keeps your place. Toggle it with the eye button in the toolbar. Other
browsers still open the file — they just cannot watch it.

---

## Search

`Ctrl/⌘ K` (or `/`) opens the search palette. It looks at headings, prose, lists, tables and
code.

| Query | Finds |
| --- | --- |
| `webhook` | every slide containing "webhook" |
| `retry webhook` | only slides containing **both** words — terms narrow, in any order |
| `"exactly this"` | the phrase, matched literally and never fuzzily |
| `authn` | the heading "Authentication" — headings also match on subsequences |
| `adr` | the heading "Architecture Decision Records" — initials count |

Results are ranked rather than listed in document order. A term in a heading outranks the same
term in the body, a term starting a word outranks one buried mid-word, an exact match outranks
a fuzzy one, and a slide holding all the terms in a single passage outranks one where they are
scattered. Equally good matches stay in document order, so the same query always produces the
same list.

Bodies are matched literally only. A subsequence match is meaningful in a six-word heading and
meaningless in a six-hundred-word section.

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
Slide 1        Slide 2   Slide 3        Slide 4
Authentication  Why      Alternatives   Database
```

Each slide is one section. Sections too tall for the screen are split into parts stacked
vertically, reachable with `↑` / `↓`.

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
Slide Builder (deterministic rules)
     │
Slide Model
     │
     ▼
React components → Reveal.js
```

No AI.

No proprietary format.

The only transformations applied before parsing are deterministic and in memory: line endings
are normalised, and documents whose Markdown punctuation was backslash-escaped by an exporter
are repaired. Your file on disk is never modified, and it remains the single source of truth.

---

## Slide Generation Rules

The presentation is generated using deterministic rules.

Default strategy:

* Every `# Heading` starts a new slide group.
* Every `## Heading` creates a new slide.
* `###` and deeper headings stay within the current slide.
* Content before the first heading becomes an opening slide.
* Large sections are automatically split into parts.
* Code blocks never split across slides.
* Tables remain intact whenever possible.
* A slide never ends on a heading whose content lives on the next slide.

The same document always produces the same deck.

Future versions will support multiple generation strategies.

---

## Keyboard Shortcuts

| Key          | Action                     |
| ------------ | -------------------------- |
| ← →          | Previous / next slide      |
| ↑ ↓          | Previous / next part       |
| Home         | First slide                |
| End          | Last slide                 |
| F            | Fullscreen                 |
| Esc          | Exit fullscreen / overview |
| Ctrl/Cmd + K | Search                     |
| /            | Search                     |
| M            | Toggle table of contents   |
| T            | Toggle light / dark theme  |

---

## Project structure

```text
src/
  lib/
    markdown.ts   Markdown → AST, AST slice → HTML
    slides.ts     Deterministic slide builder + table of contents
    search.ts     Ranked multi-term search, with fuzzy heading matching
    enhance.ts    Table wrappers, code chrome, line numbers
    document.ts   File / URL loading, watching and persistence
  components/
    Deck.tsx      Reveal.js integration and lazy slide rendering
    Sidebar.tsx   Table of contents
    SearchPalette.tsx
    Welcome.tsx   Drop zone and loaders
    Lightbox.tsx  Fullscreen image preview
  examples/
    tour.md       The bundled example document
```

### Performance notes

Slide bodies are converted to HTML only when they come within two slides of the current
position, so a 12,000-line document opens in well under two seconds and navigates without
lag. Rendered slides are cached for the lifetime of the document.

Syntax highlighting drives `lowlight` directly with an explicit language list rather than
`rehype-highlight`, whose default import pulls in every common highlight.js grammar. The
production bundle is 189 kB gzipped.

Search scores every slide on every keystroke. The expensive parts are avoided rather than
optimised: the searchable text of a slide is derived once and cached, fuzzy matching is gated
behind a linear subsequence pre-check that rejects almost every slide, its scoring matrix reuses
buffers instead of allocating them, and snippets are built only for the results that are shown.
A query against the 1,040-slide document costs about 1 ms, worst case 3 ms.

Opening an untrusted document does not let it run script: raw HTML embedded in the Markdown is
dropped rather than executed, and link and image URLs are restricted to safe schemes, so a
`[click](javascript:…)` link cannot fire. Remote images may still be fetched when their slide
renders; links are only followed when you activate them.

---

## Philosophy

Markdown Reader is **not** another presentation editor.

Write your content in Markdown using your favorite editor.

View it as slides whenever you want.

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

[`ROADMAP.md`](./ROADMAP.md) is the plan of record. In short: v1 is the presentation view and
is complete; v2 splits the engine from the renderer and adds a Book View; v3 adds an Outline
view; v4 packages a desktop reader and v5 an editor integration.

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
