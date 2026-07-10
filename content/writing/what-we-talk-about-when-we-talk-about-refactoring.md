---
title: What We Talk About When We Talk About Refactoring
description: Refactoring becomes avoidance when structural change substitutes for naming the real constraint, making the hard decision, or investigating behavior.
publishDate: 2026-07-11
tags:
  - refactoring
  - engineering
  - decision-making
featured: true
draft: false
---

Refactoring is not always an act of engineering discipline. Sometimes it is an avoidance strategy.

A team faces a difficult problem: unclear ownership, contradictory requirements, poorly understood behavior, or an architectural decision nobody wants to make. Instead of resolving that problem, the team decides to “refactor the module.”

The code changes. Files move. Interfaces appear. Functions become smaller. Tests improve. The pull request is large enough to demonstrate progress.

But the original problem remains.

This is what makes refactoring such an effective form of avoidance. It is legitimate work. It produces visible output. Almost every individual change can be justified. Yet the project may be no closer to resolving its actual constraint.

The problem is not refactoring.

The problem is what refactoring is being used instead of.

## Good Refactoring Follows a Decision

Useful refactoring usually begins with a concrete constraint.

A parser must support streaming input, but its current design requires the entire file to remain in memory. A new payment provider requires changes across seven unrelated modules. A performance trace shows that lock contention dominates request latency.

In each case, the problem is known. The relevant constraint is understood. Refactoring is then used to make a specific change safer, more local, or more efficient.

The sequence is:

> Known problem → explicit constraint → structural change

Avoidance refactoring reverses this relationship.

The team does not yet understand the problem, so it changes the structure in the hope that clarity will emerge:

> Unclear problem → broad structural change → expected clarity

Sometimes restructuring does reveal useful information. But without a specific question, a bounded scope, and a stopping condition, “exploration” easily becomes indefinite redesign.

A useful distinction is:

> **Good refactoring follows a decision. Avoidance refactoring postpones the decision.**

Before reorganizing the code, the team may need to decide:

* which behavior is correct;
* which compatibility requirements still matter;
* which module owns a piece of state;
* which failure modes are acceptable;
* which abstraction should not exist;
* which product behavior should be removed rather than generalized.

These are not primarily coding questions. Code cannot resolve them on its own.

## Refactoring Can Hide Semantic Uncertainty

Engineers often respond to complexity by introducing abstraction.

When several components look similar, we create a common interface. When several workflows overlap, we unify them behind one state machine. When multiple implementations share code, we extract a framework.

This can be good design. It can also conceal the fact that the underlying concepts do not share the same semantics.

Suppose several storage systems are placed behind a single `StorageBackend` interface. Their method names may be similar, but their guarantees may differ substantially:

* atomicity;
* consistency;
* durability;
* overwrite behavior;
* retry safety;
* failure recovery.

The hard question is not how to design a cleaner interface. It is whether these systems actually satisfy the same behavioral contract.

If the team has not answered that question, the abstraction does not remove complexity. It merely moves complexity behind a cleaner surface.

The same problem appears in business logic. Three workflows may contain duplicated code because the organization has not decided whether their differences are intentional. Combining them before resolving that ambiguity often produces one highly configurable workflow with more flags, branches, and exceptional states.

The code becomes unified. The meaning does not.

A structural solution cannot compensate for unresolved semantics.

## Refactoring Can Replace Investigation

Refactoring is also attractive when the real work is uncertain or uncomfortable.

A system is slow, so the team proposes a service decomposition, a new cache, an event-driven architecture, or a rewrite in another language.

But the basic questions remain unanswered:

* Where is the time actually being spent?
* Which request path causes the tail latency?
* Is the bottleneck CPU, I/O, locking, networking, or a database query?
* Can the problem be reproduced?
* Does the current architecture prevent a local fix?

Architecture is often more emotionally satisfying than measurement.

Architecture creates diagrams, boundaries, and a sense of control. Measurement may reveal that the grand architectural problem is a missing index, an accidental serialization point, or one badly designed request.

The same dynamic appears in legacy code. An engineer encounters unfamiliar behavior and decides to clean up the surrounding module before making the required change.

The cleanup may be reasonable. But it may also be a way of postponing the riskier task: understanding the existing behavior well enough to modify it safely.

Renaming variables and extracting functions can make code look familiar. They do not necessarily make its hidden contracts better understood.

Before changing structure, the more valuable work may be to add characterization tests, inspect production traces, document state transitions, or make one minimal behavioral change that tests a concrete hypothesis.

## Productive Procrastination

Avoidance refactoring rarely looks like inactivity.

