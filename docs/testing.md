# Testing and continuous integration

The application uses Node's built-in test runner through `tsx`. Run the same quality checks locally
before merging to staging:

```cmd
npm ci
npx prisma validate
npm run lint
npm test
npx tsc --noEmit
npm run build
```

The GitHub Actions workflow at `.github/workflows/ci.yml` runs these checks for pushes and pull
requests targeting `main` or `staging`, and can also be started manually. It uses a read-only token
and placeholder database credentials. No real database, storage, email, or payment credentials are
made available to the job. It does not deploy, migrate, or seed a database.

This is a source-quality gate, not a full workflow integration test. A passing check verifies the
Prisma schema, unit tests, lint, TypeScript, and production build. It does **not** prove migrations
apply, external APIs work, or employer/officer journeys pass against a database. Those checks need
an isolated test database and a separate integration-test slice; never run them against the local,
Preview, or Production application database.

To make this gate mandatory, configure a GitHub branch protection rule for `main` and `staging`
that requires the `verify` job. Without branch protection, a failed workflow reports an error but
does not itself prevent a direct push or merge.
