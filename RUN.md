# How to run the AUB Clubs app

## 1. Set up the database

Create a `.env` file in the project root (same folder as `package.json`) with your PostgreSQL connection string:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
```

Example for local PostgreSQL:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aub_clubs?schema=public"
```

For local development with a different base URL (optional):

```env
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## 2. Install dependencies (if you haven’t)

```bash
npm install
```

## 3. Apply the database schema

Generate the Prisma client and create/update tables:

```bash
npm run db:generate
npm run db:migrate
```

- **`db:generate`** – generates the Prisma client from `prisma/schema.prisma`.
- **`db:migrate`** – creates a new migration and applies it (creates/updates tables). Use this when you want to keep migration history.

If you prefer to sync the schema without creating a migration file (e.g. quick prototyping):

```bash
npm run db:push
```

### If you see "Drift detected" or "migrations applied but missing locally"

Your database was migrated from another machine or with migrations that are no longer in this repo. To realign **and wipe all data** (use only on a dev database):

1. **Reset** the database and migration history (this **deletes all data** in the DB):

   ```bash
   npx prisma migrate reset
   ```

   When prompted, confirm. This drops the `public` schema and reapplies all migrations in `prisma/migrations`. The old conflicting migration has been removed, so after reset there are no migrations to apply.

2. **Create and apply** the initial migration for the current schema:

   ```bash
   npx prisma migrate dev --name initial
   ```

   This creates a new migration from `schema.prisma` and applies it. Your DB will match the schema (User, Clubs, RegisteredClubs, Post, Announcement).

## 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Using the new APIs (profile & For You feed)

The backend exposes:

- **Student profile**: `trpc.profile.get`, `trpc.profile.update`
- **For You feed**: `trpc.forYou.getFeed` (announcements + posts from clubs the user is in)

Use these from any **client component** that is rendered inside the tRPC provider, for example:

```tsx
'use client';
import { useTRPC } from '@/trpc/client';

export function ProfilePage() {
  const trpc = useTRPC();
  const { data: profile } = trpc.profile.get.useQuery();
  const updateProfile = trpc.profile.update.useMutation();
  // ...
}

export function ForYouPage() {
  const trpc = useTRPC();
  const { data } = trpc.forYou.getFeed.useQuery({ limit: 20 });
  // data.items = mixed announcements + posts, sorted by date
  // data.nextCursor = for pagination
}
```

Make sure your app is wrapped with `TRPCReactProvider` (e.g. in `layout.tsx`) so `useTRPC()` and these queries work.

---

## Scripts reference

| Command           | Purpose                          |
|-------------------|----------------------------------|
| `npm run dev`     | Start Next.js dev server         |
| `npm run build`   | Production build                 |
| `npm run start`   | Run production server            |
| `npm run db:generate` | Generate Prisma client      |
| `npm run db:migrate`  | Create and run migrations   |
| `npm run db:push`     | Sync schema without migrations |
