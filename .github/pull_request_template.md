## Summary

<!-- What changed and why? -->

## Verification

- [ ] `npm run typecheck`
- [ ] `npm run lint --workspace=frontend`
- [ ] `npm run test --workspace=backend`
- [ ] `npm run test:ci --workspace=frontend`
- [ ] `npm run build`
- [ ] `npm audit --omit=dev --audit-level=high`

## Risk and rollout

- [ ] No data migration is required.
- [ ] Any migration is idempotent and has a rollback or recovery procedure.
- [ ] API, streaming, privacy, or telemetry contracts are documented.
- [ ] Screenshots or a manual verification note are included for UI changes.
