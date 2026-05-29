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

function formatDate(value: unknown): string {
  if (typeof value !== 'string') return String(value ?? 'n/a');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatBytes(value: unknown): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'n/a';
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function accentForKind(kind: string): string {
  const normalized = kind.toLowerCase();
  if (normalized.includes('image'))
    return 'linear-gradient(135deg, rgba(99, 102, 241, 0.9), rgba(59, 130, 246, 0.75))';
  if (normalized.includes('spreadsheet') || normalized.includes('excel'))
    return 'linear-gradient(135deg, rgba(5, 150, 105, 0.9), rgba(16, 185, 129, 0.75))';
  if (normalized.includes('video'))
    return 'linear-gradient(135deg, rgba(219, 39, 119, 0.9), rgba(249, 115, 22, 0.75))';
  if (normalized.includes('text'))
    return 'linear-gradient(135deg, rgba(99, 102, 241, 0.9), rgba(168, 85, 247, 0.75))';
  return 'linear-gradient(135deg, rgba(31, 111, 255, 0.9), rgba(44, 188, 242, 0.75))';
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Asset {
  asset_id: string;
  content_hash?: string;
  filename?: string;
  title?: string;
  description?: string;
  tags?: string[];
  mime_type?: string;
  asset_type?: string;
  size_bytes?: number;
  created_at?: string;
  scope?: string;
  project_ref?: string;
  enrichments?: Record<string, unknown>;
  score?: number;
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

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
      <span style={{ fontWeight: 600 }}>{String(value ?? 'n/a')}</span>
    </span>
  );
}

function KeyValueGrid({ items }: { items: Array<[string, unknown]> }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
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
            {label.replace(/_/g, ' ')}
          </div>
          <div
            style={{
              fontWeight: 600,
              wordBreak: 'break-word',
              fontSize: 13,
            }}
          >
            {value != null && value !== '' ? String(value) : 'n/a'}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Content type icon pill ───────────────────────────────────────────────────

function ContentTypePill({ type }: { type: string }) {
  const short = type.split('/').pop()?.toUpperCase().slice(0, 6) ?? 'FILE';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 22,
        padding: '0 8px',
        borderRadius: 6,
        background: 'rgba(31, 111, 255, 0.08)',
        border: '1px solid rgba(31, 111, 255, 0.16)',
        color: '#1f6fff',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.04em',
        flexShrink: 0,
      }}
    >
      {short}
    </span>
  );
}

// ─── Asset card (grid cell) ───────────────────────────────────────────────────

