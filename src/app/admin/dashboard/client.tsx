// src/app/admin/dashboard/client.tsx
"use client";
import type { Session } from "next-auth";
import { AdminDashboard } from "~/app/_components/admin/AdminDashboard";

interface AdminDashboardClientProps {
  session: Session;
}

export function AdminDashboardClient({ session }: AdminDashboardClientProps) {
  return <AdminDashboard session={session} />;
}
