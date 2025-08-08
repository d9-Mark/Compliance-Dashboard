// scripts/seed.js - Enhanced with SentinelOne and Windows compliance data
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Realistic Windows versions and build numbers
const WINDOWS_VERSIONS = [
  {
    name: "Windows 11 23H2",
    revision: "22631.2715",
    isGA: true,
    compliant: true,
  },
  {
    name: "Windows 11 22H2",
    revision: "22621.2715",
    isGA: true,
    compliant: true,
  },
  {
    name: "Windows 11 21H2",
    revision: "22000.2538",
    isGA: false,
    compliant: false,
  }, // Outdated
  {
    name: "Windows 10 22H2",
    revision: "19045.3570",
    isGA: true,
    compliant: true,
  },
  {
    name: "Windows 10 21H2",
    revision: "19044.3570",
    isGA: false,
    compliant: false,
  }, // Outdated
  {
    name: "Windows Server 2022",
    revision: "20348.2031",
    isGA: true,
    compliant: true,
  },
  {
    name: "Windows Server 2019",
    revision: "17763.4974",
    isGA: false,
    compliant: false,
  }, // Outdated
];

// Sample compliance issues
const USER_ACTIONS = [
  [],
  ["reboot_needed"],
  ["upgrade_needed"],
  ["reboot_needed", "upgrade_needed"],
  ["user_action_needed"],
];

const MISSING_PERMISSIONS = [
  [],
  ["user_action_needed_fda"],
  ["user_action_needed_notifications"],
  ["user_action_needed_fda", "user_action_needed_notifications"],
];

