# Authentication

No request reaches a handler without an authenticated caller, unless its route is on the public list.

## The architectural pattern

Put one gate in front of every route: a proxy or middleware that verifies the caller's credential and refuses the request when there isn't a valid one. The routes that anyone may call (the login page, a health check) are an explicit list in one file.

Handlers do not each decide whether to authenticate. A new route is authenticated because it exists, with nothing to remember.

The pattern fails in three ways:

- A route is served that the gate does not sit in front of.
- A route is added to the public list to make a test pass.
- The gate itself is edited to let something through.

## Enforcing it

This uses a technique you will see in other patterns too: **refuse by default, with one list of exceptions**.

1. Put the gate and the public list in the frame. An ordinary new route needs no human, because the gate already covers it. Making a route public, or changing how the gate verifies a caller, does.
2. Check that the gate covers every route. After the build, compare the routes your framework serves with the paths the gate matches, and fail on any route it misses. This check is specific to your framework, so you write it; it belongs in the frame too.
3. Test the gate as a function: a request with no credential to a path that is not public is refused.

The frame here is three small things: the gate, the public list and the coverage check. Every route handler, the ones that exist and the ones an agent writes next month, sits outside it.

## What this does not cover

- Whether the gate verifies credentials correctly. That is review and testing.
- What an authenticated caller is allowed to do. That is authorization.
- Entry points the gate is not in front of: a background job, a queue consumer, a second server.
