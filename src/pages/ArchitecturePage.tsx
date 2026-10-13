import {
  Building2 as ArchIcon,
  Shield,
  Lock,
  Zap,
  RotateCcw,
  Users,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  Network,
  FileText,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/Badges';
import { usePolicyContext } from '@/context/PolicyContext';
import { getCurrentVersion } from '@/lib/policyUtils';
import { evaluateRules } from '@/engine/engine';
import { useMemo } from 'react';
import type { Condition, ConditionGroup, ConditionLeaf } from '@/types/policy';

export function ArchitecturePage() {
  const { policies } = usePolicyContext();

  const benchmark = useMemo(() => {
    if (policies.length === 0) return null;
    const policy = policies[0];
    const version = getCurrentVersion(policy);
    if (!version) return null;
    const sampleInputs: Record<string, string | number | boolean> = {};
    for (const rule of version.rules) {
      if (!rule.condition) continue;
      try {
        const cond = rule.condition as Condition;
        if ('field' in cond) {
          const leaf = cond as ConditionLeaf;
          sampleInputs[leaf.field] = leaf.value;
        } else if ('conditions' in cond) {
          const group = cond as ConditionGroup;
          for (const c of group.conditions) {
            if ('field' in c) sampleInputs[(c as ConditionLeaf).field] = (c as ConditionLeaf).value;
          }
        }
      } catch { /* ignore */ }
    }
    const times: number[] = [];
    for (let i = 0; i < 1000; i++) {
      const result = evaluateRules(version.rules, sampleInputs, version.version);
      times.push(result.evaluationTimeMs);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const max = Math.max(...times);
    const min = Math.min(...times);
    const sorted = [...times].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    return { avg, max, min, p95, count: times.length, ruleCount: version.rules.length };
  }, [policies]);

  return (
    <div>
      <PageHeader
        title="System Architecture"
        description="Policy architecture, threat model, authorization model, and performance benchmarks"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard icon={<ArchIcon size={18} />} title="Policy Architecture" accent="blue">
          <div className="space-y-3 text-sm text-gray-600 dark:text-slate-300">
            <p><strong className="text-gray-900 dark:text-white">Pipeline:</strong> Natural Language → Structured Rule (IR) → Test Cases → Execution → Evidence</p>
            <p><strong className="text-gray-900 dark:text-white">Rule Engine:</strong> Deterministic TypeScript evaluator. No LLM dependency for execution. Rules are compiled into an intermediate representation (IR) — a normalized JSON structure with typed conditions, comparison operators, and logical grouping (AND/OR).</p>
            <p><strong className="text-gray-900 dark:text-white">Evaluation:</strong> Rules are sorted by priority (descending). Each rule's condition tree is evaluated recursively. The first matching rule's action determines the decision. Multiple matches with conflicting actions produce a CONFLICT decision.</p>
            <p><strong className="text-gray-900 dark:text-white">Evidence:</strong> Every decision includes the matched rule, all condition evaluations (pass/fail with actual vs expected values), input snapshot, policy version, and human-readable reasoning.</p>
          </div>
        </SectionCard>

        <SectionCard icon={<Lock size={18} />} title="Threat Model" accent="red">
          <div className="space-y-2 text-sm text-gray-600 dark:text-slate-300">
            <ThreatItem severity="high" title="Privilege Escalation" desc="Attacker modifies rule priority or action to gain unauthorized ALLOW. Mitigation: approval workflow requires multi-role sign-off before activation." />
            <ThreatItem severity="high" title="Rule Injection" desc="Malicious condition bypasses intended logic. Mitigation: conditions use typed operators only — no eval, no string interpolation." />
            <ThreatItem severity="medium" title="Version Rollback Attack" desc="Attacker restores a deprecated version with weaker rules. Mitigation: version restoration creates a new version — original is preserved, all transitions audited." />
            <ThreatItem severity="medium" title="Conflict Exploitation" desc="Attacker crafts inputs that trigger conflicting rules to get desired outcome. Mitigation: conflict detector identifies these scenarios before activation." />
            <ThreatItem severity="low" title="Data Tampering" desc="Local storage manipulation. Mitigation: audit log provides forensic trail; production deployments use Supabase with RLS." />
          </div>
        </SectionCard>

        <SectionCard icon={<Users size={18} />} title="Authorization Model" accent="emerald">
          <div className="space-y-2 text-sm text-gray-600 dark:text-slate-300">
            <p><strong className="text-gray-900 dark:text-white">Role-Based Access Control (RBAC):</strong></p>
            <RoleMatrix />
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">Roles are enforced in the approval workflow. Each status transition requires a specific role. The audit log records which role performed each action.</p>
          </div>
        </SectionCard>

        <SectionCard icon={<Gauge size={18} />} title="Performance Benchmarking" accent="amber">
          {benchmark ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="Rules in Policy" value={String(benchmark.ruleCount)} />
                <MetricCard label="Iterations" value={String(benchmark.count)} />
                <MetricCard label="Avg Time" value={`${benchmark.avg.toFixed(4)}ms`} />
                <MetricCard label="Min Time" value={`${benchmark.min.toFixed(4)}ms`} />
                <MetricCard label="Max Time" value={`${benchmark.max.toFixed(4)}ms`} />
                <MetricCard label="P95 Time" value={`${benchmark.p95.toFixed(4)}ms`} />
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-slate-800/50 p-3">
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Engine evaluates {benchmark.ruleCount} rules in {benchmark.avg.toFixed(4)}ms on average.
                  Linear with rule count. No external calls during evaluation — fully deterministic and synchronous.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 dark:text-slate-500">No policies available for benchmarking.</p>
          )}
        </SectionCard>

        <SectionCard icon={<Zap size={18} />} title="Policy Caching & Failure Behavior" accent="blue">
          <div className="space-y-3 text-sm text-gray-600 dark:text-slate-300">
            <div>
              <p className="font-medium text-gray-900 dark:text-white mb-1">Caching Strategy</p>
              <p>Compiled rules are cached in memory per session. The intermediate representation is computed once at policy load and reused across evaluations. Version changes invalidate the cache for that policy only.</p>
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white mb-1">Failure Behavior</p>
              <p>If no rule matches the input scenario, the engine returns AMBIGUOUS — never a default ALLOW. This fail-closed design prevents unintended access when rules are incomplete.</p>
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white mb-1">Error Handling</p>
              <p>Missing input fields evaluate to false (condition not met). Type mismatches produce false results. The engine never throws during evaluation — all errors are captured as evidence.</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={<RotateCcw size={18} />} title="Policy Rollback" accent="purple">
          <div className="space-y-2 text-sm text-gray-600 dark:text-slate-300">
            <p><strong className="text-gray-900 dark:text-white">Rollback Procedure:</strong></p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Navigate to Versions & Diff Viewer</li>
              <li>Select the policy to roll back</li>
              <li>Choose the target version from history</li>
              <li>Click "Restore" — this creates a new version with the old rules</li>
              <li>The restored version enters draft status</li>
              <li>Submit through the approval workflow to activate</li>
            </ol>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">Rollback never deletes versions — it creates a new one. Full audit trail preserved. Original version remains accessible.</p>
          </div>
        </SectionCard>

        <SectionCard icon={<Network size={18} />} title="Tenant Isolation" accent="slate">
          <div className="space-y-2 text-sm text-gray-600 dark:text-slate-300">
            <p><strong className="text-gray-900 dark:text-white">Multi-Tenant Architecture:</strong></p>
            <p>Each tenant's policies are scoped by a tenant ID prefix (pol_{'{tenantId}'}_...). The policy context loads only the current tenant's policies. In production with Supabase, RLS policies enforce tenant isolation at the database level — queries automatically filter by the authenticated user's tenant.</p>
            <p><strong className="text-gray-900 dark:text-white">Data Isolation:</strong></p>
            <p>Audit logs, test results, and approval histories are all tenant-scoped. No cross-tenant data access is possible through the application layer.</p>
          </div>
        </SectionCard>

        <SectionCard icon={<Shield size={18} />} title="Security Review Checklist" accent="red">
          <div className="space-y-1.5 text-sm">
            <CheckItem label="RLS enabled on all tables" />
            <CheckItem label="No eval() or Function() in rule engine" />
            <CheckItem label="Conditions use typed operators only" />
            <CheckItem label="Audit log is append-only" />
            <CheckItem label="Approval workflow enforces role checks" />
            <CheckItem label="Version restoration creates new version (no mutation)" />
            <CheckItem label="Engine fails closed (AMBIGUOUS, not ALLOW)" />
            <CheckItem label="No user input reaches eval or dynamic imports" />
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 card p-5 animate-slide-up">
        <div className="flex items-center gap-2 mb-4">
          <FileText size={18} className="text-gray-400 dark:text-slate-500" />
          <h3 className="section-title">REST API (Edge Function)</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-slate-300 mb-3">
          The policy engine is exposed as a REST API via a Supabase Edge Function. External systems can POST a policy ID and input scenario to receive a decision with full evidence.
        </p>
        <div className="rounded-lg bg-gray-900 dark:bg-slate-950 p-4 overflow-x-auto">
          <pre className="mono text-green-400 text-xs leading-relaxed">{`POST /functions/v1/policy-engine
Content-Type: application/json

{
  "policyId": "pol_purchase_approval",
  "inputs": {
    "amount": 75000,
    "approverId": "user_123",
    "requesterId": "user_123"
  }
}

Response:
{
  "decision": "DENY",
  "evidence": {
    "matchedRule": "Self-approval prevention",
    "conditions": [{ "field": "amount", "passed": true }, ...],
    "policyVersion": 1,
    "reasoning": ["Rule 'Self-approval prevention' matched..."]
  },
  "evaluationTimeMs": 0.042
}`}</pre>
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  accent,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  const accents: Record<string, string> = {
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40',
    red: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40',
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40',
    purple: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40',
    slate: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800',
  };
  return (
    <div className="card p-5 animate-slide-up">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accents[accent]}`}>
          {icon}
        </div>
        <h3 className="section-title">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ThreatItem({ severity, title, desc }: { severity: string; title: string; desc: string }) {
  const colors: Record<string, string> = {
    high: 'text-red-500',
    medium: 'text-amber-500',
    low: 'text-emerald-500',
  };
  return (
    <div className="flex items-start gap-2">
      <AlertTriangle size={14} className={`${colors[severity]} mt-0.5 shrink-0`} />
      <div>
        <p className="font-medium text-gray-900 dark:text-white text-xs">{title} <span className={`uppercase text-[10px] ${colors[severity]}`}>{severity}</span></p>
        <p className="text-xs text-gray-500 dark:text-slate-400">{desc}</p>
      </div>
    </div>
  );
}

function RoleMatrix() {
  const roles = ['Admin', 'Policy Author', 'Reviewer', 'Approver', 'Auditor'];
  const permissions = [
    { action: 'Create/Edit Policies', roles: ['Admin', 'Policy Author'] },
    { action: 'Submit for Review', roles: ['Admin', 'Policy Author'] },
    { action: 'Approve/Reject', roles: ['Admin', 'Reviewer', 'Approver'] },
    { action: 'Activate Policy', roles: ['Admin', 'Approver'] },
    { action: 'Deprecate/Archive', roles: ['Admin'] },
    { action: 'View Audit Log', roles: ['Admin', 'Auditor'] },
    { action: 'Run Simulator', roles: ['Admin', 'Policy Author', 'Reviewer', 'Approver', 'Auditor'] },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 dark:border-slate-700">
            <th className="text-left py-2 pr-3 text-gray-400 dark:text-slate-500 font-medium">Action</th>
            {roles.map((r) => (
              <th key={r} className="text-center py-2 px-1 text-gray-400 dark:text-slate-500 font-medium">{r.split(' ').map(w => w[0]).join('')}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {permissions.map((perm) => (
            <tr key={perm.action} className="border-b border-gray-100 dark:border-slate-800">
              <td className="py-1.5 pr-3 text-gray-700 dark:text-slate-300">{perm.action}</td>
              {roles.map((r) => (
                <td key={r} className="text-center py-1.5">
                  {perm.roles.includes(r) ? (
                    <CheckCircle2 size={12} className="text-emerald-500 mx-auto" />
                  ) : (
                    <span className="text-gray-300 dark:text-slate-700">—</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 dark:bg-slate-800/50 p-3">
      <p className="text-xs text-gray-400 dark:text-slate-500">{label}</p>
      <p className="text-lg font-bold text-gray-900 dark:text-white mono">{value}</p>
    </div>
  );
}

function CheckItem({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
      <span className="text-gray-700 dark:text-slate-300 text-xs">{label}</span>
    </div>
  );
}
