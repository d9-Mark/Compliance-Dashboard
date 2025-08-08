"use client";
// src/app/admin/dashboard/client.tsx - Enhanced with Windows version tracking

import { useState } from "react";
import { api } from "~/trpc/react";
import type { Session } from "next-auth";
import Link from "next/link";

interface AdminDashboardClientProps {
  session: Session;
}

export function AdminDashboardClient({ session }: AdminDashboardClientProps) {
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  // Get all tenants (admin only)
  const { data: tenants, isLoading: tenantsLoading } =
    api.tenant.getAll.useQuery();

  // Get overview for selected tenant
  const { data: overview, isLoading: overviewLoading } =
    api.tenant.getOverview.useQuery(
      { tenantId: selectedTenantId! },
      { enabled: !!selectedTenantId },
    );

  // Get Windows summary for selected tenant
  const { data: windowsSummary } = api.tenant.getWindowsVersionSummary.useQuery(
    { tenantId: selectedTenantId! },
    { enabled: !!selectedTenantId },
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">D9 Admin Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Welcome back, {session.user.name}. Manage all client tenants here.
          </p>
        </div>
        <Link
          href="/auth/signout"
          className="rounded-lg bg-red-100 px-4 py-2 text-red-700 transition-colors hover:bg-red-200"
        >
          Sign Out
        </Link>
      </div>

      {/* Tenant Selection */}
      <div className="mb-8">
        <h2 className="mb-4 text-xl font-semibold">Client Tenants</h2>
        {tenantsLoading ? (
          <div className="py-8 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading tenants...</p>
          </div>
        ) : tenants?.length ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tenants.map((tenant) => (
              <TenantCard
                key={tenant.id}
                tenant={tenant}
                isSelected={selectedTenantId === tenant.id}
                onSelect={() => setSelectedTenantId(tenant.id)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg bg-gray-50 py-8 text-center">
            <p className="text-gray-600">
              No tenants found. Run the seed script to create test data.
            </p>
            <code className="mt-2 block rounded bg-gray-100 p-2 text-sm">
              npm run db:seed
            </code>
          </div>
        )}
      </div>

      {/* Selected Tenant Overview */}
      {selectedTenantId && (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Tenant Overview:{" "}
              {tenants?.find((t) => t.id === selectedTenantId)?.name}
            </h2>
            <Link
              href={`/tenant/${tenants?.find((t) => t.id === selectedTenantId)?.slug}/dashboard`}
              className="rounded-lg bg-blue-100 px-4 py-2 text-blue-700 transition-colors hover:bg-blue-200"
            >
              View as Tenant →
            </Link>
          </div>

          {overviewLoading ? (
            <div className="py-8 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading overview...</p>
            </div>
          ) : overview ? (
            <>
              <TenantOverview overview={overview} />
              {windowsSummary && (
                <WindowsOverview windowsSummary={windowsSummary} />
              )}
            </>
          ) : (
            <div className="rounded-lg bg-red-50 py-8 text-center">
              <p className="text-red-600">Failed to load tenant overview</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TenantCard({
  tenant,
  isSelected,
  onSelect,
}: {
  tenant: any;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const totalEndpoints = tenant._count.endpoints;
  const hasEndpoints = totalEndpoints > 0;

  return (
    <div
      className={`cursor-pointer rounded-lg border p-6 transition-all hover:shadow-md ${
        isSelected
          ? "border-blue-500 bg-blue-50 shadow-md"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold">{tenant.name}</h3>
          <p className="text-sm text-gray-600">/{tenant.slug}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">
            {totalEndpoints}
          </div>
          <div className="text-xs text-gray-500">endpoints</div>
        </div>
      </div>

      {hasEndpoints ? (
        <div className="mt-4">
          <div className="mb-2 text-xs text-gray-500">
            {tenant._count.users} users • {tenant._count.clients} clients
          </div>
          <div className="text-xs text-blue-600">
            Click to see compliance details →
          </div>
        </div>
      ) : (
        <div className="mt-4 py-2 text-center">
          <span className="text-sm text-gray-400">No endpoints</span>
        </div>
      )}
    </div>
  );
}

function TenantOverview({ overview }: { overview: any }) {
  const totalVulns =
    overview.stats.vulnerabilities.critical +
    overview.stats.vulnerabilities.high +
    overview.stats.vulnerabilities.medium +
    overview.stats.vulnerabilities.low;

  const hasWindowsIssues =
    overview.stats.windows.outdated > 0 || overview.stats.windows.unknown > 0;
  const windowsComplianceRate =
    overview.stats.windows.total > 0
      ? Math.round(
          (overview.stats.windows.compliant / overview.stats.windows.total) *
            100,
        )
      : 100;

  return (
    <div className="space-y-6">
      {/* Critical Problems Alert */}
      {(overview.stats.vulnerabilities.critical > 0 ||
        overview.stats.endpoints.nonCompliant > 0 ||
        hasWindowsIssues) && (
        <div className="rounded border-l-4 border-red-400 bg-red-50 p-4">
          <div className="flex items-center">
            <span className="mr-2 text-xl text-red-500">🚨</span>
            <div>
              <h3 className="font-medium text-red-800">
                Critical Issues Detected
              </h3>
              <div className="space-y-1 text-sm text-red-700">
                {overview.stats.vulnerabilities.critical > 0 && (
                  <div>
                    • {overview.stats.vulnerabilities.critical} critical
                    vulnerabilities
                  </div>
                )}
                {overview.stats.endpoints.nonCompliant > 0 && (
                  <div>
                    • {overview.stats.endpoints.nonCompliant} non-compliant
                    endpoints
                  </div>
                )}
                {hasWindowsIssues && (
                  <div>
                    •{" "}
                    {overview.stats.windows.outdated +
                      overview.stats.windows.unknown}{" "}
                    Windows systems need updates
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Problem-Focused Stats + Windows */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {/* Critical Issues */}
        <div className="rounded border-l-4 border-red-500 bg-red-50 p-4">
          <h3 className="font-semibold text-red-900">🚨 Critical</h3>
          <div className="text-2xl font-bold text-red-700">
            {overview.stats.vulnerabilities.critical}
          </div>
          <div className="text-xs text-red-600">Immediate action required</div>
        </div>

        {/* High Priority */}
        <div className="rounded border-l-4 border-orange-500 bg-orange-50 p-4">
          <h3 className="font-semibold text-orange-900">⚠️ High Priority</h3>
          <div className="text-2xl font-bold text-orange-700">
            {overview.stats.vulnerabilities.high}
          </div>
          <div className="text-xs text-orange-600">High priority fixes</div>
        </div>

        {/* Windows Issues */}
        <div className="rounded border-l-4 border-blue-500 bg-blue-50 p-4">
          <h3 className="font-semibold text-blue-900">🪟 Windows Issues</h3>
          <div className="text-2xl font-bold text-blue-700">
            {overview.stats.windows.outdated + overview.stats.windows.unknown}
          </div>
          <div className="text-xs text-blue-600">
            of {overview.stats.windows.total} Windows systems
          </div>
        </div>

        {/* Non-Compliant */}
        <div className="rounded border-l-4 border-red-400 bg-red-50 p-4">
          <h3 className="font-semibold text-red-900">❌ Non-Compliant</h3>
          <div className="text-2xl font-bold text-red-700">
            {overview.stats.endpoints.nonCompliant}
          </div>
          <div className="text-xs text-red-600">
            of {overview.stats.endpoints.total} endpoints
          </div>
        </div>

        {/* Overall Compliance Rate */}
        <div
          className={`rounded border-l-4 p-4 ${
            overview.stats.endpoints.total > 0 &&
            overview.stats.endpoints.compliant /
              overview.stats.endpoints.total >=
              0.9
              ? "border-green-500 bg-green-50"
              : "border-yellow-500 bg-yellow-50"
          }`}
        >
          <h3
            className={`font-semibold ${
              overview.stats.endpoints.total > 0 &&
              overview.stats.endpoints.compliant /
                overview.stats.endpoints.total >=
                0.9
                ? "text-green-900"
                : "text-yellow-900"
            }`}
          >
            📊 Overall Compliance
          </h3>
          <div
            className={`text-2xl font-bold ${
              overview.stats.endpoints.total > 0 &&
              overview.stats.endpoints.compliant /
                overview.stats.endpoints.total >=
                0.9
                ? "text-green-700"
                : "text-yellow-700"
            }`}
          >
            {overview.stats.endpoints.total > 0
              ? `${Math.round((overview.stats.endpoints.compliant / overview.stats.endpoints.total) * 100)}%`
              : "0%"}
          </div>
          <div
            className={`text-xs ${
              overview.stats.endpoints.total > 0 &&
              overview.stats.endpoints.compliant /
                overview.stats.endpoints.total >=
                0.9
                ? "text-green-600"
                : "text-yellow-600"
            }`}
          >
            {overview.stats.endpoints.compliant} of{" "}
            {overview.stats.endpoints.total} compliant
          </div>
        </div>
      </div>

      {/* Windows Compliance Summary */}
      {overview.stats.windows.total > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Windows Compliance Chart */}
          <div className="rounded-lg border bg-white p-6">
            <h3 className="mb-4 font-semibold">
              🪟 Windows Version Compliance
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-green-600">✅ Latest Versions</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">
                    {overview.stats.windows.compliant}
                  </span>
                  <span className="text-sm text-gray-500">
                    (
                    {Math.round(
                      (overview.stats.windows.compliant /
                        overview.stats.windows.total) *
                        100,
                    )}
                    %)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-orange-600">⚠️ Need Updates</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">
                    {overview.stats.windows.outdated}
                  </span>
                  <span className="text-sm text-gray-500">
                    (
                    {Math.round(
                      (overview.stats.windows.outdated /
                        overview.stats.windows.total) *
                        100,
                    )}
                    %)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">❓ Unknown Version</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">
                    {overview.stats.windows.unknown}
                  </span>
                  <span className="text-sm text-gray-500">
                    (
                    {Math.round(
                      (overview.stats.windows.unknown /
                        overview.stats.windows.total) *
                        100,
                    )}
                    %)
                  </span>
                </div>
              </div>
              <div className="border-t pt-3">
                <div className="flex items-center justify-between font-bold">
                  <span>Total Windows Systems</span>
                  <span>{overview.stats.windows.total}</span>
                </div>
              </div>
            </div>
          </div>

          {/* All Vulnerabilities Breakdown */}
          <div className="rounded-lg border bg-white p-6">
            <h3 className="mb-4 font-semibold">📊 All Vulnerabilities</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-red-600">Critical</span>
                <span className="font-semibold text-red-600">
                  {overview.stats.vulnerabilities.critical}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-orange-600">High</span>
                <span className="font-semibold text-orange-600">
                  {overview.stats.vulnerabilities.high}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-yellow-600">Medium</span>
                <span className="font-semibold text-yellow-600">
                  {overview.stats.vulnerabilities.medium}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-blue-600">Low</span>
                <span className="font-semibold text-blue-600">
                  {overview.stats.vulnerabilities.low}
                </span>
              </div>
              <div className="border-t pt-3">
                <div className="flex items-center justify-between font-bold">
                  <span>Total</span>
                  <span>{totalVulns}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WindowsOverview({ windowsSummary }: { windowsSummary: any }) {
  if (!windowsSummary || windowsSummary.endpoints.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-white p-6">
      <h3 className="mb-4 text-lg font-semibold">
        🪟 Windows Endpoints Detail
      </h3>

      {/* Quick stats */}
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {windowsSummary.summary.total}
          </div>
          <div className="text-sm text-gray-600">Total</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {windowsSummary.summary.latest}
          </div>
          <div className="text-sm text-gray-600">Latest</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-600">
            {windowsSummary.summary.needsUpdate}
          </div>
          <div className="text-sm text-gray-600">Need Updates</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-600">
            {windowsSummary.summary.unknown}
          </div>
          <div className="text-sm text-gray-600">Unknown</div>
        </div>
      </div>

      {/* Detailed list of problematic endpoints */}
      <div className="space-y-3">
        <h4 className="font-medium text-gray-900">
          Endpoints Requiring Windows Updates:
        </h4>
        {windowsSummary.endpoints
          .filter((endpoint: any) => !endpoint.analysis.isLatest)
          .slice(0, 10)
          .map((endpoint: any) => (
            <div
              key={endpoint.id}
              className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 p-3"
            >
              <div>
                <div className="font-medium">{endpoint.hostname}</div>
                <div className="text-sm text-gray-600">
                  Current: {endpoint.operatingSystem} {endpoint.osVersion}
                </div>
                {endpoint.analysis.recommendedVersion && (
                  <div className="text-sm text-orange-700">
                    Recommended: {endpoint.analysis.recommendedVersion}
                  </div>
                )}
              </div>
              <div className="text-right">
                <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800">
                  Update Available
                </span>
                {endpoint.analysis.daysSinceLastSeen !== null && (
                  <div className="mt-1 text-xs text-gray-500">
                    Last seen: {endpoint.analysis.daysSinceLastSeen} days ago
                  </div>
                )}
              </div>
            </div>
          ))}

        {windowsSummary.endpoints.filter((e: any) => !e.analysis.isLatest)
          .length > 10 && (
          <div className="text-center text-sm text-gray-500">
            ... and{" "}
            {windowsSummary.endpoints.filter((e: any) => !e.analysis.isLatest)
              .length - 10}{" "}
            more
          </div>
        )}
      </div>
    </div>
  );
}
