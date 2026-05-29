import React, { useCallback, useEffect, useRef, useState } from 'react';

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

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkflowStep {
  step_id: string;
  service_type: 'agent' | 'capability';
  agent_name?: string;
  capability_name?: string;
  message?: string;
  params?: string;
}

interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  created_at: string;
}

interface WorkflowRun {
  run_id: string;
  definition_id: string;
  definition_name?: string;
  status: string;
  started_at: string;
  completed_at?: string;
  steps?: Array<{ step_id: string; status: string }>;
}

interface DefFormData {
  name: string;
  description: string;
  steps: WorkflowStep[];
}

const defaultDef: DefFormData = {
  name: '',
  description: '',
  steps: [],
};

const defaultStep: WorkflowStep = {
  step_id: '',
  service_type: 'agent',
  agent_name: '',
  capability_name: '',
  message: '',
  params: '{}',
};

// ─── Shared UI ────────────────────────────────────────────────────────────────

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
  minHeight: 64,
  padding: '8px 12px',
  resize: 'vertical',
  fontFamily: 'monospace',
  fontSize: 12,
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

function statusTone(status: string) {
  const s = status.toLowerCase();
  if (
    ['running', 'active', 'healthy', 'ok', 'completed', 'ready'].includes(s)
  ) {
    return {
      dot: '#067647',
      text: '#067647',
      border: 'rgba(6, 118, 71, 0.18)',
      background: 'rgba(6, 118, 71, 0.08)',
    };
  }
  if (['planned', 'queued', 'pending'].includes(s)) {
    return {
      dot: '#b54708',
      text: '#b54708',
      border: 'rgba(181, 71, 8, 0.18)',
      background: 'rgba(181, 71, 8, 0.08)',
    };
  }
  if (['failed', 'error', 'degraded'].includes(s)) {
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

function StatusBadge({ status }: { status: string }) {
  const tone = statusTone(status);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: 22,
        padding: '0 8px',
        borderRadius: 999,
        border: `1px solid ${tone.border}`,
        background: tone.background,
        color: tone.text,
        fontWeight: 600,
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        flexShrink: 0,
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
      {status}
    </span>
  );
}

// ─── Step builder row ─────────────────────────────────────────────────────────

function StepRow({
  step,
  index,
  onChange,
  onRemove,
}: {
  step: WorkflowStep;
  index: number;
  onChange: (updated: WorkflowStep) => void;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        borderRadius: 10,
        border: '1px solid var(--affine-border-color, rgba(16,24,40,0.08))',
        background: 'var(--affine-background-secondary-color, #f7f8fb)',
        padding: 12,
        display: 'grid',
        gap: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--affine-text-secondary-color, #667085)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Step {index + 1}
        </span>
        <DangerButton onClick={onRemove}>Remove</DangerButton>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--affine-text-secondary-color, #667085)',
              marginBottom: 4,
              textTransform: 'uppercase',
            }}
          >
            Step ID
          </label>
          <input
            style={inputStyle}
            value={step.step_id}
            onChange={e => onChange({ ...step, step_id: e.target.value })}
            placeholder="step_01"
          />
        </div>
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--affine-text-secondary-color, #667085)',
              marginBottom: 4,
              textTransform: 'uppercase',
            }}
          >
            Service Type
          </label>
          <select
            style={selectStyle}
            value={step.service_type}
            onChange={e =>
              onChange({
                ...step,
                service_type: e.target.value as 'agent' | 'capability',
              })
            }
          >
            <option value="agent">Agent</option>
            <option value="capability">Capability</option>
          </select>
        </div>
      </div>
      {step.service_type === 'agent' ? (
        <>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--affine-text-secondary-color, #667085)',
                marginBottom: 4,
                textTransform: 'uppercase',
              }}
            >
              Agent Name
            </label>
            <input
              style={inputStyle}
              value={step.agent_name ?? ''}
              onChange={e => onChange({ ...step, agent_name: e.target.value })}
              placeholder="my-agent"
            />
          </div>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--affine-text-secondary-color, #667085)',
                marginBottom: 4,
                textTransform: 'uppercase',
              }}
            >
              Message
            </label>
            <textarea
              style={textareaStyle}
              value={step.message ?? ''}
              onChange={e => onChange({ ...step, message: e.target.value })}
              placeholder="Process the topic: {{topic}}"
            />
          </div>
        </>
      ) : (
        <>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--affine-text-secondary-color, #667085)',
                marginBottom: 4,
                textTransform: 'uppercase',
              }}
            >
              Capability Name
            </label>
            <input
              style={inputStyle}
              value={step.capability_name ?? ''}
              onChange={e =>
                onChange({ ...step, capability_name: e.target.value })
              }
              placeholder="web_search"
            />
          </div>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--affine-text-secondary-color, #667085)',
                marginBottom: 4,
                textTransform: 'uppercase',
              }}
            >
              Params (JSON)
            </label>
            <textarea
              style={textareaStyle}
              value={step.params ?? '{}'}
              onChange={e => onChange({ ...step, params: e.target.value })}
              placeholder='{"query": "{{topic}}"}'
            />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Run modal ────────────────────────────────────────────────────────────────

