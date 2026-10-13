import { useState, useMemo, useCallback } from 'react';
import {
  TestTube2,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  Plus,
  Trash2,
  Zap,
  Filter,
} from 'lucide-react';
import { useNav } from '@/context/NavContext';
import { usePolicyContext } from '@/context/PolicyContext';
import { PageHeader, DecisionBadge, EmptyState } from '@/components/ui/Badges';
import { getCurrentVersion } from '@/lib/policyUtils';
import { generateCounterexamples } from '@/engine/counterexample';
import { evaluateRules } from '@/engine/engine';
import type { TestCase, ScenarioInput, Decision } from '@/types/policy';

const CATEGORY_ICONS: Record<string, typeof CheckCircle2> = {
  allowed: CheckCircle2,
  denied: XCircle,
  ambiguous: HelpCircle,
  conflicting: AlertTriangle,
  edge: Zap,
};

const CATEGORY_COLORS: Record<string, string> = {
  allowed: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30',
  denied: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30',
  ambiguous: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30',
  conflicting: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30',
  edge: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30',
};

export function TestSuitePage() {
  const { params } = useNav();
  const { policies, logAction, currentUser } = usePolicyContext();

  const initialPolicyId = params.policyId || policies[0]?.id || '';
  const [selectedPolicyId, setSelectedPolicyId] = useState(initialPolicyId);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [showAddManual, setShowAddManual] = useState(false);
  const [manualInputs, setManualInputs] = useState<ScenarioInput>({});
  const [manualFields, setManualFields] = useState<string[]>([]);

  const selectedPolicy = policies.find((p) => p.id === selectedPolicyId);
  const currentVersion = selectedPolicy ? getCurrentVersion(selectedPolicy) : undefined;

  const handleGenerate = useCallback(() => {
    if (!currentVersion) return;
    const cases = generateCounterexamples(currentVersion.rules);
    setTestCases(cases);
    setHasGenerated(true);
    logAction({
      actor: currentUser,
      action: `Generated ${cases.length} counterexample test cases for "${selectedPolicy?.name}"`,
      policyId: selectedPolicy?.id,
      policyName: selectedPolicy?.name,
      details: `Categories: ${cases.map((c) => c.category).join(', ')}`,
      category: 'test',
    });
  }, [currentVersion, selectedPolicy, logAction, currentUser]);

  const handleRunAll = useCallback(() => {
    if (!currentVersion) return;
    const updated = testCases.map((tc) => {
      const result = evaluateRules(currentVersion.rules, tc.inputs, currentVersion.version);
      const passed = tc.expectedDecision === result.decision;
      return {
        ...tc,
        actualDecision: result.decision,
        passed,
      };
    });
    setTestCases(updated);
    const passCount = updated.filter((t) => t.passed).length;
    logAction({
      actor: currentUser,
      action: `Ran test suite for "${selectedPolicy?.name}"`,
      policyId: selectedPolicy?.id,
      policyName: selectedPolicy?.name,
      details: `${passCount}/${updated.length} passed`,
      category: 'test',
    });
  }, [currentVersion, testCases, selectedPolicy, logAction, currentUser]);

  const handleReset = () => {
    setTestCases([]);
    setHasGenerated(false);
  };

  const addManualField = () => {
    const name = `field_${manualFields.length + 1}`;
    setManualFields((prev) => [...prev, name]);
    setManualInputs((prev) => ({ ...prev, [name]: 0 }));
  };

  const updateManualField = (field: string, value: string) => {
    let parsed: string | number | boolean = value;
    if (value === 'true') parsed = true;
    else if (value === 'false') parsed = false;
    else if (!isNaN(Number(value)) && value.trim() !== '') parsed = Number(value);
    setManualInputs((prev) => ({ ...prev, [field]: parsed }));
  };

  const addManualTestCase = () => {
    if (Object.keys(manualInputs).length === 0) return;
    const newCase: TestCase = {
      id: Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
      name: `Manual test case ${testCases.length + 1}`,
      category: 'edge',
      inputs: { ...manualInputs },
      expectedDecision: 'AMBIGUOUS' as Decision,
      description: 'Manually created test case',
    };
    setTestCases((prev) => [...prev, newCase]);
    setShowAddManual(false);
    setManualInputs({});
    setManualFields([]);
  };

  const deleteTestCase = (id: string) => {
    setTestCases((prev) => prev.filter((tc) => tc.id !== id));
  };

  const filteredCases = filter === 'all' ? testCases : testCases.filter((tc) => tc.category === filter);

  const summary = useMemo(() => {
    if (testCases.length === 0) return null;
    const passed = testCases.filter((tc) => tc.passed === true).length;
    const failed = testCases.filter((tc) => tc.passed === false).length;
    const pending = testCases.filter((tc) => tc.passed === undefined).length;
    const byCategory: Record<string, number> = {};
    for (const tc of testCases) {
      byCategory[tc.category] = (byCategory[tc.category] || 0) + 1;
    }
    return { total: testCases.length, passed, failed, pending, byCategory };
  }, [testCases]);

  const categories = ['all', 'allowed', 'denied', 'ambiguous', 'conflicting', 'edge'];

  return (
    <div>
      <PageHeader
        title="Test Suite & Counterexample Generator"
        description="Automatically generate test cases that exercise allowed, denied, ambiguous, conflicting, and edge scenarios"
        actions={
          <>
            <button className="btn-secondary" onClick={handleReset} disabled={!hasGenerated}>
              <RotateCcw size={16} /> Reset
            </button>
            <button className="btn-primary" onClick={handleGenerate} disabled={!currentVersion}>
              <Zap size={16} /> Generate Cases
            </button>
            {hasGenerated && (
              <button className="btn-success" onClick={handleRunAll}>
                <Play size={16} /> Run All Tests
              </button>
            )}
          </>
        }
      />

      <div className="card p-5 mb-6 animate-slide-up">
        <label className="label">Select Policy</label>
        <select
          className="select"
          value={selectedPolicyId}
          onChange={(e) => {
            setSelectedPolicyId(e.target.value);
            setTestCases([]);
            setHasGenerated(false);
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

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6 animate-slide-up">
          <div className="card p-4">
            <p className="text-xs text-gray-400 dark:text-slate-500">Total</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.total}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-emerald-500">Passed</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{summary.passed}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-red-500">Failed</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.failed}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-400 dark:text-slate-500">Pending</p>
            <p className="text-2xl font-bold text-gray-500 dark:text-slate-400">{summary.pending}</p>
          </div>
          <div className="card p-4 col-span-2">
            <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Categories</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(summary.byCategory).map(([cat, count]) => (
                <span key={cat} className={`badge ${CATEGORY_COLORS[cat] || ''}`}>
                  {cat}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {hasGenerated && (
        <div className="mb-4 flex items-center gap-2 flex-wrap">
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
          <button className="btn-secondary text-xs px-3 py-1.5 ml-auto" onClick={() => setShowAddManual(true)}>
            <Plus size={14} /> Add Manual Case
          </button>
        </div>
      )}

      {showAddManual && (
        <div className="card p-5 mb-6 animate-slide-up">
          <h3 className="section-title mb-4">Add Manual Test Case</h3>
          <div className="space-y-2 mb-3">
            {manualFields.map((field) => (
              <div key={field} className="flex items-center gap-2">
                <input
                  className="input flex-1"
                  value={field}
                  readOnly
                />
                <input
                  className="input flex-1"
                  value={String(manualInputs[field] ?? '')}
                  onChange={(e) => updateManualField(field, e.target.value)}
                  placeholder="value"
                />
                <button
                  className="btn-ghost p-2 text-red-400"
                  onClick={() => {
                    setManualFields((prev) => prev.filter((f) => f !== field));
                    setManualInputs((prev) => {
                      const next = { ...prev };
                      delete next[field];
                      return next;
                    });
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={addManualField}>
              <Plus size={14} /> Add Field
            </button>
            <button className="btn-primary" onClick={addManualTestCase}>
              Add Test Case
            </button>
            <button className="btn-ghost" onClick={() => setShowAddManual(false)}>Cancel</button>
          </div>
        </div>
      )}

      {!hasGenerated ? (
        <div className="card p-8">
          <EmptyState
            icon={<TestTube2 size={32} />}
            title="No test cases generated yet"
            description="Select a policy and click 'Generate Cases' to automatically create counterexamples across all categories."
            action={currentVersion && (
              <button className="btn-primary" onClick={handleGenerate}>
                <Zap size={16} /> Generate Counterexamples
              </button>
            )}
          />
        </div>
      ) : filteredCases.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-400 dark:text-slate-500">
          No test cases in the "{filter}" category.
        </div>
      ) : (
        <div className="card overflow-hidden animate-slide-up">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Test Case</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider hidden lg:table-cell">Inputs</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Expected</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Actual</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Result</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {filteredCases.map((tc) => {
                const Icon = CATEGORY_ICONS[tc.category] || HelpCircle;
                return (
                  <tr key={tc.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{tc.name}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 truncate max-w-xs">{tc.description}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`badge ${CATEGORY_COLORS[tc.category] || ''}`}>
                        <Icon size={10} /> {tc.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="mono text-xs text-gray-500 dark:text-slate-400">
                        {Object.entries(tc.inputs).map(([k, v]) => `${k}=${v}`).join(', ') || '{}'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <DecisionBadge decision={tc.expectedDecision} />
                    </td>
                    <td className="px-4 py-3">
                      {tc.actualDecision ? <DecisionBadge decision={tc.actualDecision} /> : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {tc.passed === undefined ? (
                        <span className="text-xs text-gray-400 dark:text-slate-500">pending</span>
                      ) : tc.passed ? (
                        <CheckCircle2 size={16} className="text-emerald-500" />
                      ) : (
                        <XCircle size={16} className="text-red-500" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="text-gray-300 hover:text-red-500 transition-colors"
                        onClick={() => deleteTestCase(tc.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
