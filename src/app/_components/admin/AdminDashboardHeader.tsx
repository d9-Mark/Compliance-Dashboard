// components/admin/AdminDashboardHeader.tsx
import type { Session } from "next-auth";

interface AdminDashboardHeaderProps {
  session: Session;
}

export function AdminDashboardHeader({ session }: AdminDashboardHeaderProps) {
  return (
    <div className="bg-white shadow">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-gray-900">
              Admin Dashboard
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">
              Welcome, {session.user?.email}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