function RunModal({
  definition,
  onClose,
  onRun,
}: {
  definition: WorkflowDefinition;
  onClose: () => void;
  onRun: (runId: string) => void;
}) {
  const [topic, setTopic] = useState('');
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setErr(null);
    try {
      const resp = await fetch(buildApiUrl('/workflows/runs'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          definition_id: definition.id,
          inputs: { topic },
        }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as { run_id?: string; id?: string };
      onRun(data.run_id ?? data.id ?? 'unknown');
    } catch (e) {
      setErr(String(e));
      setRunning(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(16, 24, 40, 0.40)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'var(--affine-background-primary-color, #fff)',
          borderRadius: 16,
          padding: 24,
          width: 420,
          boxShadow: '0 8px 24px rgba(16,24,40,0.18)',
          border: '1px solid var(--affine-border-color, rgba(16,24,40,0.08))',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
          Run Workflow
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--affine-text-secondary-color, #667085)',
            marginBottom: 20,
          }}
        >
          {definition.name}
        </div>
        {err ? <ErrorBanner message={err} /> : null}
        <FormField label="Topic / Input">
          <input
            style={inputStyle}
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="e.g. AI agent architectures"
            autoFocus
          />
        </FormField>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 8,
          }}
        >
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton
            onClick={() => {
              handleRun().catch(() => {});
            }}
            disabled={running}
          >
            {running ? 'Starting…' : 'Start Run'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// ─── WorkflowsPage ────────────────────────────────────────────────────────────

export function WorkflowsPage() {
  const [definitions, setDefinitions] = useState<WorkflowDefinition[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loadingDefs, setLoadingDefs] = useState(true);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [defForm, setDefForm] = useState<DefFormData>(defaultDef);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [runModal, setRunModal] = useState<WorkflowDefinition | null>(null);
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const runsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadDefs = useCallback(async () => {
    setLoadingDefs(true);
    try {
      const resp = await fetch(buildApiUrl('/workflows/definitions'), {
        headers: { Accept: 'application/json' },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as {
        definitions?: WorkflowDefinition[];
        items?: WorkflowDefinition[];
      };
      setDefinitions(data.definitions ?? data.items ?? []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoadingDefs(false);
    }
  }, []);

  const loadRuns = useCallback(async () => {
    setLoadingRuns(true);
    try {
      const resp = await fetch(buildApiUrl('/workflows/runs'), {
        headers: { Accept: 'application/json' },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as {
        runs?: WorkflowRun[];
        items?: WorkflowRun[];
      };
      setRuns(data.runs ?? data.items ?? []);
    } catch {
      // silently ignore run list errors
    } finally {
      setLoadingRuns(false);
    }
  }, []);

  useEffect(() => {
    loadDefs().catch(() => {});
    loadRuns().catch(() => {});
  }, [loadDefs, loadRuns]);

  // Auto-refresh runs every 5s
  useEffect(() => {
    runsIntervalRef.current = setInterval(() => {
      loadRuns().catch(() => {});
    }, 5000);
    return () => {
      if (runsIntervalRef.current) clearInterval(runsIntervalRef.current);
    };
  }, [loadRuns]);

  const handleSaveDef = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: defForm.name,
        description: defForm.description,
        steps: defForm.steps.map(s => ({
          step_id: s.step_id,
          service_type: s.service_type,
          ...(s.service_type === 'agent'
            ? { agent_name: s.agent_name, message: s.message }
            : {
                capability_name: s.capability_name,
                params: (() => {
                  try {
                    return JSON.parse(s.params ?? '{}');
                  } catch {
                    return {};
                  }
                })(),
              }),
        })),
      };
      const resp = await fetch(buildApiUrl('/workflows/definitions'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setShowForm(false);
      setDefForm(defaultDef);
      await loadDefs();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDef = async (defId: string) => {
    try {
      const resp = await fetch(buildApiUrl(`/workflows/definitions/${defId}`), {
        method: 'DELETE',
      });
      if (!resp.ok && resp.status !== 204)
        throw new Error(`HTTP ${resp.status}`);
      setDeleteConfirm(null);
      await loadDefs();
    } catch (err) {
      setError(String(err));
    }
  };

  const addStep = () => {
    setDefForm(f => ({
      ...f,
      steps: [
        ...f.steps,
        { ...defaultStep, step_id: `step_${f.steps.length + 1}` },
      ],
    }));
  };

  const updateStep = (index: number, updated: WorkflowStep) => {
    setDefForm(f => {
      const steps = [...f.steps];
      steps[index] = updated;
      return { ...f, steps };
    });
  };

  const removeStep = (index: number) => {
    setDefForm(f => ({
      ...f,
      steps: f.steps.filter((_, i) => i !== index),
    }));
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {error ? <ErrorBanner message={error} /> : null}

      {/* Run modal */}
      {runModal ? (
        <RunModal
          definition={runModal}
          onClose={() => setRunModal(null)}
          onRun={runId => {
            setLastRunId(runId);
            setRunModal(null);
            loadRuns().catch(() => {});
          }}
        />
      ) : null}

      {/* Definitions section */}
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
            style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}
          >
            Workflow Definitions
          </div>
          <PrimaryButton
            onClick={() => {
              setShowForm(true);
              setDefForm(defaultDef);
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
            New Workflow
          </PrimaryButton>
        </div>

        {/* New workflow form */}
        {showForm ? (
          <Card style={{ marginBottom: 12 }}>
            <SectionLabel>New Workflow Definition</SectionLabel>
            <form
              onSubmit={e => {
                handleSaveDef(e).catch(() => {});
              }}
            >
              <FormField label="Workflow Name *">
                <input
                  style={inputStyle}
                  value={defForm.name}
                  onChange={e =>
                    setDefForm(f => ({ ...f, name: e.target.value }))
                  }
                  required
                />
              </FormField>
              <FormField label="Description">
                <input
                  style={inputStyle}
                  value={defForm.description}
                  onChange={e =>
                    setDefForm(f => ({ ...f, description: e.target.value }))
                  }
                />
              </FormField>

              <div style={{ marginBottom: 14 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--affine-text-secondary-color, #667085)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Steps ({defForm.steps.length})
                  </span>
                  <button
                    type="button"
                    onClick={addStep}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      height: 26,
                      padding: '0 10px',
                      borderRadius: 6,
                      border: '1px solid rgba(31, 111, 255, 0.20)',
                      background: 'rgba(31, 111, 255, 0.06)',
                      color: '#1f6fff',
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    + Add Step
                  </button>
                </div>
                <div style={{ display: 'grid', gap: 10 }}>
                  {defForm.steps.map((step, i) => (
                    <StepRow
                      key={i}
                      step={step}
                      index={i}
                      onChange={updated => updateStep(i, updated)}
                      onRemove={() => removeStep(i)}
                    />
                  ))}
                  {defForm.steps.length === 0 ? (
                    <div
                      style={{
                        padding: '12px 16px',
                        borderRadius: 8,
                        border: '1px dashed rgba(16, 24, 40, 0.12)',
                        color: 'var(--affine-text-secondary-color, #667085)',
                        fontSize: 13,
                      }}
                    >
                      No steps added yet. Click &ldquo;+ Add Step&rdquo; to
                      begin.
                    </div>
                  ) : null}
                </div>
              </div>

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
                    setDefForm(defaultDef);
                  }}
                >
                  Cancel
                </SecondaryButton>
                <PrimaryButton type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Create Workflow'}
                </PrimaryButton>
              </div>
            </form>
          </Card>
        ) : null}

        {/* Definitions list */}
        {loadingDefs ? (
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
            Loading workflow definitions…
          </div>
        ) : definitions.length === 0 ? (
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
            No workflow definitions yet. Create one above.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {definitions.map(def => (
              <Card key={def.id}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{ display: 'grid', gap: 4, flex: 1, minWidth: 0 }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {def.name}
                    </div>
                    {def.description ? (
                      <div
                        style={{
                          fontSize: 13,
                          color: 'var(--affine-text-secondary-color, #667085)',
                        }}
                      >
                        {def.description}
                      </div>
                    ) : null}
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--affine-text-secondary-color, #667085)',
                      }}
                    >
                      {def.steps?.length ?? 0} step
                      {(def.steps?.length ?? 0) !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <PrimaryButton onClick={() => setRunModal(def)}>
                      ▶ Run
                    </PrimaryButton>
                    {deleteConfirm === def.id ? (
                      <>
                        <DangerButton
                          onClick={() => {
                            handleDeleteDef(def.id).catch(() => {});
                          }}
                        >
                          Confirm delete
                        </DangerButton>
                        <SecondaryButton onClick={() => setDeleteConfirm(null)}>
                          Cancel
                        </SecondaryButton>
                      </>
                    ) : (
                      <DangerButton onClick={() => setDeleteConfirm(def.id)}>
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

      {/* Last started run notification */}
      {lastRunId ? (
        <div
          style={{
            borderRadius: 10,
            border: '1px solid rgba(6, 118, 71, 0.18)',
            background: 'rgba(6, 118, 71, 0.06)',
            padding: '10px 16px',
            fontSize: 13,
            color: '#067647',
            fontWeight: 600,
          }}
        >
          Run started — ID:{' '}
          <span style={{ fontFamily: 'monospace', fontWeight: 400 }}>
            {lastRunId}
          </span>
        </div>
      ) : null}

      {/* Running workflows section */}
      <div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            marginBottom: 12,
          }}
        >
          Running Workflows
        </div>
        {loadingRuns && runs.length === 0 ? (
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
            Loading runs…
          </div>
        ) : runs.length === 0 ? (
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
            No workflow runs yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {runs.map(run => {
              const completedSteps = (run.steps ?? []).filter(
                s => s.status === 'completed'
              ).length;
              const totalSteps = (run.steps ?? []).length;
              return (
                <Card key={run.run_id}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      alignItems: 'flex-start',
                    }}
                  >
                    <div
                      style={{ display: 'grid', gap: 6, flex: 1, minWidth: 0 }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: 12,
                            color:
                              'var(--affine-text-secondary-color, #667085)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: 220,
                          }}
                        >
                          {run.run_id}
                        </span>
                      </div>
                      {run.definition_name ? (
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                          }}
                        >
                          {run.definition_name}
                        </div>
                      ) : null}
                      <div
                        style={{
                          display: 'flex',
                          gap: 10,
                          fontSize: 12,
                          color: 'var(--affine-text-secondary-color, #667085)',
                        }}
                      >
                        <span>
                          Started: {new Date(run.started_at).toLocaleString()}
                        </span>
                        {totalSteps > 0 ? (
                          <span>
                            Steps: {completedSteps}/{totalSteps}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <StatusBadge status={run.status} />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default WorkflowsPage;
