import React, { useCallback, useEffect, useState } from 'react';

const API_BASE_STORAGE_KEY = 'foundryos.apiBase';

declare global {
  interface Window {
    __FOUNDRYOS_API_BASE__?: string;
  }
}

function resolveApiBase(): string {
  const currentUrl = new URL(window.location.href);
  const queryBase = currentUrl.searchParams.get('foundryos_api_base');
  if (queryBase) {
    localStorage.setItem(API_BASE_STORAGE_KEY, queryBase);
    return queryBase;
  }
  const injectedBase = window.__FOUNDRYOS_API_BASE__;
  if (injectedBase) return injectedBase;
  const storedBase = localStorage.getItem(API_BASE_STORAGE_KEY);
  if (storedBase) return storedBase;
  if (window.location.port === '8000') return '';
  return '/foundryos-api';
}

function buildApiUrl(path: string): string {
  const base = resolveApiBase();
  if (!base) return path;
  if (base.startsWith('http://') || base.startsWith('https://')) {
    return new URL(path, `${base.replace(/\/$/, '')}/`).toString();
  }
  return `${base.replace(/\/$/, '')}${path}`;
}

interface Agent {
  id: string;
  name: string;
  description: string;
  provider: string;
  model: string;
  system_prompt: string;
  tools: string[];
  created_at: string;
  updated_at: string;
}

interface AgentFormData {
  name: string;
  description: string;
  provider: string;
  model: string;
  system_prompt: string;
  tools: string;
}

const defaultForm: AgentFormData = {
  name: '',
  description: '',
  provider: 'anthropic',
  model: 'claude-haiku-4-5-20251001',
  system_prompt: '',
  tools: '',
};

// ─── Shared sub-components ───────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </div>
  );
}

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        borderRadius: 12,
        border: '1px solid var(--affine-border-color, rgba(16,24,40,0.08))',
        padding: 16,
        background: 'var(--affine-background-primary-color, #fff)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 6,
        background: 'rgba(16, 24, 40, 0.04)',
        border: '1px solid var(--affine-border-color, rgba(16,24,40,0.08))',
        fontSize: 11,
        color: 'var(--affine-text-secondary-color, #667085)',
        fontFamily: 'monospace',
        marginRight: 4,
        marginBottom: 2,
      }}
    >
      {children}
    </span>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label
        style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--affine-text-secondary-color, #667085)',
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 36,
  borderRadius: 8,
  border: '1px solid var(--affine-border-color, rgba(16, 24, 40, 0.12))',
  padding: '0 12px',
  background: 'var(--affine-background-primary-color, #fff)',
  outline: 'none',
  fontSize: 13,
  boxSizing: 'border-box',
  color: 'var(--affine-text-primary-color, #101828)',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 80,
  padding: '8px 12px',
  resize: 'vertical',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
};

function PrimaryButton({
  children,
  onClick,
  type = 'button',
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height: 32,
        padding: '0 14px',
        borderRadius: 8,
        border: '1px solid rgba(31, 111, 255, 0.20)',
        background: 'rgba(31, 111, 255, 0.10)',
        color: '#1f6fff',
        fontWeight: 600,
        fontSize: 13,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

function DangerButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height: 28,
        padding: '0 10px',
        borderRadius: 6,
        border: '1px solid rgba(180, 35, 24, 0.20)',
        background: 'rgba(180, 35, 24, 0.06)',
        color: '#b42318',
        fontWeight: 600,
        fontSize: 12,
        cursor: 'pointer',
        marginLeft: 6,
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height: 28,
        padding: '0 10px',
        borderRadius: 6,
        border: '1px solid var(--affine-border-color, rgba(16,24,40,0.10))',
        background: 'var(--affine-background-secondary-color, #f7f8fb)',
        color: 'var(--affine-text-secondary-color, #667085)',
        fontWeight: 600,
        fontSize: 12,
        cursor: 'pointer',
        marginLeft: 6,
      }}
    >
      {children}
    </button>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        borderRadius: 12,
        border: '1px solid rgba(180, 35, 24, 0.20)',
        background: 'rgba(180, 35, 24, 0.05)',
        padding: '12px 16px',
        color: '#b42318',
        fontSize: 13,
        marginBottom: 16,
      }}
    >
      {message}
    </div>
  );
}

// ─── AgentsPage ───────────────────────────────────────────────────────────────

