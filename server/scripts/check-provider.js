const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
const schemaContent = fs.readFileSync(schemaPath, 'utf8');

// Detect environment
const dbUrl = process.env.DATABASE_URL || '';
const isPostgres = dbUrl.startsWith('postgres') || process.env.NODE_ENV === 'production';
const targetProvider = isPostgres ? 'postgresql' : 'sqlite';

console.log(`[Check Provider] Detected DB URL starting with: ${dbUrl.substring(0, 10)}...`);
console.log(`[Check Provider] Target provider: ${targetProvider}`);

let newContent = schemaContent;

if (targetProvider === 'postgresql') {
  newContent = schemaContent.replace('provider = "sqlite"', 'provider = "postgresql"');
} else {
  newContent = schemaContent.replace('provider = "postgresql"', 'provider = "sqlite"');
}

if (newContent !== schemaContent) {
  fs.writeFileSync(schemaPath, newContent);
  console.log(`[Check Provider] Updated schema.prisma to use ${targetProvider}`);
} else {
  console.log(`[Check Provider] Schema already uses ${targetProvider}`);
}
