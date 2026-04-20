# Contributing to manage-definit-com

This repo holds the **manage.definit.com** portal shell and its mini-apps
(Notes, CallScribe, RecurringTasks, EmailReview, TeamsTracker, Checkmate).

## Split rule — where should this change go?

| Change | Repo |
|---|---|
| Token value (`--primary`, `--n-500`, spacing, radii) | **`definit-shared-design-system`** |
| Shared primitive (Button, Card, Input, Badge, Rail, TopBar) | **`definit-shared-design-system`** |
| Font / logo / shared image | **`definit-shared-design-system`** |
| Manage-specific layout / feature / page | **this repo** |
| Manage copy / content / workflow | **this repo** |
| Mini-app functionality (Notes save logic, CallScribe UI, etc.) | **this repo** |

**Rule of thumb:** if the change would visually or functionally affect
apps.definit.com or design.definit.com, it belongs in `definit-shared-design-system`.
If it only affects manage, it belongs here.

## Flow

1. Open a PR on this repo's `main` branch.
2. CODEOWNERS auto-requests review from the maintainer.
3. On approve + merge, the reverse-sync pipeline mirrors to Forgejo within 5 min.
4. manage-VM's systemd timer pulls Forgejo every 5 min and rebuilds affected
   containers with `docker compose up -d --build`. Total: PR-merge to live ~= 10 min.

## Consuming the shared design system

This repo links to `https://assets.definit.com/tokens.css` for all CSS tokens
and fonts. Do **not** duplicate token values locally. If you need a token that
doesnt exist, PR it into `definit-shared-design-system`, not here.
