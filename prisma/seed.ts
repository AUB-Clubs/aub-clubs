import { prisma } from '../src/lib/prisma';
import fs from 'fs';
import path from 'path';

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
