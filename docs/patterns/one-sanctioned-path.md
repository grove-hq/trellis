# One sanctioned path

Something powerful is reached only through the wrapper that makes it safe.

## The architectural pattern

A database driver will run any query for any tenant. So you write one module that wraps it and scopes every query to the caller's tenant, and the rest of the codebase uses that module. The same shape fits a secrets reader, a token issuer, or a raw query builder.

The pattern fails when some file imports the driver directly. Nothing looks wrong in that file, and its queries are not scoped.

## Enforcing it

1. Fence the driver with an [import fence](../utilities/import-fences.md), allowlisting only the wrapper.
2. Put the ESLint config that declares the fence in the frame, so adding a file to the allowlist needs a human.
3. Put the wrapper in the frame too if its scoping logic is short enough to read on every change.

A new file that imports the driver now fails lint, and the message tells the agent to use the wrapper.

## What this does not cover

- Whether the wrapper scopes queries correctly. That is review and testing.
- Another route to the same thing, such as a second driver package or a raw HTTP call to the database. Fence each one you know of.
