// scripts/make-admin.js
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const name = process.argv[3] || email?.split("@")[0]; // Use part before @ as default name

  if (!email) {
    console.error("❌ Please provide an email address");
    console.log(
      "Usage: node scripts/make-admin.js your@email.com [optional-name]",
    );
    process.exit(1);
  }

  console.log(`🔍 Looking for user with email: ${email}`);

  // Try to find existing user
  let user = await db.user.findUnique({
    where: { email },
  });

  if (user) {
    console.log(`👤 Found existing user: ${user.name || user.email}`);

    // Update existing user to admin
    user = await db.user.update({
      where: { email },
      data: {
        role: "ADMIN",
        tenantId: null, // Admin users don't belong to a specific tenant
      },
    });
    console.log(`✅ Updated ${email} to ADMIN role`);
  } else {
    console.log(`👤 User not found, creating new admin user...`);

    // Create new admin user (without password - will be set on first login)
    user = await db.user.create({
      data: {
        email,
        name,
        role: "ADMIN",
        tenantId: null, // Admin users don't belong to a specific tenant
        emailVerified: new Date(), // Mark as verified since we're manually creating
      },
    });
    console.log(`✅ Created new ADMIN user: ${email}`);
  }

  console.log("\n🎯 Setup Complete! Next steps:");
  console.log("1. Start your dev server: npm run dev");
  console.log("2. Go to: http://localhost:3000/auth/signin");
  console.log(`3. Sign in with:`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Password: [any password] (will be set on first login)`);
  console.log("4. After signing in, go to: /admin/dashboard");
  console.log("\n📧 Admin user details:");
  console.log(`   Email: ${user.email}`);
  console.log(`   Name: ${user.name}`);
  console.log(`   Role: ${user.role}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
