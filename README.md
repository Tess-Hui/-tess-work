# Tess Work Manager

Personal cloud work management system for Tess. Built with Next.js App Router,
Drizzle ORM, Neon Postgres, Tailwind CSS, and shadcn-style UI primitives.

## Features

- Single-admin login. Username is fixed as `Tess`; password is configured by hash.
- Responsive admin layout for desktop, mobile, and tablet.
- Dashboard with task/reminder/fixed item/memo counts and preview sections.
- Task CRUD, complete/reopen, trash, restore, and permanent delete.
- Fixed items, reminders, memos, and day-based Gantt chart.
- Cloud database persistence through `DATABASE_URL`.

## Local Setup

```bash
pnpm install
pnpm hash-password "your-password"
```

Create `.env.local` using `.env.example`, then paste the generated hash into
`ADMIN_PASSWORD_HASH`.

```bash
pnpm db:migrate
pnpm dev
```

If this Codex desktop environment does not expose `pnpm`, use the bundled Node
runtime or install pnpm normally in your shell.

## Vercel Deployment

1. Create/link a Vercel project.
2. Add Neon Postgres from Vercel Marketplace.
3. Configure these environment variables in Vercel:
   - `DATABASE_URL`
   - `ADMIN_PASSWORD_HASH`
   - `SESSION_SECRET`
   - `NEXT_PUBLIC_APP_NAME`
4. Run migrations against the production database:

```bash
pnpm db:migrate
```

5. Deploy to Vercel. The production URL becomes the fixed public login link.

## Useful Commands

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm db:generate
pnpm db:migrate
```
