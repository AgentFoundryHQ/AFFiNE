import { Tabs } from '@affine/component';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import {
  getFoundryOSProjectPath,
  getWorkspaceFoundryOSAdminPath,
  getWorkspaceFoundryOSCustomerPath,
  getWorkspaceFoundryOSProjectPath,
} from '../../route-paths';

const API_BASE_STORAGE_KEY = 'foundryos.apiBase';
const DEFAULT_LOCAL_API_BASE = 'http://127.0.0.1:8000';
const projectSections = [
  'overview',
  'content',
  'workflows',
  'observability',
  'runtime',
] as const;

type ProjectSection = (typeof projectSections)[number];
type JsonRecord = Record<string, any>;

type CustomerShellPayload = {
  shell: {
    shell_id: string;
    workspace_id: string;
    routes?: {
      foundryos?: {
        customer?: string;
        admin?: string;
      };
    };
  };
  projects: Array<
    JsonRecord & {
      project_id: string;
      display_name: string;
      description: string;
      routes?: {
        foundryos?: Partial<Record<ProjectSection, string>>;
      };
      affine_surface?: JsonRecord;
    }
  >;
  runtime: {
    summary: JsonRecord;
    items: JsonRecord[];
  };
  work: {
    active_workflows: JsonRecord[];
    pending_approvals: JsonRecord[];
  };
};

type AdminShellPayload = {
  shell: {
    shell_id: string;
    workspace_id: string;
    routes?: {
      foundryos?: {
        customer?: string;
        admin?: string;
      };
    };
  };
  runtime: {
    summary: JsonRecord;
    items: JsonRecord[];
  };
  queues: {
    approvals: JsonRecord[];
    workflows: JsonRecord[];
  };
  incidents: JsonRecord[];
  registry: {
    agents: JsonRecord[];
    containers: JsonRecord[];
    capabilities: JsonRecord[];
    ui_surfaces: JsonRecord[];
  };
};

type ProjectOverviewPayload = {
  project: JsonRecord;
};

type ProjectContentPayload = {
  project: JsonRecord;
  content_surface: JsonRecord;
  assets: JsonRecord[];
};

type ProjectActivityPayload = {
  project: JsonRecord;
  activity: {
    assets: JsonRecord[];
    actions: JsonRecord[];
    workflows: JsonRecord[];
    approvals: JsonRecord[];
    observability: JsonRecord[];
  };
};

type ProjectRuntimePayload = {
  project: JsonRecord;
  runtime_context: {
    capabilities: JsonRecord[];
    containers: JsonRecord[];
    agents: JsonRecord[];
  };
};

type FoundryOSState =
  | {
      kind: 'customer';
      customer: CustomerShellPayload;
    }
  | {
      kind: 'admin';
      admin: AdminShellPayload;
    }
  | {
      kind: 'project';
      customer: CustomerShellPayload;
      overview: ProjectOverviewPayload;
      content: ProjectContentPayload;
      activity: ProjectActivityPayload;
      runtime: ProjectRuntimePayload;
    };

declare global {
  interface Window {
    __FOUNDRYOS_API_BASE__?: string;
  }
}

function normalizeSection(value?: string): ProjectSection {
  if (!value) {
    return 'overview';
  }
  if ((projectSections as readonly string[]).includes(value)) {
    return value as ProjectSection;
  }
  if (value === 'activity') {
    return 'workflows';
  }
  return 'overview';
}

function resolveApiBase() {
  const currentUrl = new URL(window.location.href);
  const queryBase = currentUrl.searchParams.get('foundryos_api_base');
  if (queryBase) {
    localStorage.setItem(API_BASE_STORAGE_KEY, queryBase);
    return queryBase;
  }

  const injectedBase = window.__FOUNDRYOS_API_BASE__;
  if (injectedBase) {
    return injectedBase;
  }

  const storedBase = localStorage.getItem(API_BASE_STORAGE_KEY);
  if (storedBase) {
    return storedBase;
  }

  if (window.location.port === '8080') {
    return '/foundryos-api';
  }

  if (window.location.port === '8000') {
    return '';
  }

  return DEFAULT_LOCAL_API_BASE;
}

function buildApiUrl(path: string) {
  const base = resolveApiBase();
  if (!base) {
    return path;
  }
  if (base.startsWith('http://') || base.startsWith('https://')) {
    return new URL(path, `${base.replace(/\/$/, '')}/`).toString();
  }
  return `${base.replace(/\/$/, '')}${path}`;
}

async function api<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    signal,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function getCustomerPath(workspaceId?: string) {
  return workspaceId
    ? getWorkspaceFoundryOSCustomerPath(workspaceId)
    : '/foundryos/customer';
}

function getAdminPath(workspaceId?: string) {
  return workspaceId
    ? getWorkspaceFoundryOSAdminPath(workspaceId)
    : '/foundryos/admin';
}

function getProjectPath(
  projectId: string,
  section: string,
  workspaceId?: string
) {
  return workspaceId
    ? getWorkspaceFoundryOSProjectPath(workspaceId, projectId, section)
    : getFoundryOSProjectPath(projectId, section);
}

function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, match => match.toUpperCase());
}

function fieldValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return 'n/a';
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  return JSON.stringify(value);
}

function formatCount(value: unknown) {
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  return fieldValue(value);
}

function formatDate(value: unknown) {
  if (typeof value !== 'string') {
    return fieldValue(value);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function formatBytes(value: unknown) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fieldValue(value);
  }
  if (value < 1024) {
    return `${value} B`;
  }
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function statusTone(status: unknown) {
  const normalized = String(status ?? 'unknown').toLowerCase();
  if (
    [
      'running',
      'active',
      'healthy',
      'ok',
      'stored',
      'completed',
      'ready',
    ].includes(normalized)
  ) {
    return {
      dot: '#067647',
      text: '#067647',
      border: 'rgba(6, 118, 71, 0.18)',
      background: 'rgba(6, 118, 71, 0.08)',
    };
  }
  if (
    ['planned', 'queued', 'pending', 'approval_required'].includes(normalized)
  ) {
    return {
      dot: '#b54708',
      text: '#b54708',
      border: 'rgba(181, 71, 8, 0.18)',
      background: 'rgba(181, 71, 8, 0.08)',
    };
  }
  if (['failed', 'error', 'degraded', 'denied'].includes(normalized)) {
    return {
      dot: '#b42318',
      text: '#b42318',
      border: 'rgba(180, 35, 24, 0.18)',
      background: 'rgba(180, 35, 24, 0.08)',
    };
  }
  return {
    dot: '#667085',
    text: '#475467',
    border: 'rgba(71, 84, 103, 0.16)',
    background: 'rgba(71, 84, 103, 0.08)',
  };
}

function accentForKind(kind: string) {
  const normalized = kind.toLowerCase();
  if (normalized.includes('image')) {
    return 'linear-gradient(135deg, rgba(99, 102, 241, 0.9), rgba(59, 130, 246, 0.75))';
  }
  if (normalized.includes('spreadsheet') || normalized.includes('excel')) {
    return 'linear-gradient(135deg, rgba(5, 150, 105, 0.9), rgba(16, 185, 129, 0.75))';
  }
  if (normalized.includes('video')) {
    return 'linear-gradient(135deg, rgba(219, 39, 119, 0.9), rgba(249, 115, 22, 0.75))';
  }
  if (normalized.includes('text')) {
    return 'linear-gradient(135deg, rgba(99, 102, 241, 0.9), rgba(168, 85, 247, 0.75))';
  }
  return 'linear-gradient(135deg, rgba(31, 111, 255, 0.9), rgba(44, 188, 242, 0.75))';
}

function readString(item: JsonRecord, keys: string[], fallback = 'n/a') {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return fallback;
}

function readArray(item: JsonRecord, key: string) {
  const value = item[key];
  return Array.isArray(value) ? value : [];
}

function recordId(item: JsonRecord, fallback: string) {
  return String(
    item.project_id ??
      item.asset_id ??
      item.workflow_run_id ??
      item.decision_id ??
      item.record_id ??
      item.action_id ??
      item.runtime_id ??
      item.agent_id ??
      item.container_id ??
      item.capability_id ??
      fallback
  );
}

// ─── Dot indicator ───────────────────────────────────────────────────────────

function StatusDot({ status }: { status: unknown }) {
  const tone = statusTone(status);
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: tone.dot,
        flexShrink: 0,
      }}
    />
  );
}

