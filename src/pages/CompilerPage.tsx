import { useState, useMemo, useCallback } from 'react';
import {
  FileCode2,
  Plus,
  Trash2,
  Save,
  Eye,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Layers,
  AlertCircle,
  CheckCircle2,
  Copy,
} from 'lucide-react';
import { useNav } from '@/context/NavContext';
import { usePolicyContext } from '@/context/PolicyContext';
import { PageHeader, DecisionBadge, EmptyState } from '@/components/ui/Badges';
import { policyCategories, policyTemplates } from '@/engine/templates';
import { parseNaturalLanguage, parsedPolicyToRule } from '@/engine/nlParser';
import { conditionToReadable, isConditionGroup } from '@/engine/evaluator';
import { evaluateRules } from '@/engine/engine';
import { getCurrentVersion, createNewVersion, generateId as genPolicyId } from '@/lib/policyUtils';
import type {
  PolicyRule,
  ConditionLeaf,
  ConditionGroup,
  Condition,
  ComparisonOperator,
  LogicalOperator,
  FieldType,
  ActionType,
  PolicyRecord,
} from '@/types/policy';

function generateId(): string {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

const OPERATORS: ComparisonOperator[] = ['>', '<', '>=', '<=', '==', '!='];
const FIELD_TYPES: FieldType[] = ['number', 'string', 'boolean'];
const ACTIONS: ActionType[] = ['ALLOW', 'DENY'];

export function CompilerPage() {
  const { params, navigate } = useNav();
  const { policies, upsertPolicy, logAction, currentUser } = usePolicyContext();
  const editingPolicy = params.policyId ? policies.find((p) => p.id === params.policyId) : undefined;

  const [policyName, setPolicyName] = useState(editingPolicy?.name || '');
  const [policyDescription, setPolicyDescription] = useState(editingPolicy?.description || '');
  const [policyCategory, setPolicyCategory] = useState(editingPolicy?.category || policyCategories[0]);
  const [rules, setRules] = useState<PolicyRule[]>(() => {
    if (editingPolicy) {
      const v = getCurrentVersion(editingPolicy);
      return v ? JSON.parse(JSON.stringify(v.rules)) : [];
    }
    return [];
  });
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(true);
  const [nlInput, setNlInput] = useState('');
  const [nlResult, setNlResult] = useState<ReturnType<typeof parseNaturalLanguage> | null>(null);
  const [changeNote, setChangeNote] = useState('');
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const toggleExpanded = (id: string) => {
    setExpandedRules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addRule = () => {
    const newRule: PolicyRule = {
      id: generateId(),
      name: `Rule ${rules.length + 1}`,
      description: '',
      actor: 'Employee',
      resource: 'Purchase',
      condition: {
        id: generateId(),
        field: 'amount',
        operator: '>',
        value: 0,
        valueType: 'number',
      } as ConditionLeaf,
      action: 'DENY',
      priority: 50,
      enabled: true,
    };
    setRules([...rules, newRule]);
    setExpandedRules((prev) => new Set([...prev, newRule.id]));
  };

  const updateRule = (id: string, updates: Partial<PolicyRule>) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const deleteRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const duplicateRule = (rule: PolicyRule) => {
    const copy = JSON.parse(JSON.stringify(rule)) as PolicyRule;
    copy.id = generateId();
    copy.name = `${rule.name} (copy)`;
    if (copy.condition) {
      copy.condition = JSON.parse(JSON.stringify(copy.condition));
    }
    setRules([...rules, copy]);
  };

  const handleParseNL = () => {
    if (!nlInput.trim()) return;
    const result = parseNaturalLanguage(nlInput);
    setNlResult(result);
  };

  const applyParsedRule = () => {
    if (!nlResult) return;
    const rule = parsedPolicyToRule(nlResult);
    setRules([...rules, rule]);
    setExpandedRules((prev) => new Set([...prev, rule.id]));
    setNlInput('');
    setNlResult(null);
  };

  const handleSave = () => {
    if (!policyName.trim()) {
      setSaveMessage({ type: 'error', text: 'Policy name is required.' });
      return;
    }
    if (rules.length === 0) {
      setSaveMessage({ type: 'error', text: 'At least one rule is required.' });
      return;
    }

    const note = changeNote.trim() || (editingPolicy ? 'Updated rules' : 'Initial version');
    let policy: PolicyRecord;

    if (editingPolicy) {
      policy = createNewVersion(editingPolicy, rules, note, currentUser);
      policy.name = policyName;
      policy.description = policyDescription;
      policy.category = policyCategory;
    } else {
      const now = new Date().toISOString();
      const versionId = generateId();
      const policyId = genPolicyId();
      policy = {
        id: `pol_${policyId}`,
        name: policyName,
        description: policyDescription,
        category: policyCategory,
        createdAt: now,
        updatedAt: now,
        currentVersionId: versionId,
        versions: [{
          id: versionId,
          policyId,
          version: 1,
          rules: JSON.parse(JSON.stringify(rules)),
          description: note,
          createdAt: now,
          createdBy: currentUser,
          changeNote: note,
          status: 'draft',
        }],
        approvalHistory: [],
      };
    }

    upsertPolicy(policy);
    logAction({
      actor: currentUser,
      action: editingPolicy ? `Updated policy: ${policyName}` : `Created policy: ${policyName}`,
      policyId: policy.id,
      policyName: policyName,
      details: `${rules.length} rule(s) · Version ${policy.versions.length} · ${note}`,
      category: 'policy',
    });
    setSaveMessage({ type: 'success', text: `Policy "${policyName}" saved as version ${policy.versions.length}.` });
    setChangeNote('');
    setTimeout(() => navigate('dashboard'), 800);
  };

  const loadTemplate = (template: string) => {
    setNlInput(template);
    const result = parseNaturalLanguage(template);
    setNlResult(result);
  };

  const livePreview = useMemo(() => {
    if (rules.length === 0) return null;
    const sampleInputs: Record<string, string | number | boolean> = {};
    for (const rule of rules) {
      if (!rule.condition) continue;
      collectSampleInputs(rule.condition, sampleInputs);
    }
    return JSON.stringify(sampleInputs, null, 2);
  }, [rules]);

  const previewDecision = useMemo(() => {
    if (rules.length === 0 || !livePreview) return null;
    try {
      const inputs = JSON.parse(livePreview);
      return evaluateRules(rules, inputs, 0);
    } catch {
      return null;
    }
  }, [rules, livePreview]);

  return (
    <div>
      <PageHeader
        title="Policy Compiler"
        description="Author structured rules from natural language or build them manually"
        actions={
          <>
            <button className="btn-secondary" onClick={() => navigate('dashboard')}>Cancel</button>
            <button className="btn-primary" onClick={handleSave}>
              <Save size={16} /> {editingPolicy ? 'Save New Version' : 'Create Policy'}
            </button>
          </>
        }
      />

      {saveMessage && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm animate-slide-up ${
          saveMessage.type === 'success'
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
            : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
        }`}>
          {saveMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {saveMessage.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-5 animate-slide-up">
            <h3 className="section-title mb-4">Policy Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Policy Name</label>
                <input className="input" value={policyName} onChange={(e) => setPolicyName(e.target.value)} placeholder="e.g. Purchase Approval Policy" />
              </div>
              <div>
                <label className="label">Category</label>
                <select className="select" value={policyCategory} onChange={(e) => setPolicyCategory(e.target.value)}>
                  {policyCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="label">Description</label>
              <textarea className="input min-h-[60px]" value={policyDescription} onChange={(e) => setPolicyDescription(e.target.value)} placeholder="Brief description of what this policy governs..." />
            </div>
            {editingPolicy && (
              <div className="mt-4">
                <label className="label">Change Note (for new version)</label>
                <input className="input" value={changeNote} onChange={(e) => setChangeNote(e.target.value)} placeholder="What changed in this version?" />
              </div>
            )}
          </div>

          <div className="card p-5 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title">Natural Language Input</h3>
              <Sparkles size={18} className="text-blue-500" />
            </div>
            <p className="section-subtitle mb-3">Paste a policy in plain English. The deterministic parser extracts actor, resource, conditions, and action.</p>
            <div className="flex gap-2 mb-3">
              <input
                className="input"
                value={nlInput}
                onChange={(e) => setNlInput(e.target.value)}
                placeholder='e.g. "An employee cannot approve their own purchase above ₹50,000."'
                onKeyDown={(e) => e.key === 'Enter' && handleParseNL()}
              />
              <button className="btn-secondary shrink-0" onClick={handleParseNL}>Parse</button>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {policyTemplates.slice(0, 4).map((t) => (
                <button
                  key={t.name}
                  className="btn-ghost text-xs px-2.5 py-1"
                  onClick={() => loadTemplate(t.template)}
                  title={t.description}
                >
                  {t.name}
                </button>
              ))}
            </div>

            {nlResult && (
              <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-4 animate-slide-up bg-gray-50 dark:bg-slate-800/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`badge ${nlResult.confidence >= 75 ? 'badge-active' : nlResult.confidence >= 50 ? 'badge-ambiguous' : 'badge-deny'}`}>
                      {nlResult.confidence}% confidence
                    </span>
                  </div>
                  <button className="btn-primary text-xs px-3 py-1.5" onClick={applyParsedRule}>
                    <Plus size={14} /> Add as Rule
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                  <div><span className="text-gray-400 dark:text-slate-500">Actor:</span> <span className="font-medium text-gray-900 dark:text-white">{nlResult.actor || '—'}</span></div>
                  <div><span className="text-gray-400 dark:text-slate-500">Resource:</span> <span className="font-medium text-gray-900 dark:text-white">{nlResult.resource || '—'}</span></div>
                  <div><span className="text-gray-400 dark:text-slate-500">Action:</span> <span className="font-medium text-gray-900 dark:text-white">{nlResult.action}</span></div>
                  <div><span className="text-gray-400 dark:text-slate-500">Conditions:</span> <span className="font-medium text-gray-900 dark:text-white">{nlResult.conditions.length}</span></div>
                </div>
                {nlResult.conditions.length > 0 && (
                  <div className="space-y-1 mb-3">
                    {nlResult.conditions.map((c, i) => (
                      <div key={i} className="mono text-gray-600 dark:text-slate-300 bg-white dark:bg-slate-900 px-2 py-1 rounded">
                        {c.field} {c.operator} {c.value}
                      </div>
                    ))}
                  </div>
                )}
                {nlResult.warnings.length > 0 && (
                  <div className="space-y-1">
                    {nlResult.warnings.map((w, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                        <AlertCircle size={12} /> {w}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="card p-5 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title">Rules ({rules.length})</h3>
              <button className="btn-primary" onClick={addRule}>
                <Plus size={16} /> Add Rule
              </button>
            </div>

            {rules.length === 0 ? (
              <EmptyState
                icon={<FileCode2 size={28} />}
                title="No rules yet"
                description="Add a rule manually or parse one from natural language above."
                action={<button className="btn-primary" onClick={addRule}><Plus size={16} /> Add Rule</button>}
              />
            ) : (
              <div className="space-y-3">
                {rules.map((rule, idx) => (
                  <RuleEditor
                    key={rule.id}
                    rule={rule}
                    index={idx}
                    expanded={expandedRules.has(rule.id)}
                    onToggle={() => toggleExpanded(rule.id)}
                    onUpdate={(updates) => updateRule(rule.id, updates)}
                    onDelete={() => deleteRule(rule.id)}
                    onDuplicate={() => duplicateRule(rule)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-5 animate-slide-up sticky top-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title">Live Preview</h3>
              <button className="btn-ghost p-1" onClick={() => setShowPreview(!showPreview)}>
                <Eye size={16} />
              </button>
            </div>

            {showPreview && (
              <>
                <div className="mb-4">
                  <p className="section-subtitle mb-2">Compiled Intermediate Representation</p>
                  <div className="rounded-lg bg-gray-900 dark:bg-slate-950 p-3 overflow-x-auto max-h-64 overflow-y-auto">
                    <pre className="mono text-green-400 text-[11px] leading-relaxed">
                      {JSON.stringify({
                        policyName: policyName || 'Untitled',
                        category: policyCategory,
                        rules: rules.map(r => ({
                          id: r.id.slice(0, 8),
                          name: r.name,
                          actor: r.actor,
                          resource: r.resource,
                          condition: r.condition ? conditionToReadable(r.condition) : 'always',
                          action: r.action,
                          priority: r.priority,
                          enabled: r.enabled,
                        })),
                      }, null, 2)}
                    </pre>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="section-subtitle mb-2">Sample Input</p>
                  <textarea
                    className="input mono text-xs min-h-[80px]"
                    value={livePreview || '{}'}
                    onChange={(e) => {
                      // Allow editing sample input
                    }}
                    readOnly
                  />
                </div>

                {previewDecision && (
                  <div>
                    <p className="section-subtitle mb-2">Engine Decision</p>
                    <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <DecisionBadge decision={previewDecision.decision} />
                        <span className="text-xs text-gray-400 dark:text-slate-500">{previewDecision.evaluationTimeMs.toFixed(2)}ms</span>
                      </div>
                      <div className="space-y-1">
                        {previewDecision.evidence.reasoning.map((r, i) => (
                          <p key={i} className="text-xs text-gray-500 dark:text-slate-400">{r}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function collectSampleInputs(condition: Condition, inputs: Record<string, string | number | boolean>) {
  if (isConditionGroup(condition)) {
    for (const c of (condition as ConditionGroup).conditions) {
      collectSampleInputs(c, inputs);
    }
  } else {
    const leaf = condition as ConditionLeaf;
    if (!(leaf.field in inputs)) {
      inputs[leaf.field] = leaf.value;
    }
  }
}

function RuleEditor({
  rule,
  index,
  expanded,
  onToggle,
  onUpdate,
  onDelete,
  onDuplicate,
}: {
  rule: PolicyRule;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<PolicyRule>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  return (
    <div className={`rounded-lg border border-gray-200 dark:border-slate-700 transition-all ${rule.enabled ? '' : 'opacity-60'}`}>
      <div className="flex items-center gap-2 p-3">
        <button onClick={onToggle} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <span className="text-xs font-mono text-gray-400 dark:text-slate-500 w-6">#{index + 1}</span>
        <span className="font-medium text-sm text-gray-900 dark:text-white flex-1 truncate">{rule.name}</span>
        <span className={`badge ${rule.action === 'ALLOW' ? 'badge-allow' : 'badge-deny'}`}>{rule.action}</span>
        <button onClick={() => onUpdate({ enabled: !rule.enabled })} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
          {rule.enabled ? 'Enabled' : 'Disabled'}
        </button>
        <button onClick={onDuplicate} className="text-gray-400 hover:text-blue-500 transition-colors" title="Duplicate">
          <Copy size={14} />
        </button>
        <button onClick={onDelete} className="text-gray-400 hover:text-red-500 transition-colors" title="Delete">
          <Trash2 size={14} />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-200 dark:border-slate-700 p-4 space-y-4 animate-slide-up">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Rule Name</label>
              <input className="input" value={rule.name} onChange={(e) => onUpdate({ name: e.target.value })} />
            </div>
            <div>
              <label className="label">Priority (higher = more important)</label>
              <input type="number" className="input" value={rule.priority} onChange={(e) => onUpdate({ priority: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Actor</label>
              <input className="input" value={rule.actor} onChange={(e) => onUpdate({ actor: e.target.value })} placeholder="e.g. Employee, Manager, Admin" />
            </div>
            <div>
              <label className="label">Resource</label>
              <input className="input" value={rule.resource} onChange={(e) => onUpdate({ resource: e.target.value })} placeholder="e.g. Purchase, Expense, Refund" />
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <input className="input" value={rule.description} onChange={(e) => onUpdate({ description: e.target.value })} placeholder="Human-readable rule description" />
          </div>

          <div>
            <label className="label">Action</label>
            <div className="flex gap-2">
              {ACTIONS.map((action) => (
                <button
                  key={action}
                  className={`btn ${rule.action === action ? (action === 'ALLOW' ? 'btn-success' : 'btn-danger') : 'btn-secondary'}`}
                  onClick={() => onUpdate({ action })}
                >
                  {action}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Condition</label>
              <button
                className="btn-ghost text-xs px-2 py-1"
                onClick={() => onUpdate({ condition: null })}
              >
                Clear condition (always applies)
              </button>
            </div>
            <ConditionEditor
              condition={rule.condition}
              onChange={(c) => onUpdate({ condition: c })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ConditionEditor({
  condition,
  onChange,
}: {
  condition: Condition | null;
  onChange: (c: Condition | null) => void;
}) {
  if (!condition) {
    return (
      <div className="rounded-lg bg-gray-50 dark:bg-slate-800/50 p-3 text-center">
        <p className="text-sm text-gray-400 dark:text-slate-500 mb-2">No condition set — this rule always applies</p>
        <button
          className="btn-secondary"
          onClick={() => onChange({
            id: generateId(),
            field: 'amount',
            operator: '>',
            value: 0,
            valueType: 'number',
          } as ConditionLeaf)}
        >
          <Plus size={14} /> Add Condition
        </button>
      </div>
    );
  }

  if (!isConditionGroup(condition)) {
    const leaf = condition as ConditionLeaf;
    return (
      <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input
            className="input"
            value={leaf.field}
            onChange={(e) => onChange({ ...leaf, field: e.target.value })}
            placeholder="field name"
          />
          <select
            className="select"
            value={leaf.operator}
            onChange={(e) => onChange({ ...leaf, operator: e.target.value as ComparisonOperator })}
          >
            {OPERATORS.map((op) => <option key={op} value={op}>{op}</option>)}
          </select>
          <select
            className="select"
            value={leaf.valueType}
            onChange={(e) => {
              const newType = e.target.value as FieldType;
              const newValue = newType === 'number' ? 0 : newType === 'boolean' ? false : '';
              onChange({ ...leaf, valueType: newType, value: newValue });
            }}
          >
            {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {leaf.valueType === 'boolean' ? (
            <select
              className="select"
              value={String(leaf.value)}
              onChange={(e) => onChange({ ...leaf, value: e.target.value === 'true' })}
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : (
            <input
              className="input"
              type={leaf.valueType === 'number' ? 'number' : 'text'}
              value={String(leaf.value)}
              onChange={(e) => {
                const val = leaf.valueType === 'number' ? Number(e.target.value) : e.target.value;
                onChange({ ...leaf, value: val });
              }}
              placeholder="value"
            />
          )}
        </div>
        <div className="flex gap-2 mt-2">
          <button
            className="btn-ghost text-xs"
            onClick={() => onChange({
              id: generateId(),
              logic: 'AND',
              conditions: [leaf],
            } as ConditionGroup)}
          >
            <Layers size={12} /> Group with AND
          </button>
          <button
            className="btn-ghost text-xs"
            onClick={() => onChange({
              id: generateId(),
              logic: 'OR',
              conditions: [leaf],
            } as ConditionGroup)}
          >
            <Layers size={12} /> Group with OR
          </button>
        </div>
      </div>
    );
  }

  const group = condition as ConditionGroup;
  return (
    <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3">
      <div className="flex items-center gap-2 mb-3">
        <select
          className="select w-auto"
          value={group.logic}
          onChange={(e) => onChange({ ...group, logic: e.target.value as LogicalOperator })}
        >
          <option value="AND">AND (all must match)</option>
          <option value="OR">OR (any must match)</option>
        </select>
        <span className="text-xs text-gray-400 dark:text-slate-500">{group.conditions.length} condition(s)</span>
      </div>
      <div className="space-y-2">
        {group.conditions.map((child, idx) => (
          <div key={idx} className="flex items-start gap-2">
            <div className="flex-1">
              <ConditionEditor
                condition={child}
                onChange={(newChild) => {
                  const newConditions = [...group.conditions];
                  if (newChild) newConditions[idx] = newChild;
                  else newConditions.splice(idx, 1);
                  onChange({ ...group, conditions: newConditions });
                }}
              />
            </div>
            <button
              className="btn-ghost p-1.5 mt-1 text-red-400 hover:text-red-600"
              onClick={() => {
                const newConditions = group.conditions.filter((_, i) => i !== idx);
                if (newConditions.length === 0) onChange(null);
                else if (newConditions.length === 1 && !isConditionGroup(newConditions[0])) onChange(newConditions[0]);
                else onChange({ ...group, conditions: newConditions });
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <button
        className="btn-secondary mt-3"
        onClick={() => onChange({
          ...group,
          conditions: [...group.conditions, {
            id: generateId(),
            field: 'amount',
            operator: '>',
            value: 0,
            valueType: 'number',
          } as ConditionLeaf],
        })}
      >
        <Plus size={14} /> Add Condition
      </button>
    </div>
  );
}
