import { useState, useMemo, useCallback } from 'react';
import {
  PlayCircle,
  Play,
  RotateCcw,
  Zap,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Clock,
  History,
} from 'lucide-react';
import { useNav } from '@/context/NavContext';
import { usePolicyContext } from '@/context/PolicyContext';
import { PageHeader, DecisionBadge, EmptyState } from '@/components/ui/Badges';
import { getCurrentVersion } from '@/lib/policyUtils';
import { evaluatePolicyVersion } from '@/engine/engine';
import { conditionToReadable, isConditionGroup } from '@/engine/evaluator';
import type { ScenarioInput, EngineEvaluationResult, PolicyRecord, Condition, ConditionGroup, ConditionLeaf } from '@/types/policy';

interface DecisionHistoryEntry {
  id: string;
  timestamp: string;
  policyName: string;
  inputs: ScenarioInput;
  result: EngineEvaluationResult;
}

const DECISION_ICONS: Record<string, typeof CheckCircle2> = {
  ALLOW: CheckCircle2,
  DENY: XCircle,
  AMBIGUOUS: HelpCircle,
  CONFLICT: AlertTriangle,
};

const DECISION_COLORS: Record<string, string> = {
  ALLOW: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30',
  DENY: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30',
  AMBIGUOUS: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30',
  CONFLICT: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30',
};