function AssetCard({
  asset,
  selected,
  onClick,
}: {
  asset: Asset;
  selected: boolean;
  onClick: () => void;
}) {
  const title = asset.title ?? asset.filename ?? asset.asset_id.slice(0, 12);
  const contentType = asset.mime_type ?? asset.asset_type ?? 'file';
  const scorePercent =
    asset.score != null ? Math.round(asset.score * 100) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: 'left',
        borderRadius: 12,
        border: selected
          ? '1px solid rgba(31, 111, 255, 0.28)'
          : '1px solid var(--affine-border-color, rgba(16,24,40,0.08))',
        background: selected
          ? 'rgba(31, 111, 255, 0.06)'
          : 'var(--affine-background-primary-color, #fff)',
        padding: 14,
        cursor: 'pointer',
        boxShadow: selected
          ? '0 0 0 2px rgba(31, 111, 255, 0.10)'
          : '0 1px 3px rgba(0,0,0,0.06)',
        display: 'grid',
        gap: 8,
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          justifyContent: 'space-between',
        }}
      >
        <ContentTypePill type={contentType} />
        {scorePercent != null ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#1f6fff',
            }}
          >
            {scorePercent}%
          </span>
        ) : null}
      </div>
      <div
        style={{
          fontWeight: 600,
          fontSize: 13,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--affine-text-secondary-color, #667085)',
        }}
      >
        {contentType}
      </div>
      {asset.created_at ? (
        <div
          style={{
            fontSize: 11,
            color: 'var(--affine-text-secondary-color, #667085)',
          }}
        >
          {formatDate(asset.created_at)}
        </div>
      ) : null}
      {scorePercent != null ? (
        <div
          style={{
            height: 4,
            borderRadius: 999,
            background: 'var(--affine-border-color, rgba(16,24,40,0.08))',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${scorePercent}%`,
              background: '#1f6fff',
              borderRadius: 999,
            }}
          />
        </div>
      ) : null}
    </button>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function AssetDetail({
  asset,
  onClose,
}: {
  asset: Asset;
  onClose: () => void;
}) {
  const contentType = asset.mime_type ?? asset.asset_type ?? 'file';
  const title = asset.title ?? asset.filename ?? asset.asset_id;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 400,
        background: 'var(--affine-background-primary-color, #fff)',
        borderLeft: '1px solid var(--affine-border-color, rgba(16,24,40,0.08))',
        boxShadow: '-4px 0 24px rgba(16,24,40,0.10)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 200,
        overflow: 'auto',
      }}
    >
      {/* Panel header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom:
            '1px solid var(--affine-border-color, rgba(16,24,40,0.08))',
          flexShrink: 0,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 14 }}>Asset Detail</div>
        <button
          type="button"
          onClick={onClose}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 6,
            border: '1px solid var(--affine-border-color, rgba(16,24,40,0.10))',
            background: 'var(--affine-background-secondary-color, #f7f8fb)',
            cursor: 'pointer',
            color: 'var(--affine-text-secondary-color, #667085)',
            fontSize: 16,
          }}
        >
          ×
        </button>
      </div>

      {/* Hero banner */}
      <div
        style={{
          padding: 20,
          minHeight: 120,
          background: accentForKind(contentType),
          color: '#fff',
          display: 'grid',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            opacity: 0.8,
          }}
        >
          {contentType}
        </div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}
        >
          {title}
        </div>
        {asset.description ? (
          <div style={{ fontSize: 12, opacity: 0.85 }}>{asset.description}</div>
        ) : null}
        <div
          style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}
        >
          {[
            formatBytes(asset.size_bytes),
            asset.scope,
            formatDate(asset.created_at),
          ]
            .filter(Boolean)
            .map((v, i) => (
              <span
                key={i}
                style={{
                  padding: '3px 8px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.15)',
                  fontSize: 11,
                }}
              >
                {v}
              </span>
            ))}
        </div>
      </div>

      {/* Metadata */}
      <div style={{ padding: 16, display: 'grid', gap: 16 }}>
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--affine-text-secondary-color, #667085)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: 10,
            }}
          >
            Metadata
          </div>
          <KeyValueGrid
            items={[
              ['Asset ID', asset.asset_id],
              ['Content Hash', asset.content_hash ?? 'n/a'],
              ['MIME Type', asset.mime_type ?? 'n/a'],
              ['Size', formatBytes(asset.size_bytes)],
              ['Created', formatDate(asset.created_at)],
              ['Project Ref', asset.project_ref ?? 'n/a'],
              ['Scope', asset.scope ?? 'n/a'],
            ]}
          />
        </div>

        {asset.tags && asset.tags.length > 0 ? (
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--affine-text-secondary-color, #667085)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: 8,
              }}
            >
              Tags
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {asset.tags.map(tag => (
                <span
                  key={tag}
                  style={{
                    padding: '3px 10px',
                    borderRadius: 999,
                    border:
                      '1px solid var(--affine-border-color, rgba(16,24,40,0.10))',
                    background:
                      'var(--affine-background-secondary-color, #f7f8fb)',
                    fontSize: 12,
                    color: 'var(--affine-text-secondary-color, #667085)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {asset.enrichments && Object.keys(asset.enrichments).length > 0 ? (
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--affine-text-secondary-color, #667085)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: 10,
              }}
            >
              Enrichments
            </div>
            <KeyValueGrid
              items={Object.entries(asset.enrichments).map(([k, v]) => [
                k,
                typeof v === 'object' ? JSON.stringify(v) : v,
              ])}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── AssetsPage ───────────────────────────────────────────────────────────────

export function AssetsPage() {
  const [query, setQuery] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedAssetIdRef = useRef<string | null>(null);
  selectedAssetIdRef.current = selectedAssetId;

  const search = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      // Try POST /assets/search first (cockpit-api proxy), fall back to GET with query params
      let resp = await fetch(buildApiUrl('/assets/search'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query: q, limit: 20 }),
      });
      if (!resp.ok) {
        // Fallback: GET with query string
        const searchParams = new URLSearchParams();
        if (q) searchParams.set('q', q);
        searchParams.set('limit', '20');
        resp = await fetch(
          buildApiUrl(`/assets/search?${searchParams.toString()}`),
          {
            headers: { Accept: 'application/json' },
          }
        );
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as {
        assets?: Asset[];
        items?: Asset[];
        results?: Asset[];
      };
      const list = data.assets ?? data.items ?? data.results ?? [];
      setAssets(list);
      if (list.length > 0 && !selectedAssetIdRef.current) {
        setSelectedAssetId(list[0].asset_id);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search on query change (also fires on mount with query='')
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      search(query).catch(() => {});
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  const selectedAsset =
    assets.find(a => a.asset_id === selectedAssetId) ?? null;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Header + search */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div
          style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}
        >
          Asset Gallery
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: 1,
            maxWidth: 400,
          }}
        >
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search assets by name, type, scope…"
            style={{
              flex: 1,
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
          {loading ? (
            <span
              style={{
                fontSize: 12,
                color: 'var(--affine-text-secondary-color, #667085)',
                flexShrink: 0,
              }}
            >
              Loading…
            </span>
          ) : (
            <span
              style={{
                fontSize: 12,
                color: 'var(--affine-text-secondary-color, #667085)',
                flexShrink: 0,
              }}
            >
              {assets.length} asset{assets.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {error ? (
        <div
          style={{
            borderRadius: 12,
            border: '1px solid rgba(180, 35, 24, 0.20)',
            background: 'rgba(180, 35, 24, 0.05)',
            padding: '12px 16px',
            color: '#b42318',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : null}

      {/* Stats row */}
      {assets.length > 0 ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <MiniStat label="total" value={assets.length} />
          {Array.from(
            new Set(
              assets.map(
                a => (a.mime_type ?? a.asset_type ?? 'unknown').split('/')[0]
              )
            )
          ).map(type => (
            <MiniStat
              key={type}
              label={type}
              value={
                assets.filter(a =>
                  (a.mime_type ?? a.asset_type ?? '').startsWith(type)
                ).length
              }
            />
          ))}
        </div>
      ) : null}

      {/* Grid */}
      {assets.length === 0 && !loading ? (
        <div
          style={{
            padding: '48px 16px',
            borderRadius: 12,
            border: '1px dashed rgba(16, 24, 40, 0.12)',
            color: 'var(--affine-text-secondary-color, #667085)',
            background: 'rgba(248, 250, 252, 0.8)',
            fontSize: 13,
            textAlign: 'center',
          }}
        >
          {query ? `No assets found for "${query}".` : 'No assets stored yet.'}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12,
          }}
        >
          {assets.map(asset => (
            <AssetCard
              key={asset.asset_id}
              asset={asset}
              selected={asset.asset_id === selectedAssetId}
              onClick={() =>
                setSelectedAssetId(
                  selectedAssetId === asset.asset_id ? null : asset.asset_id
                )
              }
            />
          ))}
        </div>
      )}

      {/* Detail panel (fixed slide-in) */}
      {selectedAsset ? (
        <AssetDetail
          asset={selectedAsset}
          onClose={() => setSelectedAssetId(null)}
        />
      ) : null}
    </div>
  );
}

export default AssetsPage;
