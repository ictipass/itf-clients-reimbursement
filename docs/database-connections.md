# Prisma Postgres connections on Vercel

The Next.js runtime uses `DATABASE_URL`. Set it to the **pooled** Prisma Postgres connection string (`pooled.db.prisma.io`) in Vercel Preview and Production. Set `DIRECT_URL` to the **direct** string (`db.prisma.io`) for Prisma migrations and the seed script. Generate both strings for the same database in Prisma Console; do not commit credentials.

The application reuses one Prisma client per warm Node process. On Vercel, its `pg` pool defaults to one connection per process. `DATABASE_POOL_MAX` may be set to an integer from 1 through 10, but raising it multiplies total connections across Vercel instances. Pool size alone cannot compensate for using a direct URL for application traffic.

To repair staging:

1. In Prisma Console, obtain the pooled and direct strings for the **staging** database.
2. In the Vercel project's **Preview** environment, set `DATABASE_URL` to the pooled string, `DIRECT_URL` to the direct string, and `DATABASE_POOL_MAX` to `1`. Do not change Production unless it has the same issue and its own credentials are ready.
3. Redeploy the Preview deployment so its functions use the new environment values. Changing a Vercel environment variable does not update an already-built deployment.
4. Open the HQ RO claim again, then exercise a read and a disposable write. Confirm no new `P2037` errors and check the Prisma Postgres connection metrics. If the pooled limit is still reached, inspect concurrent Vercel instances, other applications sharing the database, and long-running transactions.

For local migrations, `prisma.config.ts` uses `DIRECT_URL` when present and falls back to `DATABASE_URL` for a local PostgreSQL setup. The seed script follows the same split. Use Command Prompt commands such as `npx prisma migrate deploy` and `npm run db:seed` only against the intended database.
