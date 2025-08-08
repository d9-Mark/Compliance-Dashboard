"use client";
// src/app/admin/dashboard/client.tsx

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
      <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="col-span-full">
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
      </div>

      {/* Selected Tenant Overview */}
      {selectedTenantId && (
        <div className="mt-8">
          <h2 className="mb-4 text-xl font-semibold">
            Tenant Overview:{" "}
            {tenants?.find((t) => t.id === selectedTenantId)?.name}
          </h2>
          {overviewLoading ? (
            <div className="py-8 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading overview...</p>
            </div>
          ) : overview ? (
            <TenantOverview overview={overview} />
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
  // Calculate total problems for this tenant
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
      <h3 className="text-lg font-semibold">{tenant.name}</h3>
      <p className="text-sm text-gray-600">/{tenant.slug}</p>

      {hasEndpoints ? (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Endpoints</span>
            <span className="font-bold text-gray-900">{totalEndpoints}</span>
          </div>
          <div className="text-xs text-gray-500">
            Click to see detailed problems
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

  return (
    <div className="space-y-6">
      {/* Critical Problems Alert */}
      {(overview.stats.vulnerabilities.critical > 0 ||
        overview.stats.endpoints.nonCompliant > 0) && (
        <div className="rounded border-l-4 border-red-400 bg-red-50 p-4">
          <div className="flex items-center">
            <span className="mr-2 text-xl text-red-500">🚨</span>
            <div>
              <h3 className="font-medium text-red-800">
                Critical Issues Detected
              </h3>
              <p className="text-sm text-red-700">
                {overview.stats.vulnerabilities.critical > 0 &&
                  `${overview.stats.vulnerabilities.critical} critical vulnerabilities`}
                {overview.stats.vulnerabilities.critical > 0 &&
                  overview.stats.endpoints.nonCompliant > 0 &&
                  ", "}
                {overview.stats.endpoints.nonCompliant > 0 &&
                  `${overview.stats.endpoints.nonCompliant} non-compliant endpoints`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Problem-Focused Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

        {/* Compliance Rate */}
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
            📊 Compliance
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

      {/* All Vulnerabilities Breakdown */}
      <div className="rounded-lg border bg-white p-4">
        <h3 className="mb-3 font-semibold">📊 All Vulnerabilities</h3>
        <div className="grid grid-cols-2 gap-4 text-center md:grid-cols-4">
          <div>
            <div className="text-lg font-bold text-red-600">
              {overview.stats.vulnerabilities.critical}
            </div>
            <div className="text-xs text-gray-600">Critical</div>
          </div>
          <div>
            <div className="text-lg font-bold text-orange-600">
              {overview.stats.vulnerabilities.high}
            </div>
            <div className="text-xs text-gray-600">High</div>
          </div>
          <div>
            <div className="text-lg font-bold text-yellow-600">
              {overview.stats.vulnerabilities.medium}
            </div>
            <div className="text-xs text-gray-600">Medium</div>
          </div>
          <div>
            <div className="text-lg font-bold text-blue-600">
              {overview.stats.vulnerabilities.low}
            </div>
            <div className="text-xs text-gray-600">Low</div>
          </div>
        </div>
        <div className="mt-3 border-t pt-3 text-center">
          <span className="text-lg font-bold">Total: {totalVulns}</span>
          <span className="ml-2 text-sm text-gray-600">
            vulnerabilities across all endpoints
          </span>
        </div>
      </div>
    </div>
  );
}
