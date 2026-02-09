import { prisma } from '../src/lib/prisma';
import { ClubRole, PostType } from '../src/generated/prisma/enums';

async function main() {
  console.log('Start seeding ...');

  // CLEANUP
  await prisma.upvote.deleteMany();
  await prisma.post.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.club.deleteMany();
  await prisma.user.deleteMany();

  // USERS
  const alice = await prisma.user.create({
    data: {
      aubnetId: 10001,
      email: 'alice@aub.edu.lb',
      firstName: 'Alice',
      lastName: 'Wonderland',
      dob: new Date('2003-01-01'),
    },
  });

  const bob = await prisma.user.create({
    data: {
      aubnetId: 10002,
      email: 'bob@aub.edu.lb',
      firstName: 'Bob',
      lastName: 'Builder',
      dob: new Date('2002-05-20'),
    },
  });

  const charlie = await prisma.user.create({
    data: {
      aubnetId: 10003,
      email: 'charlie@aub.edu.lb',
      firstName: 'Charlie',
      lastName: 'Chaplin',
      dob: new Date('2001-12-25'),
    },
  });

  console.log('Created users:', alice.firstName, bob.firstName, charlie.firstName);

  // CLUBS
  const cmpsClub = await prisma.club.create({
    data: {
      crn: 12345,
      title: 'Computer Science Student Society',
      description: 'The official club for CMPS students at AUB.',
      image_url: 'https://placehold.co/100x100/png',
      banner_url: 'https://placehold.co/1200x300/png',
    },
  });

  const roboticsClub = await prisma.club.create({
    data: {
      crn: 67890,
      title: 'AUB Robotics Club',
      description: 'Building the future, one robot at a time.',
      image_url: 'https://placehold.co/100x100/png',
      banner_url: 'https://placehold.co/1200x300/png',
    },
  });

  console.log('Created clubs:', cmpsClub.title, roboticsClub.title);

  // MEMBERSHIPS
  await prisma.membership.create({
    data: {
      userId: alice.id,
      clubId: cmpsClub.id,
      role: ClubRole.PRESIDENT,
    },
  });

  await prisma.membership.create({
    data: {
      userId: bob.id,
      clubId: cmpsClub.id,
      role: ClubRole.MEMBER,
    },
  });

  await prisma.membership.create({
    data: {
      userId: charlie.id,
      clubId: roboticsClub.id,
      role: ClubRole.VICE_PRESIDENT,
    },
  });

  // POSTS
  await prisma.post.create({
    data: {
      title: 'Welcome to CSSS!',
      content: 'We are excited to start a new semester.',
      type: PostType.ANNOUNCEMENT,
      authorId: alice.id,
      clubId: cmpsClub.id,
      postImages : {
        create: [
          {
            imageUrl: 'https://placehold.co/600x400/png',
          },
        ],
      }
    },
  });

  await prisma.post.create({
    data: {
      title: 'Robotics Workshop',
      content: 'Join us for a workshop on Arduino.',
      type: PostType.GENERAL,
      authorId: charlie.id,
      clubId: roboticsClub.id,
      postImages : {
        create: [
          {
            imageUrl: 'https://placehold.co/600x400/png',
          },
        ],
      }
    },
  });

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
