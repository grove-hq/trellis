# Trellis

## Why every codebase needs a trellis

We want coding agents (that are part of a [software factory](https://grovehq.com/blog/software-factory)) to have more and more autonomy, up to and including approving and merging PRs.

But some bugs are terrible. A route that ships without an auth check, or one tenant's data reaching another tenant, is a bug you can't afford even once. Telling an agent not to introduce one works most of the time, but most of the time isn't good enough for these kinds of bugs.

The way to avoid them is strong architectural patterns. If every route is built from one auth wrapper, and every query goes through one tenant-scoped client, then the bug is handled in one place, and any code that goes through that place is safe from it.

A pattern only protects you if all of the code follows it, and an agent trying to get a build to pass will go around a pattern when that is the shorter path. So you need something that enforces the patterns across the codebase: checks that fail the build when code goes around one, and a human who ratifies any change to those checks. That is Trellis. Everywhere else, the agents can get on with it.

### The analogy

A trellis is a frame that a plant grows along. The gardener doesn't place each shoot. They build the frame, and the plant fills it in at its own speed, in the shape the frame allows.

A codebase written by agents grows the same way. You can't inspect every line, but you can build the frame: a small set of files that decides the shape all the other code has to take, the code written last year and the code written next month.

## How Trellis achieves this

Trellis does two things.

**1. It makes the frame something only a human can change.** Certain files in the codebase form the frame: the lint rules, types, dependency rules and CI workflows that hold your architectural invariants. An agent can propose a change to a frame file like any other change. It can't land one until a human has ratified that exact change with proof of presence: a signature that takes the person's fingerprint, which an agent working with that person's credentials can't supply.

What goes into the frame is the smallest amount of code that holds the invariant. A small frame is one a human can actually read when asked to ratify a change to it, and it leaves everything outside it free for agents to change.

**2. It gives you utilities and patterns for the common things you want in a frame.** These are the ones we have needed to protect authentication, authorization and multi-tenancy:

- [Import fences](docs/patterns/import-fences.md): make one file the only way to reach a module.

> Trellis is being moved here from the codebase it grew up in. The import fences are here today. The frame check with human ratification, more patterns and the npm package follow.

## What Trellis does not do

Trellis only checks that a mechanism is present and reached the right way. It does not judge whether the mechanism is correct; that is up to you. Please, please don't assume you can adopt Trellis and your coding agents will produce secure code. Trellis helps you focus your attention where it is needed most, but the architectural patterns that make your coding agents produce the right code are unique to your codebase and your application. We have found that manual review and red teaming are still necessary to maintain your ever-evolving frames, which in turn maintain your ever-evolving codebase.

## License

Apache-2.0. See [LICENSE](LICENSE).
