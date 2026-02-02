# AI Agent Guidelines & Architecture Documentation

This document serves as the authoritative guide for AI agents and developers working on the `aub-clubs` project. Adherence to these guidelines, especially the architecture and module system, is strict.

## 1. Tech Stack Overview
- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS & Shadcn UI
- **Database**: PostgreSQL (via Prisma ORM)
- **API**: tRPC
- **Package Manager**: npm (implied by typical usage, check lockfile if unsure)

## 2. Directory Structure & Module Architecture (CRITICAL)
The project follows a **strict modular architecture**. Features should not be scattered across generic folders but encapsulated within **modules**.

### The Module Pattern
Each major feature or domain (e.g., `auth`, `clubs`, `posts`) resides in its own directory under `src/modules/` (create if missing for new features).

**Structure of a Module:**
```
src/modules/<feature-name>/
├── server/                 # Backend logic
│   └── router.ts           # tRPC routers specific to this module
├── ui/                     # Frontend logic
│   ├── components/         # specialized components used ONLY by this feature
│   └── views/              # Page views/screens (imported by src/app pages)
```

**Global Folders:**
- `src/app/`: Next.js App Router specific files (page.tsx, layout.tsx, route.ts). These should generally be "shells" that import views from `src/modules/<feature>/ui/views/`.
- `src/components/ui/`: **Shadcn UI** components.
- `src/lib/`: Shared utilities (including the Prisma client instance).
- `src/trpc/`: tRPC configuration and core server logic.

## 3. Key Components & Libraries

### Shadcn UI
- **All base UI components are ALREADY installed** in `src/components/ui`. 
- **Do not create new UI primitives** (like buttons, inputs, dialogs) without checking `src/components/ui` first.
- Use the existing `components.json` configuration.

### Prisma (Database)
- **Configuration**: `prisma/schema.prisma`
- **Client Location**: The Prisma client itself is generated into `src/generated/prisma`.
- **Usage**:
  - **NEVER** instantiate `new PrismaClient()` manually in your code.
  - **ALWAYS** import the shared instance from the library:
    ```typescript
    import { prisma } from "@/lib/prisma";
    ```
- **Migrations**: Database changes are managed via `schema.prisma`.

### tRPC (API)
- Uses `@trpc/server` and `@trpc/client`.
- **Routers**: Define procedure logic in `src/modules/<feature>/server/`.
- **Client**: Consume via the tRPC hooks generated in `src/trpc/client.tsx` (or similar).

## 4. Workflows & Scripts
Adhere to the scripts defined in `package.json`:

- **Development**:
  ```bash
  npm run dev
  ```
- **Database Migration**:
  ```bash
  npm run migrate  # Runs: npx prisma migrate dev
  ```
- **Code Generation**:
  ```bash
  npm run generate # Runs: npx prisma generate
  ```
  *Run this after any schema change.*

- **Linting**:
  ```bash
  npm run lint
  ```

## 5. Instructions for AI Agents
1.  **Stick to the Architecture**: If asked to implement a feature (e.g., "Event Management"), do NOT start throwing files into `src/components`. Create `src/modules/events/` with `server` and `ui` folders.
2.  **Use Existing Tools**: Always check for an existing Shadcn component before suggesting a custom implementation.
3.  **Type Safety**: Ensure strict TypeScript usage. Use the generated Prisma types.
4.  **Routing**: Keep `src/app` clean. Logic goes in modules; routing goes in `app`.

---
**FAILURE TO FOLLOW THE MODULE STRUCTURE IS A VIOLATION OF PROJECT STANDARDS.**
