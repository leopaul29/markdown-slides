# Markdown Slides

A guided tour of the reader you are currently looking at.

This document is plain Markdown. Nothing in it is special: no frontmatter, no
custom syntax, no directives. Open your own file and it will behave exactly the
same way.

## How slides are made

The rules are deterministic and fit on one slide:

* every `#` heading starts a new slide group,
* every `##` heading starts a new slide,
* `###` and deeper headings stay inside the current slide,
* long sections are split into parts you can page through with `↑` / `↓`,
* code blocks and tables are never cut in half.

No AI is involved, so the same document always produces the same deck.

## Navigation

| Key            | Action                          |
| -------------- | ------------------------------- |
| `←` `→`        | Previous / next slide           |
| `↑` `↓`        | Previous / next part of a slide |
| `Home` / `End` | First / last slide              |
| `Ctrl/⌘ + K`   | Search the whole document       |
| `F`            | Fullscreen                      |
| `Esc`          | Exit fullscreen                 |
| `M`            | Toggle the table of contents    |
| `T`            | Toggle light / dark theme       |

Clicking any entry in the sidebar jumps straight to that section.

# Reading long documents

The reason this tool exists: AI assistants produce long Markdown, and long
Markdown is tiring to scroll.

## Code blocks

Code keeps its formatting, gets syntax highlighting, and scrolls sideways
instead of wrapping.

```ts
import { buildDeck } from './lib/slides'

const deck = buildDeck(markdown)

for (const slide of deck.slides) {
  console.log(`${slide.h}.${slide.v}`, slide.title)
}
```

Line numbers are optional — toggle them from the toolbar.

```bash
npm install
npm run dev
```

## Quotes and lists

> Markdown is the source of truth. Slides are simply another way to read it.

Nested lists keep their structure:

1. Parse the Markdown into an AST.
2. Group the AST into sections.
   * `#` opens a group
   * `##` opens a slide
3. Split sections that are too tall.
4. Render each slide only when it is about to be shown.

## A section long enough to split

Sections that would overflow the slide are divided into parts automatically.
The part counter appears next to the title, and `↑` / `↓` moves between parts
without leaving the section.

Splitting happens at block boundaries. A paragraph is never cut in the middle,
a table never loses its header, and a code block always travels whole — if it
is taller than a slide it simply gets a slide to itself.

### Why not just scroll?

Scrolling loses your place. A slide is a fixed unit of attention: you finish it,
you move on. For a design document with thirty sections that difference is the
whole point.

### Why no AI?

Because summarisation changes the document. This tool only re-arranges what is
already written, which means you can trust that nothing was invented, dropped or
rephrased on the way to the screen.

### Why Markdown stays the source

Edit the file in your editor, drop it back in, and the deck reflects the change
immediately. There is no project file, no export step and no lock-in.

# Get going

1. Drop any `.md` file onto the window.
2. Browse it with the arrow keys.
3. Press `Ctrl/⌘ + K` to jump anywhere.

That is the entire product.
