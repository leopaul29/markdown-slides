---
name: session-wrap-up
description: Wrap up a Claude Code terminal session by capturing everything worth keeping before the terminal closes — runs the decision log, the lessons-learned summary, and the current-state snapshot in one pass. Use this at the end of a working session or before a handoff: when the user says "wrap up this session," "wrap this up," "close out," "let's wrap up before I stop," "end of session," "capture everything before I go," "do the session wrap-up," or invokes it as a slash command. This is the umbrella action that orchestrates session-to-decisions, session-to-lessons-learned, and session-to-current-state together, so the user gets all three durable records without asking for each individually.
---

# Session Wrap-Up

The end-of-session ritual for a Claude Code terminal session. It produces the three durable records that outlive the terminal, by running the three focused capture skills in sequence:

1. **`session-to-decisions`** — what was *decided* and why (appended to the decision log).
2. **`session-to-lessons-learned`** — what was *learned* that's reusable later (appended to the lessons file).
3. **`session-to-current-state`** — where the project *stands now* and what's next (overwrites the state snapshot).

Each of the three already knows how to do its own job well. This skill's only responsibility is to run all three against the current session, in the right order, and then report what was written — so wrapping up is one action instead of three.

## Why these three, in this order

The three records answer three different questions, and they don't overlap:
- **Decisions** = *why the project is the way it is* — the reasoning `git log` throws away. History that accumulates (append).
- **Lessons** = *what to carry to the next project* — reusable knowledge, stripped of this project's specifics. History that accumulates (append).
- **Current State** = *what's true right now* — a present-tense snapshot for whoever picks this up next. Replaces the previous snapshot.

Run them **decisions → lessons → current-state**. Decisions and lessons look *backward* over what happened; do them first, while the session's reasoning is freshest. Current-state looks at the *result* and should be written last, because "the decisions and lessons for this session were logged" is itself part of where things now stand.

## Process

1. **Review the session once, up front.** All three sub-skills begin by reviewing the whole session; do that reading a single time here — the actions taken (edits, `git` commits, commands, plan approvals), the user's confirmations, what was tried and reverted — and reuse that understanding across all three, rather than re-deriving it three times.
2. **Run the three skills in order**, each applied to the current session, using the Skill tool:
   - Invoke `session-to-decisions`.
   - Then invoke `session-to-lessons-learned`.
   - Then invoke `session-to-current-state`.
   Follow each sub-skill's own rules for output and file handling (append vs. overwrite, where the file lives, the empty-section honesty rule). Do not restate or duplicate their logic here — defer to them.
3. **Honor each skill's empty case.** If the session genuinely produced no decisions, no reusable lessons, or has a trivial state, let that skill say so in a line rather than padding it. A wrap-up where one of the three is "None this session" is a valid, honest wrap-up.
4. **Don't merge the three into one document.** They go to their own files (decision log, lessons file, state snapshot). Keeping them separate is the point — each is scannable on its own and has a different lifespan.
5. **Finish with a short consolidated report** to the user: one line per record naming what was captured and where it was written (e.g. "3 decisions → `docs/DECISIONS.md`", "state snapshot → `docs/CURRENT_STATE.md`"), so they can see the wrap-up landed without opening the files. This confirmation is the only prose this skill adds; the records themselves are produced by the sub-skills.

## Rules

- Always run all three sub-skills — a wrap-up that silently skips one is incomplete. If one has nothing to capture, run it anyway and let it report "None this session."
- Defer entirely to each sub-skill for its content, format, and file behavior; this skill orchestrates, it does not reimplement.
- Keep the three outputs in three separate files — never combine them into a single wrap-up document.
- Read the session once and share that understanding across all three; don't re-analyze from scratch per skill.
- End with a brief summary of what was written and where — nothing more.
