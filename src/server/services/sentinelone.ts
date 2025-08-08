import type { PrismaClient } from "@prisma/client";

// SentinelOne sync service
export class SentinelOneService {
  constructor(
    private readonly apiKey: string,
    private readonly endpoint: string,
    private readonly db: PrismaClient,
  ) {}

  async syncAgents(tenantId: string): Promise<SyncResult> {
    const syncJob = await this.db.syncJob.create({
      data: {
        tenantId,
        source: "SENTINELONE",
        status: "RUNNING",
      },
    });

    try {
      let cursor: string | null = null;
      let processedCount = 0;
      let updatedCount = 0;
      let createdCount = 0;

      do {
        // Fetch agents with pagination
        const response = await this.fetchAgents({
          cursor,
          limit: 100,
          // Filter for active agents with recent activity
          isActive: true,
          lastActiveDate__gte: new Date(
            Date.now() - 30 * 24 * 60 * 60 * 1000,
          ).toISOString(), // Last 30 days
        });

        for (const agent of response.data) {
          try {
            await this.processAgent(agent, tenantId);
            processedCount++;

            // Determine if this was a create or update
            const existing = await this.db.endpoint.findUnique({
              where: { sentinelOneAgentId: agent.id },
            });

            if (existing) {
              updatedCount++;
            } else {
              createdCount++;
            }
          } catch (error) {
            console.error(`Failed to process agent ${agent.id}:`, error);
          }
        }

        cursor = response.pagination.nextCursor;
      } while (cursor);

      // Update sync job
      await this.db.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          recordsProcessed: processedCount,
          recordsUpdated: updatedCount,
          recordsCreated: createdCount,
        },
      });

      return {
        success: true,
        processed: processedCount,
        updated: updatedCount,
        created: createdCount,
      };
    } catch (error) {
      await this.db.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          errorMessage: error.message,
        },
      });
      throw error;
    }
  }

  private async fetchAgents(params: {
    cursor?: string | null;
    limit?: number;
    isActive?: boolean;
    lastActiveDate__gte?: string;
  }) {
    const queryParams = new URLSearchParams();

    if (params.cursor) queryParams.set("cursor", params.cursor);
    if (params.limit) queryParams.set("limit", params.limit.toString());
    if (params.isActive) queryParams.set("isActive", "true");
    if (params.lastActiveDate__gte) {
      queryParams.set("lastActiveDate__gte", params.lastActiveDate__gte);
    }

    const response = await fetch(
      `${this.endpoint}/web/api/v2.1/agents?${queryParams}`,
      {
        headers: {
          Authorization: `ApiToken ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `SentinelOne API error: ${response.status} ${response.statusText}`,
      );
    }

    return response.json();
  }

  private async processAgent(agent: any, tenantId: string) {
    // Calculate compliance scores
    const complianceScore = this.calculateComplianceScore(agent);
    const isCompliant = complianceScore >= 80; // Configurable threshold

    // Map SentinelOne agent to endpoint data
    const endpointData = {
      hostname: agent.computerName,
      tenantId,
      sentinelOneAgentId: agent.id,

      // OS Information
      operatingSystem: agent.osName,
      osVersion: agent.osRevision,
      osName: agent.osName,
      osRevision: agent.osRevision,
      osType: agent.osType,
      osArch: agent.osArch,
      osStartTime: agent.osStartTime ? new Date(agent.osStartTime) : null,
      osUsername: agent.osUsername,

      // Hardware
      serialNumber: agent.serialNumber,
      modelName: agent.modelName,
      totalMemory: agent.totalMemory,
      coreCount: agent.coreCount,
      cpuCount: agent.cpuCount,
      cpuId: agent.cpuId,

      // Network
      ipAddress: agent.externalIp || agent.lastIpToMgmt,
      domain: agent.domain,
      externalIp: agent.externalIp,
      lastIpToMgmt: agent.lastIpToMgmt,

      // Agent Status
      sentinelOneAgentVersion: agent.agentVersion,
      agentLastActiveDate: agent.lastActiveDate
        ? new Date(agent.lastActiveDate)
        : null,
      isAgentActive: agent.isActive,
      isAgentUpToDate: agent.isUpToDate,
      agentRegisteredAt: agent.registeredAt
        ? new Date(agent.registeredAt)
        : null,
      lastSeen: agent.lastActiveDate ? new Date(agent.lastActiveDate) : null,

      // Security & Threats
      activeThreats: agent.activeThreats || 0,
      isInfected: agent.infected || false,
      detectionState: agent.detectionState,
      firewallEnabled: agent.firewallEnabled || false,
      encryptedApplications: agent.encryptedApplications || false,
      threatRebootRequired: agent.threatRebootRequired || false,

      // Compliance
      lastSuccessfulScan: agent.lastSuccessfulScanDate
        ? new Date(agent.lastSuccessfulScanDate)
        : null,
      scanStatus: agent.scanStatus,
      userActionsNeeded: agent.userActionsNeeded || [],
      missingPermissions: agent.missingPermissions || [],
      appsVulnerabilityStatus: agent.appsVulnerabilityStatus,

      // Active Directory
      adComputerDistinguishedName:
        agent.activeDirectory?.computerDistinguishedName,
      adComputerMemberOf: agent.activeDirectory?.computerMemberOf || [],
      adLastUserDistinguishedName:
        agent.activeDirectory?.lastUserDistinguishedName,
      adUserPrincipalName: agent.activeDirectory?.userPrincipalName,

      // Calculated compliance
      isCompliant,
      complianceScore,

      // Vulnerability counts (you might derive these from other SentinelOne endpoints)
      criticalVulns: this.extractVulnCount(agent, "critical"),
      highVulns: this.extractVulnCount(agent, "high"),
      mediumVulns: this.extractVulnCount(agent, "medium"),
      lowVulns: this.extractVulnCount(agent, "low"),
    };

    // Upsert endpoint
    await this.db.endpoint.upsert({
      where: {
        tenantId_hostname: {
          tenantId,
          hostname: agent.computerName,
        },
      },
      update: endpointData,
      create: endpointData,
    });
  }

  private calculateComplianceScore(agent: any): number {
    let score = 100;

    // Deduct points for various issues
    if (!agent.isActive) score -= 20;
    if (!agent.isUpToDate) score -= 15;
    if (agent.infected) score -= 30;
    if (agent.activeThreats > 0)
      score -= Math.min(agent.activeThreats * 10, 40);
    if (!agent.firewallEnabled) score -= 10;
    if (agent.userActionsNeeded?.length > 0)
      score -= agent.userActionsNeeded.length * 5;
    if (agent.missingPermissions?.length > 0)
      score -= agent.missingPermissions.length * 5;

    // Check Windows version compliance
    if (agent.osType === "windows") {
      const isOutdated = this.isWindowsVersionOutdated(agent.osRevision);
      if (isOutdated) score -= 20;
    }

    return Math.max(0, Math.min(100, score));
  }

  private isWindowsVersionOutdated(osRevision: string): boolean {
    // Implement your Windows version compliance logic here
    // This would check against your WindowsVersion model
    // For now, basic example:
    if (!osRevision) return true;

    const buildNumber = parseInt(osRevision.split(".")[0]);
    const minimumBuild = 22621; // Windows 11 22H2 minimum

    return buildNumber < minimumBuild;
  }

  private extractVulnCount(agent: any, severity: string): number {
    // SentinelOne might have vulnerability data in other endpoints
    // For now, return 0 or implement based on available data
    if (agent.appsVulnerabilityStatus === "up_to_date") return 0;

    // You might need to call additional SentinelOne endpoints for detailed vuln info
    return 0;
  }
}
