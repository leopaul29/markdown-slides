# Notes on the "Markdown reader with multiple views" direction

Written after v1 shipped, in response to the ten proposed PRD changes. This is a review, not
a plan of record — the plan of record is [`ROADMAP.md`](../ROADMAP.md).

Short version: **the direction is right and I'd take it.** But roughly two thirds of the ten
points are naming and documentation (cheap, do them now, they cost nothing and they change
how the next contributor thinks), and one third is real architecture (worth doing, but worth
doing *with* the second view rather than before it). The one thing I would actively push
back on is building three new abstractions — View, Strategy, Renderer — while each has
exactly one implementation.

---

## Where the current code already agrees with you

Worth knowing before changing anything, because the refactor is smaller than it looks:

* `src/lib/slides.ts` contains **zero HTML knowledge**. It walks an mdast tree and produces a
  model of sections and parts. Point 5 ("the parser never knows about HTML") is already true.
* The model carries **AST nodes, not markup**. `Slide.nodes` is `RootContent[]`; HTML is
  produced later, per slide, by the renderer. A PDF or canvas renderer would consume the same
  nodes without touching the builder.
* The builder is **already parameterised** (`buildDeck(markdown, { maxWeight })`) and already
  **tested for determinism** — same input, same slide coordinates and text.
* Everything is **already read-only**. Nothing in the app can write to the source document.

So the engine/renderer split you want exists in substance. What is missing is the *naming*,
one public entry point, and the removal of three renderer-specific leaks listed below.

---

## The leaks that actually matter

> **Resolved in v2 (2026-08-08).** All three leaks below are closed and the naming collision
> with them: the model lives in `src/engine/model.ts` as `DocumentModel`, a section owns its
> segment indices instead of a `columns` list, `nodesToHtml` moved to `src/render/html.ts`, and
> `src/engine/boundary.test.ts` fails the build if the engine imports a renderer again. The
> table is kept as the statement of what was wrong.

These are the places where Reveal.js has shaped the model. They are the real work item, and
they are small:

| Leak | Where | Why it matters |
| --- | --- | --- |
| `Slide.h` / `Slide.v` | `src/lib/slides.ts` | These are Reveal's horizontal/vertical coordinates. They are redundant — `h` is the section index and `v` is `part - 1`. A Book view has no h/v. |
| `Deck.columns` | `src/lib/slides.ts` | "Columns" is a Reveal layout concept. The model concept is "a section and its parts". |
| `nodesToHtml` | `src/lib/markdown.ts` | HTML generation sits next to parsing. It belongs to the render layer; it is the one function a non-HTML renderer would not want. |

Fixing all three is maybe an hour, including tests. Do it whenever — it makes the model
honest and costs nothing today.

One naming collision to fix at the same time: `Deck` currently means both the document model
(`lib/slides.ts`) and the React component that renders it (`components/Deck.tsx`). That will
get confusing the moment a second view exists.

---

## Point by point

**1. Reposition as a reader with multiple views — agree.** Free, and it changes how every
later decision gets made. This is the highest-value item on the list precisely because it
costs nothing.

**2. Introduce the "View" concept — agree, with a caveat about layering.** The proposal
mixes three axes that are worth keeping separate:

* **Segmentation strategy** — how the AST is divided (by `#`, by fixed length, by decision
  block). This is a property of the *model*.
* **View** — what the reader sees and how they move through it (presentation, book, outline).
* **Renderer** — the output target (DOM, PDF, canvas).

They are not the same axis. A Book view and a Presentation view might use the *same*
segmentation and differ only in rendering and navigation. An outline view might use the same
rendering and differ only in segmentation. If you collapse all three into one "View" concept
you will end up with combinatorial classes; if you keep them separate you get three small
independent knobs. I would name the layers explicitly in the PRD, exactly as above.

**3. Rename Slide Builder → Presentation Strategy / Presentation Model — agree.** Pure
naming, do it now. I'd go slightly further and call the model layer neutral
(`DocumentModel`) with `PresentationModel` as the presentation-specific projection, so the
book view isn't forced to inherit presentation vocabulary.

**4. A `PresentationStrategy` interface — agree in principle, defer the interface.** The
interface itself is ten lines; the risk isn't cost, it's *guessing wrong*. With one
implementation you get an interface shaped exactly like that implementation, and the second
strategy then either contorts to fit or forces a rewrite — with the added cost of having a
published shape to migrate. My advice: write the second strategy first. `fixed-length` is
about thirty lines and reuses the existing `weightOf()` function. Once two exist, extract
the interface from what they genuinely share. That is a day's work in v2 and it produces an
abstraction that has been *validated* rather than *predicted*.

The "enormous `if`" you are avoiding is not yet a risk: the current builder has no strategy
branching at all.

**5. "The parser never knows about HTML" — strongly agree; already true.** Make it an
enforced rule, not a sentence in a document. A five-line test that asserts `lib/slides.ts`
never imports the render layer will hold the line better than any prose. Same for
determinism — there is already a determinism test; extend it to cover the model as a whole.

