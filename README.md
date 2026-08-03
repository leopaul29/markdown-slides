# Markdown Slides

> Turn any Markdown document into a beautiful, navigable HTML presentation.

Markdown Slides is an open-source tool that converts Markdown into an interactive slide deck.
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

Markdown Slides makes them enjoyable to explore.

---

## Features

* 📄 Works with standard GitHub Flavored Markdown
* 🎯 100% deterministic (no AI required)
* ⚡ Instant HTML presentation
* ⌨️ Keyboard navigation
* 🔍 Built-in search across headings, prose, lists and code
* 📚 Collapsible table of contents
* 🌙 Light & dark themes
* 💻 Syntax-highlighted code blocks with optional line numbers
* 🖼️ Responsive images with fullscreen preview
* 📊 Scrollable tables
* 📱 Responsive layout
* 🔒 Runs entirely in your browser — nothing is uploaded

---

## Getting started

```bash
npm install
npm run dev
```

Then open the printed URL and drop a `.md` file onto the page.

| Command           | What it does                                  |
| ----------------- | --------------------------------------------- |
| `npm run dev`     | Start the dev server with hot reload           |
| `npm run build`   | Type-check and build to `dist/`                |
| `npm run preview` | Serve the production build locally             |
| `npm test`        | Run the slide-builder and search test suite    |
| `npm run typecheck` | Type-check without emitting                  |

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

The last document you opened is restored when you reload the page.

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
    search.ts     Full-document search
    enhance.ts    Table wrappers, code chrome, line numbers
    document.ts   File / URL loading and persistence
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

Opening an untrusted document does not let it run script: raw HTML embedded in the Markdown is
dropped rather than executed, and link and image URLs are restricted to safe schemes, so a
`[click](javascript:…)` link cannot fire. Remote images and links are still fetched or followed
when you ask for them, exactly as in any Markdown viewer.

---

## Philosophy

Markdown Slides is **not** another presentation editor.

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

`npm run build` produces a static site in `dist/`. The included GitHub Actions workflow
publishes it to GitHub Pages on every push to `main`, setting `BASE_PATH` so assets resolve
under `/<repository>/`.

---

## Roadmap

### v1

* Markdown → HTML Slides ✅
* Keyboard navigation ✅
* Table of contents ✅
* Search ✅
* Responsive layout ✅
* Light/Dark mode ✅

### v2

* CLI
* Live reload while editing
* Multiple themes
* PDF export

### v3

* Plugin system
* Mermaid diagrams
* Presenter mode
* Speaker notes
* Custom slide strategies

---

## Tech Stack

* React
* TypeScript
* Vite
* Remark / Unified / Rehype
* Reveal.js
* Tailwind CSS

---

## Contributing

Contributions are welcome.

Whether it's a bug report, feature request, documentation improvement, or new theme, we'd love
your help.

---

## License

MIT
