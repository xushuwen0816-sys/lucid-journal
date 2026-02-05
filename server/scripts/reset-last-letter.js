
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const lastLetter = await prisma.futureLetter.findFirst({
    orderBy: { createdAt: 'desc' }
  });

  if (lastLetter) {
    console.log(`Resetting letter ${lastLetter.id}...`);
    await prisma.futureLetter.update({
      where: { id: lastLetter.id },
      data: { isSent: false }
    });
    console.log('Reset complete. Scheduler should pick it up shortly.');
  } else {
    console.log('No letters found.');
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
