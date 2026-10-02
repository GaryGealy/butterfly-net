# CLAUDE.md

butterfly-net: digital 3×5 cards. Type a thought, Claude proposes which pile it belongs
on, you confirm, and the card sits on its pile until you mark it done.

## Start here

- **Spec:** `docs/superpowers/specs/2026-09-30-butterfly-net-design.md`
- **Implementation plan:** `docs/superpowers/plans/2026-09-30-butterfly-net.md` — 15
  TDD tasks. Read its *Global Constraints* and *Review Focus* before any task.
- **Status:** nothing built yet. The repo is a clone of the empty GitHub repo; begin at
  Task 1. The execution method (subagent-driven vs. native) has not been chosen — ask.

The idea's record lives in idea-forge as `digital-assistant`
(`~/repos/idea-forge/ideas/digital-assistant/idea.md`). Plan Task 15 writes back to it.

## Rules for this repo

- Work on branch `first`; never commit directly to `main`.
- Commit messages are conventional (`feat:`, `test:`, `chore:`, `ci:`, `docs:`) with **no**
  `Co-Authored-By` or "Generated with Claude Code" lines.
- The remote must be SSH (`git@github.com:GaryGealy/butterfly-net.git`). `gh`'s HTTPS
  helper serves Gary's work account; check `gh auth status` before any `gh` command that
  touches this repo, and `gh auth switch` to `GaryGealy` if needed.
- Production deploys fire only on a pushed `v*` tag.
- Creating Cloudflare resources, setting secrets, and pushing tags are outward-facing:
  confirm with Gary first.
- Don't change the Claude model (`claude-opus-5-5`, low effort) or the 5 s parse timeout
  without asking — the live smoke check in Task 15 is how that decision gets made.
