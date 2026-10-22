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

- Start every piece of new work by creating a branch from an up-to-date `main`. No work
  happens directly on `main`; changes reach `main` only through a merged pull request.
- Commit messages are conventional (`feat:`, `test:`, `chore:`, `ci:`, `docs:`) with **no**
  `Co-Authored-By` or "Generated with Claude Code" lines.
- The remote stays HTTPS (`https://github.com/GaryGealy/butterfly-net.git`); do not switch
  it to SSH. Pushes authenticate through `gh` as whichever account is active, and Gary's
  work account is also logged in. Before any `git push` or `gh` command that touches this
  repo, run `gh auth status` and confirm the active account is `GaryGealy`; if not,
  `gh auth switch --user GaryGealy` first.
- Production deploys fire only on a pushed `v*` tag.
- Creating Cloudflare resources, setting secrets, and pushing tags are outward-facing:
  confirm with Gary first.
- Don't change the Claude model (`claude-haiku-5-5`, low effort) or the 5 s parse timeout
  without asking — the live smoke check in Task 15 is how that decision gets made.
