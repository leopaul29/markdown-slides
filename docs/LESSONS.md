# Lessons Learned

## 2026-08-03

## What Worked

- Driving the real app in a headless browser after every change caught two bugs that no unit
  test would have: a framework re-render wiping DOM mutations, and a CSS reset silently
  disabling bold, italic and list markers. Build the browser harness early; it pays for itself
  the first time it runs.
- Measuring a claimed performance problem before accepting its severity. A "Major performance"
  finding turned out to be ~2 ms on a 12,800-line document. Take the change if it's strictly
  better and small, but report the measured number rather than repeating the label.
- Generating a synthetic document an order of magnitude past the stated target and testing
  against it. "Supports 10k lines" is a claim until something renders 12,798 of them.
- Lazily converting content to HTML only within a small window of the current position. 1,040
  slides render with 3 bodies materialized and ~13k DOM nodes; navigation stays instant.
- Writing an invariant as a test rather than as a sentence in a doc. "Code blocks never split"
  and "the same document always produces the same output" are enforced, not asserted.
- Instrumenting rather than theorizing when a framework behaves unexpectedly. Patching the
  `innerHTML` setter to log stack traces answered in one run a question that several rounds of
  reasoning from first principles had gotten wrong.

## What Did Not Work

- Assuming "raw HTML is dropped" equals "untrusted input is safe". Markdown links are not raw
  HTML: `[click](javascript:…)` passes straight through a mdast → hast pipeline. Any renderer
  that writes generated markup into the DOM needs a URL scheme allow-list as a separate step.
- Trusting that a framework skips DOM work when a prop value is unchanged. React 19 re-sets
  `dangerouslySetInnerHTML` on every render even when the HTML string is byte-identical.
- Applying a review suggestion literally without re-testing the behaviour it touches. Guarding
  focus-restore on "focus is still inside the dialog" disabled restore entirely, because the
  framework detaches the dialog before passive effect cleanup runs.
- Writing an assertion that greps rendered output for a dangerous substring. The test failed on
  safe output because the payload appeared as escaped literal text; assert on the structure
  that matters (`href` values) instead of raw string containment.
- Running `pkill -f "<pattern>"` from a shell whose own command line contains that pattern —
  it matches itself and kills the command mid-run.

## Surprises

- Eric Meyer's CSS reset, shipped inside Reveal.js, applies `font: inherit` to every inline
  element and `list-style: none` to lists. Any component library bundling a global reset can
  silently disable `<strong>`, `<em>` and list markers in content you render inside it.
- `offsetParent` is `null` for fixed-position elements, so the common "is it visible" test in a
  focus trap silently drops them from the Tab cycle. `getClientRects().length > 0` is correct.
- hast stores `srcset` as an array of candidate strings, not a string — a `typeof === 'string'`
  guard over URL attributes skips it entirely and reports success.
- A CommonMark link destination containing a tab is not parsed as a link at all, which makes
  some "control character evasion" payloads render as harmless literal text.
- Exported Markdown in the wild can arrive with every punctuation mark backslash-escaped,
  which destroys the entire heading structure. Worth detecting rather than rendering as one
  giant block.

## Reusable Insights

- Sanitize at the layer that produces markup, not at the layer that decorates it. One check in
  the render pipeline covers every consumer; a check in a DOM post-processing pass covers only
  the path that happens to run it.
- When a framework owns a DOM property, treat everything inside it as transient. To keep your
  own DOM mutations, hand the framework a childless element and manage its contents yourself.
- An interface derived from one implementation is a guess; an interface extracted from two is
  a design. When asked to add an abstraction layer for future flexibility, write the second
  implementation first, then extract what they genuinely share.
- Before agreeing to a "swap the backend" abstraction, count what the current one actually
  provides. If the incumbent supplies keyboard handling, transitions, overview and touch that
  no alternative shares, the useful seam is the data model, not a common interface.
- Rename while the cost is near zero. Repo URL, package name, deploy URL and inbound links all
  price a rename higher every week; the cheapest moment is before anything is published.
- Automated reviewers are worth reading closely and worth verifying individually. In one round:
  one critical finding was real and remotely exploitable, several were correct-but-minor, one
  was unreachable dead code, and one severity label was off by an order of magnitude.
