# Staff directory and Area Office imports

Apply database migrations before opening the updated Users or Departments and job titles settings:

```cmd
cd itf-clients-reimbursement
npx prisma migrate deploy
npx prisma generate
```

The migration creates workspace-managed Department and Job Title catalogues and copies existing
user-directory values into them. Admins can add, deactivate, or reactivate values under
**Settings → Departments and job titles**. Workflow roles under **Settings → Roles** are
permission assignments, not job titles. The reference `.xlsx` download contains active
departments, job titles, offices, and the role values allowed at Headquarters or Area Offices.

## Bulk Area Offices

Under **Settings → Offices**, download the `.xlsx` template, fill the **Area Offices** sheet,
and upload it. `office name` is required; `code` and `slug` are optional. The importer accepts
up to 250 rows and a 1 MB workbook. It validates all rows before writing and rejects an
existing slug rather than overwriting that office. An invalid row means no offices are created.

## Bulk staff users

The Users CSV template now includes `office` and `role` before `department` and `job title`.
Both are required for every imported staff member. `office` may be `Headquarters`, `HQ`, or an
active Area Office's name, code, or slug. `role` must be a valid role for that office scope,
as shown in the reference workbook. Department and job title, when present, must be active
catalogue values. Import at most 50 users per CSV; the user and membership rows are created
in one transaction. Welcome emails are dispatched after the transaction commits.

Existing CSV files using the old six-column layout need the two new columns added before
importing. Manual user creation still allows office assignment later via **Settings → Offices**.
