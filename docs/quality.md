# Quality gates

The repository's required checks are defined in `.github/workflows/ci.yml` and intentionally run without model-provider credentials. AI behavior is covered by deterministic provider doubles, schema tests, workflow fixtures, and manual evaluation runs documented separately.

The frontend CI command currently excludes `frontend/tests/dashboard/UnitEditor.test.tsx`. That suite contains an existing interaction deadlock when the editor search modal is opened under the current test runtime. It is not deleted or ignored from local development; the exclusion remains a tracked frontend refactor item. The current CI suite passes 22 files and 78 tests.

The production dependency audit is a blocking gate. Development-only advisories are reported separately and must not be silently accepted when a safe update is available.
