# Session Handoff

Last updated: 2026-06-03

## Current State

Development is proceeding slice by slice. The latest recorded workflow slice is:

- Slice 61: Registration-to-Compliance UX Guide

Recent completed slices include:

- Slice 55: Compliance-driven registration policy
- Slice 56: Head of Division access to number registry
- Slice 57: Registration submit placement below evidence and compliance cards
- Slice 58: Training Plan compliance gate
- Slice 59: Registration RA direct correction return
- Slice 60: Evidence soft delete
- Slice 61: Registration-to-compliance UX guide and friendly compliance-blocked feedback

## Important Current Rules

- New companies must complete registration before compliance filing.
- Registration completion assigns the ITF employer number and opens the current-year compliance draft.
- Annual compliance certificates, not registration certificates, are the downloadable certificate path.
- Training Plan and L&D submission requires approved/certified compliance for that training year.
- Uploaded evidence can be soft-deleted from active workflow views while preserving audit history.

## Validation Habit

Recent slices have been checked with:

- `npx prisma generate`
- `npx prisma validate`
- `npx next typegen`
- `npx tsc --noEmit`
- `npm run lint`

If resuming after switching projects, start with:

```bash
git status --short
npx prisma validate
npx next typegen
npx tsc --noEmit
```

Then continue from the next slice in `docs/implementation-slices.md`.
