import type { PolicyRecord, AuditLogEntry } from '@/types/policy';
import { getSeedPolicies } from '@/engine/templates';

const POLICIES_KEY = 'policyforge_policies';
const AUDIT_KEY = 'policyforge_audit';
const THEME_KEY = 'policyforge_theme';
const CURRENT_USER_KEY = 'policyforge_current_user';

export const ROLES = ['Admin', 'Policy Author', 'Reviewer', 'Approver', 'Auditor'] as const;
export type Role = (typeof ROLES)[number];

export function loadPolicies(): PolicyRecord[] {
  try {
    const raw = localStorage.getItem(POLICIES_KEY);
    if (!raw) {
      const seeds = getSeedPolicies();
      savePolicies(seeds);
      return seeds;
    }
    return JSON.parse(raw) as PolicyRecord[];
  } catch {
    return getSeedPolicies();
  }
}

export function savePolicies(policies: PolicyRecord[]): void {
  localStorage.setItem(POLICIES_KEY, JSON.stringify(policies));
}

export function loadAuditLog(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AuditLogEntry[];
  } catch {
    return [];
  }
}

export function saveAuditLog(log: AuditLogEntry[]): void {
  localStorage.setItem(AUDIT_KEY, JSON.stringify(log));
}

export function loadTheme(): 'dark' | 'light' {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === 'dark' || raw === 'light') return raw;
  } catch {
    // ignore
  }
  return 'dark';
}

export function saveTheme(theme: 'dark' | 'light'): void {
  localStorage.setItem(THEME_KEY, theme);
}

export function loadCurrentUser(): Role {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (raw && ROLES.includes(raw as Role)) return raw as Role;
  } catch {
    // ignore
  }
  return 'Policy Author';
}

export function saveCurrentUser(role: Role): void {
  localStorage.setItem(CURRENT_USER_KEY, role);
}

export function addAuditEntry(
  log: AuditLogEntry[],
  entry: Omit<AuditLogEntry, 'id' | 'timestamp'>,
): AuditLogEntry[] {
  const newEntry: AuditLogEntry = {
    ...entry,
    id: Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
    timestamp: new Date().toISOString(),
  };
  const updated = [newEntry, ...log].slice(0, 500);
  saveAuditLog(updated);
  return updated;
}
