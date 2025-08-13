// components/admin/ui/ErrorState.tsx
interface ErrorStateProps {
  title: string;
  message: string;
  icon?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function ErrorState({
  title,
  message,
  icon = "⚠️",
  actionLabel,
  onAction,
}: ErrorStateProps) {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="text-center">
        <div className="mb-4 text-6xl">{icon}</div>
        <h2 className="mb-4 text-2xl font-bold text-red-600">{title}</h2>
        <p className="mb-4 text-gray-600">{message}</p>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
