import { useState, useMemo, useCallback } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  ArrowRight,
  ArrowLeftRight,
} from 'lucide-react';
import { useNav } from '@/context/NavContext';
import { usePolicyContext } from '@/context/PolicyContext';
import { PageHeader, DecisionBadge, SeverityBadge, EmptyState } from '@/components/ui/Badges';
import { getCurrentVersion } from '@/lib/policyUtils';
import { detectConflicts } from '@/engine/counterexample';
import { conditionToReadable } from '@/engine/evaluator';
import type { PolicyConflict, PolicyRecord } from '@/types/policy';

export function ConflictDetectorPage() {
  const { params } = useNav();
  const { policies, logAction, currentUser } = usePolicyContext();

  const initialPolicyId = params.policyId || policies[0]?.id || '';
  const [selectedPolicyId, setSelectedPolicyId] = useState(initialPolicyId);
  const [hasScanned, setHasScanned] = useState(false);

  const selectedPolicy = policies.find((p) => p.id === selectedPolicyId);
  const currentVersion = selectedPolicy ? getCurrentVersion(selectedPolicy) : undefined;

  const conflicts = useMemo(() => {
    if (!currentVersion) return [];
    return detectConflicts(currentVersion.rules);
  }, [currentVersion]);

  const handleScan = useCallback(() => {
    setHasScanned(true);
    logAction({
      actor: currentUser,
      action: `Scanned for conflicts in "${selectedPolicy?.name}"`,
      policyId: selectedPolicy?.id,
      policyName: selectedPolicy?.name,
      details: `Found ${conflicts.length} conflict(s)`,
      category: 'conflict',
    });
  }, [conflicts, selectedPolicy, logAction, currentUser]);

  const highSeverity = conflicts.filter((c) => c.severity === 'high');
  const mediumSeverity = conflicts.filter((c) => c.severity === 'medium');

  return (
    <div>
      <PageHeader
        title="Policy Conflict Detector"
        description="Identify scenarios where two or more rules produce contradictory ALLOW and DENY decisions"
        actions={
          <button className="btn-primary" onClick={handleScan} disabled={!currentVersion}>
            <RefreshCw size={16} /> Scan for Conflicts
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
            setHasScanned(false);
          }}
        >
          {policies.length === 0 && <option value="">No policies available</option>}
          {policies.map((p) => {
            const v = getCurrentVersion(p);
            return (
              <option key={p.id} value={p.id}>
                {p.name} {v ? `(v${v.version}, ${v.rules.length} rules)` : ''}
              </option>
            );
          })}
        </select>
      </div>

      {hasScanned && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 animate-slide-up">
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 dark:text-slate-500 font-medium">Total Conflicts</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{conflicts.length}</p>
                </div>
                <div className="w-11 h-11 rounded-lg bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center text-orange-600 dark:text-orange-400">
                  <AlertTriangle size={20} />
                </div>
              </div>
            </div>
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 dark:text-slate-500 font-medium">High Severity</p>
                  <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-1">{highSeverity.length}</p>
                </div>
                <div className="w-11 h-11 rounded-lg bg-red-50 dark:bg-red-950/40 flex items-center justify-center text-red-600 dark:text-red-400">
                  <ShieldAlert size={20} />
                </div>
              </div>
            </div>
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 dark:text-slate-500 font-medium">Medium Severity</p>
                  <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-1">{mediumSeverity.length}</p>
                </div>
                <div className="w-11 h-11 rounded-lg bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <AlertTriangle size={20} />
                </div>
              </div>
            </div>
          </div>

          {conflicts.length === 0 ? (
            <div className="card p-8">
              <EmptyState
                icon={<ShieldAlert size={32} />}
                title="No conflicts detected"
                description="All rules in this policy are consistent. No scenarios were found where rules produce contradictory decisions."
              />
            </div>
          ) : (
            <div className="space-y-4">
              {conflicts.map((conflict) => (
                <ConflictCard key={conflict.id} conflict={conflict} policy={selectedPolicy} />
              ))}
            </div>
          )}
        </>
      )}

      {!hasScanned && (
        <div className="card p-8">
          <EmptyState
            icon={<AlertTriangle size={32} />}
            title="Ready to scan"
            description="Select a policy and click 'Scan for Conflicts' to check for contradicting rules."
            action={currentVersion && (
              <button className="btn-primary" onClick={handleScan}>
                <RefreshCw size={16} /> Scan Now
              </button>
            )}
          />
        </div>
      )}
    </div>
  );
}

