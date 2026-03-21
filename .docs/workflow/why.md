# Why Night Shift

This file captures the motivation and operating philosophy behind the Night Shift workflow: humans do the thinking-heavy daytime work, and agents do the execution-heavy nighttime work.

## Core Idea

Human time, attention, and energy are scarce. Agent time and tokens are cheap. The workflow should preserve human control while minimizing babysitting, replanning, and prompt ping-pong.

The human should focus on one thing at a time: requirements, system design, and writing clear specs. The agent should take that prepared context and work through implementation autonomously.

## The Day Shift

During the day shift, the human does the work that benefits most from judgment: talking to people, understanding the problem, designing the system, and writing detailed specs.

AI can help, but only in narrow ways: concise information lookup and brief review of a plan for missing edge cases. The goal is not to outsource thinking. The goal is to sharpen the spec so the night shift can run with minimal intervention.

## The Night Shift

During the night shift, the agent should be able to pick up prepared work, load the relevant docs and code, write tests first, review its own plan critically, implement, validate aggressively, update docs, and leave behind a clean review trail.

The human should not need to read the agent's private planning or sit around steering it. If the workflow requires constant supervision, the docs, specs, or validations are not good enough yet.

## The Feedback Loop

The next morning, the human reviews what happened: changelog, commits, tests, docs, and manual behavior. If the agent made a bad decision, do not only fix the code. Improve the docs, workflow, specs, and validations that allowed the mistake, then fix the code.

That feedback loop is the point. Over time, the system should require less babysitting, catch more of its own mistakes, and produce work that is easier for a human to review. A human should not be spending mornings catching basic, obvious issues.