It looks productive.

Commits are merged. Test coverage rises. Modules become smaller. Naming becomes more consistent. Design documents become more polished.

Every local change appears defensible.

Yet the feature is still not shipped. The performance problem is still not measured. Ownership is still unclear. The product decision is still unresolved.

This is **productive procrastination**: doing valuable-looking work in order to avoid the most important work.

It is especially dangerous because the work may genuinely improve the code. The issue is not that nothing useful happened. The issue is opportunity cost.

A cleaner internal structure may still be the wrong priority if the project’s actual blocker is a product decision, an operational constraint, or an unanswered question about system behavior.

Local improvement is not the same as project progress.

## Why Engineers Reach for Refactoring

Refactoring offers three things that ambiguous problems do not.

First, it offers control.

Cross-team ownership, product semantics, and architectural trade-offs require negotiation. Code is often the part of the problem an engineer can directly change.

When we cannot control the problem, we control the code.

Second, refactoring offers visible progress.

A difficult decision may produce only one sentence:

> We will no longer support this behavior.

That decision may simplify the system more than thousands of lines of restructuring, but it is harder to represent as engineering output.

Refactoring produces diffs, pull requests, review comments, and measurable activity.

Third, refactoring offers clearer completion criteria.

Ambiguous problems create anxiety. A function can be extracted. A directory can be reorganized. An interface can be introduced. These tasks have obvious endpoints, even when the broader problem does not.

> **Ambiguous problems produce anxiety. Refactoring produces diffs.**

This does not make engineers irrational. It makes refactoring psychologically and organizationally convenient.

## A Better Test for Refactoring

Before beginning a substantial refactor, the team should be able to answer a few direct questions.

### What specific constraint will this refactor remove?

“Technical debt” and “messy code” are not specific enough.

A stronger answer looks like this:

> Adding a new backend currently requires changes in six modules because protocol handling, state management, and retry policy are coupled.

That statement identifies a concrete constraint and suggests a boundary for the work.

### What becomes possible after the refactor?

The answer should describe a capability, not merely a code-quality improvement.

For example:

* a feature can be implemented locally;
* a subsystem can be tested independently;
* a known latency target can be reached;
* a failure can be isolated;
* a deprecated behavior can be removed;
* a migration can proceed incrementally.

### What decision has already been made?

A refactor built on unresolved semantics is likely to become unstable.

The team should know which behavior is authoritative, which differences must remain, who owns the state, and which compatibility requirements still apply.

### How will we know when to stop?

“Make the architecture clean” has no natural endpoint.

A bounded objective does:

> Stop when the new provider can be implemented without modifying the checkout state machine.

### Is there a smaller experiment?

Before restructuring an entire subsystem, the team may be able to extract one boundary, migrate one caller, instrument one request path, or test one alternative representation.

Small experiments separate justified design changes from architectural intuition.

One especially useful question is:

> **If we remove the word “refactor,” what is the actual objective?**

“Refactor the payment system” is vague.

“Make duplicate callbacks idempotent” is actionable.

“Refactor the scheduler” is vague.

“Allow one scheduling policy to be tested without initializing the device runtime” is actionable.

If the objective cannot be stated without using the word *refactor*, the work probably lacks a sufficiently clear problem definition.

## Refactor Only as Far as Necessary

The goal of refactoring should not be to make the system conform to an ideal architecture.

Ideal architectures have no stable endpoint. There is always another abstraction to improve, another dependency to invert, another interface to generalize, or another naming inconsistency to remove.

A more disciplined objective is:

> **Refactor until the identified change becomes safe, local, and verifiable. Then stop.**

This connects structural work to an actual engineering outcome.

Exploratory refactoring still has a place. Restructuring code can help expose dependencies, make implicit state visible, or test a possible boundary.

But exploratory refactoring should be:

* small;
* reversible;
* attached to a specific question;
* limited by a stopping condition.

Without those constraints, exploration becomes open-ended redesign.

## The Real Measure of Progress

Refactoring is one of the most valuable tools in software engineering. That is precisely why it can become such a convincing form of avoidance.

It looks responsible. It produces visible progress. It improves local code quality. It can almost always be defended in isolation.

But the correct measure is not whether the code became cleaner.

The correct measure is whether the project moved closer to resolving its real constraint.

Did the team make the difficult decision?

Did it clarify the system’s behavior?

Did it remove an actual blocker?

Did it reduce a measured risk?

Did it make delivery possible?

Or did it merely rearrange the code around a problem that nobody has yet named?

> **Refactor after you name the problem—not instead of naming it.**
