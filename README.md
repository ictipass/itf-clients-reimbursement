# ITF Reimbursement Gateway

Enterprise workflow platform for ITF employer registration, annual compliance, training approval, and reimbursement claim governance.

## Getting Started

Install dependencies:

```bash
npm install
```

Generate the Prisma client:

```bash
npx prisma generate
```

Run the local development server with Webpack:

```bash
npm run dev:webpack
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

The default `npm run dev` command uses Next.js 16 Turbopack. On the current local machine, Turbopack hung during first route compilation, so `npm run dev:webpack` is the stable local development command.

See [docs/implementation-slices.md](docs/implementation-slices.md).

## Architecture

See [docs/enterprise-architecture.md](docs/enterprise-architecture.md).

## Useful Commands

```bash
npm run lint
npm run build
npx prisma validate
npx prisma generate
```
