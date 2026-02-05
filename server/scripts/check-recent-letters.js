
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const letters = await prisma.futureLetter.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log('Recent letters:', JSON.stringify(letters, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
