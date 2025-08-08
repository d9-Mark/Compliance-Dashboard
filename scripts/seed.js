// scripts/seed.js
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create test tenants
  const tenants = [];

  const tenantData = [
    { name: "Acme Corporation", slug: "acme-corp" },
    { name: "Tech Solutions Inc", slug: "tech-solutions" },
    { name: "Global Enterprises LLC", slug: "global-enterprises" },
  ];

  for (const tenantInfo of tenantData) {
    const tenant = await db.tenant.upsert({
      where: { slug: tenantInfo.slug },
      update: {},
      create: tenantInfo,
    });
    tenants.push(tenant);
  }

  console.log(`✅ Created ${tenants.length} tenants`);

  // Create clients for each tenant
  for (const tenant of tenants) {
    const clientData = [
      { name: `${tenant.name} - Main Office`, tenantId: tenant.id },
      { name: `${tenant.name} - Branch Office`, tenantId: tenant.id },
    ];

    for (const client of clientData) {
      await db.client.upsert({
        where: {
          id: `${tenant.slug}-${client.name.includes("Main") ? "main" : "branch"}`,
        },
        update: {},
        create: {
          id: `${tenant.slug}-${client.name.includes("Main") ? "main" : "branch"}`,
          ...client,
        },
      });
    }
    console.log(`✅ Created 2 clients for ${tenant.name}`);
  }

  // Create sample endpoints
  for (const tenant of tenants) {
    const clients = await db.client.findMany({
      where: { tenantId: tenant.id },
    });

    for (const client of clients) {
      const isMainOffice = client.name.includes("Main");
      const endpointCount = isMainOffice ? 8 : 4; // More endpoints in main office

      for (let i = 1; i <= endpointCount; i++) {
        const hostname = `${isMainOffice ? "dc" : "ws"}${String(i).padStart(2, "0")}-${tenant.slug}`;
        const isServer = hostname.includes("dc");

        await db.endpoint.upsert({
          where: {
            tenantId_hostname: {
              tenantId: tenant.id,
              hostname: hostname,
            },
          },
          update: {},
          create: {
            hostname: hostname,
            tenantId: tenant.id,
            clientId: client.id,
            operatingSystem: isServer
              ? "Windows Server 2022"
              : "Windows 11 Pro",
            osVersion: isServer ? "10.0.20348" : "10.0.22631",
            ipAddress: `192.168.${isMainOffice ? "1" : "2"}.${10 + i}`,
            lastSeen: new Date(
              Date.now() - Math.random() * 24 * 60 * 60 * 1000,
            ), // Within last 24 hours
            isCompliant: Math.random() > 0.25, // 75% compliant
            complianceScore: Math.floor(Math.random() * 40) + 60, // 60-100
            criticalVulns: Math.floor(Math.random() * (isServer ? 8 : 3)),
            highVulns: Math.floor(Math.random() * (isServer ? 15 : 8)),
            mediumVulns: Math.floor(Math.random() * (isServer ? 25 : 15)),
            lowVulns: Math.floor(Math.random() * (isServer ? 40 : 25)),
            sentinelOneAgentId: `so-${Math.random().toString(36).substr(2, 9)}`,
            ninjaOneDeviceId: `no-${Math.random().toString(36).substr(2, 9)}`,
          },
        });
      }
    }
  }

  console.log("✅ Created sample endpoints for all tenants");

  // Show summary
  const summary = await db.tenant.findMany({
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

  console.log("\n📊 Seed Complete! Summary:");
  summary.forEach((tenant) => {
    console.log(`   🏢 ${tenant.name} (${tenant.slug})`);
    console.log(
      `      Users: ${tenant._count.users}, Clients: ${tenant._count.clients}, Endpoints: ${tenant._count.endpoints}`,
    );
  });

  console.log("\n🎯 Next steps:");
  console.log(
    "1. Create admin account: node scripts/make-admin.js admin@example.com",
  );
  console.log(
    "2. Create test user: node scripts/create-user.js user@acme.com acme-corp",
  );
  console.log("3. List all users: node scripts/list-users.js");
  console.log("4. Start dev server: npm run dev");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
