# Tenant isolation

No query reads or writes another tenant's data.

## The architectural pattern

Give the database one door: a tenant-scoped client. It is the only code that holds a connection, and it adds the caller's tenant to every query. Handlers ask it for data. They never write the tenant filter themselves, so there is no filter to forget.

The pattern fails in three ways:

- A handler opens a connection of its own and queries without the scope.
- The scoped client gains a method that skips the tenant, such as a "list everything" for an admin page.
- The tenant comes from something the caller controls, such as the request body, and not from the authenticated session.

## Enforcing it

This uses a technique you will see in other patterns too: **one door, and no way to build another**.

1. Keep the connection private. Create it inside the scoped client's file and never export it, so there is nothing for other code to import.
2. Fence the database driver with an [import fence](../utilities/import-fences.md), so only the scoped client's file can import it. That stops a second connection being opened.
3. Put the scoped client and the lint config that declares the fence in the frame. An ordinary new handler needs no human, because it can only reach data through the door. A new method on the scoped client does.
4. Test the scoped client: one tenant cannot read or change another tenant's rows.

A fence reads ordinary `import` statements. The sample closes the general ways around it, such as `require()`, with a short baseline of standard lint rules.

The frame here is two small things: the scoped client and the fence. Every handler sits outside it.

## In the sample

The [sample app](https://github.com/grove-hq/trellis-sample) does this with SQLite:

- [`src/db/tenant-db.ts`](https://github.com/grove-hq/trellis-sample/blob/main/src/db/tenant-db.ts) is the scoped client. It opens the database and hands out `dbFor(user)`.
- [`eslint.config.mjs`](https://github.com/grove-hq/trellis-sample/blob/main/eslint.config.mjs) declares the fence, and holds the baseline.
- [`src/db/tenant-db.test.ts`](https://github.com/grove-hq/trellis-sample/blob/main/src/db/tenant-db.test.ts) tests the scoping and that the fence is wired.

## What this does not cover

- Whether each query inside the scoped client is right. That is review, which is why the frame is kept small enough to read.
- Whether the caller's tenant is the right one. That is [authentication](authentication.md).
- Data that leaves by another route: a cache, a search index, logs, a background job, file storage. Each needs its own door.
