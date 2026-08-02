\# PRD — Markdown Slides



\## Vision



Markdown Slides is an open-source tool that transforms any Markdown document into a beautiful, navigable HTML slide deck.



The goal is \*\*not\*\* to replace PowerPoint, Keynote, or presentation software.



The goal is to make long, structured Markdown documents enjoyable to read.



The application is especially useful for AI-assisted development, where agents generate long design documents, PRDs, architecture decisions, implementation plans, ADRs, or technical reports.



Instead of scrolling through thousands of lines of Markdown, users can browse the document as a presentation.



\---



\# Problem



Modern AI coding agents generate increasingly long Markdown documents.



Examples include:



\* PRDs

\* ADRs

\* Design documents

\* Research reports

\* Planning documents

\* Meeting notes

\* Decision logs

\* RFCs



Although Markdown is readable, very long documents quickly become difficult to navigate.



Even inside modern IDEs, reading a 2,000-line Markdown file is often tedious.



Users usually want to explore sections one at a time rather than continuously scrolling.



\---



\# Goals



\* Convert Markdown into HTML slides.

\* Preserve the document structure.

\* Require zero AI.

\* Be fully deterministic.

\* Work locally.

\* Support very large Markdown files.

\* Be open source.

\* Have zero vendor lock-in.



\---



\# Non Goals



\* No AI summarization.

\* No rewriting.

\* No editing.

\* No collaboration.

\* No presentation authoring.

\* No PowerPoint export (V1).

\* No PDF generation (V1).



The Markdown file remains the single source of truth.



\---



\# Philosophy



Markdown is the source.



Slides are only a visualization.



Editing always happens inside the Markdown document.



Refreshing the page immediately updates the presentation.



\---



\# Supported Markdown



V1 supports standard GitHub Markdown.



\* headings

\* paragraphs

\* lists

\* tables

\* images

\* code blocks

\* blockquotes

\* links

\* horizontal rules



No custom syntax.



No frontmatter required.



\---



\# Slide Generation Rules



The parser is entirely deterministic.



Example:



```markdown

\# Title



content



\## Section A



...



\## Section B



...



\# Another Title



...

```



becomes



```

Slide 1

Title



Slide 2

Section A



Slide 3

Section B



Slide 4

Another Title

```



Rules:



\* Every H1 starts a new slide group.

\* Every H2 creates a new slide.

\* H3+ remain inside the current slide.

\* Very large sections are automatically split.

\* Images remain inside their section.

\* Tables stay intact when possible.

\* Code blocks never split across slides.



No LLM is used.



\---



\# Navigation



Keyboard:



← →



Previous / Next slide



↑ ↓



Previous / Next subsection



Home



First slide



End



Last slide



F



Fullscreen



ESC



Exit fullscreen



\---



\# Table of Contents



A collapsible sidebar displays:



```

Introduction



Architecture



Authentication



Database



API



Deployment



Future Work

```



Clicking a title jumps directly to the slide.



\---



\# Search



Users can search the document.



Results instantly navigate to the matching slide.



Search works on:



\* headings

\* paragraph text

\* code

\* lists



\---



\# Reading Mode



Minimal UI.



Focus on content.



Optional dark/light themes.



Large readable typography.



Smooth transitions.



\---



\# Code Blocks



Requirements:



\* syntax highlighting

\* line numbers (optional)

\* horizontal scrolling

\* preserve formatting



\---



\# Images



Images are displayed responsively.



Large images automatically fit inside the slide.



Clicking an image opens a fullscreen preview.



\---



\# Tables



Tables automatically scale.



Large tables become horizontally scrollable.



\---



\# Performance



Target:



\* 10,000+ line Markdown documents

\* instant navigation

\* no noticeable lag



Rendering should remain smooth even for very large documents.



\---



\# Architecture



```

Markdown File

&#x20;       │

&#x20;       ▼

Markdown Parser (remark)

&#x20;       │

Markdown AST

&#x20;       │

&#x20;       ▼

Slide Builder

&#x20;       │

Slide Model

&#x20;       │

&#x20;       ▼

React Components

&#x20;       │

&#x20;       ▼

Reveal.js

```



No AI.



No backend.



Everything runs locally.



\---



\# Tech Stack



Frontend



\* React

\* TypeScript

\* Vite



Markdown



\* remark

\* unified

\* rehype



Presentation



\* Reveal.js



Styling



\* TailwindCSS



Deployment



\* GitHub Pages



\---



\# Future Features



\* Multiple slide generation strategies

\* Split view (Markdown + Slides)

\* Live reload while editing

\* Presenter mode

\* Speaker notes

\* PDF export

\* Theme marketplace

\* Custom slide templates

\* Plugin API

\* Mermaid support

\* Callout support

\* Diagram support

\* Embedded videos

\* Keyboard command palette

\* Mini-map

\* Reading analytics



\---



\# Success Criteria



A user can:



1\. Clone the repository.

2\. Open the application.

3\. Drop any Markdown file.

4\. Instantly browse it as a presentation.



No configuration.



No preprocessing.



No AI.



Just Markdown → Slides.



\---



\# Guiding Principle



\*\*Markdown is the source of truth. Slides are simply another way to read it.\*\*



