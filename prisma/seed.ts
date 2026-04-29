import { prisma } from '../src/lib/prisma';
import fs from 'fs';
import path from 'path';
import type { ClubType } from '../src/generated/prisma';

const FALLBACK_AUTHOR_EMAIL = 'seed-author@aub.test';
const DEFAULT_E2E_USER_ID = "00000000-0000-4000-8000-000000000001";
const E2E_USER_EMAIL = "e2e-user@aub.test";
const TOTAL_POSTS = 100;
const TARGET_CLUB_COUNT = 40;

type SeedPost = {
  title: string;
  content: string;
  type: 'ANNOUNCEMENT' | 'GENERAL';
  status: 'PUBLISHED';
  audience: 'PUBLIC';
  priority: 'GENERAL' | 'IMPORTANT';
  createdAt: Date;
  clubId: string;
  authorId: string;
};

const announcementTemplates = [
  {
    title: 'Clubs Fair Booth Volunteer Sign-Up',
    content:
      'OSA runs Clubs and Societies Fair each fall, so we are opening volunteer slots for booth setup, walk-up demos, and member onboarding coverage.',
    priority: 'IMPORTANT' as const,
  },
  {
    title: 'Cabinet Transition Prep (April Cycle)',
    content:
      'Cabinet transition activities start in April. We are collecting nominations, role preferences, and handover notes so incoming officers can onboard quickly.',
    priority: 'GENERAL' as const,
  },
  {
    title: 'New Member Orientation Week',
    content:
      'Orientation week includes a 30-minute intro to the club roadmap, communication channels, committee structure, and contribution tracks for first-year members.',
    priority: 'GENERAL' as const,
  },
  {
    title: 'Semester Projects: Call for Leads',
    content:
      'Project proposals are open. Submit a one-page plan with goals, timeline, and resource needs; leads will be selected based on feasibility and member interest.',
    priority: 'IMPORTANT' as const,
  },
];

const generalTemplates = [
  {
    title: 'Workshop Recap and Slide Deck',
    content:
      'Thanks to everyone who attended this week. We uploaded the slides, references, and practice tasks; comments are open for follow-up questions.',
  },
  {
    title: 'Open Office Hours This Week',
    content:
      'Cabinet members will run office hours for member support on planning, logistics, and skill-building. Drop in for 10-15 minute discussions.',
  },
  {
    title: 'Collaboration Thread: Ideas Needed',
    content:
      'Use this thread to suggest cross-club collaborations. We are especially looking for projects that combine technical depth with community impact.',
  },
  {
    title: 'Member Spotlight',
    content:
      'This week we are highlighting members who contributed to event operations, content creation, and outreach. Thank you for keeping momentum high.',
  },
  {
    title: 'Weekly Progress Check-In',
    content:
      'Share blockers, wins, and what you plan to complete next week. Keeping updates concise helps committee leads unblock work quickly.',
  },
];

const worldAnchors = {
  worldOceansDay: 'World Oceans Day is observed annually on June 8.',
  coastalCleanup: 'International Coastal Cleanup events are organized globally in September.',
  ieeeDay: 'IEEE Day is observed on the first Tuesday of October.',
  ieeextreme: 'IEEEXtreme is a 24-hour programming competition with teams of 1-3 IEEE student members.',
};

function typeSpecificLine(types: ClubType[], clubTitle: string): string {
  if (types.includes('TECHNOLOGY')) {
    return `${worldAnchors.ieeextreme} ${clubTitle} members can join prep circles for problem-solving and team matching.`;
  }
  if (types.includes('ENVIRONMENTAL')) {
    return `${worldAnchors.worldOceansDay} ${worldAnchors.coastalCleanup} We are aligning our field activities and data collection around those calendars.`;
  }
  if (types.includes('BUSINESS')) {
    return 'This cycle focuses on case practice, industry exposure, and practical portfolio projects members can present at interviews.';
  }
  if (types.includes('HEALTH_WELLNESS')) {
    return 'We are prioritizing evidence-based sessions, peer support, and accessible participation formats for all members.';
  }
  if (types.includes('ARTS')) {
    return 'This cycle emphasizes production quality, rehearsal discipline, and public showcases with clear creative direction.';
  }
  if (types.includes('CULTURAL')) {
    return 'Expect culture-focused programming with inclusive participation, historical context, and community storytelling.';
  }
  if (types.includes('SPORTS')) {
    return 'Training sessions will follow progressive difficulty with attendance tracking and peer coaching rotations.';
  }
  if (types.includes('ACADEMIC')) {
    return 'Academic tracks include peer tutoring, topic circles, and short applied sessions tied to course outcomes.';
  }
  if (types.includes('MEDIA')) {
    return 'Media teams are running story-pitch pipelines, editing reviews, and publishing schedules with clear deadlines.';
  }
  return 'We are structuring weekly activities around practical learning, member retention, and measurable outcomes.';
}

