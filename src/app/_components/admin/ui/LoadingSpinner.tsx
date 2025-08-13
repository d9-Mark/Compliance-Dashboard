// components/admin/ui/LoadingSpinner.tsx
interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  message?: string;
}

export function LoadingSpinner({ size = "md", message }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div className="flex items-center justify-center">
      <div className="text-center">
        <div
          className={`${sizeClasses[size]} mx-auto mb-4 animate-spin rounded-full border-b-2 border-blue-600`}
        />
        {message && <p className="text-gray-600">{message}</p>}
      </div>
    </div>
  );
}
