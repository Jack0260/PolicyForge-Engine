import type {
  PolicyRule,
  ScenarioInput,
  TestCase,
  PolicyConflict,
  Condition,
  ConditionGroup,
  ConditionLeaf,
} from '@/types/policy';
import { evaluateRules } from './engine';
import { evaluateCondition, isConditionGroup } from './evaluator';

function generateId(): string {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

function extractFields(rules: PolicyRule[]): Set<string> {
  const fields = new Set<string>();
  for (const rule of rules) {
    if (!rule.condition) continue;
    collectFields(rule.condition, fields);
  }
  return fields;
}

function collectFields(condition: Condition, fields: Set<string>): void {
  if (isConditionGroup(condition)) {
    for (const c of (condition as ConditionGroup).conditions) {
      collectFields(c, fields);
    }
  } else {
    fields.add((condition as ConditionLeaf).field);
  }
}

export function generateCounterexamples(rules: PolicyRule[]): TestCase[] {
  const testCases: TestCase[] = [];
  const fields = Array.from(extractFields(rules));
  if (fields.length === 0) return testCases;

  const activeRules = rules.filter((r) => r.enabled);

  for (const rule of activeRules) {
    const baseInputs = buildInputsForRule(rule, fields);
    const allowedResult = evaluateRules(rules, baseInputs, 0);
    testCases.push({
      id: generateId(),
      name: `Auto case for: ${rule.name}`,
      category: allowedResult.decision === 'ALLOW' ? 'allowed' : 'denied',
      inputs: { ...baseInputs },
      expectedDecision: allowedResult.decision,
      actualDecision: allowedResult.decision,
      passed: true,
      ruleId: rule.id,
      description: `Generated to exercise rule "${rule.name}" — engine decided ${allowedResult.decision}.`,
    });
  }

  for (const rule of activeRules) {
    const edgeCase = buildEdgeCaseForRule(rule, fields);
    if (edgeCase) {
      const result = evaluateRules(rules, edgeCase, 0);
      testCases.push({
        id: generateId(),
        name: `Edge case for: ${rule.name}`,
        category: 'edge',
        inputs: edgeCase,
        expectedDecision: 'AMBIGUOUS',
        actualDecision: result.decision,
        passed: false,
        ruleId: rule.id,
        description: `Edge case with boundary/extreme values — engine decided ${result.decision}.`,
      });
    }
  }

  for (const rule of activeRules) {
    const negCase = buildNegatedInputsForRule(rule, fields);
    if (negCase) {
      const result = evaluateRules(rules, negCase, 0);
      testCases.push({
        id: generateId(),
        name: `Denied case for: ${rule.name}`,
        category: 'denied',
        inputs: negCase,
        expectedDecision: 'DENY',
        actualDecision: result.decision,
        passed: result.decision === 'DENY',
        ruleId: rule.id,
        description: `Inputs designed to fail rule "${rule.name}" conditions — engine decided ${result.decision}.`,
      });
    }
  }

  const conflicts = detectConflicts(activeRules);
  for (const conflict of conflicts) {
    testCases.push({
      id: generateId(),
      name: `Conflict: ${conflict.ruleA.name} vs ${conflict.ruleB.name}`,
      category: 'conflicting',
      inputs: conflict.scenario,
      expectedDecision: 'CONFLICT',
      actualDecision: 'CONFLICT',
      passed: true,
      description: conflict.description,
    });
  }

  const emptyResult = evaluateRules(rules, {}, 0);
  testCases.push({
    id: generateId(),
    name: 'Ambiguous: empty inputs',
    category: 'ambiguous',
    inputs: {},
    expectedDecision: 'AMBIGUOUS',
    actualDecision: emptyResult.decision,
    passed: emptyResult.decision === 'AMBIGUOUS',
    description: 'No input values provided — engine decided ' + emptyResult.decision + '.',
  });

  return testCases;
}

function buildInputsForRule(rule: PolicyRule, fields: string[]): ScenarioInput {
  const inputs: ScenarioInput = {};
  for (const field of fields) {
    inputs[field] = 0;
  }
  if (rule.condition) {
    fillConditionInputs(rule.condition, inputs);
  }
  return inputs;
}

function fillConditionInputs(condition: Condition, inputs: ScenarioInput): void {
  if (isConditionGroup(condition)) {
    const group = condition as ConditionGroup;
    if (group.logic === 'AND') {
      for (const c of group.conditions) {
        fillConditionInputs(c, inputs);
      }
    } else {
      fillConditionInputs(group.conditions[0], inputs);
    }
  } else {
    const leaf = condition as ConditionLeaf;
    inputs[leaf.field] = leaf.value;
  }
}

function buildEdgeCaseForRule(rule: PolicyRule, fields: string[]): ScenarioInput | null {
  if (!rule.condition) return null;
  const inputs: ScenarioInput = {};
  for (const field of fields) {
    inputs[field] = 0;
  }
  fillEdgeConditionInputs(rule.condition, inputs);
  return inputs;
}

function fillEdgeConditionInputs(condition: Condition, inputs: ScenarioInput): void {
  if (isConditionGroup(condition)) {
    const group = condition as ConditionGroup;
    for (const c of group.conditions) {
      fillEdgeConditionInputs(c, inputs);
    }
  } else {
    const leaf = condition as ConditionLeaf;
    if (leaf.valueType === 'number') {
      const numVal = Number(leaf.value);
      switch (leaf.operator) {
        case '>':
        case '>=':
        case '<':
        case '<=':
          inputs[leaf.field] = numVal;
          break;
        case '==':
          inputs[leaf.field] = numVal + 1;
          break;
        case '!=':
          inputs[leaf.field] = numVal;
          break;
      }
    } else if (leaf.valueType === 'string') {
      inputs[leaf.field] = leaf.operator === '==' ? 'edge_' + leaf.value : leaf.value;
    } else if (leaf.valueType === 'boolean') {
      inputs[leaf.field] = !leaf.value;
    }
  }
}

function buildNegatedInputsForRule(rule: PolicyRule, fields: string[]): ScenarioInput | null {
  if (!rule.condition) return null;
  const inputs: ScenarioInput = {};
  for (const field of fields) {
    inputs[field] = 0;
  }
  fillNegatedConditionInputs(rule.condition, inputs);
  const result = evaluateCondition(rule.condition, inputs);
  if (result.passed) return null;
  return inputs;
}

function fillNegatedConditionInputs(condition: Condition, inputs: ScenarioInput): void {
  if (isConditionGroup(condition)) {
    const group = condition as ConditionGroup;
    if (group.logic === 'AND') {
      fillNegatedConditionInputs(group.conditions[0], inputs);
    } else {
      for (const c of group.conditions) {
        fillNegatedConditionInputs(c, inputs);
      }
    }
  } else {
    const leaf = condition as ConditionLeaf;
    fillNegatedLeaf(leaf, inputs);
  }
}

function fillNegatedLeaf(leaf: ConditionLeaf, inputs: ScenarioInput): void {
  if (leaf.valueType === 'number') {
    const numVal = Number(leaf.value);
    switch (leaf.operator) {
      case '>':
        inputs[leaf.field] = numVal - 1;
        break;
      case '<':
        inputs[leaf.field] = numVal + 1;
        break;
      case '>=':
        inputs[leaf.field] = numVal - 1;
        break;
      case '<=':
        inputs[leaf.field] = numVal + 1;
        break;
      case '==':
        inputs[leaf.field] = numVal + 1;
        break;
      case '!=':
        inputs[leaf.field] = numVal;
        break;
    }
  } else if (leaf.valueType === 'string') {
    inputs[leaf.field] = 'different_' + leaf.value;
  } else if (leaf.valueType === 'boolean') {
    inputs[leaf.field] = !leaf.value;
  }
}

export function detectConflicts(rules: PolicyRule[]): PolicyConflict[] {
  const conflicts: PolicyConflict[] = [];
  const activeRules = rules.filter((r) => r.enabled);

  for (let i = 0; i < activeRules.length; i++) {
    for (let j = i + 1; j < activeRules.length; j++) {
      const ruleA = activeRules[i];
      const ruleB = activeRules[j];

      if (ruleA.action === ruleB.action) continue;
      if (ruleA.actor !== ruleB.actor && ruleA.actor !== '*' && ruleB.actor !== '*') continue;
      if (ruleA.resource !== ruleB.resource && ruleA.resource !== '*' && ruleB.resource !== '*') continue;

      const conflictScenario = findConflictScenario(ruleA, ruleB);
      if (conflictScenario) {
        const resultA = evaluateRules([ruleA], conflictScenario, 0);
        const resultB = evaluateRules([ruleB], conflictScenario, 0);

        if (resultA.decision !== 'AMBIGUOUS' && resultB.decision !== 'AMBIGUOUS') {
          const severity = ruleA.priority === ruleB.priority ? 'high' : 'medium';
          conflicts.push({
            id: generateId(),
            ruleA,
            ruleB,
            scenario: conflictScenario,
            decisionA: resultA.decision,
            decisionB: resultB.decision,
            severity,
            description: `Rule "${ruleA.name}" (${ruleA.action}) and rule "${ruleB.name}" (${ruleB.action}) both match when ${JSON.stringify(conflictScenario)}. This produces a ${severity} severity conflict.`,
          });
        }
      }
    }
  }

  return conflicts;
}

function findConflictScenario(ruleA: PolicyRule, ruleB: PolicyRule): ScenarioInput | null {
  const fields = new Set<string>();
  if (ruleA.condition) collectFields(ruleA.condition, fields);
  if (ruleB.condition) collectFields(ruleB.condition, fields);

  const inputs: ScenarioInput = {};
  for (const field of fields) {
    inputs[field] = 0;
  }

  if (ruleA.condition) fillConditionInputs(ruleA.condition, inputs);
  if (ruleB.condition) fillConditionInputs(ruleB.condition, inputs);

  const resultA = ruleA.condition ? evaluateCondition(ruleA.condition, inputs) : { passed: true };
  const resultB = ruleB.condition ? evaluateCondition(ruleB.condition, inputs) : { passed: true };

  if (resultA.passed && resultB.passed) {
    return inputs;
  }

  if (ruleA.condition && ruleB.condition) {
    const altInputs: ScenarioInput = { ...inputs };
    fillConditionInputs(ruleB.condition, altInputs);
    const altA = evaluateCondition(ruleA.condition, altInputs);
    const altB = evaluateCondition(ruleB.condition, altInputs);
    if (altA.passed && altB.passed) {
      return altInputs;
    }
  }

  if (!ruleA.condition && !ruleB.condition) {
    return inputs;
  }

  if (!ruleA.condition && resultB.passed) return inputs;
  if (!ruleB.condition && resultA.passed) return inputs;

  return null;
}

export { generateId };
