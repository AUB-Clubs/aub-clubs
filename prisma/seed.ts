import { prisma } from '../src/lib/prisma';
import fs from 'fs';
import path from 'path';

const E2E_USER_ID = '00000000-0000-4000-8000-000000000001';

async function main() {
  console.log('Start seeding ...');

  // CLEANUP: only clear clubs (dependent records are removed by cascade)
  await prisma.club.deleteMany();
  console.log('Existing clubs deleted.');

  const clubs = [];
  console.log('Generating real clubs from clubs.json...');

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
      }
    });
    clubs.push(club);
  }
  console.log(`Created ${clubs.length} clubs.`);

  await prisma.user.upsert({
    where: { id: E2E_USER_ID },
    update: {
      email: 'e2e-user@aub.test',
      emailVerified: true,
      onboardingCompleted: true,
      firstName: 'E2E',
      lastName: 'User',
      aubnetId: 99999999,
      major: 'Computer Science',
      year: 4,
    },
    create: {
      id: E2E_USER_ID,
      email: 'e2e-user@aub.test',
      emailVerified: true,
      onboardingCompleted: true,
      firstName: 'E2E',
      lastName: 'User',
      aubnetId: 99999999,
      major: 'Computer Science',
      year: 4,
    },
  });
  console.log('E2E test user ensured.');

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