// ─── Badge ───────────────────────────────────────────────────────────────────

function StatusBadge({ label }: { label: unknown }) {
  const tone = statusTone(label);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: 24,
        padding: '0 10px',
        borderRadius: 999,
        border: `1px solid ${tone.border}`,
        background: tone.background,
        color: tone.text,
        fontWeight: 600,
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
    >
      <StatusDot status={label} />
      {fieldValue(label)}
    </span>
  );
}

// ─── Stat chip ───────────────────────────────────────────────────────────────

function StatChip({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: unknown;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: 12,
        border: accent
          ? '1px solid rgba(31, 111, 255, 0.20)'
          : '1px solid var(--affine-border-color, rgba(16,24,40,0.08))',
        background: accent
          ? 'rgba(31, 111, 255, 0.06)'
          : 'var(--affine-background-primary-color, #fff)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        minWidth: 96,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--affine-text-secondary-color, #667085)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          color: accent
            ? '#1f6fff'
            : 'var(--affine-text-primary-color, #101828)',
        }}
      >
        {formatCount(value)}
      </div>
    </div>
  );
}

// ─── Mini stat pill ───────────────────────────────────────────────────────────

function MiniStat({ label, value }: { label: string; value: unknown }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 24,
        padding: '0 8px',
        borderRadius: 6,
        background: 'rgba(16, 24, 40, 0.04)',
        fontSize: 12,
        color: '#344054',
        fontWeight: 400,
        gap: 4,
      }}
    >
      <span style={{ color: 'var(--affine-text-secondary-color, #667085)' }}>
        {label}
      </span>
      <span style={{ fontWeight: 600 }}>{formatCount(value)}</span>
    </span>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: '20px 16px',
        borderRadius: 8,
        border: '1px dashed rgba(16, 24, 40, 0.12)',
        color: 'var(--affine-text-secondary-color, #667085)',
        background: 'rgba(248, 250, 252, 0.8)',
        fontSize: 13,
      }}
    >
      {message}
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <>
      <style>{`
        @keyframes foundry-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
        .foundry-skeleton {
          animation: foundry-pulse 1.6s ease-in-out infinite;
          border-radius: 8px;
          background: rgba(16, 24, 40, 0.07);
        }
      `}</style>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          {[96, 96, 96, 96].map((w, i) => (
            <div
              key={i}
              className="foundry-skeleton"
              style={{ width: w, height: 72 }}
            />
          ))}
        </div>
        <div className="foundry-skeleton" style={{ height: 180 }} />
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}
        >
          <div className="foundry-skeleton" style={{ height: 120 }} />
          <div className="foundry-skeleton" style={{ height: 120 }} />
        </div>
      </div>
    </>
  );
}

// ─── Error banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ error, pathname }: { error: string; pathname: string }) {
  return (
    <div
      style={{
        borderRadius: 12,
        border: '1px solid rgba(180, 35, 24, 0.20)',
        background: 'rgba(180, 35, 24, 0.05)',
        padding: '16px 20px',
        display: 'grid',
        gap: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontWeight: 700,
          color: '#b42318',
          fontSize: 14,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 1.5L1 14h14L8 1.5z"
            stroke="#b42318"
            strokeWidth="1.5"
            fill="none"
            strokeLinejoin="round"
          />
          <path
            d="M8 6v4M8 11.5v.5"
            stroke="#b42318"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        Backend request failed
      </div>
      <div style={{ fontSize: 13, color: '#b42318', opacity: 0.85 }}>
        {error}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 12,
          color: 'var(--affine-text-secondary-color, #667085)',
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <span>Route: {pathname}</span>
        <span>API: {resolveApiBase()}</span>
      </div>
    </div>
  );
}

// ─── KeyValueGrid ─────────────────────────────────────────────────────────────

function KeyValueGrid({ items }: { items: Array<[string, unknown]> }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 10,
      }}
    >
      {items.map(([label, value]) => (
        <div
          key={label}
          style={{
            padding: 12,
            borderRadius: 8,
            background: 'var(--affine-background-secondary-color, #f7f8fb)',
            border:
              '1px solid var(--affine-border-color, rgba(16, 24, 40, 0.06))',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--affine-text-secondary-color, #667085)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: 5,
            }}
          >
            {titleCase(label)}
          </div>
          <div
            style={{ fontWeight: 600, wordBreak: 'break-word', fontSize: 13 }}
          >
            {fieldValue(value)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Top bar ──────────────────────────────────────────────────────────────────

function TopBar({
  customerPath,
  adminPath,
  pathname,
  workspaceId,
}: {
  customerPath: string;
  adminPath: string;
  pathname: string;
  workspaceId?: string;
}) {
  const isAdmin =
    pathname.startsWith('/foundryos/admin') ||
    pathname.includes('/foundryos/admin');

  return (
    <div
      style={{
        height: 48,
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        borderBottom:
          '1px solid var(--affine-border-color, rgba(16,24,40,0.08))',
        background: 'var(--affine-background-primary-color, #fff)',
        paddingLeft: 20,
        paddingRight: 16,
        flexShrink: 0,
      }}
    >
      {/* Wordmark */}
      <span
        style={{
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: '-0.01em',
          color: 'var(--affine-text-primary-color, #101828)',
          marginRight: 12,
        }}
      >
        FoundryOS
      </span>

      {/* Nav pills */}
      <div style={{ display: 'flex', gap: 4, flex: 1 }}>
        <Link
          to={customerPath}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            height: 30,
            padding: '0 12px',
            borderRadius: 999,
            textDecoration: 'none',
            fontSize: 13,
            fontWeight: 600,
            background: !isAdmin ? 'rgba(31, 111, 255, 0.10)' : 'transparent',
            color: !isAdmin
              ? '#1f6fff'
              : 'var(--affine-text-secondary-color, #667085)',
            border: !isAdmin
              ? '1px solid rgba(31, 111, 255, 0.20)'
              : '1px solid transparent',
          }}
        >
          Customer
        </Link>
        <Link
          to={adminPath}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            height: 30,
            padding: '0 12px',
            borderRadius: 999,
            textDecoration: 'none',
            fontSize: 13,
            fontWeight: 600,
            background: isAdmin ? 'rgba(31, 111, 255, 0.10)' : 'transparent',
            color: isAdmin
              ? '#1f6fff'
              : 'var(--affine-text-secondary-color, #667085)',
            border: isAdmin
              ? '1px solid rgba(31, 111, 255, 0.20)'
              : '1px solid transparent',
          }}
        >
          Admin
        </Link>
      </div>

      {/* Right side: workspace indicator */}
      {workspaceId ? (
        <span
          style={{
            fontSize: 11,
            color: 'var(--affine-text-secondary-color, #667085)',
            padding: '0 8px',
            borderRadius: 6,
            background: 'var(--affine-background-secondary-color, #f7f8fb)',
            border: '1px solid var(--affine-border-color, rgba(16,24,40,0.08))',
            maxWidth: 160,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: '24px',
          }}
          title={workspaceId}
        >
          {workspaceId.slice(0, 8)}…
        </span>
      ) : null}
    </div>
  );
}