- State an exception to a stated principle explicitly in the docs. An undocumented exception
  erodes the principle faster than the exception itself costs.

## Future Improvements

- Add a browser-driven smoke test to CI, not just unit tests — the two most serious defects in
  this session were only observable in a rendered page.
- When adding a queued/deferred action (replay after async init), write the teardown path in
  the same edit. A queue that outlives its owner replays into the wrong context.
- Check `document.activeElement` semantics against the framework's unmount ordering before
  writing focus-restore logic; passive cleanup runs after detach, when focus has already
  fallen back to `<body>`.
- Keep a scratch harness that loads a hostile document (unsafe schemes, embedded script, huge
  code blocks) and assert on it after any change to the render pipeline.

---

## 2026-08-08

## What Worked

- Auditing every exported symbol against its call sites before trusting that it is load-bearing.
  One pass of "grep this name, count the hits that are not the definition" found a model field, a
  result field, a type union and two exports that existed only for a test or for nobody.
- Checking whether a dependency is *used*, not just installed. Grepping for utility classes and
  framework directives — rather than for the import — is what showed a CSS framework contributing
  nothing but its reset.
- Deriving redundant state at the boundary that needs it instead of storing it. Asking "what
  already determines this value?" turned two model fields into one four-line helper in the file
  that talks to the renderer.
- Running a tool's installer from its local plugin cache instead of piping a remote script into an
  interpreter. Same script, no fetch-and-execute.
- Using an installer's `--dry-run` before letting it write, and reading the "0 overwritten" line
  as the go-ahead.

## What Did Not Work

- Writing a long prose document through a shell heredoc. Apostrophes inside the body broke the
  outer quoting and the whole append failed; a file-writing tool has none of that surface.
- Ignoring an agent-config directory wholesale. The same directory holds both personal settings
  and project-shared workflow files, so a directory-level rule is always wrong in one direction —
  it needs to name the files, not the folder.

## Surprises

- A strict, non-flat `node_modules` (pnpm) breaks type-only imports that a flat one silently
  satisfied. Types that arrived transitively through a parser library stopped resolving and had to
  become explicit devDependencies — the migration cost is proportional to how much the project was
  relying on hoisting.
- A `<dialog>` styled with a bare `display: flex` is permanently visible: the rule overrides the
  user-agent's `display: none`, so modal display rules must be scoped to `[open]`.
- Deleting a project's plugin settings file also silently disables the plugins for that project.
  The setting has to be *relocated* to user level, not removed.
- A CSS framework can be fully installed, imported and building, with literally zero of its
  utilities in the codebase.

## Reusable Insights

- Separate personal-style agent configuration from project-workflow agent configuration. Style
  rules (how prose reads, how reviews are worded) belong in the user's own config; workflow skills
  that encode where a project keeps its records belong in the repository. "Agent config in or out
  of git" is the wrong question.
- Redundant fields in a data model are a coupling claim, not just duplication. Coordinates named
  after one renderer's axes assert that every future consumer has those axes. Derive them where
  the renderer is, and the model stops making the claim.
- A tree whose rendering is flat is not a tree. Delete the nesting and let the view that actually
  wants hierarchy rebuild it from the level field.
- Before deleting a dependency, list what it silently provides beyond its headline feature. A CSS
  framework also ships a reset; dropping it means owning the handful of rules that were doing real
  work.
- When cutting a field the UI never reads, check the test suite first. If a test uses it as its
  probe, either keep the field or strengthen the assertion in the same edit — otherwise the
  cleanup quietly weakens the suite.
- Native platform elements have usually absorbed the behaviour a hand-built component is
  reimplementing. A modal with no interactive content needs no custom focus trap.
- Prefer one pinned declaration of a tool's version that every consumer reads (a `packageManager`
  field the CI action also honours) over the same version repeated in setup steps.

## Future Improvements

- After removing a styling framework or swapping a component onto a platform primitive, drive the
  app in a browser before reporting it done. Type-check, unit tests and a green build say nothing
  about whether the page still looks right.
- When narrowing a `.gitignore` rule, run `git check-ignore -v` against a file you intend to keep.
  It answers "which rule is eating this?" directly instead of by inspection.
- Prefer an editor tool over shell redirection for any multi-paragraph text; reserve the shell for
  commands whose output you need.
