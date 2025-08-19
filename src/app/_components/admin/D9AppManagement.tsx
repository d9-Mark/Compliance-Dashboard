// D9 App Management Panel - src/app/_components/admin/D9AppManagement.tsx
"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

export function D9AppManagementPanel() {
  const [newAppName, setNewAppName] = useState("");
  const [newAppVendor, setNewAppVendor] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // UPDATED: Use the new query procedure
  const { data: d9Apps, refetch } = api.tenant.getD9ManagedApps.useQuery();

  // UPDATED: Use the new mutation procedures
  const addAppMutation = api.tenant.addD9ManagedApp.useMutation({
    onSuccess: () => {
      refetch();
      setNewAppName("");
      setNewAppVendor("");
      setShowAddForm(false);
    },
  });

  const removeAppMutation = api.tenant.removeD9ManagedApp.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleAddApp = () => {
    if (newAppName.trim()) {
      addAppMutation.mutate({
        appName: newAppName.trim(),
        vendor: newAppVendor.trim() || undefined,
      });
    }
  };

  const handleRemoveApp = (appName: string, vendor?: string) => {
    if (confirm(`Remove "${appName}" from D9 managed apps?`)) {
      removeAppMutation.mutate({
        appName,
        vendor,
      });
    }
  };

  // Common D9 managed applications for quick adding
  const commonD9Apps = [
    { name: "Microsoft Edge", vendor: "Microsoft" },
    { name: "Google Chrome", vendor: "Google" },
    { name: "Mozilla Firefox", vendor: "Mozilla" },
    { name: "Adobe Acrobat Reader", vendor: "Adobe" },
    { name: "Microsoft Office", vendor: "Microsoft" },
    { name: "Zoom", vendor: "Zoom Video Communications" },
    { name: "Microsoft Teams", vendor: "Microsoft" },
    { name: "OneDrive", vendor: "Microsoft" },
    { name: "Slack", vendor: "Slack Technologies" },
    { name: "Dropbox", vendor: "Dropbox" },
    { name: "Notepad++", vendor: "Notepad++" },
    { name: "7-Zip", vendor: "Igor Pavlov" },
    { name: "VLC Media Player", vendor: "VideoLAN" },
    { name: "Visual Studio Code", vendor: "Microsoft" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">D9 Managed Applications</h3>
          <p className="text-sm text-gray-600">
            Applications managed by D9 can be filtered out from vulnerability
            reports
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {showAddForm ? "Cancel" : "Add App"}
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h4 className="mb-3 font-medium">Add D9 Managed Application</h4>

          {/* Quick Add Common Apps */}
          <div className="mb-4">
            <p className="mb-2 text-sm text-gray-600">Quick add common apps:</p>
            <div className="flex flex-wrap gap-2">
              {commonD9Apps
                .filter(
                  (app) =>
                    !d9Apps?.apps?.some((d9App) => d9App.name === app.name),
                )
                .slice(0, 6)
                .map((app) => (
                  <button
                    key={`${app.name}-${app.vendor}`}
                    onClick={() => {
                      addAppMutation.mutate({
                        action: "ADD",
                        appName: app.name,
                        vendor: app.vendor,
                      });
                    }}
                    disabled={addAppMutation.isPending}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                  >
                    {app.name}
                  </button>
                ))}
            </div>
          </div>

          {/* Manual Add Form */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Application Name *
              </label>
              <input
                type="text"
                value={newAppName}
                onChange={(e) => setNewAppName(e.target.value)}
                placeholder="e.g., Microsoft Office"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Vendor
              </label>
              <input
                type="text"
                value={newAppVendor}
                onChange={(e) => setNewAppVendor(e.target.value)}
                placeholder="e.g., Microsoft"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleAddApp}
                disabled={!newAppName.trim() || addAppMutation.isPending}
                className="w-full rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {addAppMutation.isPending ? "Adding..." : "Add"}
              </button>
            </div>
          </div>

          {addAppMutation.error && (
            <div className="mt-2 text-sm text-red-600">
              Error: {addAppMutation.error.message}
            </div>
          )}
        </div>
      )}

      {/* Current D9 Managed Apps */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h4 className="font-medium">
            Currently Managed ({d9Apps?.apps?.length || 0} apps)
          </h4>
        </div>

        {d9Apps?.apps?.length ? (
          <div className="divide-y divide-gray-200">
            {d9Apps.apps.map((app, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <div className="font-medium">{app.name}</div>
                  {app.vendor && (
                    <div className="text-sm text-gray-600">{app.vendor}</div>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveApp(app.name, app.vendor)}
                  disabled={removeAppMutation.isPending}
                  className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            No D9 managed applications configured
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h5 className="mb-2 font-medium text-blue-800">
          How D9 App Management Works
        </h5>
        <ul className="space-y-1 text-sm text-blue-700">
          <li>
            • Apps marked as "D9 Managed" can be filtered out of vulnerability
            reports
          </li>
          <li>
            • This helps focus on applications that clients need to manage
            themselves
          </li>
          <li>
            • D9 managed apps are still tracked but don't generate alerts for
            clients
          </li>
          <li>
            • Use this for software that D9 handles updates and security for
          </li>
        </ul>
      </div>
    </div>
  );
}

// Integration component for admin tabs
export function D9AppManagementTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Application Management
        </h2>
        <p className="text-gray-600">
          Manage D9-controlled applications and vulnerability filtering
        </p>
      </div>

      <D9AppManagementPanel />
    </div>
  );
}
