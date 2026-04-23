import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const alice = await prisma.user.upsert({
    where: { phoneNumber: '+15550000001' },
    update: {},
    create: {
      phoneNumber: '+15550000001',
      displayName: 'Alice',
    },
  });

  const bob = await prisma.user.upsert({
    where: { phoneNumber: '+15550000002' },
    update: {},
    create: {
      phoneNumber: '+15550000002',
      displayName: 'Bob',
    },
  });

  const trip = await prisma.trip.create({
    data: {
      name: 'Southeast Asia Escape',
      startDate: new Date('2026-11-03'),
      endDate: new Date('2026-11-17'),
      budgetTotal: 5000,
      budgetCurrency: 'USD',
      travelStyle: 'mixed',
      members: {
        create: [
          { userId: alice.id, role: 'organizer' },
          { userId: bob.id, role: 'member' },
        ],
      },
      destinations: {
        create: [
          { name: 'Bangkok', country: 'Thailand', orderIndex: 0 },
          { name: 'Chiang Mai', country: 'Thailand', orderIndex: 1 },
        ],
      },
      tasks: {
        create: [
          { title: 'Book flights', priority: 'high', category: 'booking' },
          { title: 'Check visa requirements', priority: 'high', category: 'documents' },
        ],
      },
      decisions: {
        create: [
          { topic: 'Trip timing', decision: 'November is best for weather', decidedBy: 'both' },
        ],
      },
    },
  });

  await prisma.userPreference.createMany({
    data: [
      { userId: alice.id, category: 'food', key: 'street_food', value: 'yes', source: 'explicit', confidence: 0.9 },
      { userId: bob.id, category: 'accommodation', key: 'style', value: 'boutique_hotel', source: 'explicit', confidence: 0.9 },
    ],
    skipDuplicates: true,
  });

  console.log(`Seed complete for trip: ${trip.name}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
