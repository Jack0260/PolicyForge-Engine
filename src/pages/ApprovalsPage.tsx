import { useState, useMemo } from 'react';
import {
  CheckCircle2,
  ArrowRight,
  Clock,
  User,
  MessageSquare,
  Filter,
} from 'lucide-react';
import { useNav } from '@/context/NavContext';
import { usePolicyContext } from '@/context/PolicyContext';
import { PageHeader, EmptyState, StatusBadge } from '@/components/ui/Badges';
import { getCurrentVersion, transitionStatus } from '@/lib/policyUtils';
import type { PolicyStatus, PolicyRecord } from '@/types/policy';

const STATUS_TRANSITIONS: Array<{
  from: PolicyStatus;
  to: PolicyStatus;
  label: string;
  roles: string[];
}> = [
  { from: 'draft', to: 'in_review', label: 'Submit for Review', roles: ['Admin', 'Policy Author'] },
  { from: 'in_review', to: 'approved', label: 'Approve', roles: ['Admin', 'Reviewer', 'Approver'] },
  { from: 'in_review', to: 'draft', label: 'Request Changes', roles: ['Admin', 'Reviewer'] },
  { from: 'approved', to: 'active', label: 'Activate', roles: ['Admin', 'Approver'] },
  { from: 'active', to: 'deprecated', label: 'Deprecate', roles: ['Admin'] },
  { from: 'deprecated', to: 'archived', label: 'Archive', roles: ['Admin'] },
];

const STATUS_FLOW: PolicyStatus[] = ['draft', 'in_review', 'approved', 'active', 'deprecated', 'archived'];

export function ApprovalsPage() {
  const { navigate } = useNav();
  const { policies, upsertPolicy, logAction, currentUser } = usePolicyContext();
  const [filter, setFilter] = useState<string>('all');
  const [transitionNote, setTransitionNote] = useState<Record<string, string>>({});

  const filteredPolicies = useMemo(() => {
    if (filter === 'all') return policies;
    return policies.filter((p) => {
      const v = getCurrentVersion(p);
      return v?.status === filter;
    });
  }, [policies, filter]);

  const handleTransition = (policy: PolicyRecord, to: PolicyStatus, label: string) => {
    const version = getCurrentVersion(policy);
    if (!version) return;
    const note = transitionNote[version.id] || label;
    const updated = transitionStatus(policy, version.id, to, currentUser, note);
    upsertPolicy(updated);
    logAction({
      actor: currentUser,
      action: `${label} on "${policy.name}"`,
      policyId: policy.id,
      policyName: policy.name,
      details: `Status: ${version.status} → ${to}. Note: ${note}`,
      category: 'approval',
    });
    setTransitionNote((prev) => {
      const next = { ...prev };
      delete next[version.id];
      return next;
    });
  };

  const pendingCount = policies.filter((p) => {
    const v = getCurrentVersion(p);
    return v?.status === 'draft' || v?.status === 'in_review' || v?.status === 'approved';
  }).length;

  const filters: Array<{ value: string; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'draft', label: 'Drafts' },
    { value: 'in_review', label: 'In Review' },
    { value: 'approved', label: 'Approved' },
    { value: 'active', label: 'Active' },
    { value: 'deprecated', label: 'Deprecated' },
  ];

  return (
    <div>
      <PageHeader
        title="Approval Workflow"
        description={`${pendingCount} policies pending action. Your current role: ${currentUser}`}
      />

      <div className="card p-4 mb-6 animate-slide-up">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={16} className="text-gray-400 dark:text-slate-500" />
          {filters.map((f) => (
            <button
              key={f.value}
              className={`btn text-xs px-3 py-1.5 ${filter === f.value ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-5 mb-6 animate-slide-up">
        <h3 className="section-title mb-3">Workflow Pipeline</h3>
        <div className="flex items-center gap-1 flex-wrap text-xs">
          {STATUS_FLOW.map((status, idx) => (
            <div key={status} className="flex items-center gap-1">
              <span className={`badge ${
                status === 'active' ? 'badge-active' :
                status === 'draft' ? 'badge-draft' :
                status === 'in_review' ? 'badge-in_review' :
                status === 'approved' ? 'badge-approved' :
                status === 'deprecated' ? 'badge-deprecated' :
                'badge-archived'
              }`}>
                {status.replace('_', ' ')}
              </span>
              {idx < STATUS_FLOW.length - 1 && <ArrowRight size={12} className="text-gray-300 dark:text-slate-600" />}
            </div>
          ))}
        </div>
      </div>

      {filteredPolicies.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon={<CheckCircle2 size={32} />}
            title="No policies in this state"
            description="No policies match the selected filter."
            action={<button className="btn-primary" onClick={() => navigate('compiler')}>Create Policy</button>}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPolicies.map((policy) => {
            const version = getCurrentVersion(policy);
            if (!version) return null;

            const availableTransitions = STATUS_TRANSITIONS.filter(
              (t) => t.from === version.status && t.roles.includes(currentUser),
            );

            return (
              <div key={policy.id} className="card p-5 animate-slide-up">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-base text-gray-900 dark:text-white">{policy.name}</h3>
                      <StatusBadge status={version.status} />
                    </div>
                    <p className="text-sm text-gray-500 dark:text-slate-400">{policy.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 dark:text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> v{version.version} · {new Date(version.createdAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <User size={12} /> {version.createdBy}
                      </span>
                      <span>{version.rules.length} rules</span>
                    </div>
                  </div>
                </div>

                {version.changeNote && (
                  <div className="rounded-lg bg-gray-50 dark:bg-slate-800/50 p-3 mb-3">
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      <MessageSquare size={12} className="inline mr-1" />
                      {version.changeNote}
                    </p>
                  </div>
                )}

                {availableTransitions.length > 0 && (
                  <div className="border-t border-gray-100 dark:border-slate-800 pt-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-400 dark:text-slate-500">Actions:</span>
                      {availableTransitions.map((t) => (
                        <button
                          key={`${t.from}-${t.to}`}
                          className={`btn text-xs px-3 py-1.5 ${
                            t.to === 'active' ? 'btn-success' :
                            t.to === 'approved' ? 'btn-primary' :
                            t.to === 'deprecated' || t.to === 'archived' ? 'btn-danger' :
                            'btn-secondary'
                          }`}
                          onClick={() => handleTransition(policy, t.to, t.label)}
                        >
                          {t.label}
                        </button>
                      ))}
                      <input
                        className="input flex-1 min-w-[200px] text-xs"
                        placeholder="Add a note (optional)..."
                        value={transitionNote[version.id] || ''}
                        onChange={(e) => setTransitionNote((prev) => ({ ...prev, [version.id]: e.target.value }))}
                      />
                    </div>
                  </div>
                )}

                {availableTransitions.length === 0 && version.status !== 'archived' && (
                  <div className="border-t border-gray-100 dark:border-slate-800 pt-3">
                    <p className="text-xs text-gray-400 dark:text-slate-500">
                      No actions available for your role ({currentUser}) at this stage.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
