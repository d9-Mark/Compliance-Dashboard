// Simple chart components for better data visualization
"use client";

interface ProgressBarProps {
  value: number;
  max: number;
  label: string;
  color?: 'green' | 'red' | 'yellow' | 'blue' | 'purple';
  size?: 'sm' | 'md' | 'lg';
}

export function ProgressBar({ 
  value, 
  max, 
  label, 
  color = 'blue',
  size = 'md' 
}: ProgressBarProps) {
  const percentage = Math.round((value / max) * 100);
  
  const colorClasses = {
    green: 'bg-green-500',
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
  };

  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4',
  };

  return (
    <div className="w-full">
      <div className="mb-2 flex justify-between text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-600">
          {value}/{max} ({percentage}%)
        </span>
      </div>
      <div className={`w-full rounded-full bg-gray-200 ${sizeClasses[size]}`}>
        <div
          className={`${sizeClasses[size]} rounded-full transition-all duration-300 ${colorClasses[color]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

interface DonutChartProps {
  data: Array<{
    label: string;
    value: number;
    color: string;
  }>;
  size?: number;
  centerText?: string;
}

export function DonutChart({ data, size = 120, centerText }: DonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  
  let currentOffset = 0;
  
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          className="transform -rotate-90"
        >
          {data.map((item, index) => {
            const strokeDasharray = (item.value / total) * circumference;
            const strokeDashoffset = -currentOffset;
            currentOffset += strokeDasharray;
            
            return (
              <circle
                key={index}
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke={item.color}
                strokeWidth="8"
                strokeDasharray={`${strokeDasharray} ${circumference - strokeDasharray}`}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-300"
              />
            );
          })}
        </svg>
        
        {centerText && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-gray-700">{centerText}</span>
          </div>
        )}
      </div>
      
      {/* Legend */}
      <div className="mt-3 space-y-1">
        {data.map((item, index) => (
          <div key={index} className="flex items-center text-sm">
            <div
              className="mr-2 h-3 w-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-gray-600">
              {item.label}: {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface TrendIndicatorProps {
  current: number;
  previous?: number;
  format?: 'number' | 'percentage';
  label?: string;
}

export function TrendIndicator({ 
  current, 
  previous, 
  format = 'number',
  label 
}: TrendIndicatorProps) {
  if (!previous) {
    return (
      <div className="text-sm text-gray-500">
        {label && <span>{label}: </span>}
        {format === 'percentage' ? `${current}%` : current}
      </div>
    );
  }

  const change = current - previous;
  const percentChange = Math.round((change / previous) * 100);
  const isPositive = change > 0;
  const isNeutral = change === 0;

  return (
    <div className="flex items-center space-x-2 text-sm">
      {label && <span className="text-gray-700">{label}:</span>}
      <span className="font-medium">
        {format === 'percentage' ? `${current}%` : current}
      </span>
      
      {!isNeutral && (
        <div className={`flex items-center ${
          isPositive ? 'text-green-600' : 'text-red-600'
        }`}>
          <span className="mr-1">
            {isPositive ? '↗' : '↘'}
          </span>
          <span className="text-xs">
            {Math.abs(percentChange)}%
          </span>
        </div>
      )}
      
      {isNeutral && (
        <span className="text-gray-400 text-xs">No change</span>
      )}
    </div>
  );
}

interface MetricComparisonProps {
  title: string;
  metrics: Array<{
    label: string;
    value: number;
    color: string;
    target?: number;
  }>;
}

export function MetricComparison({ title, metrics }: MetricComparisonProps) {
  const maxValue = Math.max(...metrics.map(m => Math.max(m.value, m.target || 0)));
  
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h4 className="mb-4 font-medium text-gray-900">{title}</h4>
      <div className="space-y-4">
        {metrics.map((metric, index) => (
          <div key={index}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: metric.color }}>
                {metric.label}
              </span>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">
                  {metric.value}
                </span>
                {metric.target && (
                  <span className="text-xs text-gray-400">
                    / {metric.target}
                  </span>
                )}
              </div>
            </div>
            
            <div className="h-2 w-full rounded-full bg-gray-100">
              <div
                className="h-2 rounded-full transition-all duration-300"
                style={{
                  backgroundColor: metric.color,
                  width: `${(metric.value / maxValue) * 100}%`
                }}
              />
              {metric.target && (
                <div
                  className="h-2 w-1 bg-gray-400 opacity-50 -mt-2 rounded-full"
                  style={{
                    marginLeft: `${(metric.target / maxValue) * 100}%`
                  }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}