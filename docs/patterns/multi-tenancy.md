# Multi-tenancy

One tenant's data never reaches another tenant.

## The architectural pattern

A database driver will run any query for any tenant. So you write one module that wraps it: a client that takes the caller's tenant and scopes every query to it. The rest of the codebase reads and writes through that client.

The pattern fails when some file imports the driver directly. Nothing looks wrong in that file, and its queries are not scoped.

## Enforcing it

This uses a technique you will see in other patterns too: **one sanctioned path**. Something powerful is reachable only through the wrapper that makes it safe.

1. Fence the driver with an [import fence](../utilities/import-fences.md), allowlisting only the tenant-scoped client.
2. Put the ESLint config that declares the fence in the frame, so adding a file to the allowlist needs a human.
3. Put the client in the frame too if its scoping logic is short enough to read on every change.

A new file that imports the driver now fails lint, and the message tells the agent to use the client.

## What this does not cover

- Whether the client scopes queries correctly. That is review and testing.
- Where the tenant comes from. If a handler can pass any tenant it likes to the client, the scoping protects nothing. That is the authorization pattern's job.
- Another route to the same data, such as a second driver package or a raw HTTP call to the database. Fence each one you know of.
