---
name: GitHub main synchronization
description: Safely integrating work when the local main branch has diverged from GitHub main.
---

Before merging or pushing work to `main`, fetch the GitHub remote and compare both histories. Treat the current GitHub `main` as the shared source of truth; preserve a local backup ref before synchronizing an older divergent checkout.

**Why:** A stale local `main` can contain older, unrelated commits. Pushing it risks overwriting or reintroducing changes that the shared main branch has already superseded.

**How to apply:** Fetch first, check whether the intended commit is already an ancestor of remote `main`, and apply only any missing isolated fix on top of the remote branch.