async function main() {
  console.log("🌱 Seeding database with enhanced compliance data...");

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

  // Create Windows compliance rules for each tenant
  for (const tenant of tenants) {
    await db.windowsComplianceRule.upsert({
      where: { id: `${tenant.slug}-default-rule` },
      update: {},
      create: {
        id: `${tenant.slug}-default-rule`,
        tenantId: tenant.id,
        name: "Default Windows Compliance",
        description: "Standard Windows compliance requirements",
        requireLatestGA: true,
        maxVersionsBehind: 1,
        maxDaysBehindSecurity: 30,
        allowPreview: false,
        isActive: true,
        priority: 1,
      },
    });
  }

  console.log("✅ Created Windows compliance rules");

  // Create sample applications for vulnerability tracking
  const applications = [
    {
      name: "Google Chrome",
      vendor: "Google LLC",
      category: "BROWSER",
      hasVulns: false,
    },
    {
      name: "Mozilla Firefox",
      vendor: "Mozilla Corporation",
      category: "BROWSER",
      hasVulns: true,
    },
    {
      name: "Adobe Acrobat Reader",
      vendor: "Adobe Inc.",
      category: "PRODUCTIVITY",
      hasVulns: true,
    },
    {
      name: "Microsoft Office",
      vendor: "Microsoft Corporation",
      category: "PRODUCTIVITY",
      hasVulns: false,
    },
    {
      name: "Zoom",
      vendor: "Zoom Video Communications",
      category: "COMMUNICATION",
      hasVulns: false,
    },
    {
      name: "TeamViewer",
      vendor: "TeamViewer AG",
      category: "REMOTE_ACCESS",
      hasVulns: true,
    },
  ];

  for (const appData of applications) {
    await db.application.upsert({
      where: { name_vendor: { name: appData.name, vendor: appData.vendor } },
      update: {},
      create: {
        name: appData.name,
        vendor: appData.vendor,
        category: appData.category,
        hasKnownVulns: appData.hasVulns,
        riskLevel: appData.hasVulns ? "HIGH" : "LOW",
        isMonitored: true,
        requiresUpdates: true,
        latestVersion: "Latest",
        latestVersionDate: new Date(),
      },
    });
  }

  console.log("✅ Created sample applications");

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

  // Create realistic endpoints with compliance data
  for (const tenant of tenants) {
    const clients = await db.client.findMany({
      where: { tenantId: tenant.id },
    });

    for (const client of clients) {
      const isMainOffice = client.name.includes("Main");
      const endpointCount = isMainOffice ? 12 : 6; // More endpoints in main office

      for (let i = 1; i <= endpointCount; i++) {
        const hostname = `${isMainOffice ? "dc" : "ws"}${String(i).padStart(2, "0")}-${tenant.slug}`;
        const isServer = hostname.includes("dc");

        // Pick a random Windows version
        const windowsVersion =
          WINDOWS_VERSIONS[Math.floor(Math.random() * WINDOWS_VERSIONS.length)];

        // Generate realistic SentinelOne data
        const userActions =
          USER_ACTIONS[Math.floor(Math.random() * USER_ACTIONS.length)];
        const missingPerms =
          MISSING_PERMISSIONS[
            Math.floor(Math.random() * MISSING_PERMISSIONS.length)
          ];
        const hasThreats = Math.random() < 0.1; // 10% chance of threats
        const isInfected = hasThreats && Math.random() < 0.5;
        const activeThreats = hasThreats
          ? Math.floor(Math.random() * 5) + 1
          : 0;

        // Calculate compliance based on issues
        const hasUserActions = userActions.length > 0;
        const hasPermissionIssues = missingPerms.length > 0;
        const isOutdatedOS = !windowsVersion.compliant;
        const isCompliant =
          !hasUserActions &&
          !hasPermissionIssues &&
          !isOutdatedOS &&
          !isInfected;

        // Compliance score calculation
        let complianceScore = 100;
        if (isOutdatedOS) complianceScore -= 25;
        if (hasUserActions) complianceScore -= userActions.length * 10;
        if (hasPermissionIssues) complianceScore -= missingPerms.length * 5;
        if (isInfected) complianceScore -= 30;
        if (activeThreats > 0) complianceScore -= activeThreats * 5;
        complianceScore = Math.max(0, complianceScore);

        // Generate vulnerability counts based on compliance
        const vulnMultiplier = isCompliant ? 0.3 : 1.5;
        const criticalVulns = Math.floor(
          Math.random() * (isServer ? 5 : 2) * vulnMultiplier,
        );
        const highVulns = Math.floor(
          Math.random() * (isServer ? 10 : 5) * vulnMultiplier,
        );
        const mediumVulns = Math.floor(
          Math.random() * (isServer ? 20 : 10) * vulnMultiplier,
        );
        const lowVulns = Math.floor(
          Math.random() * (isServer ? 30 : 15) * vulnMultiplier,
        );

        const endpointData = {
          hostname: hostname,
          tenantId: tenant.id,
          clientId: client.id,

          // Basic OS info
          operatingSystem: windowsVersion.name,
          osVersion: windowsVersion.revision,
          osName: windowsVersion.name,
          osRevision: windowsVersion.revision,
          osType: "windows",
          osArch: "x64",
          osStartTime: new Date(
            Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000,
          ), // Last 7 days
          osUsername: `user${i}`,

          // Hardware
          serialNumber: `SN${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          modelName: isServer ? "Dell PowerEdge R740" : "Dell OptiPlex 7090",
          totalMemory: isServer ? 32768 : 16384, // MB
          coreCount: isServer ? 8 : 4,
          cpuCount: isServer ? 2 : 1,
          cpuId: isServer ? "Intel Xeon Gold 6248R" : "Intel Core i7-11700",

          // Network
          ipAddress: `192.168.${isMainOffice ? "1" : "2"}.${10 + i}`,
          domain: `${tenant.slug}.local`,
          externalIp: `203.0.113.${Math.floor(Math.random() * 254) + 1}`,

          // SentinelOne Agent
          sentinelOneAgentId: `so-${Math.random().toString(36).substr(2, 16)}`,
          sentinelOneAgentVersion: "23.3.2.15",
          agentLastActiveDate: new Date(
            Date.now() - Math.random() * 24 * 60 * 60 * 1000,
          ), // Last 24h
          isAgentActive: Math.random() > 0.05, // 95% active
          isAgentUpToDate: Math.random() > 0.1, // 90% up to date
          agentRegisteredAt: new Date(
            Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000,
          ), // Last year
          lastSeen: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),

          // Security & Threats
          activeThreats,
          isInfected,
          detectionState: "protected",
          firewallEnabled: Math.random() > 0.1, // 90% have firewall enabled
          encryptedApplications: Math.random() > 0.2, // 80% encrypted
          threatRebootRequired:
            hasUserActions && userActions.includes("reboot_needed"),

          // Compliance
          lastSuccessfulScan: new Date(
            Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000,
          ),
          scanStatus: Math.random() > 0.05 ? "finished" : "failed",
          userActionsNeeded: userActions,
          missingPermissions: missingPerms,
          appsVulnerabilityStatus:
            Math.random() > 0.8 ? "up_to_date" : "pending_update",

          // Active Directory (for domain-joined machines)
          adComputerDistinguishedName: `CN=${hostname},OU=Computers,DC=${tenant.slug},DC=local`,
          adComputerMemberOf: ["Domain Computers"],
          adUserPrincipalName: `${hostname}@${tenant.slug}.local`,

          // Overall compliance
          isCompliant,
          complianceScore,
          windowsCompliant: windowsVersion.compliant && !hasUserActions,
          windowsComplianceScore: windowsVersion.compliant ? 100 : 60,
          lastWindowsCheck: new Date(),

          // Vulnerability counts
          criticalVulns,
          highVulns,
          mediumVulns,
          lowVulns,

          // Legacy fields for compatibility
          ninjaOneDeviceId: `no-${Math.random().toString(36).substr(2, 9)}`,
        };

        await db.endpoint.upsert({
          where: {
            tenantId_hostname: {
              tenantId: tenant.id,
              hostname: hostname,
            },
          },
          update: endpointData,
          create: endpointData,
        });
      }
    }
  }

  console.log("✅ Created enhanced endpoints with compliance data");

  // Create sample sync jobs to show history
  for (const tenant of tenants) {
    const syncJobData = [
      {
        tenantId: tenant.id,
        source: "SENTINELONE",
        status: "COMPLETED",
        startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 5 * 60 * 1000), // 5 min duration
        recordsProcessed: 18,
        recordsUpdated: 16,
        recordsCreated: 2,
      },
      {
        tenantId: tenant.id,
        source: "SENTINELONE",
        status: "COMPLETED",
        startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000 + 7 * 60 * 1000), // 7 min duration
        recordsProcessed: 18,
        recordsUpdated: 18,
        recordsCreated: 0,
      },
    ];

    for (const jobData of syncJobData) {
      await db.syncJob.create({ data: jobData });
    }
  }

  console.log("✅ Created sample sync job history");

  // Show summary with compliance stats
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

  console.log("\n📊 Seed Complete! Enhanced Summary:");

  for (const tenant of summary) {
    const endpoints = await db.endpoint.findMany({
      where: { tenantId: tenant.id },
      select: {
        isCompliant: true,
        activeThreats: true,
        criticalVulns: true,
        highVulns: true,
        userActionsNeeded: true,
      },
    });

    const compliantCount = endpoints.filter((e) => e.isCompliant).length;
    const threatCount = endpoints.reduce((sum, e) => sum + e.activeThreats, 0);
    const criticalVulns = endpoints.reduce(
      (sum, e) => sum + e.criticalVulns,
      0,
    );
    const highVulns = endpoints.reduce((sum, e) => sum + e.highVulns, 0);
    const actionNeeded = endpoints.filter(
      (e) => e.userActionsNeeded.length > 0,
    ).length;

    console.log(`   🏢 ${tenant.name} (${tenant.slug})`);
    console.log(
      `      Endpoints: ${tenant._count.endpoints} (${compliantCount} compliant)`,
    );
    console.log(
      `      Issues: ${threatCount} threats, ${criticalVulns} critical vulns, ${highVulns} high vulns`,
    );
    console.log(
      `      Actions Needed: ${actionNeeded} endpoints require attention`,
    );
  }

  console.log("\n🎯 Next steps:");
  console.log(
    "1. Create admin account: node scripts/make-admin.js admin@example.com",
  );
  console.log(
    "2. Create test user: node scripts/create-user.js user@acme.com acme-corp",
  );
  console.log("3. List all users: node scripts/list-users.js");
  console.log("4. Start dev server: npm run dev");
  console.log(
    "\n🔧 Test the enhanced dashboard with realistic compliance data!",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
