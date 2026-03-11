# Development Workflow

This repository follows an intentionally strict incremental workflow.

## Rules

1. Work in the smallest possible step.
2. Prefer test-first thinking before full implementation.
3. Every step must be manually testable by the user, not only covered by automated tests.
4. After each step:
   - explain what changed
   - explain why it changed
   - provide exact manual test instructions
   - stop for validation before continuing
5. Commit and push only after the user has reviewed and approved the step.

## Default approach for each change

1. Pick one tiny behavior.
2. Add or update the smallest test that defines that behavior.
3. Implement only enough code to satisfy that behavior.
4. Run the relevant automated test locally.
5. Hand the step to the user for manual verification.

## Current project-specific decisions

- Backend work should remain incremental and testable.
- Authentication is deferred for now.
- A mock user is acceptable until the core generation flow is stable.
- Large multi-file backend features should be split into several reviewable slices.
