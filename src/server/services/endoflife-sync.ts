// src/server/services/endoflife-sync.ts
// Service to sync Windows version data from endoflife.date API

import type { PrismaClient } from "@prisma/client";

interface EndOfLifeWindowsEntry {
  cycle: string; // "11-24h2-e", "10-22h2"
  releaseLabel: string; // "11 24H2 (E)", "10 22H2"
  releaseDate: string; // "2024-10-01"
  eol: string; // "2027-10-12"
  latest: string; // "10.0.26100"
  link?: string; // Microsoft documentation link
  support: string; // Support end date
  lts?: boolean; // Long-term support
  extendedSupport?: boolean | string;
}

interface WindowsVersionMapping {
  id: string;
  cycle: string;
  releaseLabel: string;
  majorVersion: string;
  featureUpdate: string;
  edition: string;
  releaseDate: Date;
  eolDate: Date;
  supportDate: Date;
  latestBuild: string;
  isSupported: boolean;
  isLTS: boolean;
  microsoftLink?: string;
}

export class EndOfLifeSyncService {
  private readonly API_BASE = "https://endoflife.date/api";
  private readonly WINDOWS_API = `${this.API_BASE}/windows.json`;
  private readonly WINDOWS_SERVER_API = `${this.API_BASE}/windows-server.json`;

  constructor(private readonly db: PrismaClient) {}

  /**
   * Sync all Windows version data from endoflife.date
   */
  async syncWindowsVersions(): Promise<{
    synced: number;
    created: number;
    updated: number;
    errors: string[];
  }> {
    console.log("🔄 Starting Windows version sync from endoflife.date...");

    const result = {
      synced: 0,
      created: 0,
      updated: 0,
      errors: [] as string[],
    };

    try {
      // Sync Windows client versions
      const windowsData = await this.fetchWindowsData();
      const clientResult = await this.processWindowsEntries(
        windowsData,
        "client",
      );

      // Sync Windows Server versions
      const serverData = await this.fetchWindowsServerData();
      const serverResult = await this.processWindowsEntries(
        serverData,
        "server",
      );

      result.synced = clientResult.synced + serverResult.synced;
      result.created = clientResult.created + serverResult.created;
      result.updated = clientResult.updated + serverResult.updated;
      result.errors = [...clientResult.errors, ...serverResult.errors];

      console.log(
        `✅ Sync complete: ${result.synced} versions processed, ${result.created} created, ${result.updated} updated`,
      );

      if (result.errors.length > 0) {
        console.warn(
          `⚠️ ${result.errors.length} errors during sync:`,
          result.errors,
        );
      }

      // Refresh compliance calculations after sync
      await this.refreshComplianceData();

      return result;
    } catch (error) {
      console.error("❌ Windows version sync failed:", error);
      result.errors.push(
        error instanceof Error ? error.message : "Unknown error",
      );
      return result;
    }
  }

