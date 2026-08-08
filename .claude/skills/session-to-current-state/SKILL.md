---
name: session-to-current-state
description: Produce a current-state snapshot of a project from a Claude Code terminal session — where things stand right now, not a history of how they got there. Distinct from a decision log (session-to-decisions) or a lessons-learned summary (session-to-lessons-learned). Use this when wrapping up a session or handing off: when the user asks "where are we at," wants a status update, a project snapshot, a handoff summary, "what's the current state," "what's left," or wants to catch up their next session (or a teammate) without re-reading the whole session. Trigger on phrases like "give me the current state," "summarize where this stands," "status snapshot," "what's left to do," "update the state doc," or "catch me up before I stop" — even without the word "state" appearing explicitly.
---

# Session → Current State

Turns a Claude Code terminal session into a current-state snapshot: a single, present-tense picture of where the project stands right now — useful for a handoff, a status check, or picking the work back up in a later session. Meant to be run when **wrapping up a session**.

## Why this matters

A session accumulates history — early plans that got superseded, problems that were solved and are no longer relevant, approaches tried and reverted before landing somewhere. None of that history is the point of this document. The point is: if someone (including your next session) read only this snapshot, would they know exactly what's true about the project *right now* and what to do next? Anything that doesn't serve that — the path that led here, abandoned approaches, resolved errors — is noise for this purpose, even if it matters for a decision log or a lessons-learned doc.

A session has something a plain conversation doesn't: **the repository is ground truth.** What was committed, what's still uncommitted in the working tree, whether the tests actually pass, what's left as a TODO — these are checkable facts, not recollections. The snapshot must reconcile what the session *said* with what the repo *shows*; when they disagree, the repo wins. "Done" means committed and verified, not "we wrote it and assumed it worked."

This is the difference between a snapshot and a history. A history explains how you got here. A snapshot tells you where "here" is.

## Process

1. **Review the whole session first, then check the actual repo state.** Determine the *latest* known state for each area, and corroborate it against reality — run or recall `git status` / `git log`, note uncommitted changes, and check whether the test/build state is actually green or was left failing. Later information supersedes earlier; a blocker raised early and resolved later is resolved.
2. **Ignore historical detail that no longer matters**, including:
   - Approaches tried and abandoned (unless the reason they were abandoned is a live blocker or risk).
   - Errors and problems already resolved.
   - Superseded plans or objectives that have since changed.
3. **Distinguish "Completed" from "In Progress" using the repo, not the narrative.** Completed = landed (committed) and verified, not expected to need more work. In Progress = actively mid-change right now — uncommitted edits, a half-done refactor, a feature with failing tests. If it isn't clearly finished, treat it as In Progress rather than guessing.
4. **Blockers vs. Risks:** a Blocker is actively stopping progress right now (failing build, unanswered decision, missing credential); a Risk is a concern that could bite later but isn't stopping anything yet. Don't conflate them.
5. **Next Actions should be prioritized and concrete** — the specific next steps implied by the current state (e.g. "commit the staged changes," "run the suite to confirm B2," "push branch and open PR"), not a restatement of the objective. Preserve any order or urgency the session established.
6. **If a section has nothing to report** (no blockers, say), keep it brief and honest — "None noted" beats inventing a plausible-sounding blocker.

## Output

Produce the snapshot in the Markdown template below — the snapshot itself is the response, no preamble or closing commentary.

When wrapping a session, prefer to **write it to the project's state file** if one exists (commonly `docs/CURRENT_STATE.md`, `CURRENT_STATE.md`, or a `STATUS.md`). Unlike a decision log, a current-state snapshot is a *replace*, not an append — it describes the present, so overwrite the file's body with the fresh snapshot. If no such file exists, print it to the terminal and offer to create one.

```markdown
# Current State

## Objective
Current project objective.

## Status
Current progress.

## Completed
What is landed and verified.

## In Progress
What is actively mid-change right now.

## Blockers
What is actively stopping progress.

## Risks
Concerns that could bite later.

## Next Actions
Prioritized, concrete next steps.
```

## Rules

- Describe the present state only — no history, no chronology, no "we used to think."
- Reconcile against the repo; when the narrative and the working tree disagree, the repo wins.
- Be concise — this is a snapshot to scan quickly, not a report to read end to end.
- Prefer actionable specifics, especially in Next Actions.
- Overwrite the state file's body with the current snapshot; don't accumulate stale snapshots.
- Return Markdown only, using the exact section structure above.