async function ensureAuthorPool() {
  const existingUsers = await prisma.user.findMany({
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    take: 12,
  });

  if (existingUsers.length > 0) return existingUsers;

  const fallback = await prisma.user.upsert({
    where: { email: FALLBACK_AUTHOR_EMAIL },
    update: {},
    create: {
      email: FALLBACK_AUTHOR_EMAIL,
      emailVerified: true,
      onboardingCompleted: true,
      firstName: 'Seed',
      lastName: 'Author',
      major: 'Undeclared',
      year: 1,
    },
    select: { id: true },
  });

  return [fallback];
}

async function ensureE2EUser() {
  const e2eUserId = process.env.E2E_AUTH_USER_ID ?? DEFAULT_E2E_USER_ID;

  await prisma.user.upsert({
    where: { id: e2eUserId },
    update: {
      email: E2E_USER_EMAIL,
      emailVerified: true,
      onboardingCompleted: true,
      firstName: "E2E",
      lastName: "User",
      major: "Computer Science",
      year: 2,
    },
    create: {
      id: e2eUserId,
      email: E2E_USER_EMAIL,
      emailVerified: true,
      onboardingCompleted: true,
      firstName: "E2E",
      lastName: "User",
      major: "Computer Science",
      year: 2,
    },
  });
}

async function main() {
  console.log('Start seeding ...');

  // Keep users intact. Only reset memberships and clubs.
  await prisma.membership.deleteMany();
  await prisma.club.deleteMany();
  console.log('Existing memberships and clubs deleted.');

  const clubs = [];
  console.log('Generating clubs from clubs.json...');

  const clubsJsonPath = path.join(process.cwd(), 'clubs.json');
  const realClubsData = JSON.parse(fs.readFileSync(clubsJsonPath, 'utf8'));

  for (const clubData of realClubsData) {
    const club = await prisma.club.create({
      data: {
        crn: clubData.crn,
        title: clubData.title,
        description: clubData.description,
        types: clubData.types,
        imageUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(clubData.title)}&background=random`,
        bannerUrl: 'https://placehold.co/1200x300/png',
      },
    });
    clubs.push(club);
  }
  console.log(`Created ${clubs.length} clubs.`);

  await ensureE2EUser();
  const authorPool = await ensureAuthorPool();
  const clubsForPosts = clubs.slice(0, Math.min(TARGET_CLUB_COUNT, clubs.length));

  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const postsToSeed: SeedPost[] = [];

  if (clubsForPosts.length > 0) {
    const basePostsPerClub = Math.floor(TOTAL_POSTS / clubsForPosts.length);
    const remainder = TOTAL_POSTS % clubsForPosts.length;

    clubsForPosts.forEach((club, clubIndex) => {
      const count = basePostsPerClub + (clubIndex < remainder ? 1 : 0);
      const clubContext = typeSpecificLine(club.types as ClubType[], club.title);
      const author = authorPool[clubIndex % authorPool.length];

      for (let i = 0; i < count; i += 1) {
        const isAnnouncement = i % 3 === 0;
        const cycle = Math.floor(i / 3) + 1;

        if (isAnnouncement) {
          const tmpl = announcementTemplates[(clubIndex + i) % announcementTemplates.length];
          postsToSeed.push({
            clubId: club.id,
            authorId: author.id,
            title: `${tmpl.title} - ${club.title}`,
            content: `${tmpl.content} ${clubContext} Update cycle: ${cycle}.`,
            type: 'ANNOUNCEMENT',
            status: 'PUBLISHED',
            audience: 'PUBLIC',
            priority: tmpl.priority,
            createdAt: daysAgo(clubIndex * 3 + i + 1),
          });
        } else {
          const tmpl = generalTemplates[(clubIndex + i) % generalTemplates.length];
          postsToSeed.push({
            clubId: club.id,
            authorId: author.id,
            title: `${tmpl.title} - ${club.title}`,
            content: `${tmpl.content} ${clubContext} Week ${cycle} notes posted for members.`,
            type: 'GENERAL',
            status: 'PUBLISHED',
            audience: 'PUBLIC',
            priority: 'GENERAL',
            createdAt: daysAgo(clubIndex * 3 + i + 1),
          });
        }
      }
    });
  }

  if (postsToSeed.length > 0) {
    await prisma.post.createMany({ data: postsToSeed });
    console.log(`Seeded ${postsToSeed.length} published posts across ${clubsForPosts.length} clubs.`);
  } else {
    console.warn('No clubs found for post seeding.');
  }

  console.log('Seeding finished.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
