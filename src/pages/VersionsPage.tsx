import { useState, useMemo } from 'react';
import {
  GitCompareArrows,
  GitBranch,
  RotateCcw,
  Plus,
  Minus,
  Edit3,
  ArrowRight,
} from 'lucide-react';
import { useNav } from '@/context/NavContext';
import { usePolicyContext } from '@/context/PolicyContext';
import { PageHeader, EmptyState, StatusBadge } from '@/components/ui/Badges';
import {
  getCurrentVersion,
  getVersion,
  diffVersions,
  restoreVersion,
} from '@/lib/policyUtils';
import { conditionToReadable } from '@/engine/evaluator';
import type { PolicyVersion, PolicyRecord, PolicyRule } from '@/types/policy';

export function VersionsPage() {
  const { params, navigate } = useNav();
  const { policies, upsertPolicy, logAction, currentUser } = usePolicyContext();

  const initialPolicyId = params.policyId || policies[0]?.id || '';
  const [selectedPolicyId, setSelectedPolicyId] = useState(initialPolicyId);
  const [versionAId, setVersionAId] = useState('');
  const [versionBId, setVersionBId] = useState('');

  const selectedPolicy = policies.find((p) => p.id === selectedPolicyId);

  const sortedVersions = useMemo(() => {
    if (!selectedPolicy) return [];
    return [...selectedPolicy.versions].sort((a, b) => b.version - a.version);
  }, [selectedPolicy]);

  // Auto-select versions for comparison
  const effectiveAId = versionAId || sortedVersions[1]?.id || '';
  const effectiveBId = versionBId || sortedVersions[0]?.id || '';

  const versionA = selectedPolicy ? getVersion(selectedPolicy, effectiveAId) : undefined;
  const versionB = selectedPolicy ? getVersion(selectedPolicy, effectiveBId) : undefined;

  const diff = useMemo(() => {
    if (!versionA || !versionB) return null;
    return diffVersions(versionA, versionB);
  }, [versionA, versionB]);

  const handleRestore = (versionId: string) => {
    if (!selectedPolicy) return;
    const version = getVersion(selectedPolicy, versionId);
    if (!version) return;
    const updated = restoreVersion(selectedPolicy, versionId, currentUser);
    upsertPolicy(updated);
    logAction({
      actor: currentUser,
      action: `Restored policy "${selectedPolicy.name}" from v${version.version}`,
      policyId: selectedPolicy.id,
      policyName: selectedPolicy.name,
      details: `Created new version from v${version.version}`,
      category: 'version',
    });
  };

  return (
    <div>
      <PageHeader
        title="Versions & Diff Viewer"
        description="Browse policy version history, compare versions side-by-side, and restore previous versions"
        actions={
          <button className="btn-primary" onClick={() => navigate('compiler', { policyId: selectedPolicyId })}>
            <Edit3 size={16} /> Edit Current
          </button>
        }
      />

      <div className="card p-5 mb-6 animate-slide-up">
        <label className="label">Select Policy</label>
        <select
          className="select"
          value={selectedPolicyId}
          onChange={(e) => {
            setSelectedPolicyId(e.target.value);
            setVersionAId('');
            setVersionBId('');
          }}
        >
          {policies.length === 0 && <option value="">No policies available</option>}
          {policies.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="card p-5 animate-slide-up">
            <div className="flex items-center gap-2 mb-4">
              <GitBranch size={18} className="text-gray-400 dark:text-slate-500" />
              <h3 className="section-title">Version History</h3>
            </div>
            {sortedVersions.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-slate-500">No versions yet.</p>
            ) : (
              <div className="space-y-2">
                {sortedVersions.map((version, idx) => {
                  const isCurrent = selectedPolicy?.currentVersionId === version.id;
                  return (
                    <div
                      key={version.id}
                      className={`rounded-lg border p-3 transition-all cursor-pointer ${
                        isCurrent
                          ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/20'
                          : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                      }`}
                      onClick={() => setVersionBId(version.id)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm text-gray-900 dark:text-white">
                          v{version.version}
                          {isCurrent && <span className="text-blue-500 ml-1">(current)</span>}
                        </span>
                        <StatusBadge status={version.status} />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{version.changeNote}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-gray-400 dark:text-slate-500">
                          {new Date(version.createdAt).toLocaleDateString()} · {version.createdBy}
                        </span>
                        {!isCurrent && (
                          <button
                            className="btn-ghost text-xs px-2 py-1"
                            onClick={(e) => { e.stopPropagation(); handleRestore(version.id); }}
                            title="Restore this version"
                          >
                            <RotateCcw size={12} /> Restore
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5 animate-slide-up">
            <h3 className="section-title mb-4">Compare Versions</h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="label">Version A (older)</label>
                <select className="select" value={effectiveAId} onChange={(e) => setVersionAId(e.target.value)}>
                  {sortedVersions.map((v) => <option key={v.id} value={v.id}>v{v.version}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Version B (newer)</label>
                <select className="select" value={effectiveBId} onChange={(e) => setVersionBId(e.target.value)}>
                  {sortedVersions.map((v) => <option key={v.id} value={v.id}>v{v.version}</option>)}
                </select>
              </div>
            </div>

            {diff && versionA && versionB ? (
              <DiffView diff={diff} versionA={versionA} versionB={versionB} />
            ) : (
              <EmptyState
                icon={<GitCompareArrows size={28} />}
                title="Select versions to compare"
                description="Choose two versions to see what changed between them."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DiffView({
  diff,
  versionA,
  versionB,
}: {
  diff: ReturnType<typeof diffVersions>;
  versionA: PolicyVersion;
  versionB: PolicyVersion;
}) {
  const hasChanges = diff.added.length > 0 || diff.removed.length > 0 || diff.modified.length > 0;

  return (
    <div className="animate-slide-up">
      {!hasChanges ? (
        <div className="text-center py-8 text-sm text-gray-400 dark:text-slate-500">
          <GitCompareArrows size={32} className="mx-auto mb-2 opacity-50" />
          No differences between v{versionA.version} and v{versionB.version}.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-4 text-sm mb-4">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <Plus size={14} /> {diff.added.length} added
            </span>
            <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
              <Minus size={14} /> {diff.removed.length} removed
            </span>
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <Edit3 size={14} /> {diff.modified.length} modified
            </span>
          </div>

          {diff.added.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">Added Rules</p>
              {diff.added.map((rule) => (
                <RuleDiffCard key={rule.id} rule={rule} type="added" />
              ))}
            </div>
          )}

          {diff.removed.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">Removed Rules</p>
              {diff.removed.map((rule) => (
                <RuleDiffCard key={rule.id} rule={rule} type="removed" />
              ))}
            </div>
          )}

          {diff.modified.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">Modified Rules</p>
              {diff.modified.map((mod) => (
                <div key={mod.oldRule.id} className="rounded-lg border border-amber-200 dark:border-amber-900 p-4 mb-2 diff-modified">
                  <div className="flex items-center gap-2 mb-3">
                    <Edit3 size={14} className="text-amber-500" />
                    <p className="font-medium text-sm text-gray-900 dark:text-white">{mod.newRule.name}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Before (v{versionA.version}):</p>
                      <RuleDetails rule={mod.oldRule} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">After (v{versionB.version}):</p>
                      <RuleDetails rule={mod.newRule} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RuleDiffCard({ rule, type }: { rule: PolicyRule; type: 'added' | 'removed' }) {
  const className = type === 'added' ? 'diff-added' : 'diff-removed';
  const Icon = type === 'added' ? Plus : Minus;
  return (
    <div className={`rounded-lg p-3 mb-2 ${className}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className={type === 'added' ? 'text-emerald-500' : 'text-red-500'} />
        <p className="font-medium text-sm text-gray-900 dark:text-white">{rule.name}</p>
        <span className={`badge ${rule.action === 'ALLOW' ? 'badge-allow' : 'badge-deny'}`}>{rule.action}</span>
      </div>
      <RuleDetails rule={rule} />
    </div>
  );
}

function RuleDetails({ rule }: { rule: PolicyRule }) {
  return (
    <div className="text-xs space-y-0.5 text-gray-600 dark:text-slate-400">
      <div>Actor: <span className="text-gray-900 dark:text-slate-200">{rule.actor}</span></div>
      <div>Resource: <span className="text-gray-900 dark:text-slate-200">{rule.resource}</span></div>
      <div>Condition: <span className="mono text-gray-900 dark:text-slate-200">{rule.condition ? conditionToReadable(rule.condition) : 'always'}</span></div>
      <div>Priority: <span className="text-gray-900 dark:text-slate-200">{rule.priority}</span></div>
    </div>
  );
}
