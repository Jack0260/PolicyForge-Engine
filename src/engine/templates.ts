import type { PolicyRecord, PolicyRule, ConditionGroup, ConditionLeaf } from '@/types/policy';

function generateId(): string {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

function createLeaf(id: string, field: string, operator: ConditionLeaf['operator'], value: string | number | boolean, valueType: ConditionLeaf['valueType']): ConditionLeaf {
  return { id, field, operator, value, valueType };
}

const seedRules: Record<string, PolicyRule[]> = {
  purchase_approval: [
    {
      id: generateId(),
      name: 'Self-approval prevention',
      description: 'An employee cannot approve their own purchase above ₹50,000.',
      actor: 'Employee',
      resource: 'Purchase',
      condition: {
        id: generateId(),
        logic: 'AND',
        conditions: [
          createLeaf(generateId(), 'amount', '>', 50000, 'number'),
          createLeaf(generateId(), 'approverId', '==', 'requesterId', 'string'),
        ],
      },
      action: 'DENY',
      priority: 100,
      enabled: true,
    },
    {
      id: generateId(),
      name: 'Manager purchase approval',
      description: 'Managers can approve purchases below ₹100,000.',
      actor: 'Manager',
      resource: 'Purchase',
      condition: {
        id: generateId(),
        logic: 'AND',
        conditions: [
          createLeaf(generateId(), 'amount', '<=', 100000, 'number'),
          createLeaf(generateId(), 'approverId', '!=', 'requesterId', 'string'),
        ],
      },
      action: 'ALLOW',
      priority: 50,
      enabled: true,
    },
    {
      id: generateId(),
      name: 'Admin override approval',
      description: 'Admins can approve any purchase regardless of amount.',
      actor: 'Admin',
      resource: 'Purchase',
      condition: null,
      action: 'ALLOW',
      priority: 10,
      enabled: true,
    },
  ],
  expense_management: [
    {
      id: generateId(),
      name: 'Manager expense approval',
      description: 'Managers can approve expenses below ₹100,000.',
      actor: 'Manager',
      resource: 'Expense',
      condition: createLeaf(generateId(), 'amount', '<=', 100000, 'number'),
      action: 'ALLOW',
      priority: 50,
      enabled: true,
    },
    {
      id: generateId(),
      name: 'Self-expense prevention',
      description: 'No employee can approve their own expense.',
      actor: 'Employee',
      resource: 'Expense',
      condition: createLeaf(generateId(), 'approverId', '==', 'requesterId', 'string'),
      action: 'DENY',
      priority: 100,
      enabled: true,
    },
  ],
  refund_authorization: [
    {
      id: generateId(),
      name: 'Standard refund approval',
      description: 'Customer service can approve refunds below ₹10,000.',
      actor: 'CustomerService',
      resource: 'Refund',
      condition: createLeaf(generateId(), 'amount', '<=', 10000, 'number'),
      action: 'ALLOW',
      priority: 50,
      enabled: true,
    },
    {
      id: generateId(),
      name: 'Large refund escalation',
      description: 'Refunds above ₹50,000 require manager approval.',
      actor: 'CustomerService',
      resource: 'Refund',
      condition: createLeaf(generateId(), 'amount', '>', 50000, 'number'),
      action: 'DENY',
      priority: 80,
      enabled: true,
    },
  ],
  data_retention: [
    {
      id: generateId(),
      name: 'Data retention limit',
      description: 'Data older than 90 days must be archived.',
      actor: 'System',
      resource: 'Data',
      condition: createLeaf(generateId(), 'ageInDays', '>', 90, 'number'),
      action: 'DENY',
      priority: 50,
      enabled: true,
    },
    {
      id: generateId(),
      name: 'Critical data exemption',
      description: 'Critical classification data is exempt from retention limits.',
      actor: 'System',
      resource: 'Data',
      condition: {
        id: generateId(),
        logic: 'AND',
        conditions: [
          createLeaf(generateId(), 'classification', '==', 'critical', 'string'),
          createLeaf(generateId(), 'ageInDays', '>', 90, 'number'),
        ],
      },
      action: 'ALLOW',
      priority: 100,
      enabled: true,
    },
  ],
};

function createPolicyRecord(
  id: string,
  name: string,
  description: string,
  category: string,
  rules: PolicyRule[],
): PolicyRecord {
  const now = new Date().toISOString();
  const versionId = generateId();
  return {
    id,
    name,
    description,
    category,
    createdAt: now,
    updatedAt: now,
    currentVersionId: versionId,
    versions: [
      {
        id: versionId,
        policyId: id,
        version: 1,
        rules,
        description: 'Initial version',
        createdAt: now,
        createdBy: 'system',
        changeNote: 'Policy created from template',
        status: 'active',
      },
    ],
    approvalHistory: [
      {
        id: generateId(),
        fromStatus: 'draft' as const,
        toStatus: 'active' as const,
        actor: 'system',
        timestamp: now,
        note: 'Auto-activated from template',
      },
    ],
  };
}

export function getSeedPolicies(): PolicyRecord[] {
  return [
    createPolicyRecord(
      'pol_purchase_approval',
      'Purchase Approval Policy',
      'Governs who can approve purchase orders and prevents self-approval for large amounts.',
      'Financial Approval',
      seedRules.purchase_approval,
    ),
    createPolicyRecord(
      'pol_expense_management',
      'Expense Management Policy',
      'Controls expense approval workflow with manager limits and self-approval prevention.',
      'Workflow Approval',
      seedRules.expense_management,
    ),
    createPolicyRecord(
      'pol_refund_authorization',
      'Refund Authorization Policy',
      'Defines refund approval thresholds and escalation rules for customer service.',
      'Refund Authorization',
      seedRules.refund_authorization,
    ),
    createPolicyRecord(
      'pol_data_retention',
      'Data Retention Policy',
      'Enforces data retention limits with exemptions for critical classification data.',
      'Data Retention',
      seedRules.data_retention,
    ),
  ];
}

export const policyCategories = [
  'Access Control',
  'Financial Approval',
  'Refund Authorization',
  'Data Retention',
  'Workflow Approval',
  'Security Policies',
  'Operational Rules',
];

export const policyTemplates: Array<{
  name: string;
  category: string;
  description: string;
  template: string;
}> = [
  {
    name: 'Self-Approval Prevention',
    category: 'Financial Approval',
    description: 'Prevent employees from approving their own purchases above a threshold.',
    template: 'An employee cannot approve their own purchase above ₹50,000.',
  },
  {
    name: 'Manager Expense Limit',
    category: 'Workflow Approval',
    description: 'Allow managers to approve expenses below a certain amount.',
    template: 'Managers can approve expenses below ₹100,000.',
  },
  {
    name: 'Refund Escalation',
    category: 'Refund Authorization',
    description: 'Escalate large refunds to manager approval.',
    template: 'Refunds above ₹50,000 require manager approval.',
  },
  {
    name: 'Data Retention Rule',
    category: 'Data Retention',
    description: 'Archive data older than a specified period.',
    template: 'Data older than 90 days must be archived.',
  },
  {
    name: 'Access Control Rule',
    category: 'Access Control',
    description: 'Restrict document access based on role.',
    template: 'Only admins can access confidential documents.',
  },
  {
    name: 'Security Policy',
    category: 'Security Policies',
    description: 'Block access from blacklisted IPs.',
    template: 'Access from blacklisted IP addresses is prohibited.',
  },
  {
    name: 'Operational Rule',
    category: 'Operational Rules',
    description: 'Limit transaction frequency per user.',
    template: 'A user cannot make more than 10 transactions per day.',
  },
];
