# Contributing to Didactio

## Before opening a pull request

Install the repository with the Node.js version from `.nvmrc` and run:

```bash
npm ci
npm run typecheck
npm run lint --workspace=frontend
npm run test --workspace=backend
npm run test:ci --workspace=frontend
npm run build
```

Do not commit `.env` files, generated coverage reports, build output, credentials, prompts containing personal data, or production data.

## Branches and commits

Create a focused branch from the latest `main`. Keep each commit limited to one coherent change and use a Conventional Commit subject, for example `fix: reject unsafe generated markup` or `test: cover generation cancellation`.

Pull requests are merged with a merge commit after the required checks pass. Do not rewrite published history or use squash merges.

## Pull requests

Explain the user-visible and operational impact, migration or rollback considerations, and the checks you ran. Changes to AI prompts, model selection, telemetry, privacy, or data handling must include tests and documentation updates.
