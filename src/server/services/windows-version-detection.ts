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

  // Update your WindowsVersionDetectionService parseWindowsVersion method
  // in src/server/services/windows-version-detection.ts

  /**
   * Parse Windows version info from SentinelOne agent data - UPDATED for new field structure
   */
  async parseWindowsVersion(
    operatingSystem: string, // CHANGED: was osName, now operatingSystem
    osVersion: string, // CHANGED: was osRevision, now osVersion (build number)
  ): Promise<WindowsVersionInfo | null> {
    if (!operatingSystem || !this.isWindowsOS(operatingSystem)) {
      return null;
    }

    // Parse major version from operatingSystem (e.g., "Windows 11 Pro" -> "11")
    const majorVersionMatch = operatingSystem.match(/Windows (\d+)/i);
    const majorVersion = majorVersionMatch ? majorVersionMatch[1] : null;

    if (!majorVersion) {
      return null;
    }

    // Parse edition from operatingSystem (e.g., "Windows 11 Pro" -> "Pro")
    const editionMatch = operatingSystem.match(/Windows \d+\s+(.+)/i);
    const edition = editionMatch ? editionMatch[1].trim() : "Unknown";

    // osVersion now contains just the build number (e.g., "26100")
    const buildNumber = osVersion ? parseInt(osVersion, 10) : null;

    if (!buildNumber) {
      console.warn(`Invalid build number: ${osVersion} for ${operatingSystem}`);
      return null;
    }

    // Get Windows version info from database to determine feature update
    const windowsVersions = await this.db.windowsVersion.findMany({
      where: {
        majorVersion: majorVersion,
        isSupported: true,
      },
      orderBy: { releaseDate: "desc" },
    });

    // Find matching version by build number
    let matchedVersion = null;
    let featureUpdate = "Unknown";

    for (const version of windowsVersions) {
      // Extract build number from version.latestBuild (e.g., "10.0.26100.2152" -> 26100)
      const versionBuildMatch = version.latestBuild.match(/\d+\.\d+\.(\d+)/);
      const versionBuildNumber = versionBuildMatch
        ? parseInt(versionBuildMatch[1], 10)
        : null;

      if (versionBuildNumber && buildNumber >= versionBuildNumber) {
        matchedVersion = version;
        featureUpdate = version.featureUpdate;
        break;
      }
    }

    // Check if this is the latest build
    const latestVersion = windowsVersions[0];
    const latestBuildMatch =
      latestVersion?.latestBuild.match(/\d+\.\d+\.(\d+)/);
    const latestBuildNumber = latestBuildMatch
      ? parseInt(latestBuildMatch[1], 10)
      : null;
    const isLatestBuild = latestBuildNumber
      ? buildNumber >= latestBuildNumber
      : false;

    // Calculate how many builds behind (rough estimate)
    const buildAgeDays =
      latestBuildNumber && buildNumber < latestBuildNumber
        ? Math.max(0, latestBuildNumber - buildNumber)
        : null;

    return {
      majorVersion,
      featureUpdate,
      edition,
      build: osVersion, // The full build number as string
      majorBuild: `10.0.${buildNumber}`, // Reconstruct major build
      minorBuild: "0", // We don't have minor build info
      isSupported: matchedVersion ? matchedVersion.isSupported : false,
      isLatestBuild,
      buildAgeDays,
      recommendedBuild: latestVersion?.latestBuild || null,
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

  // Update the storeEvaluation method in WindowsVersionDetectionService
  // to use the correct field names

  /**
   * Store compliance evaluation results - UPDATED for new field structure
   */
  async storeEvaluation(
    endpointId: string,
    policyId: string,
    windowsInfo: WindowsVersionInfo,
    evaluation: ComplianceEvaluation,
    rawData: {
      operatingSystem: string; // CHANGED: was osName
      osVersion: string; // CHANGED: was osRevision
    },
  ): Promise<void> {
    try {
      await this.db.windowsComplianceEvaluation.create({
        data: {
          id: `eval-${endpointId}-${Date.now()}`,
          endpointId,
          policyId,
          evaluatedAt: new Date(),

          // Evaluation Results
          isCompliant: evaluation.isCompliant,
          complianceScore: evaluation.complianceScore,
          failureReasons: evaluation.failureReasons,
          requiredActions: evaluation.requiredActions,

          // Detected Version Info
          detectedVersion: windowsInfo.majorVersion,
          detectedFeatureUpdate: windowsInfo.featureUpdate,
          detectedEdition: windowsInfo.edition,
          detectedBuild: windowsInfo.build,
          detectedMajorBuild: windowsInfo.majorBuild,

          // Compliance Details
          isSupportedVersion: evaluation.isSupportedVersion,
          isLatestBuild: evaluation.isLatestBuild,
          buildAgeDays: windowsInfo.buildAgeDays,
          recommendedVersion: evaluation.recommendedVersion,
          recommendedBuild: evaluation.recommendedBuild,

          // Raw OS Data (for debugging) - UPDATED field names
          rawOSName: rawData.operatingSystem, // CHANGED: store operatingSystem
          rawOSRevision: rawData.osVersion, // CHANGED: store osVersion
        },
      });
    } catch (error) {
      console.error(
        `Failed to store evaluation for endpoint ${endpointId}:`,
        error,
      );
      throw error;
    }
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
