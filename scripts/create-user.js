// scripts/create-user.js
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const tenantSlug = process.argv[3];
  const name = process.argv[4] || email?.split("@")[0];

  if (!email || !tenantSlug) {
    console.error("❌ Please provide email and tenant slug");
    console.log(
      "Usage: node scripts/create-user.js user@email.com tenant-slug [optional-name]",
    );
    console.log("\nAvailable tenants:");

    const tenants = await db.tenant.findMany({
      select: { slug: true, name: true },
    });

    if (tenants.length === 0) {
      console.log("   No tenants found. Run: node scripts/seed.js");
    } else {
      tenants.forEach((tenant) => {
        console.log(`   • ${tenant.slug} - ${tenant.name}`);
      });
    }

    process.exit(1);
  }

  // Find the tenant
  const tenant = await db.tenant.findUnique({
    where: { slug: tenantSlug },
  });

  if (!tenant) {
    console.error(`❌ Tenant with slug '${tenantSlug}' not found`);
    console.log("\nAvailable tenants:");

    const tenants = await db.tenant.findMany({
      select: { slug: true, name: true },
    });

    tenants.forEach((tenant) => {
      console.log(`   • ${tenant.slug} - ${tenant.name}`);
    });

    process.exit(1);
  }

  console.log(`🔍 Looking for user with email: ${email}`);

  // Try to find existing user
  let user = await db.user.findUnique({
    where: { email },
  });

  if (user) {
    console.log(`👤 Found existing user: ${user.name || user.email}`);

    // Update existing user
    user = await db.user.update({
      where: { email },
      data: {
        role: "USER",
        tenantId: tenant.id,
      },
    });
    console.log(`✅ Updated ${email} to USER role for tenant: ${tenant.name}`);
  } else {
    console.log(`👤 User not found, creating new user...`);

    // Create new user
    user = await db.user.create({
      data: {
        email,
        name,
        role: "USER",
        tenantId: tenant.id,
        emailVerified: new Date(),
      },
    });
    console.log(`✅ Created new USER: ${email} for tenant: ${tenant.name}`);
  }

  console.log("\n🎯 User Setup Complete! Test with:");
  console.log("1. Go to: http://localhost:3000/auth/signin");
  console.log(`2. Sign in with:`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Password: [any password] (will be set on first login)`);
  console.log(`3. You'll be redirected to: /tenant/${tenant.slug}/dashboard`);
  console.log("\n👤 User details:");
  console.log(`   Email: ${user.email}`);
  console.log(`   Name: ${user.name}`);
  console.log(`   Role: ${user.role}`);
  console.log(`   Tenant: ${tenant.name} (${tenant.slug})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
