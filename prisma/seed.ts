import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@jsquarephotography.com';
  const name = process.env.SEED_ADMIN_NAME || 'J Square Admin';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`SuperAdmin already exists: ${existing.email} (${existing.id}). Password unchanged.`);
    return;
  }

  let password = process.env.SEED_ADMIN_PASSWORD;
  let generated = false;
  if (!password) {
    password = crypto.randomBytes(12).toString('base64url');
    generated = true;
  } else if (password.length < 8) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 8 characters long');
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  console.log(`SuperAdmin seeded: ${user.email} (${user.id})`);
  if (generated) {
    console.log('');
    console.log('=================================================================');
    console.log(`  Generated password (save this now, it will not be shown again):`);
    console.log(`  ${password}`);
    console.log('  Log in and change it immediately under Team Management.');
    console.log('=================================================================');
  }
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
