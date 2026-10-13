import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { PolicyRecord, AuditLogEntry } from '@/types/policy';
import {
  loadPolicies,
  savePolicies,
  loadAuditLog,
  addAuditEntry,
  loadCurrentUser,
  saveCurrentUser,
  type Role,
} from '@/lib/storage';

interface PolicyContextValue {
  policies: PolicyRecord[];
  auditLog: AuditLogEntry[];
  currentUser: Role;
  setCurrentUser: (role: Role) => void;
  upsertPolicy: (policy: PolicyRecord) => void;
  deletePolicy: (id: string) => void;
  getPolicy: (id: string) => PolicyRecord | undefined;
  logAction: (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => void;
  refresh: () => void;
}

const PolicyContext = createContext<PolicyContextValue | null>(null);

export function PolicyProvider({ children }: { children: ReactNode }) {
  const [policies, setPolicies] = useState<PolicyRecord[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [currentUser, setCurrentUserState] = useState<Role>('Policy Author');

  useEffect(() => {
    setPolicies(loadPolicies());
    setAuditLog(loadAuditLog());
    setCurrentUserState(loadCurrentUser());
  }, []);

  const upsertPolicy = useCallback((policy: PolicyRecord) => {
    setPolicies((prev) => {
      const idx = prev.findIndex((p) => p.id === policy.id);
      let updated: PolicyRecord[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = { ...policy, updatedAt: new Date().toISOString() };
      } else {
        updated = [...prev, policy];
      }
      savePolicies(updated);
      return updated;
    });
  }, []);

  const deletePolicy = useCallback((id: string) => {
    setPolicies((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      savePolicies(updated);
      return updated;
    });
  }, []);

  const getPolicy = useCallback(
    (id: string) => policies.find((p) => p.id === id),
    [policies],
  );

  const logAction = useCallback((entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => {
    setAuditLog((prev) => addAuditEntry(prev, entry));
  }, []);

  const setCurrentUser = useCallback((role: Role) => {
    setCurrentUserState(role);
    saveCurrentUser(role);
  }, []);

  const refresh = useCallback(() => {
    setPolicies(loadPolicies());
    setAuditLog(loadAuditLog());
  }, []);

  return (
    <PolicyContext.Provider
      value={{
        policies,
        auditLog,
        currentUser,
        setCurrentUser,
        upsertPolicy,
        deletePolicy,
        getPolicy,
        logAction,
        refresh,
      }}
    >
      {children}
    </PolicyContext.Provider>
  );
}

export function usePolicyContext(): PolicyContextValue {
  const ctx = useContext(PolicyContext);
  if (!ctx) throw new Error('usePolicyContext must be used within PolicyProvider');
  return ctx;
}
