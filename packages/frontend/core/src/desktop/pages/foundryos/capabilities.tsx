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

interface Capability {
  id: string;
  name: string;
  description: string;
  capability_type: 'builtin' | 'http';
  endpoint_url?: string;
  method?: string;
  timeout?: number;
  created_at: string;
  updated_at: string;
}

interface CapabilityFormData {
  name: string;
  description: string;
  capability_type: 'builtin' | 'http';
  endpoint_url: string;
  method: string;
  timeout: string;
}

const defaultForm: CapabilityFormData = {
  name: '',
  description: '',
  capability_type: 'builtin',
  endpoint_url: '',
  method: 'POST',
  timeout: '30',
};

// ─── Shared UI helpers ────────────────────────────────────────────────────────

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

function TypeBadge({ type }: { type: string }) {
  const isHttp = type === 'http';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 22,
        padding: '0 8px',
        borderRadius: 999,
        border: isHttp
          ? '1px solid rgba(31, 111, 255, 0.20)'
          : '1px solid var(--affine-border-color, rgba(16,24,40,0.10))',
        background: isHttp
          ? 'rgba(31, 111, 255, 0.06)'
          : 'var(--affine-background-secondary-color, #f7f8fb)',
        color: isHttp
          ? '#1f6fff'
          : 'var(--affine-text-secondary-color, #667085)',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {type}
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

// ─── CapabilitiesPage ─────────────────────────────────────────────────────────

export function CapabilitiesPage() {
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CapabilityFormData>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(buildApiUrl('/capabilities'), {
        headers: { Accept: 'application/json' },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as {
        capabilities?: Capability[];
        items?: Capability[];
      };
      setCapabilities(data.capabilities ?? data.items ?? []);
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
      const payload: Record<string, unknown> = {
        name: form.name,
        description: form.description,
        capability_type: form.capability_type,
        method: form.method || undefined,
        timeout: form.timeout ? Number(form.timeout) : undefined,
      };
      if (form.capability_type === 'http') {
        payload.endpoint_url = form.endpoint_url;
      }
      const url = editingId
        ? buildApiUrl(`/capabilities/${editingId}`)
        : buildApiUrl('/capabilities');
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

  const handleEdit = (cap: Capability) => {
    setEditingId(cap.id);
    setForm({
      name: cap.name,
      description: cap.description,
      capability_type: cap.capability_type,
      endpoint_url: cap.endpoint_url ?? '',
      method: cap.method ?? 'POST',
      timeout: cap.timeout != null ? String(cap.timeout) : '30',
    });
    setShowForm(true);
  };

  const handleDelete = async (capId: string) => {
    try {
      const resp = await fetch(buildApiUrl(`/capabilities/${capId}`), {
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
          Capabilities
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
          New Capability
        </PrimaryButton>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      {/* Form */}
      {showForm ? (
        <Card>
          <SectionLabel>
            {editingId ? 'Edit Capability' : 'New Capability'}
          </SectionLabel>
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
              <FormField label="Type">
                <select
                  style={selectStyle}
                  value={form.capability_type}
                  onChange={e =>
                    setForm(f => ({
                      ...f,
                      capability_type: e.target.value as 'builtin' | 'http',
                    }))
                  }
                >
                  <option value="builtin">Built-in</option>
                  <option value="http">HTTP</option>
                </select>
              </FormField>
              <FormField label="HTTP Method">
                <select
                  style={selectStyle}
                  value={form.method}
                  onChange={e =>
                    setForm(f => ({ ...f, method: e.target.value }))
                  }
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                  <option value="PATCH">PATCH</option>
                </select>
              </FormField>
            </div>
            {form.capability_type === 'http' ? (
              <FormField label="Endpoint URL *">
                <input
                  style={inputStyle}
                  value={form.endpoint_url}
                  onChange={e =>
                    setForm(f => ({ ...f, endpoint_url: e.target.value }))
                  }
                  placeholder="https://api.example.com/endpoint"
                  required
                />
              </FormField>
            ) : null}
            <FormField label="Timeout (seconds)">
              <input
                style={inputStyle}
                type="number"
                value={form.timeout}
                onChange={e =>
                  setForm(f => ({ ...f, timeout: e.target.value }))
                }
                placeholder="30"
                min="1"
                max="300"
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
          Loading capabilities…
        </div>
      ) : capabilities.length === 0 ? (
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
          No capabilities defined yet. Create your first capability above.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {capabilities.map(cap => (
            <Card key={cap.id}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ display: 'grid', gap: 6, flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 14 }}>
                      {cap.name}
                    </span>
                    <TypeBadge type={cap.capability_type} />
                  </div>
                  {cap.description ? (
                    <div
                      style={{
                        fontSize: 13,
                        color: 'var(--affine-text-secondary-color, #667085)',
                      }}
                    >
                      {cap.description}
                    </div>
                  ) : null}
                  {cap.endpoint_url ? (
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--affine-text-secondary-color, #667085)',
                        fontFamily: 'monospace',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {cap.method ?? 'POST'} {cap.endpoint_url}
                    </div>
                  ) : null}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <SecondaryButton onClick={() => handleEdit(cap)}>
                    Edit
                  </SecondaryButton>
                  {deleteConfirm === cap.id ? (
                    <>
                      <DangerButton
                        onClick={() => {
                          handleDelete(cap.id).catch(() => {});
                        }}
                      >
                        Confirm delete
                      </DangerButton>
                      <SecondaryButton onClick={() => setDeleteConfirm(null)}>
                        Cancel
                      </SecondaryButton>
                    </>
                  ) : (
                    <DangerButton onClick={() => setDeleteConfirm(cap.id)}>
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

export default CapabilitiesPage;
