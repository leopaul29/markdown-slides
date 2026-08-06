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
