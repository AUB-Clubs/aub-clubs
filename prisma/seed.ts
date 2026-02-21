import { prisma } from '../src/lib/prisma';
import { ClubRole, PostType } from '../src/generated/prisma/enums';
import { faker } from '@faker-js/faker';
import { uuid } from 'zod';

async function main() {
  console.log('Start seeding ...');

  // CLEANUP
  await prisma.upvote.deleteMany();
  await prisma.postImage.deleteMany();
  await prisma.post.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.club.deleteMany();
  await prisma.user.deleteMany();

  console.log('Database cleaned.');

  // --- 100 USERS ---
  const users = [];

  // Create 3 specific users (Alice, Bob, Charlie) first for deterministic testing
  const staticUsersData = [
    {
      id: "0000",
      aubnetId: 10001,
      email: 'alice@aub.edu.lb',
      firstName: 'Alice',
      lastName: 'Wonderland',
      dob: new Date('2003-01-01'),
      major: 'Computer Science',
      year: 3,
      bio: "I love exploring datasabses and wonderland",
      avatarUrl: faker.image.avatar(),
    },
    {
      id: "0001",
      aubnetId: 10002,
      email: 'bob@aub.edu.lb',
      firstName: 'Bob',
      lastName: 'Builder',
      dob: new Date('2002-05-20'),
      major: 'Civil Engineering',
      year: 4,
      bio: "Can we fix it? Yes we can!",
      avatarUrl: faker.image.avatar(),
    },
    {
      id: "0002",
      aubnetId: 10003,
      email: 'charlie@aub.edu.lb',
      firstName: 'Charlie',
      lastName: 'Chaplin',
      dob: new Date('2001-12-25'),
      major: 'Performing Arts',
      year: 2,
      bio: "Silent but funny",
      avatarUrl: faker.image.avatar(),
    }
  ];

  for (const userData of staticUsersData) {
    const user = await prisma.user.create({ data: userData });
    users.push(user);
  }

  // Define majors for random picking
  const majors = ['Computer Science', 'Business', 'Engineering', 'Psychology', 'Economics', 'Biology', 'Nursing', 'Architecture'];

  // Add remaining 97 random users
  console.log('Generating random users...');
  for (let i = 0; i < 97; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    // Ensure unique email and AubnetID
    const email = faker.internet.email({ firstName, lastName, provider: 'aub.edu.lb' });
    const aubnetId = 20000 + i; 

    const user = await prisma.user.create({
      data: {
        id: faker.string.uuid(), // Generate a random UUID for Clerk User ID
        aubnetId: aubnetId,
        email: email, 
        firstName: firstName,
        lastName: lastName,
        dob: faker.date.birthdate({ min: 18, max: 25, mode: 'age' }),
        bio: faker.person.bio(),
        avatarUrl: faker.image.avatar(),
        major: faker.helpers.arrayElement(majors),
        year: faker.number.int({ min: 1, max: 5 }),
      },
    });
    users.push(user);
  }
  console.log(`Created ${users.length} users.`);


  // --- 10 CLUBS ---
  const clubs = [];
  console.log('Generating clubs...');
  
  // Specific clubs
  const staticClubsData = [
    {
      crn: 12345,
      title: 'Computer Science Student Society',
      description: 'The official club for CMPS students at AUB.',
      imageUrl: 'https://placehold.co/100x100/png',
      bannerUrl: 'https://placehold.co/1200x300/png',
    },
    {
      crn: 67890,
      title: 'AUB Robotics Club',
      description: 'Building the future, one robot at a time.',
      imageUrl: 'https://placehold.co/100x100/png',
      bannerUrl: 'https://placehold.co/1200x300/png',
    }
  ];

  for(const clubData of staticClubsData) {
      const club = await prisma.club.create({ data: clubData });
      clubs.push(club);
  }

  // Generate 8 more random clubs
  for (let i = 0; i < 8; i++) {
    const clubTitle = faker.company.name() + ' Club';
    const club = await prisma.club.create({
      data: {
        crn: 1000 + i, // Simple unique CRN
        title: clubTitle,
        description: faker.lorem.paragraph(),
        imageUrl: faker.image.urlLoremFlickr({ category: 'abstract', width: 100, height: 100 }), // Using placeholders or faker image
        bannerUrl: faker.image.urlLoremFlickr({ category: 'abstract', width: 1200, height: 300 }),
      },
    });
    clubs.push(club);
  }
  console.log(`Created ${clubs.length} clubs.`);


  // --- MEMBERSHIPS ---
  console.log('Generating memberships...');
  // Ensure every club has at least one President and some members
  for (const club of clubs) {
     // Pick a random user to be president
     const president = faker.helpers.arrayElement(users);
     
     // Check if already member
     const existingPres = await prisma.membership.findUnique({
         where: { userId_clubId: { userId: president.id, clubId: club.id } }
     });

     if (!existingPres) {
        await prisma.membership.create({
            data: {
                userId: president.id,
                clubId: club.id,
                role: ClubRole.PRESIDENT
            }
        });
     }

     // Add random number of members (5-20)
     const numberOfMembers = faker.number.int({ min: 5, max: 20 });
     const randomUsers = faker.helpers.arrayElements(users, numberOfMembers);

     for (const member of randomUsers) {
         // Skip if same as president to avoid unique constraint error
         if (member.id === president.id) continue;

         const existing = await prisma.membership.findUnique({
            where: { userId_clubId: { userId: member.id, clubId: club.id } }
         });

         if (!existing) {
             await prisma.membership.create({
                 data: {
                     userId: member.id,
                     clubId: club.id,
                     role: faker.helpers.arrayElement([ClubRole.MEMBER, ClubRole.VICE_PRESIDENT, ClubRole.MEMBER, ClubRole.MEMBER]), // skew towards MEMBER
                 }
             });
         }
     }
  }


  // --- 200 POSTS ---
  console.log('Generating posts...');
  for (let i = 0; i < 200; i++) {
    const club = faker.helpers.arrayElement(clubs);
    
    // Get members of this club to be the author
    const memberships = await prisma.membership.findMany({
        where: { clubId: club.id },
        include: { user: true } // get user details
    });

    if (memberships.length === 0) continue; 

    // Important: To generate posts we need an author who is a member.
    // However, if we loop 200 times and do DB queries inside, it might be slow but it's fine for seeding 200 items.
    const randomMember = faker.helpers.arrayElement(memberships).user;

    const post = await prisma.post.create({
      data: {
        title: faker.lorem.sentence({ min: 3, max: 8 }),
        content: faker.lorem.paragraphs({ min: 1, max: 3 }),
        type: faker.helpers.arrayElement([PostType.ANNOUNCEMENT, PostType.GENERAL]),
        clubId: club.id,
        authorId: randomMember.id,
        createdAt: faker.date.past() // Random date in the past
      },
    });
    
    // Add some random upvotes (0-20)
    const numUpvotes = faker.number.int({ min: 0, max: 20 });
    const randomVoters = faker.helpers.arrayElements(users, numUpvotes);
    
    for (const voter of randomVoters) {
        
        await prisma.upvote.create({
            data: {
                userId: voter.id,
                postId: post.id
            }
        });
    }
  }
  console.log('Created 200 posts with random upvotes.');

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
