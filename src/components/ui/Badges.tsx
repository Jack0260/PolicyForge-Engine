import { type ReactNode } from 'react';
import type { Decision, PolicyStatus } from '@/types/policy';

export function DecisionBadge({ decision }: { decision: Decision }) {
  const map: Record<Decision, string> = {
    ALLOW: 'badge-allow',
    DENY: 'badge-deny',
    AMBIGUOUS: 'badge-ambiguous',
    CONFLICT: 'badge-conflict',
  };
  return <span className={map[decision]}>{decision}</span>;
}

export function StatusBadge({ status }: { status: PolicyStatus }) {
  const map: Record<PolicyStatus, string> = {
    draft: 'badge-draft',
    in_review: 'badge-in_review',
    approved: 'badge-approved',
    active: 'badge-active',
    deprecated: 'badge-deprecated',
    archived: 'badge-archived',
  };
  const labels: Record<PolicyStatus, string> = {
    draft: 'Draft',
    in_review: 'In Review',
    approved: 'Approved',
    active: 'Active',
    deprecated: 'Deprecated',
    archived: 'Archived',
  };
  return <span className={map[status]}>{labels[status]}</span>;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center mb-4 text-gray-400 dark:text-slate-500">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-slate-400 max-w-sm mb-4">{description}</p>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{title}</h1>
        {description && <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  return (
    <div className={`animate-spin rounded-full border-2 border-gray-300 dark:border-slate-700 border-t-blue-600 ${sizes[size]}`} />
  );
}

export function StatCard({
  label,
  value,
  icon,
  trend,
  accent = 'blue',
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  trend?: string;
  accent?: 'blue' | 'emerald' | 'amber' | 'red' | 'slate';
}) {
  const accents: Record<string, string> = {
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40',
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40',
    red: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40',
    slate: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800',
  };
  return (
    <div className="card card-hover p-5 animate-slide-up">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">{label}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2 tracking-tight">{value}</p>
          {trend && <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{trend}</p>}
        </div>
        <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${accents[accent]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative card w-full ${maxWidth} max-h-[90vh] overflow-y-auto animate-scale-in`}>
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-md">
      <p className="text-sm text-gray-600 dark:text-slate-300 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button
          className={danger ? 'btn-danger' : 'btn-primary'}
          onClick={() => { onConfirm(); onClose(); }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function SeverityBadge({ severity }: { severity: 'high' | 'medium' | 'low' }) {
  const map = { high: 'badge-high', medium: 'badge-medium', low: 'badge-low' };
  return <span className={map[severity]}>{severity}</span>;
}

export function CategoryBadge({ category }: { category: string }) {
  return <span className="badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{category}</span>;
}