export function SimulatorPage() {
  const { params } = useNav();
  const { policies, logAction, currentUser } = usePolicyContext();

  const initialPolicyId = params.policyId || policies[0]?.id || '';
  const [selectedPolicyId, setSelectedPolicyId] = useState(initialPolicyId);
  const [inputs, setInputs] = useState<ScenarioInput>({});
  const [result, setResult] = useState<EngineEvaluationResult | null>(null);
  const [history, setHistory] = useState<DecisionHistoryEntry[]>([]);
  const [inputFields, setInputFields] = useState<string[]>([]);

  const selectedPolicy = policies.find((p) => p.id === selectedPolicyId);
  const currentVersion = selectedPolicy ? getCurrentVersion(selectedPolicy) : undefined;

  const availableFields = useMemo(() => {
    if (!currentVersion) return [];
    const fields = new Set<string>();
    for (const rule of currentVersion.rules) {
      if (rule.condition) collectFields(rule.condition, fields);
    }
    return Array.from(fields);
  }, [currentVersion]);

  const handleRun = useCallback(() => {
    if (!currentVersion) return;
    const evalResult = evaluatePolicyVersion(currentVersion, inputs);
    setResult(evalResult);
    const entry: DecisionHistoryEntry = {
      id: Math.random().toString(36).substring(2, 11),
      timestamp: new Date().toISOString(),
      policyName: selectedPolicy?.name || '',
      inputs: { ...inputs },
      result: evalResult,
    };
    setHistory((prev) => [entry, ...prev].slice(0, 20));
    logAction({
      actor: currentUser,
      action: `Simulated decision on "${selectedPolicy?.name}"`,
      policyId: selectedPolicy?.id,
      policyName: selectedPolicy?.name,
      details: `Decision: ${evalResult.decision} | Inputs: ${JSON.stringify(inputs)}`,
      category: 'decision',
    });
  }, [currentVersion, inputs, selectedPolicy, logAction, currentUser]);

  const handleReset = () => {
    setInputs({});
    setResult(null);
    setInputFields([]);
  };

  const addField = () => {
    const fieldName = `field_${inputFields.length + 1}`;
    setInputFields((prev) => [...prev, fieldName]);
    setInputs((prev) => ({ ...prev, [fieldName]: 0 }));
  };

  const addKnownField = (field: string) => {
    if (inputFields.includes(field)) return;
    setInputFields((prev) => [...prev, field]);
    setInputs((prev) => ({ ...prev, [field]: '' }));
  };

  const updateFieldValue = (field: string, value: string) => {
    let parsedValue: string | number | boolean = value;
    if (value === 'true') parsedValue = true;
    else if (value === 'false') parsedValue = false;
    else if (!isNaN(Number(value)) && value.trim() !== '') parsedValue = Number(value);
    setInputs((prev) => ({ ...prev, [field]: parsedValue }));
  };

  const removeField = (field: string) => {
    setInputFields((prev) => prev.filter((f) => f !== field));
    setInputs((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const allFields = Array.from(new Set([...availableFields, ...inputFields]));

  return (
    <div>
      <PageHeader
        title="Policy Simulator"
        description="Run input scenarios through the deterministic engine and see exactly why a decision was made"
        actions={
          <>
            <button className="btn-secondary" onClick={handleReset}>
              <RotateCcw size={16} /> Reset
            </button>
            <button className="btn-primary" onClick={handleRun} disabled={!currentVersion}>
              <Play size={16} /> Run Decision
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="card p-5 animate-slide-up">
            <h3 className="section-title mb-4">Policy Selection</h3>
            <label className="label">Select Policy</label>
            <select
              className="select"
              value={selectedPolicyId}
              onChange={(e) => {
                setSelectedPolicyId(e.target.value);
                setResult(null);
                setInputs({});
                setInputFields([]);
              }}
            >
              {policies.length === 0 && <option value="">No policies available</option>}
              {policies.map((p) => {
                const v = getCurrentVersion(p);
                return (
                  <option key={p.id} value={p.id}>
                    {p.name} {v ? `(v${v.version}, ${v.status})` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="card p-5 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title">Input Scenario</h3>
              <button className="btn-secondary text-xs" onClick={addField}>
                + Custom Field
              </button>
            </div>

            {availableFields.length > 0 && (
              <div className="mb-4">
                <p className="section-subtitle mb-2">Known fields from policy rules:</p>
                <div className="flex flex-wrap gap-2">
                  {availableFields.map((field) => (
                    <button
                      key={field}
                      className={`btn-ghost text-xs px-2.5 py-1 ${inputFields.includes(field) ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={() => addKnownField(field)}
                      disabled={inputFields.includes(field)}
                    >
                      + {field}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {allFields.length === 0 ? (
              <EmptyState
                icon={<PlayCircle size={28} />}
                title="No input fields"
                description="Add custom fields or select a policy with rules to see known fields."
              />
            ) : (
              <div className="space-y-2">
                {allFields.map((field) => (
                  <div key={field} className="flex items-center gap-2">
                    <input
                      className="input flex-1"
                      value={field}
                      readOnly
                      aria-label="Field name"
                    />
                    <input
                      className="input flex-1"
                      value={String(inputs[field] ?? '')}
                      onChange={(e) => updateFieldValue(field, e.target.value)}
                      placeholder="value"
                      aria-label={`Value for ${field}`}
                    />
                    <button
                      className="btn-ghost p-2 text-red-400 hover:text-red-600"
                      onClick={() => removeField(field)}
                    >
                      <XCircle size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {history.length > 0 && (
            <div className="card p-5 animate-slide-up">
              <div className="flex items-center gap-2 mb-4">
                <History size={18} className="text-gray-400 dark:text-slate-500" />
                <h3 className="section-title">Decision History</h3>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {history.map((entry) => {
                  const Icon = DECISION_ICONS[entry.result.decision];
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                      onClick={() => {
                        setInputs({ ...entry.inputs });
                        setResult(entry.result);
                        const fields = Object.keys(entry.inputs);
                        setInputFields(fields);
                      }}
                    >
                      <Icon size={16} className={DECISION_COLORS[entry.result.decision].split(' ')[0]} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {entry.result.decision} — {entry.policyName}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
                          {Object.entries(entry.inputs).map(([k, v]) => `${k}=${v}`).join(', ')}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-slate-600 shrink-0">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {result ? (
            <DecisionBreakdown result={result} policy={selectedPolicy} />
          ) : (
            <div className="card p-8 animate-fade-in">
              <EmptyState
                icon={<Zap size={32} />}
                title="No decision yet"
                description="Set up an input scenario and click 'Run Decision' to see the engine's evaluation with full evidence."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DecisionBreakdown({ result, policy }: { result: EngineEvaluationResult; policy?: PolicyRecord }) {
  const Icon = DECISION_ICONS[result.decision];
  const version = policy ? getCurrentVersion(policy) : undefined;

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${DECISION_COLORS[result.decision]}`}>
              <Icon size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{result.decision}</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">Engine decision</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-700 dark:text-slate-300">{result.evaluationTimeMs.toFixed(3)}ms</p>
            <p className="text-xs text-gray-400 dark:text-slate-500">evaluation time</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-gray-50 dark:bg-slate-800/50 p-3">
            <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Policy Version</p>
            <p className="font-medium text-gray-900 dark:text-white">v{result.evidence.policyVersion}</p>
          </div>
          <div className="rounded-lg bg-gray-50 dark:bg-slate-800/50 p-3">
            <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Timestamp</p>
            <p className="font-medium text-gray-900 dark:text-white text-xs">{new Date(result.evidence.timestamp).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileText size={18} className="text-gray-400 dark:text-slate-500" />
          <h3 className="section-title">Why was this decision made?</h3>
        </div>
        <div className="space-y-2">
          {result.evidence.reasoning.map((reason, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-slate-300">
              <span className="text-blue-500 font-mono text-xs mt-0.5">{i + 1}.</span>
              <span>{reason}</span>
            </div>
          ))}
        </div>
      </div>

      {result.evidence.matchedRule && (
        <div className="card p-5">
          <h3 className="section-title mb-3">Matched Policy</h3>
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-4 border border-blue-200 dark:border-blue-900">
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-sm text-gray-900 dark:text-white">{result.evidence.matchedRule.name}</p>
              <DecisionBadge decision={result.evidence.matchedRule.action} />
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-3">{result.evidence.matchedRule.description}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-gray-400 dark:text-slate-500">Actor:</span> <span className="font-medium text-gray-700 dark:text-slate-300">{result.evidence.matchedRule.actor}</span></div>
              <div><span className="text-gray-400 dark:text-slate-500">Resource:</span> <span className="font-medium text-gray-700 dark:text-slate-300">{result.evidence.matchedRule.resource}</span></div>
              <div><span className="text-gray-400 dark:text-slate-500">Priority:</span> <span className="font-medium text-gray-700 dark:text-slate-300">{result.evidence.matchedRule.priority}</span></div>
              <div><span className="text-gray-400 dark:text-slate-500">Condition:</span> <span className="font-medium text-gray-700 dark:text-slate-300 mono">{result.evidence.matchedRule.condition ? conditionToReadable(result.evidence.matchedRule.condition) : 'always'}</span></div>
            </div>
          </div>
        </div>
      )}

      {result.evidence.matchedRules.length > 1 && (
        <div className="card p-5">
          <h3 className="section-title mb-3">All Matched Rules ({result.evidence.matchedRules.length})</h3>
          <div className="space-y-2">
            {result.evidence.matchedRules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-slate-800/50">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{rule.name}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">Priority {rule.priority} · {rule.actor} → {rule.resource}</p>
                </div>
                <DecisionBadge decision={rule.action} />
              </div>
            ))}
          </div>
        </div>
      )}

      {result.evidence.conditionEvaluations.length > 0 && (
        <div className="card p-5">
          <h3 className="section-title mb-3">Condition Evaluations</h3>
          <div className="space-y-1.5">
            {result.evidence.conditionEvaluations.map((ce, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-slate-800/50">
                {ce.passed ? (
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                ) : (
                  <XCircle size={16} className="text-red-500 shrink-0" />
                )}
                <span className="mono text-xs text-gray-700 dark:text-slate-300 flex-1">
                  {ce.field} {ce.operator} {String(ce.expectedValue)}
                </span>
                <span className="text-xs text-gray-400 dark:text-slate-500">
                  actual: {String(ce.actualValue ?? 'undefined')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-5">
        <h3 className="section-title mb-3">Inputs</h3>
        <div className="rounded-lg bg-gray-900 dark:bg-slate-950 p-3">
          <pre className="mono text-green-400 text-xs">
            {JSON.stringify(result.evidence.inputs, null, 2)}
          </pre>
        </div>
      </div>

      {result.ruleEvaluations.length > 0 && (
        <div className="card p-5">
          <h3 className="section-title mb-3">Rule Evaluation Trace</h3>
          <div className="space-y-1.5">
            {result.ruleEvaluations.map((re) => (
              <div key={re.ruleId} className="flex items-center gap-3 p-2 rounded-lg text-sm">
                {re.matched ? (
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                ) : (
                  <XCircle size={14} className="text-gray-300 dark:text-slate-600 shrink-0" />
                )}
                <span className="text-gray-700 dark:text-slate-300 flex-1 truncate">{re.ruleName}</span>
                <DecisionBadge decision={re.action} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function collectFields(condition: Condition, fields: Set<string>) {
  if (isConditionGroup(condition)) {
    for (const c of (condition as ConditionGroup).conditions) {
      collectFields(c, fields);
    }
  } else {
    fields.add((condition as ConditionLeaf).field);
  }
}
