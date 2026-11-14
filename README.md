# Trellis

Trellis keeps a codebase's most important guarantees true when most of its code is written by AI agents.

A coding agent with commit access will, to turn a red build green, strip an auth wrapper, cast past a type, add `--no-verify`, or edit the failing rule itself. Trellis defends two things against that: the guarantees the codebase depends on, and the integrity of the checks that hold them. The agent may propose any change to a check and ratify none.

> This repository is being set up. The code and documentation are on their way.

## What Trellis does not do

Trellis checks that a mechanism is present and reached the right way. It cannot judge whether the mechanism is correct, and a passing check is not a statement that a codebase is secure. Review still owns that.

## License

Apache-2.0. See [LICENSE](LICENSE).
