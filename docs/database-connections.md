# Prisma Postgres connections on Vercel

The Next.js runtime uses `DATABASE_URL`. Set it to the **pooled** Prisma Postgres connection string (`pooled.db.prisma.io`) in Vercel Preview and Production. Set `DIRECT_URL` to the **direct** string (`db.prisma.io`) for Prisma migrations and the seed script. Generate both strings for the same database in Prisma Console; do not commit credentials.

The application reuses one Prisma client per warm Node process. On Vercel, its `pg` pool defaults to one connection per process. `DATABASE_POOL_MAX` may be set to an integer from 1 through 10, but raising it multiplies total connections across Vercel instances. Pool size alone cannot compensate for using a direct URL for application traffic.

To repair staging:

1. In Prisma Console, obtain the pooled and direct strings for the **staging** database.
2. In the Vercel project's **Preview** environment, set `DATABASE_URL` to the pooled string, `DIRECT_URL` to the direct string, and `DATABASE_POOL_MAX` to `1`. Do not change Production unless it has the same issue and its own credentials are ready.
3. Redeploy the Preview deployment so its functions use the new environment values. Changing a Vercel environment variable does not update an already-built deployment.
4. Open the HQ RO claim again, then exercise a read and a disposable write. Confirm no new `P2037` errors and check the Prisma Postgres connection metrics. If the pooled limit is still reached, inspect concurrent Vercel instances, other applications sharing the database, and long-running transactions.

For local migrations, `prisma.config.ts` uses `DIRECT_URL` when present and falls back to `DATABASE_URL` for a local PostgreSQL setup. The seed script follows the same split. Use Command Prompt commands such as `npx prisma migrate deploy` and `npm run db:seed` only against the intended database.

## If Preview reports `timeout exceeded when trying to connect`

`JWT_SESSION_ERROR` can be a symptom of the same database failure: the JWT callback reads the active user and membership from PostgreSQL, so a failed connection also prevents session validation. Do not bypass this check or treat the error as an invalid password.

1. Verify the **active Preview deployment** was redeployed after `DATABASE_URL` was set to `pooled.db.prisma.io`; its `DIRECT_URL` should use `db.prisma.io`. Do not paste either full URL into logs or support messages. Keep `DATABASE_POOL_MAX=1` unless capacity testing supports a change.
2. In Prisma Console, check pooled connections, connection errors, and availability at the timestamps of the failures. The pooler has a plan-dependent connection limit shared by every application and deployment using that database. If the limit is reached, inspect concurrent Vercel function instances, other connected apps, and long-running transactions; increasing `DATABASE_POOL_MAX` makes exhaustion more likely.
3. Check Vercel function logs and deployment environment scope (Preview versus Production). If connections are below the limit, verify that the Preview URL, port 5432, TLS setting, credential, and database region match the provisioned database. A connection timeout is not proof of pool exhaustion by itself.
4. After correcting the external cause, redeploy Preview and test sign-in, a claim page, and a write. The app memoizes repeated user-directory and operating-mode reads within a render request, but it still requires a healthy database for authorization and workflow data.

If timeouts began immediately after changing `sslmode=require` to `sslmode=verify-full`, first restore the **Prisma Console-generated** Preview connection strings (which use `sslmode=require`) and redeploy Preview. This is a controlled comparison, not proof that certificate verification caused the timeout. `require` still mandates TLS. Keep Production unchanged while testing Preview. If timeouts persist, use the pooled-connection and availability checks above instead of repeatedly changing SSL modes.
