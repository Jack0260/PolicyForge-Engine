import type { PolicyRule, Condition, ConditionGroup, ConditionLeaf } from '@/types/policy';

function generateId(): string {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

export interface ParsedPolicy {
  actor: string;
  resource: string;
  conditions: Array<{
    field: string;
    operator: string;
    value: string;
    valueType: 'number' | 'string' | 'boolean';
  }>;
  action: 'ALLOW' | 'DENY';
  description: string;
  rawText: string;
  confidence: number;
  warnings: string[];
}

interface PatternMatch {
  keywords: string[];
  extract: (text: string) => Partial<ParsedPolicy> | null;
}

const actorPatterns: PatternMatch[] = [
  {
    keywords: ['employee'],
    extract: () => ({ actor: 'Employee' }),
  },
  {
    keywords: ['manager'],
    extract: () => ({ actor: 'Manager' }),
  },
  {
    keywords: ['admin', 'administrator'],
    extract: () => ({ actor: 'Admin' }),
  },
  {
    keywords: ['user'],
    extract: () => ({ actor: 'User' }),
  },
  {
    keywords: ['approver'],
    extract: () => ({ actor: 'Approver' }),
  },
  {
    keywords: ['supervisor'],
    extract: () => ({ actor: 'Supervisor' }),
  },
  {
    keywords: ['auditor'],
    extract: () => ({ actor: 'Auditor' }),
  },
  {
    keywords: ['system'],
    extract: () => ({ actor: 'System' }),
  },
];

const resourcePatterns: PatternMatch[] = [
  {
    keywords: ['purchase', 'purchases'],
    extract: () => ({ resource: 'Purchase' }),
  },
  {
    keywords: ['expense', 'expenses'],
    extract: () => ({ resource: 'Expense' }),
  },
  {
    keywords: ['refund', 'refunds'],
    extract: () => ({ resource: 'Refund' }),
  },
  {
    keywords: ['invoice', 'invoices'],
    extract: () => ({ resource: 'Invoice' }),
  },
  {
    keywords: ['payment', 'payments'],
    extract: () => ({ resource: 'Payment' }),
  },
  {
    keywords: ['access', 'document', 'file', 'data', 'record'],
    extract: (text) => {
      const resourceMap: Record<string, string> = {
        document: 'Document',
        file: 'File',
        data: 'Data',
        record: 'Record',
        access: 'Access',
      };
      for (const [key, value] of Object.entries(resourceMap)) {
        if (text.toLowerCase().includes(key)) return { resource: value };
      }
      return null;
    },
  },
  {
    keywords: ['transaction'],
    extract: () => ({ resource: 'Transaction' }),
  },
  {
    keywords: ['contract'],
    extract: () => ({ resource: 'Contract' }),
  },
  {
    keywords: ['report'],
    extract: () => ({ resource: 'Report' }),
  },
  {
    keywords: ['request'],
    extract: () => ({ resource: 'Request' }),
  },
];

const amountPattern = /(?:₹|rs\.?|inr|\$|usd|eur|£)\s*([0-9,]+(?:\.[0-9]+)?)/i;
const genericNumberPattern = /\b(?:above|below|over|under|exceeding|more\s+than|less\s+than|at\s+least|at\s+most|max(?:imum)?|min(?:imum)?)\s+([0-9,]+(?:\.[0-9]+)?)\b/i;
const comparisonPattern = /\b(above|below|over|under|exceeding|more\s+than|less\s+than|at\s+least|at\s+most|greater\s+than|less\s+than|not\s+equal|max(?:imum)?|min(?:imum)?)\b/i;

const selfApprovalPattern = /\b(?:cannot|can\s+not|must\s+not|should\s+not|not\s+allowed\s+to|may\s+not)\s+(?:approve|authoriz[es]+|sign\s+off\s+on)\s+(?:their\s+own|his\s+own|her\s+own|its\s+own)\b/i;
const selfReferencePattern = /\b(?:own|self|same\s+person)\b/i;

const denyKeywords = /\b(?:cannot|can\s+not|must\s+not|should\s+not|not\s+allowed|prohibited|deny|denied|forbidden|restricted|shall\s+not|may\s+not|blocked|prevent)\b/i;
const allowKeywords = /\b(?:can|may|allowed|permitted|approved|authorized|enable|grant|accept)\b/i;

const operatorMap: Record<string, string> = {
  above: '>',
  over: '>',
  exceeding: '>',
  'more than': '>',
  'greater than': '>',
  below: '<',
  under: '<',
  'less than': '<',
  'at least': '>=',
  'at most': '<=',
  maximum: '<=',
  max: '<=',
  minimum: '>=',
  min: '>=',
  'not equal': '!=',
  'not equal to': '!=',
};

export function parseNaturalLanguage(text: string): ParsedPolicy {
  const warnings: string[] = [];
  const lowerText = text.toLowerCase();
  const result: Partial<ParsedPolicy> = {
    rawText: text,
    description: text,
    confidence: 0,
    conditions: [],
  };

  for (const pattern of actorPatterns) {
    for (const keyword of pattern.keywords) {
      if (lowerText.includes(keyword)) {
        const extracted = pattern.extract(text);
        if (extracted?.actor) {
          result.actor = extracted.actor;
          break;
        }
      }
    }
    if (result.actor) break;
  }
  if (!result.actor) {
    warnings.push('Could not identify the actor. Please specify who the policy applies to.');
  }

  for (const pattern of resourcePatterns) {
    for (const keyword of pattern.keywords) {
      if (lowerText.includes(keyword)) {
        const extracted = pattern.extract(text);
        if (extracted?.resource) {
          result.resource = extracted.resource;
          break;
        }
      }
    }
    if (result.resource) break;
  }
  if (!result.resource) {
    warnings.push('Could not identify the resource. Please specify what the policy governs.');
  }

  const amountMatch = text.match(amountPattern);
  const genericMatch = text.match(genericNumberPattern);
  const compMatch = text.match(comparisonPattern);
  const numericMatch = text.match(/\b([0-9,]+(?:\.[0-9]+)?)\b/);

  if (amountMatch) {
    const valueStr = amountMatch[1].replace(/,/g, '');
    const operator = compMatch ? (operatorMap[compMatch[1].toLowerCase()] || '>') : '>';
    const field = result.resource ? `${result.resource.toLowerCase()}Amount` : 'amount';
    result.conditions = [
      {
        field,
        operator,
        value: valueStr,
        valueType: 'number',
      },
    ];
  } else if (genericMatch) {
    const valueStr = genericMatch[1].replace(/,/g, '');
    const operator = operatorMap[compMatch?.[1]?.toLowerCase() || ''] || '>';
    const field = result.resource ? `${result.resource.toLowerCase()}Amount` : 'amount';
    result.conditions = [
      {
        field,
        operator,
        value: valueStr,
        valueType: 'number',
      },
    ];
  } else if (numericMatch) {
    const valueStr = numericMatch[1].replace(/,/g, '');
    const field = result.resource ? `${result.resource.toLowerCase()}Amount` : 'amount';
    result.conditions = [
      {
        field,
        operator: '>',
        value: valueStr,
        valueType: 'number',
      },
    ];
    warnings.push('Found a number but no explicit comparison operator. Defaulting to "greater than".');
  }

  if (selfApprovalPattern.test(lowerText) || selfReferencePattern.test(lowerText)) {
    const field = result.actor ? `${result.actor.toLowerCase()}Id` : 'approverId';
    result.conditions = [
      ...(result.conditions || []),
      {
        field: 'approverId',
        operator: '!=',
        value: 'requesterId',
        valueType: 'string',
      },
    ];
    warnings.push('Self-approval constraint detected. Ensure "approverId" and "requesterId" are provided in scenarios.');
  }

  if (denyKeywords.test(lowerText)) {
    result.action = 'DENY';
  } else if (allowKeywords.test(lowerText)) {
    result.action = 'ALLOW';
  } else {
    warnings.push('Could not determine if this policy should ALLOW or DENY. Defaulting to DENY.');
    result.action = 'DENY';
  }

  let confidence = 0;
  if (result.actor) confidence += 25;
  if (result.resource) confidence += 25;
  if (result.conditions && result.conditions.length > 0) confidence += 25;
  if (result.action) confidence += 25;
  result.confidence = confidence;

  result.warnings = warnings;
  return result as ParsedPolicy;
}

export function parsedPolicyToRule(parsed: ParsedPolicy): PolicyRule {
  let condition: Condition | null = null;

  if (parsed.conditions.length > 0) {
    if (parsed.conditions.length === 1) {
      const c = parsed.conditions[0];
      condition = {
        id: generateId(),
        field: c.field,
        operator: c.operator as ConditionLeaf['operator'],
        value: c.valueType === 'number' ? Number(c.value) : c.value,
        valueType: c.valueType,
      } as ConditionLeaf;
    } else {
      condition = {
        id: generateId(),
        logic: 'AND',
        conditions: parsed.conditions.map((c) => ({
          id: generateId(),
          field: c.field,
          operator: c.operator as ConditionLeaf['operator'],
          value: c.valueType === 'number' ? Number(c.value) : c.value,
          valueType: c.valueType,
        } as ConditionLeaf)),
      } as ConditionGroup;
    }
  }

  return {
    id: generateId(),
    name: parsed.description.slice(0, 60) || 'Untitled Rule',
    description: parsed.description,
    actor: parsed.actor || 'Unknown',
    resource: parsed.resource || 'Unknown',
    condition,
    action: parsed.action,
    priority: 10,
    enabled: true,
  };
}
