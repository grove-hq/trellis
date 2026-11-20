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
   trellis ratify 123
   ```

   This prints a link to each frame file's change on the pull request and a code. It signs nothing.
3. Having read the changes, the owner signs:

   ```
   trellis ratify 123 --sign <code>
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

The key must be one that signs only after a physical act. The signer supplied here uses Touch ID with a key held in a Mac's Secure Enclave.

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

The check fails while a matching file's value differs. It compares the parsed JSON, the last pin matching a file and key wins, and a `null` value means the key must be absent. To change a pinned value, change the file and its pin in the same pull request.

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

A line a pull request adds outside the frame may not contain the text. Lines already in the code are not scanned. `allow` lists the exceptions: `files` is a path, and `with` is further text the line must also contain. To allow a suppression, add the entry in the same pull request as the code.

Both files are in the frame, so a changed pin or a new exception is a change the owner signs.

## What the framework assumes

- **The check is required, and only a pull request can change the default branch.** That is a branch rule in your repository's settings. Someone who can edit those rules, or bypass them, is outside what Trellis can hold.
- **The owner reads before signing.** An agent can raise the prompt. The two-step command exists so the owner sees the changes first, and it cannot make them look.
- **The key is what it claims to be.** Nothing proves a registered key is held in secure hardware. It is trusted because an owner ratified it into the frame.
- **A verdict is as fresh as its last run.** The check runs when a pull request opens or changes and when a signature is posted, not at the moment of merge. A pull request checked before a rule changed keeps its result until it runs again.
- **Git's diff is how a change is seen.** A file renamed to a name git writes in quotes, one with a non-ASCII character for example, is not read as a change to that file.
