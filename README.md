\# Markdown Slides



> Turn any Markdown document into a beautiful, navigable HTML presentation.



Markdown Slides is an open-source tool that converts Markdown into an interactive slide deck. Instead of scrolling through thousands of lines, browse your document one section at a time.



Designed for developers, technical writers, and anyone reading long Markdown documents.



\---



\## Why?



AI coding assistants increasingly generate large Markdown documents:



\* Product Requirement Documents (PRDs)

\* Architecture Decision Records (ADRs)

\* Design documents

\* RFCs

\* Research reports

\* Meeting notes

\* Implementation plans



These documents are easy to generate but often difficult to read.



Markdown Slides makes them enjoyable to explore.



\---



\## Features



\* 📄 Works with standard GitHub Flavored Markdown

\* 🎯 100% deterministic (no AI required)

\* ⚡ Instant HTML presentation

\* ⌨️ Keyboard navigation

\* 🔍 Built-in search

\* 📚 Table of contents

\* 🌙 Light \& dark themes

\* 💻 Syntax-highlighted code blocks

\* 🖼️ Responsive images

\* 📊 Table support

\* 📱 Responsive layout



\---



\## Demo



Coming soon.



\---



\## Example



Input:



```markdown

\# Authentication



Authentication is handled by Supabase Auth.



\## Why



It reduces backend complexity.



\## Alternatives



\- Clerk

\- Firebase Auth



\# Database



PostgreSQL is the source of truth.

```



Output:



```text

Slide 1

Authentication



↓



Slide 2

Why



↓



Slide 3

Alternatives



↓



Slide 4

Database

```



\---



\## How It Works



```text

Markdown

&#x20;    │

&#x20;    ▼

Markdown Parser

&#x20;    │

Markdown AST

&#x20;    │

&#x20;    ▼

Slide Builder

&#x20;    │

Slide Model

&#x20;    │

&#x20;    ▼

HTML Presentation

```



No AI.



No preprocessing.



No proprietary format.



Your Markdown file remains the single source of truth.



\---



\## Slide Generation Rules



The presentation is generated using deterministic rules.



Default strategy:



\* Every `# Heading` starts a new slide group.

\* Every `## Heading` creates a new slide.

\* `###` and deeper headings stay within the current slide.

\* Large sections are automatically split.

\* Code blocks never split across slides.

\* Tables remain intact whenever possible.



Future versions will support multiple generation strategies.



\---



\## Keyboard Shortcuts



| Key          | Action                     |

| ------------ | -------------------------- |

| ← →          | Previous / Next slide      |

| ↑ ↓          | Previous / Next subsection |

| Home         | First slide                |

| End          | Last slide                 |

| F            | Fullscreen                 |

| Esc          | Exit fullscreen            |

| Ctrl/Cmd + K | Search                     |



\---



\## Philosophy



Markdown Slides is \*\*not\*\* another presentation editor.



Write your content in Markdown using your favorite editor.



View it as slides whenever you want.



Markdown stays the source of truth.



\---



\## Use Cases



\* Reading AI-generated PRDs

\* Exploring Architecture Decision Records (ADRs)

\* Reviewing RFCs

\* Technical documentation

\* Research reports

\* Long README files

\* Internal engineering documentation

\* Meeting notes

\* Learning material



\---



\## Roadmap



\### v1



\* Markdown → HTML Slides

\* Keyboard navigation

\* Table of contents

\* Search

\* Responsive layout

\* Light/Dark mode



\### v2



\* CLI

\* Live reload

\* Multiple themes

\* PDF export



\### v3



\* Plugin system

\* Mermaid diagrams

\* Presenter mode

\* Speaker notes

\* Custom slide strategies



\---



\## Tech Stack



\* React

\* TypeScript

\* Vite

\* Remark

\* Unified

\* Rehype

\* Reveal.js

\* Tailwind CSS



\---



\## Contributing



Contributions are welcome.



Whether it's a bug report, feature request, documentation improvement, or new theme, we'd love your help.



\---



\## License



MIT



