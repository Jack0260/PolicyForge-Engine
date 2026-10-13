export type Decision = 'ALLOW' | 'DENY' | 'AMBIGUOUS' | 'CONFLICT';

export type FieldType = 'number' | 'string' | 'boolean' | 'date';

export type ComparisonOperator = '>' | '<' | '>=' | '<=' | '==' | '!=';

export type LogicalOperator = 'AND' | 'OR';

export type ActionType = 'ALLOW' | 'DENY';

export interface ConditionLeaf {
  id: string;
  field: string;
  operator: ComparisonOperator;
  value: string | number | boolean;
  valueType: FieldType;
}

export interface ConditionGroup {
  id: string;
  logic: LogicalOperator;
  conditions: Array<ConditionLeaf | ConditionGroup>;
}

export type Condition = ConditionLeaf | ConditionGroup;

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  actor: string;
  resource: string;
  condition: Condition | null;
  action: ActionType;
  priority: number;
  enabled: boolean;
}

export interface PolicyVersion {
  id: string;
  policyId: string;
  version: number;
  rules: PolicyRule[];
  description: string;
  createdAt: string;
  createdBy: string;
  changeNote: string;
  status: PolicyStatus;
}

export type PolicyStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'active'
  | 'deprecated'
  | 'archived';

export interface ScenarioInput {
  [field: string]: string | number | boolean;
}

export interface ConditionEvaluation {
  conditionId: string;
  passed: boolean;
  field: string;
  operator: ComparisonOperator;
  expectedValue: string | number | boolean;
  actualValue: string | number | boolean | undefined;
  description: string;
}

export interface RuleEvaluation {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  action: ActionType;
  conditionEvaluations: ConditionEvaluation[];
}

export interface DecisionEvidence {
  decision: Decision;
  matchedRule: PolicyRule | null;
  matchedRules: PolicyRule[];
  inputs: ScenarioInput;
  conditionEvaluations: ConditionEvaluation[];
  policyVersion: number;
  timestamp: string;
  reasoning: string[];
}

export interface TestCase {
  id: string;
  name: string;
  category: 'allowed' | 'denied' | 'ambiguous' | 'conflicting' | 'edge';
  inputs: ScenarioInput;
  expectedDecision: Decision;
  actualDecision?: Decision;
  passed?: boolean;
  ruleId?: string;
  description: string;
}

export interface PolicyConflict {
  id: string;
  ruleA: PolicyRule;
  ruleB: PolicyRule;
  scenario: ScenarioInput;
  decisionA: Decision;
  decisionB: Decision;
  severity: 'high' | 'medium' | 'low';
  description: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  policyId?: string;
  policyName?: string;
  details: string;
  category: 'policy' | 'version' | 'approval' | 'decision' | 'test' | 'conflict' | 'system';
}

export interface ApprovalStep {
  id: string;
  fromStatus: PolicyStatus;
  toStatus: PolicyStatus;
  actor: string;
  timestamp: string;
  note: string;
}

export interface PolicyRecord {
  id: string;
  name: string;
  description: string;
  category: string;
  versions: PolicyVersion[];
  currentVersionId: string;
  approvalHistory: ApprovalStep[];
  createdAt: string;
  updatedAt: string;
}

export interface EngineEvaluationResult {
  decision: Decision;
  evidence: DecisionEvidence;
  ruleEvaluations: RuleEvaluation[];
  evaluationTimeMs: number;
}
