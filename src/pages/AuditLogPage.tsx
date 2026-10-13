import { useState, useMemo } from 'react';
import {
  ScrollText,
  Filter,
  Search,
  Clock,
  User,
  FileCode2,
  GitBranch,
  CheckCircle2,
  Play,
  AlertTriangle,
  TestTube2,
  Shield,
} from 'lucide-react';
import { usePolicyContext } from '@/context/PolicyContext';
import { PageHeader, EmptyState } from '@/components/ui/Badges';

const CATEGORY_ICONS: Record<string, typeof FileCode2> = {
  policy: FileCode2,
  version: GitBranch,
  approval: CheckCircle2,
  decision: Play,
  test: TestTube2,
  conflict: AlertTriangle,
  system: Shield,
};

const CATEGORY_COLORS: Record<string, string> = {
  policy: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40',
  version: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40',
  approval: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40',
  decision: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40',
  test: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40',
  conflict: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40',
  system: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function AuditLogPage() {
  const { auditLog } = usePolicyContext();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let result = auditLog;
    if (filter !== 'all') {
      result = result.filter((e) => e.category === filter);
    }
    if (search.trim()) {
      const lower = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.action.toLowerCase().includes(lower) ||
          e.details.toLowerCase().includes(lower) ||
          (e.policyName || '').toLowerCase().includes(lower) ||
          e.actor.toLowerCase().includes(lower),
      );
    }
    return result;
  }, [auditLog, filter, search]);

  const categories = ['all', 'policy', 'version', 'approval', 'decision', 'test', 'conflict', 'system'];

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="Complete record of all system activity — policy changes, decisions, approvals, and tests"
      />

      <div className="card p-4 mb-6 animate-slide-up">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
            <input
              className="input pl-10"
              placeholder="Search audit entries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={16} className="text-gray-400 dark:text-slate-500" />
            {categories.map((cat) => (
              <button
                key={cat}
                className={`btn text-xs px-3 py-1.5 ${filter === cat ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon={<ScrollText size={32} />}
            title="No audit entries"
            description="Activity will appear here as you create policies, run simulations, and manage approvals."
          />
        </div>
      ) : (
        <div className="card overflow-hidden animate-slide-up">
          <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
            {filtered.map((entry, idx) => {
              const Icon = CATEGORY_ICONS[entry.category] || ScrollText;
              return (
                <div
                  key={entry.id}
                  className={`flex items-start gap-3 p-4 hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors ${
                    idx !== filtered.length - 1 ? 'border-b border-gray-100 dark:border-slate-800' : ''
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.system}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{entry.action}</p>
                      <span className={`badge ${CATEGORY_COLORS[entry.category]?.split(' ').find(c => c.includes('bg')) || 'badge-draft'}`}>
                        {entry.category}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{entry.details}</p>
                    {entry.policyName && (
                      <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">Policy: {entry.policyName}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400 dark:text-slate-500">
                      <span className="flex items-center gap-1"><Clock size={10} /> {formatTime(entry.timestamp)}</span>
                      <span>·</span>
                      <span>{formatTimeAgo(entry.timestamp)}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1"><User size={10} /> {entry.actor}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