  /**
   * Get current compliance summary
   */
  async getComplianceSummary(): Promise<{
    totalVersions: number;
    supportedVersions: number;
    latestBuilds: Record<string, string>;
    upcomingEOL: Array<{
      version: string;
      eolDate: Date;
      daysUntilEOL: number;
    }>;
  }> {
    const versions = await this.db.windowsVersion.findMany({
      where: { isSupported: true },
      orderBy: [{ majorVersion: "desc" }, { releaseDate: "desc" }],
    });

    const totalVersions = await this.db.windowsVersion.count();
    const supportedVersions = versions.length;

    // Get latest builds for each major version
    const latestBuilds: Record<string, string> = {};
    for (const version of versions) {
      if (
        !latestBuilds[version.majorVersion] ||
        version.releaseDate > new Date(latestBuilds[version.majorVersion])
      ) {
        latestBuilds[version.majorVersion] = version.latestBuild;
      }
    }

    // Find versions with upcoming EOL (within 6 months)
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

    const upcomingEOL = versions
      .filter((v) => v.eolDate <= sixMonthsFromNow && v.eolDate > new Date())
      .map((v) => ({
        version: v.releaseLabel,
        eolDate: v.eolDate,
        daysUntilEOL: Math.floor(
          (v.eolDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        ),
      }))
      .sort((a, b) => a.daysUntilEOL - b.daysUntilEOL);

    return {
      totalVersions,
      supportedVersions,
      latestBuilds,
      upcomingEOL,
    };
  }

  // Private methods

  private async fetchWindowsData(): Promise<EndOfLifeWindowsEntry[]> {
    console.log("📡 Fetching Windows client data from endoflife.date...");

    const response = await fetch(this.WINDOWS_API, {
      headers: {
        "User-Agent": "D9-Compliance-Dashboard/1.0",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch Windows data: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    console.log(`📊 Fetched ${data.length} Windows client entries`);
    return data;
  }

  private async fetchWindowsServerData(): Promise<EndOfLifeWindowsEntry[]> {
    console.log("📡 Fetching Windows Server data from endoflife.date...");

    const response = await fetch(this.WINDOWS_SERVER_API, {
      headers: {
        "User-Agent": "D9-Compliance-Dashboard/1.0",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch Windows Server data: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    console.log(`📊 Fetched ${data.length} Windows Server entries`);
    return data;
  }

  private async processWindowsEntries(
    entries: EndOfLifeWindowsEntry[],
    type: "client" | "server",
  ): Promise<{
    synced: number;
    created: number;
    updated: number;
    errors: string[];
  }> {
    const result = {
      synced: 0,
      created: 0,
      updated: 0,
      errors: [] as string[],
    };

    for (const entry of entries) {
      try {
        const mapping = this.parseWindowsEntry(entry, type);
        if (!mapping) {
          result.errors.push(`Failed to parse entry: ${entry.cycle}`);
          continue;
        }

        // Check if version already exists
        const existing = await this.db.windowsVersion.findUnique({
          where: { id: mapping.id },
        });

        if (existing) {
          // Update existing version
          await this.db.windowsVersion.update({
            where: { id: mapping.id },
            data: {
              latestBuild: mapping.latestBuild,
              eolDate: mapping.eolDate,
              supportDate: mapping.supportDate,
              isSupported: mapping.isSupported,
              lastUpdated: new Date(),
            },
          });
          result.updated++;
        } else {
          // Create new version
          await this.db.windowsVersion.create({
            data: mapping,
          });
          result.created++;
        }

        result.synced++;
      } catch (error) {
        const errorMsg = `Error processing ${entry.cycle}: ${error instanceof Error ? error.message : "Unknown error"}`;
        result.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    return result;
  }

  private parseWindowsEntry(
    entry: EndOfLifeWindowsEntry,
    type: "client" | "server",
  ): WindowsVersionMapping | null {
    try {
      // Parse cycle like "11-24h2-e" or "10-22h2" or "2022-datacenter"
      let majorVersion: string;
      let featureUpdate: string;
      let edition: string;

      if (type === "server") {
        // Handle server versions like "2022-datacenter", "2019-standard"
        const serverMatch = entry.cycle.match(/(\d{4})-?(.+)?/);
        if (!serverMatch) return null;

        majorVersion = `Server${serverMatch[1]}`;
        featureUpdate = serverMatch[1]; // Use year as feature update
        edition = serverMatch[2]
          ? this.capitalizeFirst(serverMatch[2])
          : "Standard";
      } else {
        // Handle client versions like "11-24h2-e", "10-22h2"
        const clientMatch = entry.cycle.match(/(\d+)-([^-]+)(?:-([ew]))?/);
        if (!clientMatch) return null;

        majorVersion = clientMatch[1];
        featureUpdate = clientMatch[2].toUpperCase();

        const editionCode = clientMatch[3];
        edition =
          editionCode === "e"
            ? "Enterprise"
            : editionCode === "w"
              ? "Home/Pro"
              : "All";
      }

      // Determine if version is currently supported
      const eolDate = new Date(entry.eol);
      const supportDate = new Date(entry.support);
      const isSupported = new Date() < eolDate;

      const mapping: WindowsVersionMapping = {
        id: `win${majorVersion.toLowerCase()}-${featureUpdate.toLowerCase()}-${edition.toLowerCase().replace("/", "-")}`,
        cycle: entry.cycle,
        releaseLabel: entry.releaseLabel,
        majorVersion,
        featureUpdate,
        edition,
        releaseDate: new Date(entry.releaseDate),
        eolDate,
        supportDate,
        latestBuild: entry.latest,
        isSupported,
        isLTS: entry.lts || false,
        microsoftLink: entry.link,
      };

      return mapping;
    } catch (error) {
      console.error(`Failed to parse Windows entry:`, entry, error);
      return null;
    }
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  private async refreshComplianceData(): Promise<void> {
    console.log("🔄 Refreshing compliance materialized view...");

    try {
      // Refresh the materialized view (PostgreSQL specific)
      await this.db
        .$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY windows_compliance_current`;
      console.log("✅ Compliance data refreshed");
    } catch (error) {
      // If concurrent refresh fails, try regular refresh
      try {
        await this.db
          .$executeRaw`REFRESH MATERIALIZED VIEW windows_compliance_current`;
        console.log("✅ Compliance data refreshed (non-concurrent)");
      } catch (refreshError) {
        console.warn("⚠️ Failed to refresh compliance view:", refreshError);
      }
    }
  }

  /**
   * Schedule daily sync (this would be called by a cron job or scheduled task)
   */
  async scheduleDailySync(): Promise<void> {
    console.log("📅 Running daily Windows version sync...");

    try {
      const result = await this.syncWindowsVersions();

      // Log the results
      if (result.errors.length === 0) {
        console.log(
          `✅ Daily sync completed successfully: ${result.synced} versions processed`,
        );
      } else {
        console.warn(
          `⚠️ Daily sync completed with ${result.errors.length} errors`,
        );
      }

      // Could send notifications, update metrics, etc.
    } catch (error) {
      console.error("❌ Daily sync failed:", error);
      // Could send alerts, etc.
    }
  }
}

export type { EndOfLifeWindowsEntry, WindowsVersionMapping };
