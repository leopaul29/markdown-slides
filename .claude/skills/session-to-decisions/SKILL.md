---
name: session-to-decisions
description: Extract a decision log from a Claude Code terminal session — a running record of the technical and process decisions that were actually made and acted on during the session, why each option won, and what it changes. Use this when wrapping up a session: when the user asks to log what was decided, "what did we decide," "capture the decisions before I close out," "log the decisions from this session," "decision history," "update the decision log," or wants to turn the session's work into a durable record of accepted choices (as distinct from a summary of everything that happened). Trigger on end-of-session phrases like "wrap this up," "log the decisions," "what did we actually settle on," or "record what we chose and why" — even without the word "decision" appearing explicitly.
---

# Session → Decisions

Turns a Claude Code terminal session into a decision log: a chronological record of the decisions that were actually made and acted on during the session — the context that made each one necessary, why that option won, and what it's expected to change. Meant to be run when **wrapping up a session**, so the reasoning behind the work survives after the terminal closes.

## Why this matters

A coding session mixes decisions in with everything that didn't become one — approaches floated and dropped, alternatives compared and rejected, code tried in a branch and reverted, speculative "what if we…" tangents. A decision log is only useful if it's strict about that line: it should contain the choices that were actually accepted and implemented, not the full space of things that were explored. A log that records a reverted approach or a rejected alternative as if it were a decision is worse than no log at all, because it misleads whoever later trusts it to understand what's actually true about the project.

The session is unusual in that many decisions are **implemented directly** — you can see them in the edits, commits, and config changes, not just in the discussion. But the diff and the commit history only preserve *what* changed, never *why*. "Switched the service worker to ES modules" is visible in the diff; "switched to ES modules because the `importScripts` + dual-global export pattern silently breaks in the worker scope and made symbol visibility order-dependent" is the reason someone reads a decision log instead of `git log`. Preserve that reasoning — it is the whole point of the document.

Decisions in a session come from two sources, and both count: choices the **user** directed ("delete the stale docs"), and consequential technical choices **you made autonomously and the user accepted** ("named the new module `github-api.js`, mapped errors into network/auth/other classes"). Log the consequential ones from either source; skip trivial mechanical steps that no one would need to revisit.

## Process

1. **Review the whole session first**, rather than logging decisions as you hit them. Sessions revisit and revise earlier positions — the real decision is usually the final state, not the first thing that sounded settled. Look across user prompts, the actions actually taken (edits, `git` commits, commands run, plan-mode approvals), and any explicit confirmations.
2. **Identify only decisions that were accepted and acted on.** A decision is something the session treated as settled and moved past — evidenced by an edit/commit/config change that landed, or by the user explicitly confirming a choice. Something still being weighed when the session ends is not a decision yet.
3. **For each candidate, discard it if it's actually one of these instead:**
   - A suggestion or option raised but never acted on.
   - An alternative that was considered and explicitly not chosen (the decision is the option that *was* chosen — a rejected alternative can be named briefly under Reasoning if it explains why the winner won, but it doesn't get its own entry).
   - An approach that was attempted and then reverted or abandoned (unless the *reversal itself* was the deliberate decision, in which case log the reversal).
   - A speculative or hypothetical thread that never resolved into a commitment.
4. **If the session revisits the same decision more than once**, log the final version only — don't create duplicate entries for one underlying choice.
5. **When context, reasoning, or consequences genuinely weren't established** for a real decision, keep that section brief and honest rather than inventing plausible-sounding justification. A short "Not discussed explicitly" is better than fabricated rationale.
6. **Use the session's date** (today's date, which the terminal knows) for the date heading. If the work clearly spanned known prior dates, attribute each decision to when it was made; otherwise use the current date. Don't invent finer-grained timing than you have.
7. **If the session made no consequential decisions** (e.g. it was pure exploration, a bug hunt with no design choices, or trivial mechanical edits), say so in one line rather than manufacturing entries.

## Output

Produce the decision log in the Markdown structure below — the log itself is the response, with no preamble or closing commentary.

When wrapping a session, prefer to **append it to the project's decision log** if one exists (commonly `docs/DECISIONS.md`, `DECISIONS.md`, or an `docs/decisions/` / ADR directory), preserving chronological order and not duplicating decisions already recorded there. If no such file exists, print the log to the terminal and offer to create one. Never overwrite existing decision history — append.

Repeat the `## YYYY-MM-DD` / `### Decision` / `### Context` / `### Reasoning` / `### Consequences` block once per decision, grouping same-day decisions under one date heading:

```markdown
# Decisions

## YYYY-MM-DD

### Decision
Description.

### Context
Why the decision was needed.

### Reasoning
Why this option was selected (name the rejected alternative here if it explains the choice).

### Consequences
Expected impact.
```

## Rules

- One decision per section — don't merge multiple distinct decisions into a single entry, even if they're related.
- Preserve rationale — the Reasoning section is the point of the document; don't compress it away, and don't settle for what the diff already shows.
- A decision must have been acted on or explicitly confirmed — an unresolved thread or an abandoned approach is not a decision.
- Append to existing decision history; never overwrite it, and never re-log a decision already recorded.
- Return the Markdown log using the exact structure above.
