# Library

A personal book library built with Next.js and Supabase. The books were imported once from Notion; since then Supabase has been the source of truth.

## Requirements

- Node.js **22 or newer** (supabase-js needs Node's built-in WebSocket)
- pnpm (`npm i -g pnpm`)
- A Supabase project, plus a Notion integration if you want to re-run the import

## Setup

```bash
pnpm install
cp .env.example .env.local   # then fill it in, see below
pnpm dev
```

### Supabase

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. **Authentication → Sign In / Providers**: keep **Email** on and turn **Allow new users to sign up** off.
3. **Authentication → Users → Add user**: create your own user, with **Auto Confirm User** ticked.
4. Copy the project URL (**Connect** button) and the keys (**Project Settings → API Keys**) into `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: used by the app
   - `SUPABASE_SECRET_KEY`: bypasses RLS. **Use it only for local scripts**, never in the app or in Vercel.
5. Link the CLI and apply the migrations:
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   pnpm db:types           # regenerate lib/database.types.ts after schema changes
   ```

Schema changes always go in a **new** migration (`npx supabase migration new <name>`). Never edit one that has already been applied.

## Notion import (one-time)

### Notion setup

1. Go to [notion.so/profile/integrations](https://www.notion.so/profile/integrations) → **New integration** → type **API / Internal**. Copy the secret (`ntn_…`).
2. Open the books database → **•••** → **Connections** → add the integration.
3. Copy the database ID from its URL (the 32 characters before `?v=`).
4. Put both in `.env.local` as `NOTION_TOKEN` and `NOTION_DATABASE_ID`.

### Running it

```bash
pnpm notion:inspect              # print the Notion columns, value counts and sample rows
pnpm notion:import --dry-run     # map everything and report problems; writes nothing
pnpm notion:import               # import new books, readings and covers
pnpm notion:import --update      # also overwrite books imported earlier (discards edits made in the app!)
```

- Books are matched on `notion_page_id`, so re-running is safe. Without `--update`, books that were already imported are left untouched.
- Covers are downloaded into the public `covers` bucket (`<user_id>/<book_id>.<ext>`). If a download fails, the external link is kept in `cover_url`.
- If the project has more than one user, add `--user you@example.com`.
- The mapping lives in `scripts/lib/notion-mapping.ts` and is covered by `pnpm test`.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start the dev server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest unit tests |
| `pnpm db:types` | Regenerate Supabase types |