function ConflictCard({ conflict, policy }: { conflict: PolicyConflict; policy?: PolicyRecord }) {
  return (
    <div className="card p-5 animate-slide-up">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-950/40 flex items-center justify-center text-red-600 dark:text-red-400">
          <ArrowLeftRight size={18} />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm text-gray-900 dark:text-white">
            {conflict.ruleA.name} vs {conflict.ruleB.name}
          </p>
          <p className="text-xs text-gray-400 dark:text-slate-500">{conflict.description}</p>
        </div>
        <SeverityBadge severity={conflict.severity} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="font-medium text-sm text-gray-900 dark:text-white">{conflict.ruleA.name}</p>
            <DecisionBadge decision={conflict.ruleA.action} />
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">{conflict.ruleA.description}</p>
          <div className="text-xs space-y-1">
            <div><span className="text-gray-400 dark:text-slate-500">Actor:</span> <span className="text-gray-700 dark:text-slate-300">{conflict.ruleA.actor}</span></div>
            <div><span className="text-gray-400 dark:text-slate-500">Resource:</span> <span className="text-gray-700 dark:text-slate-300">{conflict.ruleA.resource}</span></div>
            <div><span className="text-gray-400 dark:text-slate-500">Condition:</span> <span className="mono text-gray-700 dark:text-slate-300">{conflict.ruleA.condition ? conditionToReadable(conflict.ruleA.condition) : 'always'}</span></div>
            <div><span className="text-gray-400 dark:text-slate-500">Priority:</span> <span className="text-gray-700 dark:text-slate-300">{conflict.ruleA.priority}</span></div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="font-medium text-sm text-gray-900 dark:text-white">{conflict.ruleB.name}</p>
            <DecisionBadge decision={conflict.ruleB.action} />
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">{conflict.ruleB.description}</p>
          <div className="text-xs space-y-1">
            <div><span className="text-gray-400 dark:text-slate-500">Actor:</span> <span className="text-gray-700 dark:text-slate-300">{conflict.ruleB.actor}</span></div>
            <div><span className="text-gray-400 dark:text-slate-500">Resource:</span> <span className="text-gray-700 dark:text-slate-300">{conflict.ruleB.resource}</span></div>
            <div><span className="text-gray-400 dark:text-slate-500">Condition:</span> <span className="mono text-gray-700 dark:text-slate-300">{conflict.ruleB.condition ? conditionToReadable(conflict.ruleB.condition) : 'always'}</span></div>
            <div><span className="text-gray-400 dark:text-slate-500">Priority:</span> <span className="text-gray-700 dark:text-slate-300">{conflict.ruleB.priority}</span></div>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-gray-50 dark:bg-slate-800/50 p-3">
        <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Triggering Scenario:</p>
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(conflict.scenario).map(([key, value]) => (
            <span key={key} className="mono text-xs bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300">
              {key} = {String(value)}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 text-sm">
        <span className="text-gray-500 dark:text-slate-400">Engine produces:</span>
        <DecisionBadge decision={conflict.decisionA} />
        <ArrowRight size={14} className="text-gray-300 dark:text-slate-600" />
        <DecisionBadge decision={conflict.decisionB} />
        <span className="text-xs text-gray-400 dark:text-slate-500 ml-2">
          {conflict.severity === 'high'
            ? 'Same priority — engine cannot resolve deterministically.'
            : 'Different priorities — higher priority rule wins, but conflict still exists.'}
        </span>
      </div>

      <div className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
        <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">Resolution Suggestion:</p>
        <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
          {conflict.severity === 'high'
            ? `Set different priority values for "${conflict.ruleA.name}" and "${conflict.ruleB.name}" so the engine can resolve conflicts deterministically, or add mutually exclusive conditions.`
            : `The higher priority rule will win, but consider adding explicit conditions to prevent overlap between these rules.`}
        </p>
      </div>
    </div>
  );
}
