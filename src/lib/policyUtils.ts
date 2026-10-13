import type {
  PolicyRecord,
  PolicyVersion,
  PolicyRule,
  ApprovalStep,
  PolicyStatus,
} from '@/types/policy';

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

export function createNewVersion(
  policy: PolicyRecord,
  rules: PolicyRule[],
  changeNote: string,
  createdBy: string,
): PolicyRecord {
  const currentVersion = policy.versions.find((v) => v.id === policy.currentVersionId);
  const newVersionNumber = (currentVersion?.version || 0) + 1;
  const now = new Date().toISOString();
  const versionId = generateId();

  const newVersion: PolicyVersion = {
    id: versionId,
    policyId: policy.id,
    version: newVersionNumber,
    rules: JSON.parse(JSON.stringify(rules)),
    description: changeNote,
    createdAt: now,
    createdBy,
    changeNote,
    status: 'draft',
  };

  return {
    ...policy,
    versions: [...policy.versions, newVersion],
    currentVersionId: versionId,
    updatedAt: now,
  };
}

export function getCurrentVersion(policy: PolicyRecord): PolicyVersion | undefined {
  return policy.versions.find((v) => v.id === policy.currentVersionId);
}

export function getActiveVersion(policy: PolicyRecord): PolicyVersion | undefined {
  const active = policy.versions.filter((v) => v.status === 'active');
  if (active.length === 0) return undefined;
  return active.sort((a, b) => b.version - a.version)[0];
}

export function getVersion(policy: PolicyRecord, versionId: string): PolicyVersion | undefined {
  return policy.versions.find((v) => v.id === versionId);
}

export function transitionStatus(
  policy: PolicyRecord,
  versionId: string,
  newStatus: PolicyStatus,
  actor: string,
  note: string,
): PolicyRecord {
  const version = policy.versions.find((v) => v.id === versionId);
  if (!version) return policy;

  const oldStatus = version.status;
  const step: ApprovalStep = {
    id: generateId(),
    fromStatus: oldStatus,
    toStatus: newStatus,
    actor,
    timestamp: new Date().toISOString(),
    note,
  };

  return {
    ...policy,
    versions: policy.versions.map((v) =>
      v.id === versionId
        ? { ...v, status: newStatus }
        : v.status === 'active' && newStatus === 'active'
          ? { ...v, status: 'deprecated' as PolicyStatus }
          : v,
    ),
    approvalHistory: [...policy.approvalHistory, step],
    updatedAt: new Date().toISOString(),
  };
}

export function restoreVersion(
  policy: PolicyRecord,
  versionId: string,
  actor: string,
): PolicyRecord {
  const version = policy.versions.find((v) => v.id === versionId);
  if (!version) return policy;

  return createNewVersion(policy, version.rules, `Restored from version ${version.version}`, actor);
}

export function diffVersions(
  versionA: PolicyVersion,
  versionB: PolicyVersion,
): {
  added: PolicyRule[];
  removed: PolicyRule[];
  modified: Array<{ oldRule: PolicyRule; newRule: PolicyRule }>;
} {
  const rulesA = versionA.rules;
  const rulesB = versionB.rules;

  const added = rulesB.filter((b) => !rulesA.some((a) => a.id === b.id));
  const removed = rulesA.filter((a) => !rulesB.some((b) => b.id === a.id));
  const modified: Array<{ oldRule: PolicyRule; newRule: PolicyRule }> = [];

  for (const a of rulesA) {
    const b = rulesB.find((r) => r.id === a.id);
    if (b && JSON.stringify(a) !== JSON.stringify(b)) {
      modified.push({ oldRule: a, newRule: b });
    }
  }

  return { added, removed, modified };
}

export function countActivePolicies(policies: PolicyRecord[]): number {
  return policies.filter((p) => {
    const v = getCurrentVersion(p);
    return v?.status === 'active';
  }).length;
}

export function countPendingApprovals(policies: PolicyRecord[]): number {
  return policies.filter((p) => {
    const v = getCurrentVersion(p);
    return v?.status === 'in_review' || v?.status === 'draft';
  }).length;
}