// ─── Runtime health pills (compact inline) ───────────────────────────────────

function RuntimeHealthPills({ items }: { items: JsonRecord[] }) {
  if (!items.length) {
    return (
      <div
        style={{
          fontSize: 13,
          color: 'var(--affine-text-secondary-color, #667085)',
        }}
      >
        No runtime health records.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {items.map((runtime, index) => {
        const tone = statusTone(runtime.status);
        const name = readString(runtime, ['display_name', 'runtime_id']);
        return (
          <span
            key={recordId(runtime, `runtime-${index}`)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 28,
              padding: '0 10px',
              borderRadius: 999,
              border: `1px solid ${tone.border}`,
              background: tone.background,
              color: tone.text,
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            <StatusDot status={runtime.status} />
            {name}
          </span>
        );
      })}
    </div>
  );
}

// ─── Runtime health grid (detailed, for admin / project runtime tab) ──────────

function RuntimeHealthGrid({ items }: { items: JsonRecord[] }) {
  if (!items.length) {
    return <EmptyState message="No runtime health records." />;
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 12,
      }}
    >
      {items.map((runtime, index) => (
        <div
          key={recordId(runtime, `runtime-${index}`)}
          style={{
            padding: 16,
            borderRadius: 12,
            border:
              '1px solid var(--affine-border-color, rgba(16, 24, 40, 0.08))',
            background: 'var(--affine-background-secondary-color, #fafbfc)',
            display: 'grid',
            gap: 10,
            boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 10,
              alignItems: 'start',
            }}
          >
            <div style={{ display: 'grid', gap: 4 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>
                {readString(runtime, ['display_name', 'runtime_id'])}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--affine-text-secondary-color, #667085)',
                }}
              >
                {readString(runtime, ['foundry_ref', 'container_id'])}
              </div>
            </div>
            <StatusBadge label={runtime.status} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <MiniStat
              label="Latency"
              value={
                runtime.latency_ms == null ? 'n/a' : `${runtime.latency_ms} ms`
              }
            />
            <MiniStat label="Checked" value={formatDate(runtime.checked_at)} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Project card ─────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  workspaceId,
}: {
  project: CustomerShellPayload['projects'][number];
  workspaceId?: string;
}) {
  const overviewPath = workspaceId
    ? getProjectPath(project.project_id, 'overview', workspaceId)
    : (project.routes?.foundryos?.overview ??
      getProjectPath(project.project_id, 'overview'));

  return (
    <Link
      to={overviewPath}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <div
        style={{
          borderRadius: 12,
          padding: 16,
          background: 'var(--affine-background-primary-color, #fff)',
          border:
            '1px solid var(--affine-border-color, rgba(16, 24, 40, 0.08))',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
          display: 'grid',
          gap: 12,
          cursor: 'pointer',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: 'var(--affine-text-primary-color, #101828)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {project.display_name}
            </div>
            <div
              style={
                {
                  fontSize: 12,
                  color: 'var(--affine-text-secondary-color, #667085)',
                  lineHeight: 1.5,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                } as CSSProperties
              }
            >
              {project.description || 'No description.'}
            </div>
          </div>
          <StatusBadge label={project.status} />
        </div>

        {/* Mini stats row */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <MiniStat label="assets" value={project.asset_count ?? 0} />
          <MiniStat label="services" value={project.runtime_count ?? 0} />
          {project.capability_count != null ? (
            <MiniStat label="capabilities" value={project.capability_count} />
          ) : null}
        </div>

        {/* Open CTA */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 12,
            fontWeight: 600,
            color: '#1f6fff',
          }}
        >
          Open
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 6h7M6.5 3l3 3-3 3"
              stroke="#1f6fff"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </Link>
  );
}

// ─── Project nav sidebar ──────────────────────────────────────────────────────

function ProjectNav({
  projects,
  selectedProjectId,
  workspaceId,
}: {
  projects: CustomerShellPayload['projects'];
  selectedProjectId?: string;
  workspaceId?: string;
}) {
  if (!projects.length) {
    return null;
  }

  return (
    <div
      style={{
        display: 'grid',
        gap: 6,
        padding: '12px 8px',
        borderRight:
          '1px solid var(--affine-border-color, rgba(16,24,40,0.08))',
        alignContent: 'start',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--affine-text-secondary-color, #667085)',
          padding: '0 8px',
          marginBottom: 4,
        }}
      >
        Projects
      </div>
      {projects.map(project => {
        const selected = selectedProjectId === project.project_id;
        const tone = statusTone(project.status);
        return (
          <Link
            key={project.project_id}
            to={
              workspaceId
                ? getProjectPath(project.project_id, 'overview', workspaceId)
                : (project.routes?.foundryos?.overview ??
                  getProjectPath(project.project_id, 'overview'))
            }
            style={{
              textDecoration: 'none',
              color: selected
                ? '#1f6fff'
                : 'var(--affine-text-primary-color, #101828)',
              padding: '7px 10px',
              borderRadius: 8,
              background: selected ? 'rgba(31, 111, 255, 0.08)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              fontSize: 13,
              fontWeight: selected ? 600 : 400,
              border: selected
                ? '1px solid rgba(31, 111, 255, 0.16)'
                : '1px solid transparent',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: tone.dot,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {project.display_name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

// ─── Record stack (workflows / observability etc.) ────────────────────────────

const EMPTY_STRING_ARRAY: string[] = [];
const EMPTY_META_BUILDERS: Array<{
  label: string;
  value: (item: JsonRecord) => unknown;
}> = [];

function RecordStack({
  items,
  emptyMessage,
  titleKeyCandidates,
  subtitleKeyCandidates = EMPTY_STRING_ARRAY,
  statusKeyCandidates = EMPTY_STRING_ARRAY,
  metaBuilders = EMPTY_META_BUILDERS,
}: {
  items: JsonRecord[];
  emptyMessage: string;
  titleKeyCandidates: string[];
  subtitleKeyCandidates?: string[];
  statusKeyCandidates?: string[];
  metaBuilders?: Array<{ label: string; value: (item: JsonRecord) => unknown }>;
}) {
  if (!items.length) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {items.map((item, index) => {
        const title = readString(
          item,
          titleKeyCandidates,
          `Record ${index + 1}`
        );
        const subtitle = readString(item, subtitleKeyCandidates, '');
        const status =
          statusKeyCandidates
            .map(key => item[key])
            .find(
              value => value !== undefined && value !== null && value !== ''
            ) ?? item.result?.status;
        return (
          <div
            key={recordId(item, `record-${index}`)}
            style={{
              border:
                '1px solid var(--affine-border-color, rgba(16, 24, 40, 0.08))',
              borderRadius: 10,
              padding: 14,
              background: 'var(--affine-background-secondary-color, #fafbfc)',
              display: 'grid',
              gap: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 10,
                justifyContent: 'space-between',
                alignItems: 'start',
              }}
            >
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{title}</div>
                {subtitle ? (
                  <div
                    style={{
                      color: 'var(--affine-text-secondary-color, #667085)',
                      fontSize: 12,
                    }}
                  >
                    {subtitle}
                  </div>
                ) : null}
              </div>
              {status ? <StatusBadge label={status} /> : null}
            </div>
            {metaBuilders.length > 0 ? (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {metaBuilders.map(meta => (
                  <MiniStat
                    key={meta.label}
                    label={meta.label}
                    value={meta.value(item)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ─── Asset explorer ───────────────────────────────────────────────────────────

function AssetExplorer({
  assets,
  contentSurface,
}: {
  assets: JsonRecord[];
  contentSurface: JsonRecord;
}) {
  const [query, setQuery] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(
    assets[0]?.asset_id ?? null
  );

  const filteredAssets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return assets;
    }
    return assets.filter(asset => {
      return [
        asset.filename,
        asset.asset_id,
        asset.mime_type,
        asset.scope,
        asset.project_ref,
      ]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(normalized));
    });
  }, [assets, query]);

  useEffect(() => {
    if (!filteredAssets.some(asset => asset.asset_id === selectedAssetId)) {
      setSelectedAssetId(filteredAssets[0]?.asset_id ?? null);
    }
  }, [filteredAssets, selectedAssetId]);

  const selectedAsset =
    filteredAssets.find(asset => asset.asset_id === selectedAssetId) ??
    filteredAssets[0] ??
    null;
  const assetKind = selectedAsset
    ? readString(selectedAsset, ['mime_type', 'asset_type'], 'file')
    : 'file';

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '300px minmax(0, 1fr)',
          gap: 16,
        }}
      >
        {/* Left: search + list */}
        <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search assets…"
            style={{
              width: '100%',
              minHeight: 36,
              borderRadius: 8,
              border:
                '1px solid var(--affine-border-color, rgba(16, 24, 40, 0.12))',
              padding: '0 12px',
              background: 'var(--affine-background-primary-color, #fff)',
              outline: 'none',
              fontSize: 13,
              boxSizing: 'border-box',
            }}
          />
          <div
            style={{
              display: 'grid',
              gap: 8,
              maxHeight: 520,
              overflow: 'auto',
              paddingRight: 4,
            }}
          >
            {filteredAssets.length ? (
              filteredAssets.map((asset, index) => {
                const selected = asset.asset_id === selectedAsset?.asset_id;
                return (
                  <button
                    key={recordId(asset, `asset-${index}`)}
                    type="button"
                    onClick={() => setSelectedAssetId(asset.asset_id as string)}
                    style={{
                      textAlign: 'left',
                      border: selected
                        ? '1px solid rgba(31, 111, 255, 0.28)'
                        : '1px solid var(--affine-border-color, rgba(16, 24, 40, 0.08))',
                      background: selected
                        ? 'rgba(31, 111, 255, 0.06)'
                        : 'var(--affine-background-secondary-color, #fafbfc)',
                      borderRadius: 10,
                      padding: 12,
                      display: 'grid',
                      gap: 6,
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 8,
                        alignItems: 'start',
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          lineHeight: 1.4,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                        }}
                      >
                        {readString(asset, ['filename', 'asset_id'])}
                      </div>
                      <StatusBadge label="Stored" />
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--affine-text-secondary-color, #667085)',
                      }}
                    >
                      {readString(asset, ['mime_type', 'asset_type'])}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <MiniStat
                        label="Size"
                        value={formatBytes(asset.size_bytes)}
                      />
                      <MiniStat label="Scope" value={asset.scope} />
                    </div>
                  </button>
                );
              })
            ) : (
              <EmptyState message="No assets match the current filter." />
            )}
          </div>
        </div>

        {/* Right: detail panel */}
        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          {selectedAsset ? (
            <>
              <div
                style={{
                  borderRadius: 12,
                  padding: 20,
                  minHeight: 160,
                  background: accentForKind(assetKind),
                  color: '#fff',
                  display: 'grid',
                  gap: 10,
                  alignContent: 'space-between',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      opacity: 0.82,
                      marginBottom: 6,
                    }}
                  >
                    Selected Asset
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      lineHeight: 1.1,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {readString(selectedAsset, ['filename', 'asset_id'])}
                  </div>
                  <div
                    style={{
                      color: 'rgba(255,255,255,0.80)',
                      fontSize: 13,
                      marginTop: 4,
                    }}
                  >
                    {readString(selectedAsset, ['mime_type', 'asset_type'])}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    formatBytes(selectedAsset.size_bytes),
                    readString(selectedAsset, ['scope']),
                    formatDate(selectedAsset.created_at),
                  ].map((v, i) => (
                    <span
                      key={i}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 999,
                        background: 'rgba(255,255,255,0.15)',
                        fontSize: 12,
                      }}
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </div>
              <div
                style={{
                  borderRadius: 12,
                  border:
                    '1px solid var(--affine-border-color, rgba(16, 24, 40, 0.08))',
                  padding: 16,
                  background: 'var(--affine-background-primary-color, #fff)',
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    marginBottom: 12,
                    color: 'var(--affine-text-secondary-color, #667085)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Asset Details
                </div>
                <KeyValueGrid
                  items={[
                    ['asset_id', selectedAsset.asset_id],
                    ['project_ref', selectedAsset.project_ref],
                    ['mime_type', selectedAsset.mime_type],
                    ['size_bytes', formatBytes(selectedAsset.size_bytes)],
                    ['created_at', formatDate(selectedAsset.created_at)],
                    ['content_hash', selectedAsset.content_hash],
                  ]}
                />
              </div>
            </>
          ) : (
            <EmptyState message="This project does not have any assets yet." />
          )}

          <div
            style={{
              borderRadius: 12,
              border:
                '1px solid var(--affine-border-color, rgba(16, 24, 40, 0.08))',
              padding: 16,
              background: 'var(--affine-background-primary-color, #fff)',
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 12,
                color: 'var(--affine-text-secondary-color, #667085)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Content Boundary
            </div>
            <KeyValueGrid
              items={[
                ['provider', contentSurface.provider],
                ['mode', contentSurface.mode],
                ['status', contentSurface.status],
                ['workspace_id', contentSurface.workspace_id],
                [
                  'authoritative_state_owner',
                  contentSurface.authoritative_state_owner,
                ],
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Runtime catalog ──────────────────────────────────────────────────────────

function RuntimeCatalog({
  title,
  items,
  titleKeys,
  subtitleKeys,
  metaKeys,
}: {
  title: string;
  items: JsonRecord[];
  titleKeys: string[];
  subtitleKeys: string[];
  metaKeys: string[];
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 10,
          color: 'var(--affine-text-secondary-color, #667085)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {title}
      </div>
      {items.length ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map((item, index) => (
            <div
              key={recordId(item, `${title}-${index}`)}
              style={{
                borderRadius: 10,
                border:
                  '1px solid var(--affine-border-color, rgba(16, 24, 40, 0.08))',
                background: 'var(--affine-background-secondary-color, #fafbfc)',
                padding: 12,
                display: 'grid',
                gap: 8,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 8,
                  alignItems: 'start',
                }}
              >
                <div style={{ display: 'grid', gap: 3 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {readString(item, titleKeys)}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--affine-text-secondary-color, #667085)',
                    }}
                  >
                    {readString(item, subtitleKeys)}
                  </div>
                </div>
                <StatusBadge label={item.status ?? 'active'} />
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {metaKeys.map(key => (
                  <MiniStat
                    key={key}
                    label={titleCase(key)}
                    value={item[key]}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          message={`No ${title.toLowerCase()} attached to this project.`}
        />
      )}
    </div>
  );
}

// ─── Notes list ───────────────────────────────────────────────────────────────

function NotesList({ notes }: { notes: string[] }) {
  if (!notes.length) {
    return <EmptyState message="No implementation notes recorded." />;
  }
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {notes.map((note, index) => (
        <div
          key={`${note}-${index}`}
          style={{
            borderRadius: 8,
            background: 'var(--affine-background-secondary-color, #fafbfc)',
            border:
              '1px solid var(--affine-border-color, rgba(16, 24, 40, 0.06))',
            padding: 14,
            lineHeight: 1.6,
            fontSize: 13,
          }}
        >
          {note}
        </div>
      ))}
    </div>
  );
}

// ─── Work queue section (compact) ────────────────────────────────────────────

function WorkQueueSection({
  title,
  items,
  emptyMessage,
  summaryKeys,
}: {
  title: string;
  items: JsonRecord[];
  emptyMessage: string;
  summaryKeys: string[];
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          marginBottom: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {title}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 20,
            height: 20,
            borderRadius: 999,
            background: 'rgba(16, 24, 40, 0.06)',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--affine-text-secondary-color, #667085)',
          }}
        >
          {items.length}
        </span>
      </div>
      {!items.length ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {items.map((item, index) => (
            <div
              key={recordId(item, `${title}-${index}`)}
              style={{
                padding: 12,
                borderRadius: 10,
                background: 'var(--affine-background-secondary-color, #f8fafc)',
                border:
                  '1px solid var(--affine-border-color, rgba(16, 24, 40, 0.06))',
                display: 'grid',
                gap: 8,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 10,
                  alignItems: 'start',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>
                  {readString(
                    item,
                    [
                      'display_name',
                      'workflow_id',
                      'requested_action',
                      'decision_id',
                      'record_id',
                    ],
                    'Untitled record'
                  )}
                </div>
                <StatusBadge
                  label={item.status ?? item.result?.status ?? 'active'}
                />
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {summaryKeys.map(key => (
                  <MiniStat
                    key={key}
                    label={titleCase(key)}
                    value={item[key]}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Customer view ────────────────────────────────────────────────────────────

function CustomerView({
  customer,
  workspaceId,
}: {
  customer: CustomerShellPayload;
  workspaceId?: string;
}) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Stat chips row */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatChip label="Projects" value={customer.projects.length} accent />
        <StatChip
          label="Workflows"
          value={customer.work.active_workflows.length}
        />
        <StatChip
          label="Approvals"
          value={customer.work.pending_approvals.length}
        />
        <StatChip label="Services" value={customer.runtime.items.length} />
      </div>

      {/* Projects section */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <div
            style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}
          >
            Projects
          </div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              height: 30,
              padding: '0 12px',
              borderRadius: 8,
              border:
                '1px solid var(--affine-border-color, rgba(16,24,40,0.10))',
              background: 'var(--affine-background-primary-color, #fff)',
              fontSize: 12,
              fontWeight: 600,
              color: '#1f6fff',
              cursor: 'default',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M6 1v10M1 6h10"
                stroke="#1f6fff"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            New
          </span>
        </div>
        {customer.projects.length ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 12,
            }}
          >
            {customer.projects.map(project => (
              <ProjectCard
                key={project.project_id}
                project={project}
                workspaceId={workspaceId}
              />
            ))}
          </div>
        ) : (
          <EmptyState message="No projects in this workspace yet." />
        )}
      </div>

      {/* Runtime health section */}
      <div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            marginBottom: 12,
          }}
        >
          Runtime Health
        </div>
        <RuntimeHealthPills items={customer.runtime.items} />
      </div>
    </div>
  );
}

// ─── Admin view ───────────────────────────────────────────────────────────────

function AdminView({
  admin,
  workspaceId,
}: {
  admin: AdminShellPayload;
  workspaceId?: string;
}) {
  const running = admin.runtime.items.filter(
    i => String(i.status ?? '').toLowerCase() === 'running'
  ).length;
  const degraded = admin.runtime.items.filter(
    i => String(i.status ?? '').toLowerCase() === 'degraded'
  ).length;
  const planned = admin.runtime.items.filter(
    i => String(i.status ?? '').toLowerCase() === 'planned'
  ).length;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Admin header strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 16px',
          borderRadius: 12,
          background: 'var(--affine-background-primary-color, #fff)',
          border: '1px solid var(--affine-border-color, rgba(16,24,40,0.08))',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 15 }}>FoundryOS Admin</span>
        <Link
          to={
            workspaceId ? getCustomerPath(workspaceId) : '/foundryos/customer'
          }
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            height: 28,
            padding: '0 12px',
            borderRadius: 8,
            textDecoration: 'none',
            fontSize: 12,
            fontWeight: 600,
            color: '#1f6fff',
            border: '1px solid rgba(31, 111, 255, 0.20)',
            background: 'rgba(31, 111, 255, 0.06)',
          }}
        >
          Customer
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 6h7M6.5 3l3 3-3 3"
              stroke="#1f6fff"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>

      {/* Two-column layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          alignItems: 'start',
        }}
      >
        {/* System health */}
        <div
          style={{
            borderRadius: 12,
            border: '1px solid var(--affine-border-color, rgba(16,24,40,0.08))',
            padding: 16,
            background: 'var(--affine-background-primary-color, #fff)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
            System Health
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              marginBottom: 14,
            }}
          >
            {[
              { label: `${running} running`, status: 'running' },
              { label: `${degraded} degraded`, status: 'degraded' },
              { label: `${planned} planned`, status: 'planned' },
            ].map(({ label, status }) => {
              const tone = statusTone(status);
              return (
                <div
                  key={status}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 13,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: tone.dot,
                      flexShrink: 0,
                    }}
                  />
                  {label}
                </div>
              );
            })}
          </div>
          <RuntimeHealthGrid items={admin.runtime.items} />
        </div>

        {/* Queues column */}
        <div style={{ display: 'grid', gap: 16 }}>
          <div
            style={{
              borderRadius: 12,
              border:
                '1px solid var(--affine-border-color, rgba(16,24,40,0.08))',
              padding: 16,
              background: 'var(--affine-background-primary-color, #fff)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            <WorkQueueSection
              title="Pending Approvals"
              items={admin.queues.approvals}
              emptyMessage="No approvals are waiting."
              summaryKeys={['timestamp']}
            />
          </div>
          <div
            style={{
              borderRadius: 12,
              border:
                '1px solid var(--affine-border-color, rgba(16,24,40,0.08))',
              padding: 16,
              background: 'var(--affine-background-primary-color, #fff)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            <WorkQueueSection
              title="Active Workflows"
              items={admin.queues.workflows}
              emptyMessage="No workflows are queued."
              summaryKeys={['status', 'created_at']}
            />
          </div>
        </div>
      </div>

      {/* Registry */}
      <div
        style={{
          borderRadius: 12,
          border: '1px solid var(--affine-border-color, rgba(16,24,40,0.08))',
          padding: 16,
          background: 'var(--affine-background-primary-color, #fff)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
          Registry
        </div>
        {/* Tabs header */}
        <div
          style={{
            display: 'flex',
            gap: 16,
            marginBottom: 14,
            borderBottom:
              '1px solid var(--affine-border-color, rgba(16,24,40,0.08))',
            paddingBottom: 10,
          }}
        >
          {[
            { label: 'Agents', count: admin.registry.agents.length },
            { label: 'Containers', count: admin.registry.containers.length },
            {
              label: 'Capabilities',
              count: admin.registry.capabilities.length,
            },
          ].map(({ label, count }) => (
            <span
              key={label}
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--affine-text-primary-color, #101828)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {label}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 20,
                  height: 20,
                  borderRadius: 999,
                  background: 'rgba(31, 111, 255, 0.10)',
                  color: '#1f6fff',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {count}
              </span>
            </span>
          ))}
        </div>
        {/* Compact table rows */}
        <div style={{ display: 'grid', gap: 8 }}>
          {[
            ...admin.registry.agents,
            ...admin.registry.containers,
            ...admin.registry.capabilities,
          ].map((item, index) => (
            <div
              key={recordId(item, `reg-${index}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '8px 12px',
                borderRadius: 8,
                background: 'var(--affine-background-secondary-color, #f7f8fb)',
                border:
                  '1px solid var(--affine-border-color, rgba(16,24,40,0.06))',
                fontSize: 13,
              }}
            >
              <StatusDot status={item.status ?? 'active'} />
              <span style={{ fontWeight: 600, flex: 1 }}>
                {readString(item, [
                  'display_name',
                  'agent_id',
                  'container_id',
                  'capability_id',
                ])}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--affine-text-secondary-color, #667085)',
                }}
              >
                {readString(item, [
                  'foundry_ref',
                  'runtime_id',
                  'provider_ref',
                ])}
              </span>
              <StatusBadge label={item.status ?? 'active'} />
            </div>
          ))}
          {!admin.registry.agents.length &&
          !admin.registry.containers.length &&
          !admin.registry.capabilities.length ? (
            <EmptyState message="No registry items found." />
          ) : null}
        </div>
      </div>

      {/* Incidents */}
      {admin.incidents.length > 0 ? (
        <div
          style={{
            borderRadius: 12,
            border: '1px solid rgba(180, 35, 24, 0.16)',
            padding: 16,
            background: 'rgba(180, 35, 24, 0.03)',
          }}
        >
          <WorkQueueSection
            title="Incidents"
            items={admin.incidents}
            emptyMessage="No incidents recorded."
            summaryKeys={['timestamp', 'status']}
          />
        </div>
      ) : null}
    </div>
  );
}

// ─── Project view ─────────────────────────────────────────────────────────────

function ProjectView({
  customer,
  overview,
  content,
  activity,
  runtime,
  section,
  workspaceId,
}: {
  customer: CustomerShellPayload;
  overview: ProjectOverviewPayload;
  content: ProjectContentPayload;
  activity: ProjectActivityPayload;
  runtime: ProjectRuntimePayload;
  section: ProjectSection;
  workspaceId?: string;
}) {
  const navigate = useNavigate();
  const currentProject = useMemo(
    () =>
      customer.projects.find(
        project => project.project_id === overview.project.project_id
      ),
    [customer.projects, overview.project.project_id]
  );
  const contentSurface = content.content_surface ?? {};

  const customerPath = workspaceId
    ? getCustomerPath(workspaceId)
    : (customer.shell.routes?.foundryos?.customer ?? getCustomerPath());

  return (
    <div style={{ display: 'grid', gap: 0 }}>
      {/* Project header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 0 14px',
          borderBottom:
            '1px solid var(--affine-border-color, rgba(16,24,40,0.08))',
          marginBottom: 16,
        }}
      >
        {/* Back */}
        <Link
          to={customerPath}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            textDecoration: 'none',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--affine-text-secondary-color, #667085)',
            padding: '4px 8px',
            borderRadius: 6,
            border: '1px solid var(--affine-border-color, rgba(16,24,40,0.08))',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M9 2L4 7l5 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back
        </Link>

        <span
          style={{
            flex: 1,
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {overview.project.display_name ?? overview.project.project_id}
        </span>

        <StatusBadge label={overview.project.status} />
      </div>

      {/* Tab bar */}
      <div style={{ marginBottom: 16 }}>
        <Tabs.Root
          value={section}
          onValueChange={value => {
            navigate(
              workspaceId
                ? getProjectPath(
                    overview.project.project_id,
                    value,
                    workspaceId
                  )
                : (currentProject?.routes?.foundryos?.[
                    value as ProjectSection
                  ] ?? getProjectPath(overview.project.project_id, value))
            );
          }}
        >
          <Tabs.List>
            {projectSections.map(item => (
              <Tabs.Trigger key={item} value={item}>
                {titleCase(item)}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs.Root>
      </div>

      {/* Tab content */}
      {section === 'overview' ? (
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Stat chips */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <StatChip label="Assets" value={content.assets.length} />
            <StatChip
              label="Workflows"
              value={activity.activity.workflows.length}
            />
            <StatChip
              label="Approvals"
              value={activity.activity.approvals.length}
            />
            <StatChip
              label="Runtime Services"
              value={runtime.runtime_context.containers.length}
            />
          </div>
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}
          >
            <div
              style={{
                borderRadius: 12,
                border:
                  '1px solid var(--affine-border-color, rgba(16,24,40,0.08))',
                padding: 16,
                background: 'var(--affine-background-primary-color, #fff)',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 12,
                  color: 'var(--affine-text-secondary-color, #667085)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Project Profile
              </div>
              <KeyValueGrid
                items={[
                  ['project_id', overview.project.project_id],
                  ['slug', overview.project.slug],
                  ['status', overview.project.status],
                  [
                    'owner_foundries',
                    readArray(overview.project, 'owner_foundries').join(', ') ||
                      'n/a',
                  ],
                  [
                    'capability_refs',
                    readArray(overview.project, 'capability_refs').join(', ') ||
                      'n/a',
                  ],
                ]}
              />
            </div>
            <div
              style={{
                borderRadius: 12,
                border:
                  '1px solid var(--affine-border-color, rgba(16,24,40,0.08))',
                padding: 16,
                background: 'var(--affine-background-primary-color, #fff)',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 12,
                  color: 'var(--affine-text-secondary-color, #667085)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Content Layer
              </div>
              <KeyValueGrid
                items={[
                  ['provider', contentSurface.provider],
                  ['mode', contentSurface.mode],
                  ['status', contentSurface.status],
                  ['workspace_id', contentSurface.workspace_id],
                  [
                    'authoritative_state_owner',
                    contentSurface.authoritative_state_owner,
                  ],
                ]}
              />
            </div>
          </div>
          <div
            style={{
              borderRadius: 12,
              border:
                '1px solid var(--affine-border-color, rgba(16,24,40,0.08))',
              padding: 16,
              background: 'var(--affine-background-primary-color, #fff)',
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 12,
                color: 'var(--affine-text-secondary-color, #667085)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Implementation Notes
            </div>
            <NotesList
              notes={
                Array.isArray(contentSurface.notes)
                  ? (contentSurface.notes as string[])
                  : []
              }
            />
          </div>
        </div>
      ) : null}

      {section === 'content' ? (
        <AssetExplorer
          assets={content.assets}
          contentSurface={contentSurface}
        />
      ) : null}

      {section === 'workflows' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 16,
          }}
        >
          <div
            style={{
              borderRadius: 12,
              border:
                '1px solid var(--affine-border-color, rgba(16,24,40,0.08))',
              padding: 16,
              background: 'var(--affine-background-primary-color, #fff)',
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 12,
                color: 'var(--affine-text-secondary-color, #667085)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Workflow Runs
            </div>
            <RecordStack
              items={activity.activity.workflows}
              emptyMessage="No workflow runs for this project."
              titleKeyCandidates={['workflow_id', 'workflow_run_id']}
              subtitleKeyCandidates={['source_asset_id']}
              statusKeyCandidates={['status']}
              metaBuilders={[
                {
                  label: 'Created',
                  value: item => formatDate(item.created_at),
                },
                {
                  label: 'Source',
                  value: item => item.source_asset_id ?? 'n/a',
                },
              ]}
            />
          </div>
          <div
            style={{
              borderRadius: 12,
              border:
                '1px solid var(--affine-border-color, rgba(16,24,40,0.08))',
              padding: 16,
              background: 'var(--affine-background-primary-color, #fff)',
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 12,
                color: 'var(--affine-text-secondary-color, #667085)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Approvals
            </div>
            <RecordStack
              items={activity.activity.approvals}
              emptyMessage="No approvals for this project."
              titleKeyCandidates={['decision_id']}
              subtitleKeyCandidates={['action']}
              metaBuilders={[
                {
                  label: 'Timestamp',
                  value: item => formatDate(item.timestamp),
                },
                {
                  label: 'Result',
                  value: item => item.result?.status ?? 'n/a',
                },
              ]}
            />
          </div>
          <div
            style={{
              borderRadius: 12,
              border:
                '1px solid var(--affine-border-color, rgba(16,24,40,0.08))',
              padding: 16,
              background: 'var(--affine-background-primary-color, #fff)',
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 12,
                color: 'var(--affine-text-secondary-color, #667085)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Actions
            </div>
            <RecordStack
              items={activity.activity.actions}
              emptyMessage="No actions have been recorded."
              titleKeyCandidates={['requested_action', 'action_id']}
              subtitleKeyCandidates={['action_id']}
              statusKeyCandidates={['status']}
              metaBuilders={[
                {
                  label: 'Requested',
                  value: item => formatDate(item.requested_at),
                },
                { label: 'Action ID', value: item => item.action_id ?? 'n/a' },
              ]}
            />
          </div>
        </div>
      ) : null}

      {section === 'observability' ? (
        <div
          style={{
            borderRadius: 12,
            border: '1px solid var(--affine-border-color, rgba(16,24,40,0.08))',
            padding: 16,
            background: 'var(--affine-background-primary-color, #fff)',
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 12,
              color: 'var(--affine-text-secondary-color, #667085)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Observability
          </div>
          <RecordStack
            items={activity.activity.observability}
            emptyMessage="No observability records for this project."
            titleKeyCandidates={['message', 'record_id']}
            subtitleKeyCandidates={['subject_type', 'subject_id']}
            statusKeyCandidates={['status']}
            metaBuilders={[
              { label: 'Time', value: item => formatDate(item.timestamp) },
              { label: 'Record', value: item => item.record_id ?? 'n/a' },
            ]}
          />
        </div>
      ) : null}

      {section === 'runtime' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 16,
          }}
        >
          <div
            style={{
              borderRadius: 12,
              border:
                '1px solid var(--affine-border-color, rgba(16,24,40,0.08))',
              padding: 16,
              background: 'var(--affine-background-primary-color, #fff)',
            }}
          >
            <RuntimeCatalog
              title="Containers"
              items={runtime.runtime_context.containers}
              titleKeys={['display_name', 'container_id']}
              subtitleKeys={['foundry_ref', 'runtime_id']}
              metaKeys={['runtime_id', 'container_id']}
            />
          </div>
          <div
            style={{
              borderRadius: 12,
              border:
                '1px solid var(--affine-border-color, rgba(16,24,40,0.08))',
              padding: 16,
              background: 'var(--affine-background-primary-color, #fff)',
            }}
          >
            <RuntimeCatalog
              title="Agents"
              items={runtime.runtime_context.agents}
              titleKeys={['display_name', 'agent_id']}
              subtitleKeys={['container_ref']}
              metaKeys={['agent_id', 'container_ref']}
            />
          </div>
          <div
            style={{
              borderRadius: 12,
              border:
                '1px solid var(--affine-border-color, rgba(16,24,40,0.08))',
              padding: 16,
              background: 'var(--affine-background-primary-color, #fff)',
            }}
          >
            <RuntimeCatalog
              title="Capabilities"
              items={runtime.runtime_context.capabilities}
              titleKeys={['display_name', 'capability_id']}
              subtitleKeys={['provider_ref', 'foundry_ref']}
              metaKeys={['capability_id']}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── FoundryOSSurface ─────────────────────────────────────────────────────────

export const FoundryOSSurface = ({
  workspaceId,
  embeddedInWorkbench = false,
}: {
  workspaceId?: string;
  embeddedInWorkbench?: boolean;
}) => {
  const location = useLocation();
  const params = useParams<{ projectId?: string; section?: string }>();
  const [state, setState] = useState<FoundryOSState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pageKind = useMemo(() => {
    if (
      location.pathname.startsWith('/foundryos/admin') ||
      location.pathname.includes('/foundryos/admin')
    ) {
      return 'admin' as const;
    }
    if (
      location.pathname.startsWith('/foundryos/projects/') ||
      location.pathname.includes('/foundryos/projects/')
    ) {
      return 'project' as const;
    }
    return 'customer' as const;
  }, [location.pathname]);

  const section = normalizeSection(params.section);

  useEffect(() => {
    const abortController = new AbortController();
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        if (pageKind === 'customer') {
          const customer = await api<CustomerShellPayload>(
            '/views/customer-shell',
            abortController.signal
          );
          setState({ kind: 'customer', customer });
          return;
        }

        if (pageKind === 'admin') {
          const admin = await api<AdminShellPayload>(
            '/views/admin-shell',
            abortController.signal
          );
          setState({ kind: 'admin', admin });
          return;
        }

        if (!params.projectId) {
          throw new Error('Missing project id.');
        }

        const [customer, overview, content, activity, runtime] =
          await Promise.all([
            api<CustomerShellPayload>(
              '/views/customer-shell',
              abortController.signal
            ),
            api<ProjectOverviewPayload>(
              `/projects/${params.projectId}`,
              abortController.signal
            ),
            api<ProjectContentPayload>(
              `/projects/${params.projectId}/content`,
              abortController.signal
            ),
            api<ProjectActivityPayload>(
              `/projects/${params.projectId}/activity`,
              abortController.signal
            ),
            api<ProjectRuntimePayload>(
              `/projects/${params.projectId}/runtime-context`,
              abortController.signal
            ),
          ]);

        setState({
          kind: 'project',
          customer,
          overview,
          content,
          activity,
          runtime,
        });
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }
        setError(
          error instanceof Error ? error.message : 'Unknown FoundryOS error.'
        );
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    load().catch(() => {});
    return () => abortController.abort();
  }, [pageKind, params.projectId, section]);

  const customerPath = workspaceId
    ? getCustomerPath(workspaceId)
    : state?.kind === 'admin'
      ? (state.admin.shell.routes?.foundryos?.customer ?? getCustomerPath())
      : state?.kind === 'project'
        ? (state.customer.shell.routes?.foundryos?.customer ??
          getCustomerPath())
        : state?.kind === 'customer'
          ? (state.customer.shell.routes?.foundryos?.customer ??
            getCustomerPath())
          : getCustomerPath();

  const adminPath = workspaceId
    ? getAdminPath(workspaceId)
    : state?.kind === 'admin'
      ? (state.admin.shell.routes?.foundryos?.admin ?? getAdminPath())
      : state?.kind === 'project'
        ? (state.customer.shell.routes?.foundryos?.admin ?? getAdminPath())
        : state?.kind === 'customer'
          ? (state.customer.shell.routes?.foundryos?.admin ?? getAdminPath())
          : getAdminPath();

  // Outer wrapper — full-bleed when embedded, padded otherwise
  const outerStyle: CSSProperties = embeddedInWorkbench
    ? {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        background: 'transparent',
      }
    : {
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: 'var(--affine-background-secondary-color, #f7f8fb)',
      };

  return (
    <div style={outerStyle}>
      {/* Top bar — always shown */}
      <TopBar
        customerPath={customerPath}
        adminPath={adminPath}
        pathname={location.pathname}
        workspaceId={workspaceId}
      />

      {/* Scrollable content area */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: embeddedInWorkbench ? 16 : 24,
        }}
      >
        {/* Project view: sidebar + main */}
        {!loading && !error && state?.kind === 'project' ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '200px minmax(0, 1fr)',
              gap: 0,
              height: '100%',
              background: 'var(--affine-background-primary-color, #fff)',
              borderRadius: 12,
              border:
                '1px solid var(--affine-border-color, rgba(16,24,40,0.08))',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            <ProjectNav
              projects={state.customer.projects}
              selectedProjectId={state.overview.project.project_id}
              workspaceId={workspaceId}
            />
            <div style={{ padding: 20, overflow: 'auto' }}>
              <ProjectView
                customer={state.customer}
                overview={state.overview}
                content={state.content}
                activity={state.activity}
                runtime={state.runtime}
                section={section}
                workspaceId={workspaceId}
              />
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {loading ? <LoadingSkeleton /> : null}

            {!loading && error ? (
              <ErrorBanner error={error} pathname={location.pathname} />
            ) : null}

            {!loading && !error && state?.kind === 'customer' ? (
              <CustomerView
                customer={state.customer}
                workspaceId={workspaceId}
              />
            ) : null}

            {!loading && !error && state?.kind === 'admin' ? (
              <AdminView admin={state.admin} workspaceId={workspaceId} />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Component (standalone route) ────────────────────────────────────────────

export const Component = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams<{ projectId?: string; section?: string }>();
  const [redirectChecked, setRedirectChecked] = useState(false);

  useEffect(() => {
    const workspaceId = localStorage.getItem('last_workspace_id');
    if (!workspaceId) {
      setRedirectChecked(true);
      return;
    }

    let target = getCustomerPath(workspaceId);
    if (location.pathname.startsWith('/foundryos/admin')) {
      target = getAdminPath(workspaceId);
    } else if (
      location.pathname.startsWith('/foundryos/projects/') &&
      params.projectId
    ) {
      target = getProjectPath(
        params.projectId,
        normalizeSection(params.section),
        workspaceId
      );
    }

    navigate(target, { replace: true });
    setRedirectChecked(true);
  }, [location.pathname, navigate, params.projectId, params.section]);

  if (!redirectChecked) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'var(--affine-background-secondary-color, #f7f8fb)',
        }}
      >
        <LoadingSkeleton />
      </div>
    );
  }

  return <FoundryOSSurface />;
};