export function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AgentFormData>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(buildApiUrl('/agents'), {
        headers: { Accept: 'application/json' },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as { agents?: Agent[] };
      setAgents(data.agents ?? []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        tools: form.tools
          .split(',')
          .map(t => t.trim())
          .filter(Boolean),
      };
      const url = editingId
        ? buildApiUrl(`/agents/${editingId}`)
        : buildApiUrl('/agents');
      const method = editingId ? 'PUT' : 'POST';
      const resp = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setShowForm(false);
      setEditingId(null);
      setForm(defaultForm);
      await load();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (agent: Agent) => {
    setEditingId(agent.id);
    setForm({
      name: agent.name,
      description: agent.description,
      provider: agent.provider,
      model: agent.model,
      system_prompt: agent.system_prompt,
      tools: agent.tools.join(', '),
    });
    setShowForm(true);
  };

  const handleDelete = async (agentId: string) => {
    try {
      const resp = await fetch(buildApiUrl(`/agents/${agentId}`), {
        method: 'DELETE',
      });
      if (!resp.ok && resp.status !== 204)
        throw new Error(`HTTP ${resp.status}`);
      setDeleteConfirm(null);
      await load();
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}
        >
          Agents
        </div>
        <PrimaryButton
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setForm(defaultForm);
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
          New Agent
        </PrimaryButton>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      {/* Create / Edit form */}
      {showForm ? (
        <Card>
          <SectionLabel>{editingId ? 'Edit Agent' : 'New Agent'}</SectionLabel>
          <form
            onSubmit={e => {
              handleSubmit(e).catch(() => {});
            }}
          >
            <FormField label="Name *">
              <input
                style={inputStyle}
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </FormField>
            <FormField label="Description">
              <input
                style={inputStyle}
                value={form.description}
                onChange={e =>
                  setForm(f => ({ ...f, description: e.target.value }))
                }
              />
            </FormField>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
              }}
            >
              <FormField label="Provider">
                <select
                  style={selectStyle}
                  value={form.provider}
                  onChange={e =>
                    setForm(f => ({ ...f, provider: e.target.value }))
                  }
                >
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="mock">Mock (Testing)</option>
                  <option value="echo">Echo</option>
                </select>
              </FormField>
              <FormField label="Model">
                <input
                  style={inputStyle}
                  value={form.model}
                  onChange={e =>
                    setForm(f => ({ ...f, model: e.target.value }))
                  }
                  placeholder="claude-haiku-4-5-20251001"
                />
              </FormField>
            </div>
            <FormField label="System Prompt">
              <textarea
                style={textareaStyle}
                value={form.system_prompt}
                onChange={e =>
                  setForm(f => ({ ...f, system_prompt: e.target.value }))
                }
                placeholder="You are a helpful AI assistant..."
              />
            </FormField>
            <FormField label="Tools (comma-separated capability names)">
              <input
                style={inputStyle}
                value={form.tools}
                onChange={e => setForm(f => ({ ...f, tools: e.target.value }))}
                placeholder="web_search, web_fetch"
              />
            </FormField>
            <div
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
                marginTop: 4,
              }}
            >
              <SecondaryButton
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
              >
                Cancel
              </SecondaryButton>
              <PrimaryButton type="submit" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Update' : 'Create'}
              </PrimaryButton>
            </div>
          </form>
        </Card>
      ) : null}

      {/* List */}
      {loading ? (
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
          Loading agents…
        </div>
      ) : agents.length === 0 ? (
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
          No agents defined yet. Create your first agent above.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {agents.map(agent => (
            <Card key={agent.id}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ display: 'grid', gap: 6, flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {agent.name}
                  </div>
                  {agent.description ? (
                    <div
                      style={{
                        fontSize: 13,
                        color: 'var(--affine-text-secondary-color, #667085)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {agent.description}
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <Pill>{agent.provider}</Pill>
                    {agent.model ? <Pill>{agent.model}</Pill> : null}
                    {agent.tools.map(t => (
                      <Pill key={t}>{t}</Pill>
                    ))}
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <SecondaryButton onClick={() => handleEdit(agent)}>
                    Edit
                  </SecondaryButton>
                  {deleteConfirm === agent.id ? (
                    <>
                      <DangerButton
                        onClick={() => {
                          handleDelete(agent.id).catch(() => {});
                        }}
                      >
                        Confirm delete
                      </DangerButton>
                      <SecondaryButton onClick={() => setDeleteConfirm(null)}>
                        Cancel
                      </SecondaryButton>
                    </>
                  ) : (
                    <DangerButton onClick={() => setDeleteConfirm(agent.id)}>
                      Delete
                    </DangerButton>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default AgentsPage;
