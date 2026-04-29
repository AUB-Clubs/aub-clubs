# AUB Clubs

AUB Clubs is a centralized student-club platform for the American University of Beirut. It helps students discover active clubs, join communities, follow announcements, manage schedules, and interact with club administrators through a single web application.

This repository was built as a software engineering course project. The implementation emphasizes modular architecture, type safety, role-based workflows, persistent data modeling, and integration with modern production tooling.

## Table of Contents

- [Project Summary](#project-summary)
- [Problem Statement](#problem-statement)
- [Proposed Solution](#proposed-solution)
- [User Roles](#user-roles)
- [Core Features](#core-features)
- [Technology Stack](#technology-stack)
- [System Architecture](#system-architecture)
- [Repository Structure](#repository-structure)
- [Database Design](#database-design)
- [AI and Automation Features](#ai-and-automation-features)
- [Security and Access Control](#security-and-access-control)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Testing and Quality Assurance](#testing-and-quality-assurance)
- [Deployment Notes](#deployment-notes)
- [Known Limitations](#known-limitations)
- [Future Improvements](#future-improvements)
- [Course Submission Notes](#course-submission-notes)

## Project Summary

Student club information is often fragmented across social media, WhatsApp groups, emails, posters, and word of mouth. AUB Clubs provides one structured platform where students can find clubs, inspect activity, request membership, follow announcements, view events, and receive recommendations.

For club board members, the platform provides administration tools for club profiles, posts, members, events, calendar conflict analysis, finance records, and AI-assisted event planning. For university administrators, it provides review and oversight tools for club activity and status management.

## Problem Statement

AUB students, especially new students, face several recurring problems when engaging with student clubs:

- Club information is distributed across informal channels.
- It is difficult to know which clubs are currently active.
- Joining processes are inconsistent and often manual.
- Club announcements and events are not centralized.
- Club administrators lack structured tools for membership, scheduling, and engagement.
- University staff have limited visibility into club activity and historical trends.

## Proposed Solution

AUB Clubs consolidates discovery, membership, communication, events, and administration into one platform. The system uses a modular Next.js application with a typed tRPC API, PostgreSQL persistence through Prisma, Supabase-backed authentication/storage, and AI integrations for recommendations, chatbot support, schedule extraction, moderation, and event-generation assistance.

## User Roles

### Students

Students can browse clubs, view club profiles, request membership, follow posts, interact with comments, maintain their profile, manage their schedule, view calendars, and receive personalized recommendations.

### Club Board Members

Board members can administer club details, manage membership requests, publish announcements and posts, manage events, inspect schedule overlap, track finances, and use the event generator to create planning artifacts.

### University Administrators

University administrators can review clubs, change club status, inspect reports, and view activity/funding summaries across clubs.

## Core Features

### Authentication and Onboarding

- Supabase-based sign-up and sign-in.
- AUB email validation.
- Email verification workflow.
- Onboarding flow for profile and academic information.
- Protected application routes based on authentication, verification, and onboarding completion.
- Optional E2E test bypass mode for local automated testing.

### Club Discovery

- Searchable club directory.
- Club profile pages with descriptions, missions, media, categories, events, and posts.
- Club activity and commitment-level indicators.
- Similar-club recommendations based on club metadata and activity.

### Membership Management

- Students can request membership in clubs.
- Club board members can accept or reject requests.
- Membership status tracking: `PENDING`, `ACCEPTED`, `REJECTED`.
- Club roles: `MEMBER`, `BOARD`, `VICE_PRESIDENT`, `PRESIDENT`.
- Membership audit logs for request and decision history.

### Posts, Announcements, and Comments

- Club posts with draft/published states.
- Announcements with priority levels: general, important, urgent.
- Audience controls for public, members-only, and board-only content.
- Image support for posts and comments.
- Upvotes and threaded comments.
- Comment likes.

### Student Dashboard and Feeds

- Personalized student views.
- Discover and For You pages.
- Trending and recommendation-aware feed components.
- Profile management, including profile image updates.

### Recommendations

The recommendation module combines:

- Content-based filtering using club categories/types.
- Activity scoring using recent posts and announcements.
- Popularity signals from membership counts.
- Collaborative filtering from users with overlapping memberships.

### Calendar and Scheduling

- Student weekly schedule storage.
- Club event calendar views.
- Student calendar that combines personal schedule, joined-club events, and optionally Outlook/Microsoft Calendar events.
- Event RSVP and registration states.
- Capacity and waitlist support.
- Calendar conflict and overlap calculations for board members planning events.
- Cached overlap statistics for performance.

### Microsoft Calendar Integration

- Microsoft OAuth flow with PKCE.
- Outlook calendar read integration through Microsoft Graph.
- Encrypted refresh-token storage.
- Disconnect flow for users.

### Club Administration

- Club overview editing.
- Event management.
- Calendar management for clubs.
- Member management.
- Analytics and engagement sections.
- Finance tracking with income/expense records.
- Event-generator entry points for board users.

### University Administration

- Club review dashboard.
- Club status management: `PENDING_REVIEW`, `ACTIVE`, `INACTIVE`.
- Yearly activity reports based on posts, events, and memberships.
- Funding overview across clubs.

### Content Moderation

- Text and image moderation through a separate FastAPI inference service.
- Text moderation model: `KoalaAI/Text-Moderation`.
- Image safety model: `OwenElliott/image-safety-classifier-s`.
- Retry and timeout handling for moderation requests.

## Technology Stack

### Frontend

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Shadcn UI / Radix UI primitives
- TanStack React Query
- FullCalendar
- Recharts

### Backend

- Next.js route handlers
- tRPC
- Zod validation
- Prisma ORM
- PostgreSQL
- Supabase Auth
- Supabase Storage

### AI and Automation

- OpenAI API for chatbot, schedule inference, and event-generation workflows.
- Google GenAI for generated event/social images.
- Inngest for long-running event-generation workflows and realtime updates.
- MCP server integration for chatbot tool access to club data.
- FastAPI inference service for moderation.

### Testing and Tooling

- ESLint
- Playwright E2E tests
- Prisma migrations and seed script
- Dockerfiles for app, migration, seed, and inference service

## System Architecture

The application follows a strict feature-module architecture. UI and server logic for a domain live together under `src/modules/<feature>`, while `src/app` remains primarily responsible for routing.

```text
Browser
  |
  | React + Next.js App Router
  v
src/app pages and route handlers
  |
  | imports module views and calls tRPC
  v
src/modules/<feature>/ui + src/modules/<feature>/server
  |
  | typed procedures, validation, role checks
  v
Prisma ORM
  |
  v
PostgreSQL
```

Supporting services include Supabase for authentication and storage, Microsoft Graph for Outlook calendar events, OpenAI/Google GenAI for AI features, Inngest for workflow orchestration, and a separate FastAPI moderation service.

## Repository Structure

```text
.
├── src/
│   ├── app/                         # Next.js App Router pages and API routes
│   ├── components/ui/               # Shared Shadcn UI components
│   ├── generated/prisma/            # Generated Prisma client
│   ├── hooks/                       # Shared React hooks
│   ├── inngest/                     # Inngest client and workflow functions
│   ├── lib/                         # Shared utilities, Prisma client, storage, RAG helpers
│   ├── modules/                     # Feature modules
│   │   ├── auth/                    # Authentication and auth middleware
│   │   ├── onboarding/              # User onboarding flow
│   │   ├── Students/                # Student profile, feeds, discovery views
│   │   ├── Clubs/                   # Club browsing and administration
│   │   ├── Recommendations/         # Recommendation algorithms and router
│   │   ├── calendar/                # Student/club calendars and Microsoft Graph integration
│   │   ├── posts/                   # Posts, comments, images, likes
│   │   ├── moderation/              # Moderation tRPC wrapper
│   │   ├── event-generator/         # AI event planning UI and router
│   │   ├── chatbot/                 # AI chatbot server and UI
│   │   └── admin/                   # University admin reports and review tools
│   └── trpc/                        # tRPC initialization, client, and root router
├── prisma/
│   ├── schema.prisma                # Database schema
│   ├── migrations/                  # Prisma migrations
│   └── seed.ts                      # Seed script for clubs and test user
├── e2e/                             # Playwright smoke tests
├── inference/                       # FastAPI moderation service
├── mcp-server/                      # MCP server for chatbot data tools
├── operations/                      # Deployment and environment helper scripts
├── public/                          # Static assets
├── Dockerfile                       # Main app container
├── Dockerfile.inference             # Moderation service container
├── Dockerfile.migrate               # Migration container
├── Dockerfile.seed                  # Seed container
└── package.json                     # npm scripts and dependencies
```

## Database Design

The main Prisma models include:

- `User`: authentication-linked user profile, onboarding state, academic details, avatar, schedules, memberships, posts, comments, and chatbot sessions.
- `Club`: club metadata, CRN, status, categories/types, media links, events, posts, projects, and finance records.
- `Membership`: connection between users and clubs, including role and membership status.
- `MembershipAuditLog`: chronological history of membership actions.
- `Post`, `PostImage`, `Upvote`: club communication and engagement data.
- `Comment`, `CommentImage`, `CommentLike`: threaded discussion system.
- `UserSchedule`: recurring or custom schedule entries for students.
- `Event`, `EventRegistration`, `EventOverlapCache`: event planning, RSVP/waitlist/check-in, and conflict analysis.
- `UserMicrosoftCalendarLink`: encrypted Microsoft Calendar OAuth token storage.
- `Project`, `Message`, `Fragment`, `EventDetails`, `EventReport`, `EventSpeaker`, `EventSponsor`, `EventBuilding`, `EventEmail`, `EventPost`, `EventImage`: event-generator workflow persistence.
- `BuildingDocument`, `SponsorDocument`, `SpeakerDocument`: RAG document stores with vector embeddings.
- `ClubFinance`: club income and expense tracking.
- `ChatbotSession`, `ChatbotMessage`: persistent chatbot conversation history.

## AI and Automation Features

### Chatbot

The chatbot uses OpenAI and can optionally call an MCP server to retrieve structured club data such as club lists, club details, announcements, meetings, and events.

### Schedule Inference

Students can upload schedule images. The schedule-inference module uses OpenAI to extract structured schedule entries that can be reviewed and saved.

### Event Generator

The event-generator module helps board members plan club events. It uses Inngest workflows and AI tools to generate event ideas, reports, speaker suggestions, sponsor suggestions, building suggestions, emails, posts, and images. Human-in-the-loop approval endpoints are included for event and email approval.

### Moderation Service

The moderation module calls a FastAPI service that classifies text and images before accepting user-generated content.

## Security and Access Control

- Authentication is handled by Supabase.
- tRPC procedures use middleware to enforce authentication and onboarding requirements.
- Main app procedures generally require a verified, onboarded user.
- Club administration actions are restricted to accepted board-level members.
- University admin routes check configured admin email addresses.
- Microsoft refresh tokens are encrypted before storage.
- User-generated text and images can be screened through the moderation service.
- E2E auth bypass is controlled by explicit test-mode environment variables.

## Getting Started

### Prerequisites

Install the following before running the project locally:

- Node.js 24 or compatible modern Node.js runtime
- npm
- PostgreSQL database
- Supabase project for auth and storage
- Playwright browsers for E2E tests, if running tests
- Optional: Docker for containerized deployment or inference service
- Optional: Python 3.11 and `uv` for local inference-service development

### Install Dependencies

```bash
npm install
```

## Environment Variables

Copy `.env.example` to `.env`, then fill in the values for your local services.

```bash
# Database
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
UNIVERSITY_TIMEZONE="Asia/Beirut"
UNIVERSITY_ADMIN_EMAILS="admin1@aub.edu.lb,admin2@aub.edu.lb"

# Supabase auth and storage
NEXT_PUBLIC_SUPABASE_API_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="your-supabase-anon-or-publishable-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# OpenAI-backed chatbot, schedule inference, and event generation
OPENAI_API_KEY="your-openai-api-key"
OPENAI_MODEL="gpt-5.4"

# Optional Google GenAI image generation for event posts
GOOGLE_API_KEY="your-google-api-key"
EVENT_IMAGES_SUPABASE_BUCKET="uploads"

# Optional Microsoft Calendar integration
MICROSOFT_CLIENT_ID="your-azure-client-id"
MICROSOFT_CLIENT_SECRET="your-azure-client-secret"
MICROSOFT_REDIRECT_URI="http://localhost:3000/api/integrations/microsoft/callback"
MICROSOFT_TENANT="common"
CALENDAR_TOKEN_ENCRYPTION_KEY="base64-or-hex-encoded-32-byte-key"

# Optional moderation service
INFERENCE_URL="http://localhost:8080"
MODERATION_TIMEOUT_MS="120000"
MODERATION_RETRIES="3"

# Optional MCP chatbot tools
MCP_SERVER_URL="http://localhost:8787/mcp"
MCP_BEARER_TOKEN="shared-token"

# E2E test bypass
E2E_TEST_MODE="true"
E2E_AUTH_SECRET="local-e2e-secret"
E2E_AUTH_USER_ID="00000000-0000-4000-8000-000000000001"
```

Do not commit real `.env` values. The root `.gitignore` should keep `.env` files out of version control.

## Database Setup

Generate the Prisma client:

```bash
npm run generate
```

Apply migrations:

```bash
npm run migrate
```

Seed clubs and the E2E test user:

```bash
npm run seed
```

The seed script loads real club data from `clubs.json`, creates club records, and ensures a deterministic E2E user exists.

## Running the Application

Start the Next.js development server:

```bash
npm run dev
```

Open the app at:

```text
http://localhost:3000
```

Build for production:

```bash
npm run build
```

Start the production standalone server after building:

```bash
npm run start
```

## Available Scripts

```bash
npm run dev                  # Start local Next.js dev server
npm run build                # Generate Prisma client and build Next.js app
npm run start                # Start standalone production server
npm run lint                 # Run ESLint
npm run migrate              # Run Prisma migrations in development
npm run generate             # Generate Prisma client
npm run seed                 # Seed database from clubs.json
npm run studio               # Open Prisma Studio
npm run e2e                  # Run Playwright tests
npm run e2e:ui               # Run Playwright UI mode
npm run e2e:headed           # Run headed Playwright tests
npm run ai                   # Start local Inngest dev server
npm run rag:hydrate:all      # Hydrate RAG document tables
```

## Testing and Quality Assurance

### Linting

```bash
npm run lint
```

### End-to-End Tests

The Playwright smoke tests cover major navigation and page-load flows:

- Root redirect to Discover in bypass mode.
- Auth page rendering.
- Discover page rendering.
- Clubs page rendering and club links.
- Profile page rendering.
- Club details page navigation.

Run E2E tests:

```bash
npm run e2e
```

The Playwright config starts the dev server with `E2E_TEST_MODE=true` and uses cookie/header-based bypass credentials. Make sure the database has been seeded before running tests.

## Optional Services

### Moderation Inference Service

The moderation service lives in `inference/` and exposes `/health` and `/moderate` endpoints.

Run with Docker Compose:

```bash
cd inference
docker compose up
```

Or run locally with `uv`:

```bash
cd inference
uv sync
uv run uvicorn main:app --host 0.0.0.0 --port 8080 --reload
```

### Inngest Event Workflows

For local event-generator workflow development:

```bash
npm run ai
```

The Inngest API route is available at `/api/inngest`.

### MCP Server

The `mcp-server/` directory contains a Model Context Protocol server that exposes club-data tools to the chatbot. It can be run separately when chatbot tool-calling is needed.

## Deployment Notes

The repository includes container definitions for production deployment:

- `Dockerfile`: builds the main Next.js standalone app.
- `Dockerfile.migrate`: intended for database migration jobs.
- `Dockerfile.seed`: intended for seed jobs.
- `Dockerfile.inference`: builds the FastAPI moderation service with models baked into the image.

The inference service includes `fly.toml` for Fly.io deployment. The app also includes scripts under `operations/` for image building, tag generation, deployment tag updates, and environment synchronization.

A typical deployment pipeline should:

1. Build the app image.
2. Run Prisma migrations against the production database.
3. Deploy the app container with required environment variables.
4. Deploy optional services such as inference and MCP if those features are enabled.
5. Configure Supabase and Microsoft redirect URLs to match the production domain.

## Known Limitations

- Advanced integrations require manually provisioned external service credentials.
- Several advanced features depend on external services and will be unavailable without valid credentials.
- The moderation service is separate from the main app and must be deployed or run locally for moderation calls to succeed.
- Some AI workflows depend on Inngest and realtime subscriptions, which require additional local or hosted setup.
- Recommendation quality improves as more realistic membership, posts, and activity data are added.
- Supabase email verification requires correct project email-template and redirect configuration.

## Future Improvements

- Add stronger environment validation at startup for required service groups.
- Add unit tests for recommendation scoring, role checks, calendar overlap logic, and membership workflows.
- Add integration tests for tRPC routers.
- Add CI checks for linting, type checking, migrations, and Playwright smoke tests.
- Improve seed data to include realistic users, memberships, posts, comments, and events.
- Add notification support for membership decisions, event reminders, and urgent announcements.
- Add analytics dashboards for student engagement over time.
- Add richer club onboarding and university approval workflows.
- Add exportable reports for university administrators.

## Course Submission Notes

This project demonstrates the following software engineering concepts:

- Requirements-driven feature design for multiple user roles.
- Modular feature architecture under `src/modules`.
- Separation of routing, UI views, API procedures, and persistence logic.
- Typed full-stack communication with tRPC and TypeScript.
- Relational database modeling with Prisma and PostgreSQL.
- Authentication, authorization, and role-based access control.
- Input validation with Zod.
- Automated E2E smoke testing with Playwright.
- Deployment-oriented containerization.
- Integration with external services through clearly isolated modules.
- AI-assisted features implemented as optional, service-backed capabilities rather than hard-coded UI demos.

## Maintainers

Add the course team members here before final submission:

```text
Team Name: <team-name>
Course: CMPS 270 Software Engineering
Institution: American University of Beirut
Team Members:
- <name> - <role/contribution>
- <name> - <role/contribution>
- <name> - <role/contribution>
```
