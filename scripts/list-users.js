// scripts/list-users.js
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("👥 Current Users:\n");

  const users = await db.user.findMany({
    include: {
      tenant: {
        select: { name: true, slug: true },
      },
    },
    orderBy: [{ role: "asc" }, { email: "asc" }],
  });

  if (users.length === 0) {
    console.log("No users found.");
    console.log("\nCreate users with:");
    console.log("  Admin: node scripts/make-admin.js admin@example.com");
    console.log(
      "  User:  node scripts/create-user.js user@example.com tenant-slug",
    );
    return;
  }

  // Group by role
  const admins = users.filter((u) => u.role === "ADMIN");
  const regularUsers = users.filter((u) => u.role === "USER");

  if (admins.length > 0) {
    console.log("🔧 ADMINS:");
    admins.forEach((user) => {
      console.log(`   📧 ${user.email}`);
      console.log(`      Name: ${user.name || "Not set"}`);
      console.log(`      Login: http://localhost:3000/auth/signin`);
      console.log(`      Goes to: /admin/dashboard`);
      console.log("");
    });
  }

  if (regularUsers.length > 0) {
    console.log("👤 TENANT USERS:");
    regularUsers.forEach((user) => {
      console.log(`   📧 ${user.email}`);
      console.log(`      Name: ${user.name || "Not set"}`);
      console.log(
        `      Tenant: ${user.tenant?.name || "None"} (${user.tenant?.slug || "no-slug"})`,
      );
      console.log(`      Login: http://localhost:3000/auth/signin`);
      console.log(
        `      Goes to: /tenant/${user.tenant?.slug || "unknown"}/dashboard`,
      );
      console.log("");
    });
  }

  console.log("📊 Quick Stats:");
  console.log(`   Total Users: ${users.length}`);
  console.log(`   Admins: ${admins.length}`);
  console.log(`   Tenant Users: ${regularUsers.length}`);

  // Show tenants
  console.log("\n🏢 Available Tenants:");
  const tenants = await db.tenant.findMany({
    include: {
      _count: {
        select: {
          users: true,
          clients: true,
          endpoints: true,
        },
      },
    },
  });

  if (tenants.length === 0) {
    console.log("   No tenants found. Run: node scripts/seed.js");
  } else {
    tenants.forEach((tenant) => {
      console.log(`   • ${tenant.slug} - ${tenant.name}`);
      console.log(
        `     Users: ${tenant._count.users}, Clients: ${tenant._count.clients}, Endpoints: ${tenant._count.endpoints}`,
      );
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
