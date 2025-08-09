// src/server/services/windows-compliance.ts
// Windows compliance service using endoflife.date API for accurate EOL data

export interface WindowsEOLData {
  cycle: string;
  cycleShortHand?: string;
  release: string;
  support: string | boolean;
  eol: string | boolean;
  link?: string;
  latest?: string;
  latestReleaseDate?: string;
}

export interface ComplianceAnalysis {
  isCompliant: boolean;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  score: number; // 0-100
  issues: string[];
  recommendations: string[];
  daysUntilEOL?: number;
  daysUntilSupportEnd?: number;
  securityStatus: "CURRENT" | "OUTDATED" | "UNSUPPORTED" | "UNKNOWN";
  versionInfo?: WindowsEOLData;
}

export class WindowsComplianceService {
  private static windowsEOLCache: WindowsEOLData[] | null = null;
  private static windowsServerEOLCache: WindowsEOLData[] | null = null;
  private static lastCacheUpdate: Date | null = null;
  private static readonly CACHE_DURATION_HOURS = 24; // Cache for 24 hours

  /**
   * Get Windows EOL data from endoflife.date API with caching
   */
  private static async getWindowsEOLData(): Promise<WindowsEOLData[]> {
    const now = new Date();

    // Check if cache is still valid
    if (
      this.windowsEOLCache &&
      this.lastCacheUpdate &&
      now.getTime() - this.lastCacheUpdate.getTime() <
        this.CACHE_DURATION_HOURS * 60 * 60 * 1000
    ) {
      return this.windowsEOLCache;
    }

    try {
      console.log("🔄 Fetching Windows EOL data from endoflife.date...");

      const response = await fetch("https://endoflife.date/api/windows.json", {
        headers: {
          "User-Agent": "D9-Compliance-Dashboard/1.0",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch Windows EOL data: ${response.status} ${response.statusText}`,
        );
      }

      const data: WindowsEOLData[] = await response.json();

      this.windowsEOLCache = data;
      this.lastCacheUpdate = now;

      console.log(
        `✅ Cached ${data.length} Windows versions from endoflife.date`,
      );
      return data;
    } catch (error) {
      console.error("❌ Failed to fetch Windows EOL data:", error);

      // Return cached data if available, even if stale
      if (this.windowsEOLCache) {
        console.log("⚠️ Using stale Windows EOL cache due to API error");
        return this.windowsEOLCache;
      }

      throw new Error(
        "Unable to fetch Windows EOL data and no cache available",
      );
    }
  }

  /**
   * Get Windows Server EOL data from endoflife.date API with caching
   */
  private static async getWindowsServerEOLData(): Promise<WindowsEOLData[]> {
    const now = new Date();

    // Check if cache is still valid
    if (
      this.windowsServerEOLCache &&
      this.lastCacheUpdate &&
      now.getTime() - this.lastCacheUpdate.getTime() <
        this.CACHE_DURATION_HOURS * 60 * 60 * 1000
    ) {
      return this.windowsServerEOLCache;
    }

    try {
      console.log("🔄 Fetching Windows Server EOL data from endoflife.date...");

      const response = await fetch(
        "https://endoflife.date/api/windows-server.json",
        {
          headers: {
            "User-Agent": "D9-Compliance-Dashboard/1.0",
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch Windows Server EOL data: ${response.status} ${response.statusText}`,
        );
      }

      const data: WindowsEOLData[] = await response.json();

      this.windowsServerEOLCache = data;
      this.lastCacheUpdate = now;

      console.log(
        `✅ Cached ${data.length} Windows Server versions from endoflife.date`,
      );
      return data;
    } catch (error) {
      console.error("❌ Failed to fetch Windows Server EOL data:", error);

      // Return cached data if available, even if stale
      if (this.windowsServerEOLCache) {
        console.log("⚠️ Using stale Windows Server EOL cache due to API error");
        return this.windowsServerEOLCache;
      }

      throw new Error(
        "Unable to fetch Windows Server EOL data and no cache available",
      );
    }
  }

  /**
   * Analyze Windows compliance for a given OS version using live EOL data
   */
  static async analyzeCompliance(
    osName?: string,
    osVersion?: string,
    osRevision?: string,
  ): Promise<ComplianceAnalysis> {
    if (!osName || (!osVersion && !osRevision)) {
      return {
        isCompliant: false,
        riskLevel: "HIGH",
        score: 0,
        issues: ["Unknown Windows version"],
        recommendations: ["Identify Windows version for compliance assessment"],
        securityStatus: "UNKNOWN",
      };
    }

    try {
      const isServer = osName.toLowerCase().includes("server");
      const eolData = isServer
        ? await this.getWindowsServerEOLData()
        : await this.getWindowsEOLData();

      // Extract version info from OS name and version
      const versionMatch = this.extractWindowsVersion(
        osName,
        osVersion,
        osRevision,
      );

      if (!versionMatch) {
        return {
          isCompliant: false,
          riskLevel: "MEDIUM",
          score: 40,
          issues: [
            `Cannot parse Windows version from: ${osName} ${osVersion || osRevision}`,
          ],
          recommendations: ["Verify Windows version reporting in SentinelOne"],
          securityStatus: "UNKNOWN",
        };
      }

      // Find matching EOL data
      const eolInfo = this.findMatchingEOLData(eolData, versionMatch, isServer);

      if (!eolInfo) {
        return {
          isCompliant: false,
          riskLevel: "MEDIUM",
          score: 50,
          issues: [`Unknown Windows version: ${versionMatch.display}`],
          recommendations: [
            "Check if this is a newer version not yet in EOL database",
            "Verify version detection accuracy",
          ],
          securityStatus: "UNKNOWN",
        };
      }

      return this.calculateComplianceFromEOL(eolInfo, versionMatch);
    } catch (error) {
      console.error("Failed to analyze Windows compliance:", error);

      return {
        isCompliant: false,
        riskLevel: "HIGH",
        score: 20,
        issues: ["Unable to fetch current EOL data"],
        recommendations: [
          "Check internet connectivity",
          "Retry compliance analysis",
        ],
        securityStatus: "UNKNOWN",
      };
    }
  }

  /**
   * Extract Windows version information from OS strings
   */
  private static extractWindowsVersion(
    osName: string,
    osVersion?: string,
    osRevision?: string,
  ): {
    version: string;
    build?: string;
    display: string;
    isServer: boolean;
  } | null {
    const versionString = osVersion || osRevision || "";
    const isServer = osName.toLowerCase().includes("server");

    // Extract Windows 10/11 version from various formats
    if (osName.includes("Windows 11")) {
      const buildMatch = versionString.match(/(\d+)\.(\d+)\.(\d+)/);
      if (buildMatch) {
        const build = buildMatch[3];
        // Map builds to versions
        if (build >= "22631")
          return {
            version: "23H2",
            build,
            display: "Windows 11 23H2",
            isServer,
          };
        if (build >= "22621")
          return {
            version: "22H2",
            build,
            display: "Windows 11 22H2",
            isServer,
          };
        if (build >= "22000")
          return {
            version: "21H2",
            build,
            display: "Windows 11 21H2",
            isServer,
          };
      }
      return { version: "11", display: "Windows 11", isServer };
    }

    if (osName.includes("Windows 10")) {
      const buildMatch = versionString.match(/(\d+)\.(\d+)\.(\d+)/);
      if (buildMatch) {
        const build = buildMatch[3];
        // Map builds to versions
        if (build >= "19045")
          return {
            version: "22H2",
            build,
            display: "Windows 10 22H2",
            isServer,
          };
        if (build >= "19044")
          return {
            version: "21H2",
            build,
            display: "Windows 10 21H2",
            isServer,
          };
        if (build >= "19043")
          return {
            version: "21H1",
            build,
            display: "Windows 10 21H1",
            isServer,
          };
        if (build >= "19042")
          return {
            version: "20H2",
            build,
            display: "Windows 10 20H2",
            isServer,
          };
      }
      return { version: "10", display: "Windows 10", isServer };
    }

    // Handle Windows Server versions
    if (isServer) {
      if (osName.includes("2022"))
        return { version: "2022", display: "Windows Server 2022", isServer };
      if (osName.includes("2019"))
        return { version: "2019", display: "Windows Server 2019", isServer };
      if (osName.includes("2016"))
        return { version: "2016", display: "Windows Server 2016", isServer };
      if (osName.includes("2012")) {
        if (osName.includes("R2"))
          return {
            version: "2012-r2",
            display: "Windows Server 2012 R2",
            isServer,
          };
        return { version: "2012", display: "Windows Server 2012", isServer };
      }
    }

    return null;
  }

  /**
   * Find matching EOL data for a Windows version
   */
  private static findMatchingEOLData(
    eolData: WindowsEOLData[],
    versionMatch: any,
    isServer: boolean,
  ): WindowsEOLData | null {
    // Try exact cycle match first
    let match = eolData.find(
      (item) =>
        item.cycle === versionMatch.version ||
        item.cycleShortHand === versionMatch.version,
    );

    if (match) return match;

    // Try fuzzy matching for common variations
    const versionLower = versionMatch.version.toLowerCase();
    match = eolData.find((item) => {
      const cycleLower = item.cycle.toLowerCase();
      const shortHandLower = item.cycleShortHand?.toLowerCase();

      return (
        cycleLower.includes(versionLower) ||
        shortHandLower?.includes(versionLower) ||
        versionLower.includes(cycleLower)
      );
    });

    return match || null;
  }

  /**
   * Calculate compliance score from EOL data
   */
  private static calculateComplianceFromEOL(
    eolInfo: WindowsEOLData,
    versionMatch: any,
  ): ComplianceAnalysis {
    const now = new Date();
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Parse dates (handle both string dates and boolean values)
    const supportEndDate = this.parseEOLDate(eolInfo.support);
    const eolDate = this.parseEOLDate(eolInfo.eol);

    // Calculate days until EOL/support end
    const daysUntilSupportEnd = supportEndDate
      ? Math.floor(
          (supportEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        )
      : undefined;
    const daysUntilEOL = eolDate
      ? Math.floor((eolDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : undefined;

    // Determine security status
    let securityStatus: "CURRENT" | "OUTDATED" | "UNSUPPORTED" | "UNKNOWN" =
      "CURRENT";
    let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
    let score = 100;

    // Check if EOL has passed
    if (eolDate && now > eolDate) {
      securityStatus = "UNSUPPORTED";
      riskLevel = "CRITICAL";
      score = 0;
      issues.push(
        `Windows version ${versionMatch.display} is no longer supported (EOL: ${eolDate.toLocaleDateString()})`,
      );
      recommendations.push(
        "URGENT: Upgrade to a supported Windows version immediately",
      );
    }
    // Check if support has ended but EOL hasn't
    else if (supportEndDate && now > supportEndDate) {
      securityStatus = "OUTDATED";
      riskLevel = "HIGH";
      score = 25;
      issues.push(
        `Windows version ${versionMatch.display} mainstream support has ended (${supportEndDate.toLocaleDateString()})`,
      );
      recommendations.push("Plan upgrade to a newer Windows version");

      if (daysUntilEOL && daysUntilEOL <= 365) {
        riskLevel = "CRITICAL";
        score = 10;
        issues.push(`End of life approaching in ${daysUntilEOL} days`);
        recommendations.push("URGENT: Upgrade before end of life date");
      }
    }
    // Check if approaching end of support
    else if (daysUntilSupportEnd && daysUntilSupportEnd <= 365) {
      securityStatus = "CURRENT";
      riskLevel = "MEDIUM";
      score = 70;
      issues.push(
        `Windows version ${versionMatch.display} support ends in ${daysUntilSupportEnd} days`,
      );
      recommendations.push(
        "Plan upgrade to newer Windows version within the next year",
      );
    }
    // Check if approaching EOL
    else if (daysUntilEOL && daysUntilEOL <= 730) {
      securityStatus = "CURRENT";
      riskLevel = "LOW";
      score = 90;
      issues.push(
        `Windows version ${versionMatch.display} EOL in ${daysUntilEOL} days`,
      );
      recommendations.push("Consider planning for future upgrade");
    }

    // Check if it's the latest version
    if (eolInfo.latest && versionMatch.build) {
      const isLatestBuild = eolInfo.latest.includes(versionMatch.build);
      if (!isLatestBuild) {
        score = Math.max(0, score - 10);
        issues.push("Not running the latest build of this Windows version");
        recommendations.push("Install latest Windows updates");
      }
    }

    const isCompliant = score >= 70 && riskLevel !== "CRITICAL";

    return {
      isCompliant,
      riskLevel,
      score,
      issues,
      recommendations,
      daysUntilEOL,
      daysUntilSupportEnd,
      securityStatus,
      versionInfo: eolInfo,
    };
  }

  /**
   * Parse EOL date from API response (can be string date or boolean)
   */
  private static parseEOLDate(
    dateValue: string | boolean | undefined,
  ): Date | null {
    if (!dateValue || typeof dateValue === "boolean") {
      return null;
    }

    try {
      return new Date(dateValue);
    } catch {
      return null;
    }
  }

  /**
   * Get all supported Windows versions (for UI dropdowns, etc.)
   */
  static async getSupportedVersions(): Promise<
    { cycle: string; name: string; isSupported: boolean }[]
  > {
    try {
      const [windowsData, serverData] = await Promise.all([
        this.getWindowsEOLData(),
        this.getWindowsServerEOLData(),
      ]);

      const now = new Date();

      const processVersions = (data: WindowsEOLData[], prefix: string) => {
        return data.map((item) => {
          const eolDate = this.parseEOLDate(item.eol);
          const isSupported = !eolDate || now <= eolDate;

          return {
            cycle: item.cycle,
            name: `${prefix} ${item.cycle}`,
            isSupported,
          };
        });
      };

      return [
        ...processVersions(windowsData, "Windows"),
        ...processVersions(serverData, "Windows Server"),
      ].sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error("Failed to get supported Windows versions:", error);
      return [];
    }
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  static clearCache(): void {
    this.windowsEOLCache = null;
    this.windowsServerEOLCache = null;
    this.lastCacheUpdate = null;
    console.log("🗑️ Windows EOL cache cleared");
  }
}

// Export types for use in other parts of the application
export type { WindowsEOLData };