**6. Public `compile(markdown, options)` — agree, with one condition.** Excellent idea, near
zero cost (it is `buildDeck` with a better name and an exported type). The condition: don't
call it public until v2. A public API is a stability promise, and promising stability on a
shape derived from a single consumer is how you end up maintaining a bad shape. Ship it as
*the* entry point internally now, mark it experimental, freeze it when the book view has
proven it.

**7. Reveal is *a* renderer, not *the* renderer — agree, but do not build a `Renderer`
interface.** This is my main technical concern with the proposal. Reveal is not a thin
rendering layer; it supplies keyboard navigation, the overview grid, transitions, touch
handling, fullscreen and slide-state classes. A PDF renderer, a canvas renderer and a book
renderer share *none* of that. An interface across them would have exactly one method
(`take the model, produce output`) and would provide no leverage — the shared thing is the
model, not the interface.

There is also a cost to be aware of: the day the model stops being Reveal-shaped, someone has
to own navigation for the views that are not Reveal. That is real work, not a rename. Budget
for it in v2 rather than discovering it.

**8. A real roadmap — agree, done.** See `ROADMAP.md`. I put the engine extraction *inside*
v2 alongside Book View rather than in a v1.5 of its own, for the reason given under point 4.

**9. The determinism / read-only principle — strongly agree, best item on the list after
(1).** Two footnotes. First, make it executable (see point 5). Second, there is already one
deliberate exception worth documenting rather than hiding: `normalize()` repairs documents
whose Markdown punctuation was backslash-escaped by an exporter — as this repository's own
`PRD.md` is. It transforms the input in memory before parsing. It never touches the file and
it is deterministic, but "the model is a pure function of the source bytes" is not literally
true, and a principle with an undocumented exception erodes fast.

**10. Mission statement — agree.** Costs nothing, and it is the sentence that will decide
future feature arguments.

---

## On the name

> **Resolved 2026-08-03: renamed to Markdown Reader.** The section below is kept as the
> reasoning that led there; "Markdown Slides" was the name at the time of writing.


My honest read: **rename now or accept the name for good.** The cost curve is steep and you
are at its cheapest point — one implementation commit, no users, no npm package, no domain,
no Pages URL in circulation, no inbound links. In six months a rename means the repo URL, the
Pages URL, the package name, every link anyone has shared, and whatever search presence has
accumulated.

The argument *for* keeping it: "Markdown Slides" is concrete, searchable, and describes
exactly what the tool does today. Products that do one nameable thing tend to get adopted
faster than products that describe a category. If the multi-view ambition is genuine, the
name will constrain you; if it turns out that presentation mode is the thing people actually
use and the other views never ship, the name will have been right.

So the question is not "is the name too narrow" — it is "how confident are you that Book View
ships". If the answer is "confident", rename this week. If it is "we'll see", keep the name
and keep the *architecture* open, which costs nothing either way. Whatever you pick, avoid a
generic "markdown reader"-style name: it is unsearchable and it describes a category rather
than a product.

---

## What I would actually do, in order

| When | Item | Effort |
| --- | --- | --- |
| Now | Reposition the PRD (points 1, 3, 10) and adopt the three-layer vocabulary from point 2 | ~1 h, no code |
| Now | Remove the `h`/`v` and `columns` leaks; move `nodesToHtml` into the render layer; rename the model `Deck` | ~1 h + tests |
| Now | Make determinism and the engine/render boundary into tests | ~30 min |
| Now | Introduce `compile()` as the single entry point, marked experimental | ~30 min |
| Now | Decide the name | — |
| v2 | Write the second strategy (`fixed-length`), *then* extract the strategy interface from the two | ~1 day |
| v2 | Book View, and with it the navigation work Reveal currently does for free | several days |
| v2 | Freeze `compile()` as the public API | — |
| Later | Renderer targets (PDF, canvas), plugin API | — |

The first block is a few hours and is entirely reversible. The second block is where the
architecture actually gets proven, and it wants a real second view to prove it against.

> **What actually happened (v2).** The order held, with one change: rather than `fixed-length`
> alone, three strategies were written before any interface was extracted, and what they shared
> turned out to be two helper functions rather than a pipeline. The Book View cost the navigation
> work this document predicted — lazy rendering with placeholder heights, scroll anchoring, and
> position reporting — and none of it needed a `Renderer` interface. `compile()` is the entry
> point and is still marked experimental; freezing it waits for the Outline view.

---

## Two risks worth naming

**Multiplied surface area.** Search, table of contents, position state, theming and keyboard
handling currently exist once. With three views they either get abstracted (work) or
duplicated (rot). Cross-view position state in particular — "I was here in Presentation, put
me here in Book" — is a genuine design problem, not a detail. Worth deciding before Book View
starts, not during.

**Abstraction ahead of demand.** Three interfaces with one implementation each is the classic
way to make a small tool slow to change. The v1 code is deliberately direct: one builder, one
renderer, no indirection. That directness is why the whole engine fits in four small files
and why a 12,000-line document renders in under two seconds. Keep the *seams* clean — model
free of renderer concepts, one entry point, no HTML in the parser — and let the second
implementation of each thing tell you what the interface should be.
