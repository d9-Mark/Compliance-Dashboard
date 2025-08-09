// src/server/services/windows-version-detection.ts
// Windows Version Detection and Compliance Service

import type { PrismaClient } from "@prisma/client";

interface WindowsVersionInfo {
  majorVersion: string; // "11" or "10"
  featureUpdate: string; // "24H2", "23H2", etc.
  edition: string; // "Enterprise", "Pro", "Home", etc.
  build: string; // "10.0.26100.2152"
  majorBuild: string; // "10.0.26100"
  minorBuild: string; // "2152"
  isSupported: boolean;
  isLatestBuild: boolean;
  buildAgeDays: number | null;
  recommendedBuild: string | null;
}

interface ComplianceEvaluation {
  isCompliant: boolean;
  complianceScore: number; // 0-100
  failureReasons: string[];
  requiredActions: string[];
  isSupportedVersion: boolean;
  isLatestBuild: boolean;
  isAllowedVersion: boolean;
  isAllowedEdition: boolean;
  buildAgeDays: number | null;
  recommendedVersion: string | null;
  recommendedBuild: string | null;
}

export class WindowsVersionDetectionService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Parse Windows version info from SentinelOne agent data
   */
  async parseWindowsVersion(
    osName: string,
    osRevision: string,
  ): Promise<WindowsVersionInfo | null> {
    if (!osName || !this.isWindowsOS(osName)) {
      return null;
    }

    // Parse major version (11, 10, etc.)
    const majorVersion = this.extractMajorVersion(osName);
    if (!majorVersion) {
      return null;
    }

    // Parse build number
    const buildInfo = this.parseBuildNumber(osRevision);
    if (!buildInfo) {
      return null;
    }

    // Determine feature update based on build number
    const featureUpdate = await this.determineFeatureUpdate(
      majorVersion,
      buildInfo.majorBuild,
    );

    // Determine edition
    const edition = this.extractEdition(osName);

    // Check if this build is supported and latest
    const versionStatus = await this.getVersionStatus(
      majorVersion,
      featureUpdate,
      buildInfo.majorBuild,
    );

    return {
      majorVersion,
      featureUpdate: featureUpdate || "Unknown",
      edition,
      build: osRevision,
      majorBuild: buildInfo.majorBuild,
      minorBuild: buildInfo.minorBuild,
      isSupported: versionStatus.isSupported,
      isLatestBuild: versionStatus.isLatestBuild,
      buildAgeDays: versionStatus.buildAgeDays,
      recommendedBuild: versionStatus.recommendedBuild,
    };
  }

  /**
   * Evaluate Windows compliance against a policy
   */
  async evaluateCompliance(
    windowsInfo: WindowsVersionInfo,
    policyId: string,
  ): Promise<ComplianceEvaluation> {
    const policy = await this.db.windowsCompliancePolicy.findUnique({
      where: { id: policyId },
    });

    if (!policy || !policy.isActive) {
      throw new Error(`Compliance policy ${policyId} not found or inactive`);
    }

    const evaluation: ComplianceEvaluation = {
      isCompliant: true,
      complianceScore: 100,
      failureReasons: [],
      requiredActions: [],
      isSupportedVersion: windowsInfo.isSupported,
      isLatestBuild: windowsInfo.isLatestBuild,
      isAllowedVersion: false,
      isAllowedEdition: false,
      buildAgeDays: windowsInfo.buildAgeDays,
      recommendedVersion: null,
      recommendedBuild: windowsInfo.recommendedBuild,
    };

    // Check if version is supported by Microsoft
    if (policy.requireSupported && !windowsInfo.isSupported) {
      evaluation.isCompliant = false;
      evaluation.complianceScore -= 40;
      evaluation.failureReasons.push(
        "Windows version is no longer supported by Microsoft",
      );
      evaluation.requiredActions.push("Upgrade to a supported Windows version");
    }

    // Check allowed versions
    if (policy.allowedVersions && policy.allowedVersions.length > 0) {
      evaluation.isAllowedVersion = policy.allowedVersions.includes(
        windowsInfo.majorVersion,
      );
      if (!evaluation.isAllowedVersion) {
        evaluation.isCompliant = false;
        evaluation.complianceScore -= 30;
        evaluation.failureReasons.push(
          `Windows ${windowsInfo.majorVersion} is not allowed by policy`,
        );
        evaluation.requiredActions.push(
          `Upgrade to an allowed version: ${policy.allowedVersions.join(", ")}`,
        );
      }
    } else {
      evaluation.isAllowedVersion = true;
    }

    // Check blocked versions
    if (
      policy.blockedVersions &&
      policy.blockedVersions.includes(windowsInfo.majorVersion)
    ) {
      evaluation.isCompliant = false;
      evaluation.complianceScore -= 50;
      evaluation.failureReasons.push(
        `Windows ${windowsInfo.majorVersion} is blocked by policy`,
      );
      evaluation.requiredActions.push(
        "Upgrade to a non-blocked Windows version",
      );
    }

    // Check minimum versions
    if (policy.minimumVersions) {
      const minVersion = (policy.minimumVersions as any)[
        windowsInfo.majorVersion
      ];
      if (
        minVersion &&
        this.compareFeatureUpdates(windowsInfo.featureUpdate, minVersion) < 0
      ) {
        evaluation.isCompliant = false;
        evaluation.complianceScore -= 25;
        evaluation.failureReasons.push(
          `Windows ${windowsInfo.majorVersion} ${windowsInfo.featureUpdate} is below minimum required ${minVersion}`,
        );
        evaluation.requiredActions.push(
          `Upgrade to Windows ${windowsInfo.majorVersion} ${minVersion} or later`,
        );
        evaluation.recommendedVersion = `${windowsInfo.majorVersion} ${minVersion}`;
      }
    }

    // Check allowed editions
    if (policy.allowedEditions && policy.allowedEditions.length > 0) {
      evaluation.isAllowedEdition = policy.allowedEditions.some((allowed) =>
        windowsInfo.edition.toLowerCase().includes(allowed.toLowerCase()),
      );
      if (!evaluation.isAllowedEdition) {
        evaluation.isCompliant = false;
        evaluation.complianceScore -= 20;
        evaluation.failureReasons.push(
          `Windows ${windowsInfo.edition} edition is not allowed`,
        );
        evaluation.requiredActions.push(
          `Upgrade to allowed edition: ${policy.allowedEditions.join(", ")}`,
        );
      }
    } else {
      evaluation.isAllowedEdition = true;
    }

    // Check blocked editions
    if (
      policy.blockedEditions &&
      policy.blockedEditions.some((blocked) =>
        windowsInfo.edition.toLowerCase().includes(blocked.toLowerCase()),
      )
    ) {
      evaluation.isCompliant = false;
      evaluation.complianceScore -= 30;
      evaluation.failureReasons.push(
        `Windows ${windowsInfo.edition} edition is blocked by policy`,
      );
      evaluation.requiredActions.push(
        "Change to a non-blocked Windows edition",
      );
    }

    // Check latest build requirement
    if (policy.requireLatestBuild && !windowsInfo.isLatestBuild) {
      evaluation.isCompliant = false;
      evaluation.complianceScore -= 20;
      evaluation.failureReasons.push(
        "Not running the latest build for this Windows version",
      );
      evaluation.requiredActions.push(
        `Update to latest build: ${windowsInfo.recommendedBuild}`,
      );
    }

    // Check build age
    if (
      policy.maxBuildAgeDays &&
      windowsInfo.buildAgeDays &&
      windowsInfo.buildAgeDays > policy.maxBuildAgeDays
    ) {
      evaluation.isCompliant = false;
      evaluation.complianceScore -= 15;
      evaluation.failureReasons.push(
        `Build is ${windowsInfo.buildAgeDays} days old (max: ${policy.maxBuildAgeDays})`,
      );
      evaluation.requiredActions.push("Update to a more recent build");
    }

    // Ensure score doesn't go below 0
    evaluation.complianceScore = Math.max(0, evaluation.complianceScore);

    return evaluation;
  }

  /**
   * Store compliance evaluation in database
   */
  async storeEvaluation(
    endpointId: string,
    policyId: string,
    windowsInfo: WindowsVersionInfo,
    evaluation: ComplianceEvaluation,
    rawOsData: { osName: string; osRevision: string },
  ): Promise<void> {
    await this.db.windowsComplianceEvaluation.create({
      data: {
        endpointId,
        policyId,
        detectedVersion: windowsInfo.majorVersion,
        detectedFeatureUpdate: windowsInfo.featureUpdate,
        detectedEdition: windowsInfo.edition,
        detectedBuild: windowsInfo.build,
        osName: rawOsData.osName,
        osRevision: rawOsData.osRevision,
        isCompliant: evaluation.isCompliant,
        complianceScore: evaluation.complianceScore,
        failureReasons: evaluation.failureReasons,
        requiredActions: evaluation.requiredActions,
        isSupportedVersion: evaluation.isSupportedVersion,
        isLatestBuild: evaluation.isLatestBuild,
        isAllowedVersion: evaluation.isAllowedVersion,
        isAllowedEdition: evaluation.isAllowedEdition,
        buildAgeDays: evaluation.buildAgeDays,
        recommendedVersion: evaluation.recommendedVersion,
        recommendedBuild: evaluation.recommendedBuild,
      },
    });
  }

  // Private helper methods

  private isWindowsOS(osName: string): boolean {
    return osName.toLowerCase().includes("windows");
  }

  private extractMajorVersion(osName: string): string | null {
    // Extract major version from OS name
    const windows11Match = osName.match(/windows\s*11/i);
    if (windows11Match) return "11";

    const windows10Match = osName.match(/windows\s*10/i);
    if (windows10Match) return "10";

    const serverMatch = osName.match(/server\s*(\d{4})/i);
    if (serverMatch) return `Server${serverMatch[1]}`;

    return null;
  }

  private parseBuildNumber(
    osRevision: string,
  ): { majorBuild: string; minorBuild: string } | null {
    if (!osRevision) return null;

    // Parse build like "10.0.26100.2152" or "22631.4317"
    const fullBuildMatch = osRevision.match(/(\d+\.\d+\.\d+)\.?(\d+)?/);
    if (fullBuildMatch) {
      return {
        majorBuild: fullBuildMatch[1],
        minorBuild: fullBuildMatch[2] || "0",
      };
    }

    // Handle short format like "22631.4317"
    const shortBuildMatch = osRevision.match(/(\d+)\.(\d+)/);
    if (shortBuildMatch) {
      return {
        majorBuild: `10.0.${shortBuildMatch[1]}`,
        minorBuild: shortBuildMatch[2],
      };
    }

    return null;
  }

  private extractEdition(osName: string): string {
    // Extract Windows edition from OS name
    if (osName.match(/enterprise/i)) return "Enterprise";
    if (osName.match(/professional|pro\b/i)) return "Pro";
    if (osName.match(/education/i)) return "Education";
    if (osName.match(/home/i)) return "Home";
    if (osName.match(/server/i)) return "Server";
    return "Unknown";
  }

  private async determineFeatureUpdate(
    majorVersion: string,
    majorBuild: string,
  ): Promise<string | null> {
    // Look up feature update based on major version and build
    const version = await this.db.windowsVersion.findFirst({
      where: {
        majorVersion,
        latestBuild: majorBuild,
      },
    });

    if (version) {
      return version.featureUpdate;
    }

    // Fallback: map known builds to feature updates
    const buildToFeatureMap: Record<string, string> = {
      "10.0.26100": "24H2",
      "10.0.22631": "23H2",
      "10.0.22621": "22H2",
      "10.0.19045": "22H2", // Windows 10
      "10.0.19044": "21H2",
      "10.0.19043": "21H1",
      "10.0.19042": "20H2",
    };

    return buildToFeatureMap[majorBuild] || null;
  }

  private async getVersionStatus(
    majorVersion: string,
    featureUpdate: string | null,
    majorBuild: string,
  ): Promise<{
    isSupported: boolean;
    isLatestBuild: boolean;
    buildAgeDays: number | null;
    recommendedBuild: string | null;
  }> {
    const currentVersion = await this.db.windowsVersion.findFirst({
      where: {
        majorVersion,
        ...(featureUpdate && { featureUpdate }),
        isSupported: true,
      },
      orderBy: { releaseDate: "desc" },
    });

    if (!currentVersion) {
      return {
        isSupported: false,
        isLatestBuild: false,
        buildAgeDays: null,
        recommendedBuild: null,
      };
    }

    const isLatestBuild = currentVersion.latestBuild === majorBuild;

    // Calculate build age (simplified - would need more detailed build date tracking)
    const buildAgeDays = currentVersion.lastUpdated
      ? Math.floor(
          (Date.now() - currentVersion.lastUpdated.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : null;

    return {
      isSupported:
        currentVersion.isSupported && new Date() < currentVersion.eolDate,
      isLatestBuild,
      buildAgeDays,
      recommendedBuild: currentVersion.latestBuild,
    };
  }

  private compareFeatureUpdates(version1: string, version2: string): number {
    // Compare feature updates like "24H2" vs "23H2"
    const parseVersion = (v: string) => {
      const match = v.match(/(\d+)H(\d+)/);
      if (!match) return { year: 0, half: 0 };
      return { year: parseInt(match[1]), half: parseInt(match[2]) };
    };

    const v1 = parseVersion(version1);
    const v2 = parseVersion(version2);

    if (v1.year !== v2.year) {
      return v1.year - v2.year;
    }
    return v1.half - v2.half;
  }
}

export type { WindowsVersionInfo, ComplianceEvaluation };
