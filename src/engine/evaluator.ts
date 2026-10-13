import type {
  Condition,
  ConditionLeaf,
  ConditionGroup,
  ScenarioInput,
  ConditionEvaluation,
  ComparisonOperator,
} from '@/types/policy';

export function isConditionGroup(c: Condition): c is ConditionGroup {
  return (c as ConditionGroup).logic !== undefined;
}

function compareValues(
  actual: string | number | boolean | undefined,
  operator: ComparisonOperator,
  expected: string | number | boolean,
): boolean {
  if (actual === undefined || actual === null) return false;

  switch (operator) {
    case '>':
      return Number(actual) > Number(expected);
    case '<':
      return Number(actual) < Number(expected);
    case '>=':
      return Number(actual) >= Number(expected);
    case '<=':
      return Number(actual) <= Number(expected);
    case '==':
      return actual == expected;
    case '!=':
      return actual != expected;
    default:
      return false;
  }
}

export function evaluateCondition(
  condition: Condition,
  inputs: ScenarioInput,
): { passed: boolean; evaluations: ConditionEvaluation[] } {
  if (isConditionGroup(condition)) {
    return evaluateGroup(condition, inputs);
  }
  return evaluateLeaf(condition, inputs);
}

function evaluateLeaf(
  leaf: ConditionLeaf,
  inputs: ScenarioInput,
): { passed: boolean; evaluations: ConditionEvaluation[] } {
  const actualValue = inputs[leaf.field];
  const passed = compareValues(actualValue, leaf.operator, leaf.value);
  const evaluation: ConditionEvaluation = {
    conditionId: leaf.id,
    passed,
    field: leaf.field,
    operator: leaf.operator,
    expectedValue: leaf.value,
    actualValue: actualValue as string | number | boolean | undefined,
    description: `${leaf.field} ${leaf.operator} ${leaf.value} → actual: ${actualValue ?? 'undefined'}`,
  };
  return { passed, evaluations: [evaluation] };
}

function evaluateGroup(
  group: ConditionGroup,
  inputs: ScenarioInput,
): { passed: boolean; evaluations: ConditionEvaluation[] } {
  let allEvaluations: ConditionEvaluation[] = [];
  let results: boolean[] = [];

  for (const child of group.conditions) {
    const result = isConditionGroup(child)
      ? evaluateGroup(child, inputs)
      : evaluateLeaf(child, inputs);
    allEvaluations = allEvaluations.concat(result.evaluations);
    results.push(result.passed);
  }

  const passed =
    group.logic === 'AND'
      ? results.every((r) => r === true)
      : results.some((r) => r === true);

  return { passed, evaluations: allEvaluations };
}

export function conditionToReadable(condition: Condition): string {
  if (isConditionGroup(condition)) {
    const parts = condition.conditions.map((c) => {
      if (isConditionGroup(c)) {
        return `(${conditionToReadable(c)})`;
      }
      return conditionToReadable(c);
    });
    return parts.join(` ${condition.logic} `);
  }
  return `${condition.field} ${condition.operator} ${condition.value}`;
}
