// src/app/admin/dashboard/client.tsx
"use client";
import { AdminDashboard } from "~/app/_components/admin/AdminDashboard";
import type { Session } from "next-auth";

interface AdminDashboardClientProps {
  session: Session;
}

export function AdminDashboardClient({ session }: AdminDashboardClientProps) {
  return <AdminDashboard session={session} />;
}
