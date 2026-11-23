# The framework

The framework makes one set of files, the frame, something only a human can change. A pull request that touches a frame file fails a required check until the file's owner signs that exact change with a key an agent cannot use.

## The frame

The frame is a marked block in `CODEOWNERS`. Each entry names a path and the person who may ratify changes to it.

```
# trellis:frame-begin
/.github/CODEOWNERS      @alex
/.github/workflows/      @alex
/.trellis/               @alex
/eslint.config.js        @alex
/src/db/client.js        @sam
# trellis:frame-end
```

A path outside the block still requests its owner's review in the usual way, and nothing blocks a merge on it. A file that needs a human's sign-off goes in the block.

Put in the frame the smallest amount of code that holds an invariant: the lint config that declares a fence, the one file allowed through it, the workflow that runs the checks. `CODEOWNERS` and `.trellis/` are always in it, or an agent could take a file out of the frame or change who may sign.

## Ratifying a change

1. A pull request changes a frame file. The Trellis check fails and names the file.
2. The file's owner lists the changes:

   ```
   node scripts/trellis/ratify.mjs 123
   ```

   This prints a link to each frame file's change on the pull request and a code. It signs nothing.
3. Having read the changes, the owner signs:

   ```
   node scripts/trellis/ratify.mjs 123 --sign <code>
   ```

   The signer asks for the owner's fingerprint, and the signature is posted as a comment on the pull request. The code ties the signature to the changes that were listed: if a frame file has changed since, nothing is signed.
4. The check runs again and passes.

The pull request still needs an ordinary approving review. The signature replaces the owner's approval, not peer review.

### What a signature covers

The owner signs a statement of the pull request's frame changes: each changed frame file with its content before and after, and the pull request's number.

- A push that touches no frame file leaves the signature valid.
- A push that changes a frame file again needs a new signature.
- A signature cannot be reused on another pull request, or on the same change from a different starting point.

### Keys

`.trellis/allowed_signers` lists each owner's public key, in OpenSSH's `allowed_signers` format:

```
alex namespaces="trellis-ratify" sk-ecdsa-sha2-nistp256@openssh.com AAAA…
```

A signature counts only for the files `CODEOWNERS` gives that person. The check reads this file from the base branch, so a key counts only once the pull request that adds it has merged, ratified by an existing key.

The key must be one that signs only after a physical act. The signer supplied here, `scripts/trellis/signers/touch-id.mjs`, uses Touch ID with a key held in a Mac's Secure Enclave.

## Guards that are not whole files

Two more files in `.trellis/` cover guards smaller than a file. Both are optional: without the file, that check does not run.

### JSON pins

`.trellis/json-pins.json` lists values that must hold in JSON files that are otherwise free to change, such as the script that runs lint:

```json
[
  {
    "files": "packages/*/package.json",
    "key": "scripts.lint",
    "value": "eslint . --max-warnings 0",
    "why": "Every package lints its whole tree and allows no warnings."
  }
]
```

The check fails while a matching file's value differs. It compares the parsed JSON, the last pin matching a file and key wins, and a `null` value means the key must be absent. To change a pinned value, change the file and its pin in the same commit.

### Banned text

`.trellis/banned-text.json` lists text that switches a check off: a lint or type-check suppression comment, or the flag that skips the git hooks.

```json
[
  {
    "text": "eslint-disable",
    "why": "Switches off a lint rule.",
    "allow": [
      { "files": "src/legacy/report.js", "with": "no-console", "why": "Prints the report to stdout." }
    ]
  }
]
```

A line a pull request adds outside the frame may not contain the text. Lines already in the code are not scanned. `allow` lists the exceptions: `files` is a path, and `with` is further text the line must also contain. To allow a suppression, add the entry in the same commit as the code.

Both files are in the frame, so a changed pin or a new exception is a change the owner signs.

When a pin or a ban fails, the check prints that entry's `why`. Write there what to do instead.

## Setting it up

You copy the framework into your own repository. It is not fetched from this one when your checks run.

1. Copy the contents of this repository's `framework/` folder into the root of your repository. That adds `scripts/trellis/` and two workflows, `.github/workflows/trellis.yml` and `.github/workflows/trellis-review.yml`.
2. Add the frame block to `.github/CODEOWNERS`, with `/.github/CODEOWNERS`, `/.github/workflows/`, `/scripts/trellis/` and `/.trellis/` in it.
3. Add each owner's key to `.trellis/allowed_signers`.
4. Make the `Trellis` check required on your default branch, and allow changes to it only through pull requests.

The check runs from your default branch, so it starts with the pull requests opened after the one that adds it has merged.

The copy is deliberate. The check is the gate on every other guard, so its code belongs in your frame like theirs: an owner has read it, and an update arrives as a pull request they read and sign. Nothing outside your repository can change what the gate does.

### Updating the copy

From your repository's root, extract `framework/` from a release of this repository, with `v` set to the release you want:

```sh
v=0.2.0; curl -fsSL "https://github.com/grove-hq/trellis/archive/refs/tags/v$v.tar.gz" | tar -xzf - --strip-components=2 "trellis-$v/framework"
```

This overwrites the copied files. It does not delete a file the release no longer has. The result is a frame change like any other: open it as a pull request, and the owner reads and signs it.

## The ladder

The check in CI is the only part that must exist. Each step before it is an optional preview of the same rules, so a problem shows up while it is still cheap to fix.

| Step | What runs | What it blocks |
| --- | --- | --- |
| Agent instructions | A few lines in the agent's instruction file: which files are frame, and that a change to one waits for its owner's signature | Nothing |
| Commit hook | `node scripts/trellis/tripwire.mjs --staged` | Banned text, unmet pins |
| Push hook | `node scripts/trellis/tripwire.mjs --local --range "origin/main...HEAD"` | Banned text, unmet pins |
| CI check | The `Trellis` workflow | Frame changes, banned text, unmet pins |
| Signature | `node scripts/trellis/ratify.mjs <pr>` | Clears its owner's frame changes |

At commit and push, a frame change is listed as a warning, since only the owner's signature on the pull request can clear it. Only banned text and unmet pins block there.

Skip the commit hook during a merge: it compares the index with the first parent only, so every line the merge brings in reads as added. The push hook and the CI check compare against the base branch and still cover the merge.

## What the framework assumes

- **The check is required, and only a pull request can change the default branch.** That is a branch rule in your repository's settings. Someone who can edit those rules, or bypass them, is outside what Trellis can hold.
- **The owner reads before signing.** An agent can raise the prompt. The two-step command exists so the owner sees the changes first, and it cannot make them look.
- **The key is what it claims to be.** Nothing proves a registered key is held in secure hardware. It is trusted because an owner ratified it into the frame.
- **A verdict is as fresh as its last run.** The check runs when a pull request opens or changes and when a signature is posted, not at the moment of merge. A pull request checked before a rule changed keeps its result until it runs again.
- **It is built against shortcuts, not sabotage.** Trellis stops an agent, or a person in a hurry, from taking the short way round a guard. It reads a pull request through git's diff, and it is not proof against someone who deliberately engineers file names or branch history to hide a change from that diff. Peer review is what stands against that.
