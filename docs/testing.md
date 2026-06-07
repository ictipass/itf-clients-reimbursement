# Testing

The initial automated-test foundation uses Node's built-in test runner through the existing `tsx`
development dependency.

```bash
npm test
npm run verify
```

Current unit coverage protects:

- RBAC boundaries for employer and annual-compliance authority
- Active organization selection and rejection of organizations outside a user's memberships
- Escaping of active markup before transactional email rendering

Database integration tests should run against a dedicated test database, never the development or
production database. Configure that database before adding migration-backed workflow tests.
