import { useMemo } from 'react';
import {
  Shield,
  FileCode2,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  TestTube2,
  GitCompareArrows,
  ScrollText,
  ArrowRight,
  Activity,
  Clock,
} from 'lucide-react';
import { useNav } from '@/context/NavContext';
import { usePolicyContext } from '@/context/PolicyContext';
import { PageHeader, StatCard, CategoryBadge } from '@/components/ui/Badges';
import { countActivePolicies, countPendingApprovals, getCurrentVersion } from '@/lib/policyUtils';
import { detectConflicts } from '@/engine/counterexample';

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const ACTION_COLORS: Record<string, string> = {
  policy: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40',
  version: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40',
  approval: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40',
  decision: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40',
  test: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40',
  conflict: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40',
  system: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800',
};

export function DashboardPage() {
  const { navigate } = useNav();
  const { policies, auditLog } = usePolicyContext();

  const stats = useMemo(() => {
    const active = countActivePolicies(policies);
    const pending = countPendingApprovals(policies);
    const totalRules = policies.reduce((sum, p) => {
      const v = getCurrentVersion(p);
      return sum + (v?.rules.length || 0);
    }, 0);

    let totalConflicts = 0;
    for (const p of policies) {
      const v = getCurrentVersion(p);
      if (v) {
        totalConflicts += detectConflicts(v.rules).length;
      }
    }

    return { active, pending, totalRules, totalConflicts };
  }, [policies]);

  const quickActions = [
    { label: 'Compile Policy', icon: <FileCode2 size={20} />, page: 'compiler' as const, desc: 'Author or edit structured rules', accent: 'blue' },
    { label: 'Simulate Decision', icon: <PlayCircle size={20} />, page: 'simulator' as const, desc: 'Run a scenario through the engine', accent: 'emerald' },
    { label: 'Run Tests', icon: <TestTube2 size={20} />, page: 'tests' as const, desc: 'Generate counterexamples & test cases', accent: 'amber' },
    { label: 'Detect Conflicts', icon: <AlertTriangle size={20} />, page: 'conflicts' as const, desc: 'Find contradicting rules', accent: 'red' },
    { label: 'Compare Versions', icon: <GitCompareArrows size={20} />, page: 'versions' as const, desc: 'Diff policy versions', accent: 'slate' },
    { label: 'View Audit Log', icon: <ScrollText size={20} />, page: 'audit' as const, desc: 'Review all system activity', accent: 'slate' },
  ];

  const accentClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white dark:group-hover:bg-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white dark:group-hover:bg-emerald-600',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 group-hover:bg-amber-600 group-hover:text-white dark:group-hover:bg-amber-600',
    red: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 group-hover:bg-red-600 group-hover:text-white dark:group-hover:bg-red-600',
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 group-hover:bg-slate-700 group-hover:text-white dark:group-hover:bg-slate-700',
  };

  const recentAudit = auditLog.slice(0, 8);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Policy control system overview and quick access to all tools"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Policies" value={stats.active} icon={<Shield size={20} />} accent="blue" trend={`${policies.length} total policies`} />
        <StatCard label="Total Rules" value={stats.totalRules} icon={<FileCode2 size={20} />} accent="emerald" trend="Across all active versions" />
        <StatCard label="Pending Approvals" value={stats.pending} icon={<CheckCircle2 size={20} />} accent="amber" trend="Awaiting review" />
        <StatCard label="Detected Conflicts" value={stats.totalConflicts} icon={<AlertTriangle size={20} />} accent="red" trend="Across all policies" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <h2 className="section-title mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {quickActions.map((action) => (
              <div
                key={action.label}
                className="card card-hover p-4 cursor-pointer group animate-slide-up"
                onClick={() => navigate(action.page)}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-all duration-200 ${accentClasses[action.accent]}`}>
                  {action.icon}
                </div>
                <p className="font-semibold text-sm text-gray-900 dark:text-white mb-0.5">{action.label}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">{action.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="section-title mb-4">Recent Activity</h2>
          <div className="card divide-y divide-gray-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
            {recentAudit.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400 dark:text-slate-500">
                <Activity size={24} className="mx-auto mb-2 opacity-50" />
                No activity yet
              </div>
            ) : (
              recentAudit.map((entry) => (
                <div key={entry.id} className="p-3 flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${ACTION_COLORS[entry.category] || ACTION_COLORS.system}`}>
                    <Clock size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-200 truncate">{entry.action}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{entry.details}</p>
                    <p className="text-[10px] text-gray-400 dark:text-slate-600 mt-0.5">{formatTimeAgo(entry.timestamp)} · {entry.actor}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Policies</h2>
          <button className="btn-primary" onClick={() => navigate('compiler')}>
            <FileCode2 size={16} /> New Policy
          </button>
        </div>
        <div className="card overflow-hidden">
          {policies.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400 dark:text-slate-500">
              No policies yet. Create your first policy to get started.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Policy</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider hidden sm:table-cell">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">Rules</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {policies.map((policy) => {
                  const version = getCurrentVersion(policy);
                  return (
                    <tr
                      key={policy.id}
                      className="hover:bg-gray-50 dark:hover:bg-slate-800/30 cursor-pointer transition-colors"
                      onClick={() => navigate('compiler', { policyId: policy.id })}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm text-gray-900 dark:text-white">{policy.name}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500 truncate max-w-xs">{policy.description}</p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <CategoryBadge category={policy.category} />
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-sm text-gray-600 dark:text-slate-400">{version?.rules.length || 0}</span>
                      </td>
                      <td className="px-4 py-3">
                        {version && (
                          <span className={`badge ${
                            version.status === 'active' ? 'badge-active' :
                            version.status === 'draft' ? 'badge-draft' :
                            version.status === 'in_review' ? 'badge-in_review' :
                            version.status === 'deprecated' ? 'badge-deprecated' :
                            'badge-archived'
                          }`}>
                            {version.status.replace('_', ' ')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ArrowRight size={16} className="text-gray-300 dark:text-slate-600" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
