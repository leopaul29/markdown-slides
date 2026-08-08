---
name: session-to-lessons-learned
description: Extract a lessons-learned summary from a Claude Code terminal session — reusable knowledge from the work that would still matter in six months, distinct from a decision log (session-to-decisions) or a current-state snapshot (session-to-current-state). Use this when wrapping up a session: when the user asks what they learned, wants a retro or postmortem of the work, asks "what worked and what didn't," wants to capture takeaways, or wants to turn the session into reusable insight for future projects. Trigger on phrases like "what did we learn," "lessons learned," "pull the takeaways from this session," "retro this," or "what should I remember for next time" — even without the exact phrase "lessons learned."
---

# Session → Lessons Learned

Turns a Claude Code terminal session into a lessons-learned summary: the reusable knowledge worth carrying forward, stripped of the project-specific details that won't matter once this particular effort is over. Meant to be run when **wrapping up a session**.

## Why this matters

The test for whether something belongs here is simple: would it still be useful in six months, on a different project? A session is full of detail that mattered in the moment but has no shelf life — which file had the bug, which line the typo was on, the exact command that finally worked. None of that is a lesson. A lesson is the pattern underneath: "MV3 alarms set from a page don't survive a browser restart, so re-register them on `onStartup`" is reusable; "the reminder didn't fire on my machine" is not, until it's generalized into that rule.

Coding sessions are a rich source of lessons precisely because things get *tried* against a real system — approaches that failed, errors the environment threw, tools that behaved unexpectedly, an assumption the code proved wrong. The most valuable lessons are usually the ones you paid for: a gotcha that cost twenty minutes of debugging is worth one durable sentence so it costs zero minutes next time. But keep the lesson, not the incident — generalize the specific failure into the rule it teaches.

This is a summary of learning, not a summary of events. Resist the pull to narrate the session in order — a lessons-learned doc that reads like a play-by-play of what happened is usually one that hasn't distilled anything yet.

## Process

1. **Review the whole session first.** Lessons often only become visible in hindsight — something that looked like a minor detour early might turn out, by the end, to be the most important insight. Mine the failures especially: reverted approaches, errors hit, retries, and moments where an assumption turned out wrong.
2. **For each candidate lesson, ask: would this still be useful in six months, possibly on a different project?** If no, it's project-specific detail or implementation noise, not a lesson — leave it out.
3. **Ignore:**
   - Temporary details specific to this exact task, file, day, or tool version.
   - Implementation noise — individual debugging steps, back-and-forth that led nowhere.
   - Repeated points — keep a lesson once, in its strongest form.
4. **Distill, don't narrate.** Convert "we tried X, it errored, then Y worked" into the underlying insight — stated as a standalone fact someone could apply without knowing the backstory.
5. **Keep insights actionable.** A good Reusable Insight or Future Improvement tells the reader what to do differently, not just what happened. Prefer "verify a token with a real API call, not a regex" over "the regex check wasn't enough."
6. **If a category genuinely has nothing to report** (no surprises came up, say), keep it short and honest — "None noted" beats manufacturing a surprise that wasn't there.

## Output

Produce the summary in the Markdown template below — the summary itself is the response, no preamble or closing commentary.

When wrapping a session, prefer to **append it to the project's lessons file** if one exists (commonly `docs/LESSONS.md`, `LESSONS_LEARNED.md`, or a retro doc), so insights accumulate over time; de-duplicate against lessons already recorded rather than repeating them. If no such file exists, print the summary to the terminal and offer to create one. Never overwrite existing lessons — append.

```markdown
# Lessons Learned

## What Worked
Approaches that succeeded, stated as reusable practice.

## What Did Not Work
Mistakes and failed approaches, stated as what to avoid.

## Surprises
Unexpected findings (environment quirks, tool behavior, wrong assumptions).

## Reusable Insights
Knowledge applicable on other projects.

## Future Improvements
Concrete things to do differently next time.
```

## Rules

- Focus on learning — every line should be a lesson, not an event.
- Avoid storytelling — no chronological narration of what happened.
- Keep insights actionable — favor concrete guidance over vague observation.
- Append to existing lessons; never overwrite, and don't re-log a lesson already captured.
- Return Markdown only, using the exact section structure above.
