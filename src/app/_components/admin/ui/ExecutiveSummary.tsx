// Executive Summary component for digestible overview
"use client";

interface ExecutiveSummaryProps {
  globalMetrics: any;
  cveStats: any;
  tenantCount: number;
}

export function ExecutiveSummary({ globalMetrics, cveStats, tenantCount }: ExecutiveSummaryProps) {
  if (!globalMetrics) return null;

  const complianceRate = Math.round(globalMetrics.averageCompliance);
  const criticalIssues = globalMetrics.criticalVulns + globalMetrics.totalThreats;
  const totalVulns = globalMetrics.totalVulnerabilities;
  
  // Determine overall health score
  const getHealthScore = () => {
    let score = 100;
    if (criticalIssues > 0) score -= 30;
    if (complianceRate < 80) score -= 20;
    if (complianceRate < 60) score -= 30;
    return Math.max(0, score);
  };

  const healthScore = getHealthScore();
  const getHealthStatus = () => {
    if (healthScore >= 80) return { status: 'Excellent', color: 'green', icon: '🟢' };
    if (healthScore >= 60) return { status: 'Good', color: 'yellow', icon: '🟡' };
    return { status: 'Needs Attention', color: 'red', icon: '🔴' };
  };

  const health = getHealthStatus();

  return (
    <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50 to-indigo-100 p-6 shadow-sm">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-gray-900">
            📋 Executive Summary
          </h2>
          <div className="rounded-full bg-white px-3 py-1 text-sm font-medium text-gray-700">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
        <p className="text-sm text-gray-600">
          Quick overview of your security posture across all {tenantCount} managed organizations
        </p>
      </div>

      {/* Key Insights */}
      <div className="mb-6 space-y-4">
        {/* Overall Health */}
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg">{health.icon}</span>
                <span className="font-semibold text-gray-900">Overall Security Health</span>
              </div>
              <div className={`text-sm mt-1 ${
                health.color === 'green' ? 'text-green-600' : 
                health.color === 'yellow' ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {health.status} ({healthScore}/100)
              </div>
            </div>
            <div className={`text-2xl font-bold ${
              health.color === 'green' ? 'text-green-600' : 
              health.color === 'yellow' ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {healthScore}
            </div>
          </div>
        </div>

        {/* Critical Actions */}
        {criticalIssues > 0 && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <div className="flex items-start space-x-3">
              <span className="text-red-500 text-lg">⚠️</span>
              <div>
                <div className="font-medium text-red-800 mb-1">
                  Immediate Action Required
                </div>
                <div className="text-sm text-red-700">
                  <strong>{criticalIssues} critical security issues</strong> need your immediate attention. 
                  These pose significant risk to your managed environments.
                </div>
                <div className="mt-2">
                  <button className="rounded-md bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700">
                    View Critical Issues →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Good News */}
        {criticalIssues === 0 && complianceRate >= 80 && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-4">
            <div className="flex items-start space-x-3">
              <span className="text-green-500 text-lg">✅</span>
              <div>
                <div className="font-medium text-green-800 mb-1">
                  Excellent Security Posture
                </div>
                <div className="text-sm text-green-700">
                  No critical issues detected and {complianceRate}% compliance rate indicates 
                  strong security management across your client portfolio.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Key Metrics Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg bg-white p-3 text-center">
          <div className="text-lg font-bold text-blue-600">{tenantCount}</div>
          <div className="text-xs text-gray-600">Active Clients</div>
        </div>
        
        <div className="rounded-lg bg-white p-3 text-center">
          <div className="text-lg font-bold text-purple-600">{globalMetrics.totalEndpoints}</div>
          <div className="text-xs text-gray-600">Endpoints</div>
        </div>
        
        <div className={`rounded-lg bg-white p-3 text-center ${
          complianceRate >= 80 ? 'border-l-4 border-green-500' : 
          complianceRate >= 60 ? 'border-l-4 border-yellow-500' : 'border-l-4 border-red-500'
        }`}>
          <div className={`text-lg font-bold ${
            complianceRate >= 80 ? 'text-green-600' : 
            complianceRate >= 60 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {complianceRate}%
          </div>
          <div className="text-xs text-gray-600">Compliant</div>
        </div>
        
        <div className={`rounded-lg bg-white p-3 text-center ${
          criticalIssues === 0 ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'
        }`}>
          <div className={`text-lg font-bold ${
            criticalIssues === 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {criticalIssues}
          </div>
          <div className="text-xs text-gray-600">Critical Issues</div>
        </div>
      </div>

      {/* Quick Recommendations */}
      <div className="mt-6 rounded-lg bg-blue-50 border border-blue-200 p-4">
        <div className="flex items-start space-x-3">
          <span className="text-blue-500 text-lg">💡</span>
          <div>
            <div className="font-medium text-blue-800 mb-2">
              Today's Recommendations
            </div>
            <div className="space-y-1 text-sm text-blue-700">
              {criticalIssues > 0 && (
                <div>• Address {criticalIssues} critical security issues first</div>
              )}
              {complianceRate < 90 && (
                <div>• Improve compliance rate from {complianceRate}% to 90%+</div>
              )}
              <div>• Review {Math.floor(totalVulns * 0.1)} medium-priority vulnerabilities</div>
              {tenantCount > 5 && (
                <div>• Consider automated reporting for {tenantCount} client organizations</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}