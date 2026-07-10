"use client";

import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Compass,
  Download,
  FileText,
  Megaphone,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { AuthCallbackHandler } from "@/modules/auth/ui/components/auth-callback-handler";

const categories = [
  "Academic",
  "Arts",
  "Business",
  "Cultural",
  "Environmental",
  "Health and wellness",
  "Media",
  "Social",
  "Sports",
  "Technology",
];

const platformFeatures = [
  {
    title: "Feed and recommendations",
    description:
      "A personalized discover feed surfaces posts from recommended clubs, with recommendations based on interests, activity, and shared memberships.",
    icon: Compass,
    iconClassName: "bg-primary/10 text-primary",
  },
  {
    title: "Club directory and search",
    description:
      "Browse 96 official clubs by category, search by name, compare member counts, and filter by commitment level.",
    icon: Search,
    iconClassName: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  {
    title: "Calendar with Outlook sync",
    description:
      "Students can see club events beside their schedule and connect Microsoft Outlook calendar data for conflict awareness.",
    icon: CalendarDays,
    iconClassName: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  {
    title: "AI club chatbot",
    description:
      "Ask for club suggestions, upcoming events, announcements, and campus-fit recommendations grounded in real club data.",
    icon: MessageCircle,
    iconClassName: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  {
    title: "Event management",
    description:
      "Create events, manage capacity and waitlists, track registrations, check students in, and edit event timing from the admin calendar.",
    icon: CalendarCheck,
    iconClassName: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  {
    title: "AI event generator",
    description:
      "Club boards can generate event reports, speaker and sponsor material, announcement emails, social posts, and poster assets.",
    icon: Bot,
    iconClassName: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
  },
  {
    title: "Analytics and reporting",
    description:
      "Club admins get member, event, post, and finance analytics; university admins can review activity and funding across clubs.",
    icon: BarChart3,
    iconClassName: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  },
  {
    title: "Member exports",
    description:
      "Club boards can export member lists as CSV or PDF, including profile fields and role/status information.",
    icon: Download,
    iconClassName: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
];

const boardFeatures = [
  {
    title: "Membership and roles",
    description:
      "Review join requests, keep board/member roles organized, and maintain membership audit history.",
    icon: UserCheck,
  },
  {
    title: "Posts and announcements",
    description:
      "Share announcements, posts, images, and member-only information from one place.",
    icon: Megaphone,
  },
  {
    title: "AI event campaign builder",
    description:
      "Use AI to turn an event idea into a launch-ready package with a report, venue notes, sponsor and speaker outreach, announcement emails, social posts, and poster assets.",
    icon: Bot,
  },
  {
    title: "Reports and exports",
    description:
      "Use admin reports, overlap statistics, finance summaries, and CSV/PDF member exports when clubs need records.",
    icon: FileText,
  },
];

const studentHighlights = [
  {
    title: "Personalized feed",
    description: "See posts, announcements, and updates from clubs that match your activity and interests.",
    icon: Compass,
  },
  {
    title: "Smart recommendations",
    description: "Find clubs through interest, category, activity, and shared-membership signals.",
    icon: Sparkles,
  },
  {
    title: "Calendar sync",
    description: "View club events alongside your student schedule and Microsoft Outlook availability, so you can spot conflicts before joining, registering, or helping plan an event.",
    icon: CalendarDays,
  },
  {
    title: "AI club assistant",
    description: "Ask for club suggestions, upcoming events, announcements, and what to join next based on your goals.",
    icon: MessageCircle,
  },
];

function FeatureTile({
  title,
  description,
  icon: Icon,
  iconClassName,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  iconClassName: string;
}) {
  return (
    <div className="rounded-md border bg-card p-5 shadow-sm">
      <div className={`mb-5 flex size-11 items-center justify-center rounded-md ${iconClassName}`}>
        <Icon className="size-5" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function WorkflowItem({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="flex gap-4 py-4 first:pt-0 last:pb-0">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function WorkflowPanel({
  title,
  description,
  icon: Icon,
  items,
  iconClassName,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  items: typeof studentHighlights;
  iconClassName: string;
}) {
  return (
    <div className="rounded-md border bg-card p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className={`flex size-12 shrink-0 items-center justify-center rounded-md ${iconClassName}`}>
          <Icon className="size-6" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold">{title}</h2>
          <p className="mt-3 leading-7 text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="mt-6 divide-y divide-border">
        {items.map((feature) => (
          <WorkflowItem key={feature.title} {...feature} />
        ))}
      </div>
    </div>
  );
}

export function LandingPageView() {
  return (
    <>
      <AuthCallbackHandler redirectTo="/auth/verified" />
      <div className="min-h-screen bg-background text-foreground">
        <section className="relative min-h-[86svh] overflow-hidden">
          <Image
            src="/image.png"
            alt="Aerial view of the American University of Beirut campus"
            fill
            priority
            sizes="100vw"
            className="object-cover object-[center_45%]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(17,20,24,0.94)_0%,rgba(17,20,24,0.78)_45%,rgba(17,20,24,0.28)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background to-transparent" />

          <div className="relative z-10 mx-auto flex max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
            <nav className="flex items-center justify-between">
              <Link href="/" className="flex items-center gap-3 text-white">
                <Image
                  src="/favicon.ico"
                  alt="AUB Clubs"
                  width={32}
                  height={32}
                  unoptimized
                  className="size-8"
                />
                <span className="text-sm font-semibold sm:text-base">AUB Clubs</span>
              </Link>

              <div className="flex items-center gap-2">
                <Button
                  asChild
                  variant="ghost"
                  className="text-white hover:bg-white/10 hover:text-white"
                >
                  <Link href="/auth">Sign in</Link>
                </Button>
                <Button asChild className="bg-white text-primary hover:bg-white/90">
                  <Link href="/auth?tab=sign-up">Create account</Link>
                </Button>
              </div>
            </nav>

            <div className="flex min-h-[calc(86svh-5rem)] max-w-4xl flex-col justify-center py-14">
              <p className="mb-5 max-w-xl text-sm font-medium text-white/80">
                Student life at the American University of Beirut
              </p>
              <h1 className="max-w-3xl text-5xl font-semibold leading-none text-white sm:text-6xl lg:text-7xl">
                AUB Clubs
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-white/85 sm:text-xl">
                Discover official clubs, follow a personalized feed, sync your
                calendar, ask the AI assistant, and give club boards real tools
                for events, reports, exports, and operations.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-11 w-full sm:w-auto">
                  <Link href="/auth?tab=sign-up">
                    Join with your AUB email
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-11 w-full border-white/35 bg-white/10 text-white hover:bg-white/20 hover:text-white sm:w-auto"
                >
                  <Link href="/auth">Sign in</Link>
                </Button>
              </div>

              <div className="mt-10 grid max-w-2xl grid-cols-3 border-y border-white/20 text-white">
                <div className="py-4 pr-4">
                  <p className="text-3xl font-semibold">96</p>
                  <p className="mt-1 text-xs text-white/70 sm:text-sm">Official clubs</p>
                </div>
                <div className="border-x border-white/20 px-4 py-4">
                  <p className="text-3xl font-semibold">MS</p>
                  <p className="mt-1 text-xs text-white/70 sm:text-sm">Outlook sync</p>
                </div>
                <div className="py-4 pl-4">
                  <p className="text-3xl font-semibold">AI</p>
                  <p className="mt-1 text-xs text-white/70 sm:text-sm">Assistant and event generator</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b bg-background">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
            <div>
              <div className="mb-4 flex size-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Sparkles className="size-5" />
              </div>
              <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">
                The actual club operating system.
              </h2>
              <p className="mt-4 max-w-xl leading-7 text-muted-foreground">
                The landing page should reflect what is already in the app:
                recommendations, feeds, Outlook calendar sync, event management,
                AI tools, analytics, exports, finance, and admin reporting.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {categories.map((category) => (
                <div
                  key={category}
                  className="flex min-h-12 items-center justify-between rounded-md border bg-muted/35 px-4 py-3 text-sm font-medium"
                >
                  <span>{category}</span>
                  <CheckCircle2 className="size-4 text-primary" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">
                Everything students and boards actually use.
              </h2>
              <p className="mt-4 leading-7 text-muted-foreground">
                AUB Clubs is not just a directory. It connects discovery,
                scheduling, AI assistance, events, reporting, and exports into
                one workflow.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {platformFeatures.map((feature) => (
                <FeatureTile key={feature.title} {...feature} />
              ))}
            </div>
          </div>
        </section>

        <section className="bg-background">
          <div className="mx-auto grid max-w-7xl items-stretch gap-6 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8">
            <WorkflowPanel
              title="For students"
              description="Use the feed, recommendation system, search, club pages, request tracking, calendars, Outlook sync, and the AI club assistant to find where you fit on campus."
              icon={Users}
              iconClassName="bg-primary text-primary-foreground"
              items={studentHighlights}
            />

            <WorkflowPanel
              title="For club boards"
              description="Run the practical side of the club: membership, events, attendance, calendar conflict stats, finance logs, posts, reports, AI event generation, and exports."
              icon={ShieldCheck}
              iconClassName="bg-emerald-600 text-white"
              items={boardFeatures}
            />
          </div>
        </section>

        <section className="border-y bg-primary text-primary-foreground">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold">Ready for campus life in one place?</h2>
              <p className="mt-2 text-primary-foreground/80">
                Use your AUB email to access clubs, recommendations, calendars,
                AI tools, event management, reports, and exports.
              </p>
            </div>
            <Button asChild size="lg" className="h-11 bg-white text-primary hover:bg-white/90">
              <Link href="/auth?tab=sign-up">
                Get started
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>

        <footer className="bg-background">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
            <p className="font-medium text-foreground">AUB Clubs Platform</p>
            <p>2026 American University of Beirut. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </>
  );
}
