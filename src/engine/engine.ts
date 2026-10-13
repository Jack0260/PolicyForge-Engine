import type {
  PolicyRule,
  ScenarioInput,
  DecisionEvidence,
  Decision,
  EngineEvaluationResult,
  RuleEvaluation,
  PolicyVersion,
} from '@/types/policy';
import { evaluateCondition, conditionToReadable } from './evaluator';

export function evaluateRules(
  rules: PolicyRule[],
  inputs: ScenarioInput,
  policyVersion: number,
): EngineEvaluationResult {
  const start = performance.now();

  const activeRules = rules.filter((r) => r.enabled);
  activeRules.sort((a, b) => b.priority - a.priority);

  const ruleEvaluations: RuleEvaluation[] = [];
  const matchedRules: PolicyRule[] = [];
  let allConditionEvaluations: DecisionEvidence['conditionEvaluations'] = [];

  for (const rule of activeRules) {
    const conditionResult = rule.condition
      ? evaluateCondition(rule.condition, inputs)
      : { passed: true, evaluations: [] };

    const matched = conditionResult.passed;

    ruleEvaluations.push({
      ruleId: rule.id,
      ruleName: rule.name,
      matched,
      action: rule.action,
      conditionEvaluations: conditionResult.evaluations,
    });

    allConditionEvaluations = allConditionEvaluations.concat(
      conditionResult.evaluations,
    );

    if (matched) {
      matchedRules.push(rule);
    }
  }

  let decision: Decision = 'AMBIGUOUS';
  let matchedRule: PolicyRule | null = null;
  const reasoning: string[] = [];

  if (matchedRules.length === 0) {
    decision = 'AMBIGUOUS';
    reasoning.push('No rules matched the given input scenario.');
  } else if (matchedRules.length === 1) {
    matchedRule = matchedRules[0];
    decision = matchedRule.action;
    reasoning.push(
      `Rule "${matchedRule.name}" (priority ${matchedRule.priority}) matched and resulted in ${matchedRule.action}.`,
    );
  } else {
    const allowRules = matchedRules.filter((r) => r.action === 'ALLOW');
    const denyRules = matchedRules.filter((r) => r.action === 'DENY');

    if (allowRules.length > 0 && denyRules.length > 0) {
      decision = 'CONFLICT';
      reasoning.push(
        `Conflict detected: ${allowRules.length} rule(s) say ALLOW and ${denyRules.length} rule(s) say DENY.`,
      );
      reasoning.push(
        `Conflicting rules: ${matchedRules.map((r) => r.name).join(', ')}`,
      );
      matchedRule = matchedRules[0];
    } else {
      matchedRule = matchedRules[0];
      decision = matchedRule.action;
      reasoning.push(
        `${matchedRules.length} rules matched, all agree: ${matchedRule.action}.`,
      );
      reasoning.push(
        `Primary rule: "${matchedRule.name}" (highest priority ${matchedRule.priority}).`,
      );
    }
  }

  const evidence: DecisionEvidence = {
    decision,
    matchedRule,
    matchedRules,
    inputs,
    conditionEvaluations: allConditionEvaluations,
    policyVersion,
    timestamp: new Date().toISOString(),
    reasoning,
  };

  const evaluationTimeMs = performance.now() - start;

  return {
    decision,
    evidence,
    ruleEvaluations,
    evaluationTimeMs,
  };
}

export function evaluatePolicyVersion(
  version: PolicyVersion,
  inputs: ScenarioInput,
): EngineEvaluationResult {
  return evaluateRules(version.rules, inputs, version.version);
}

export function describeRule(rule: PolicyRule): string {
  const parts: string[] = [];
  parts.push(`Actor: ${rule.actor}`);
  parts.push(`Resource: ${rule.resource}`);
  if (rule.condition) {
    parts.push(`Condition: ${conditionToReadable(rule.condition)}`);
  } else {
    parts.push('Condition: (always applies)');
  }
  parts.push(`Action: ${rule.action}`);
  parts.push(`Priority: ${rule.priority}`);
  return parts.join(' | ');
}
