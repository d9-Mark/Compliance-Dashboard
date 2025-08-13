// components/admin/ui/MetricCard.tsx
interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  color: "blue" | "green" | "orange" | "red" | "purple";
  trend?: "excellent" | "good" | "warning" | "critical";
  urgent?: boolean;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  color,
  trend,
  urgent,
}: MetricCardProps) {
  const colorClasses = {
    blue: "from-blue-500 to-blue-600",
    green: "from-green-500 to-green-600",
    orange: "from-orange-500 to-orange-600",
    red: "from-red-500 to-red-600",
    purple: "from-purple-500 to-purple-600",
  };

  const trendLabels = {
    excellent: "🎯 Excellent",
    good: "✅ Good",
    warning: "⚠️ Warning",
    critical: "🚨 Critical",
  };

  return (
    <div
      className={`rounded-xl bg-gradient-to-br ${colorClasses[color]} transform p-6 text-white shadow-lg transition-all duration-200 hover:scale-105 ${
        urgent ? "animate-pulse" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white/80">{title}</p>
          <p className="mt-2 text-3xl font-bold">{value}</p>
          {subtitle && <p className="mt-1 text-sm text-white/70">{subtitle}</p>}
          {trend && (
            <p className="mt-1 text-xs text-white/60">{trendLabels[trend]}</p>
          )}
        </div>
        {icon && <div className="text-2xl opacity-70">{icon}</div>}
      </div>
    </div>
  );
}
