import { TodayIcon, ViewLayersIcon } from '@blocksuite/icons/rc';
import { Link, useLocation, useParams } from 'react-router-dom';

import {
  ViewBody,
  ViewHeader,
  ViewIcon,
  ViewSidebarTab,
  ViewTitle,
} from '../../../../modules/workbench';
import {
  getWorkspaceFoundryOSAdminPath,
  getWorkspaceFoundryOSCustomerPath,
} from '../../../route-paths';
import { FoundryOSSurface } from '../../foundryos';

const headerShellStyle = {
  display: 'grid',
  gap: 14,
  padding: '20px 24px 16px',
  borderBottom: '1px solid rgba(16, 24, 40, 0.08)',
  background:
    'radial-gradient(circle at top left, rgba(31, 111, 255, 0.16), transparent 30%), var(--affine-background-primary-color, #fff)',
} as const;

const tabButtonStyle = (active: boolean) =>
  ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
    padding: '0 14px',
    borderRadius: 12,
    textDecoration: 'none',
    fontWeight: 700,
    color: 'inherit',
    border: `1px solid ${active ? 'rgba(31, 111, 255, 0.24)' : 'rgba(16, 24, 40, 0.08)'}`,
    background: active
      ? 'rgba(31, 111, 255, 0.10)'
      : 'var(--affine-background-primary-color, #fff)',
  }) satisfies React.CSSProperties;

function WorkspaceFoundryHeader({
  workspaceId,
  pathname,
}: {
  workspaceId: string;
  pathname: string;
}) {
  const customerPath = getWorkspaceFoundryOSCustomerPath(workspaceId);
  const adminPath = getWorkspaceFoundryOSAdminPath(workspaceId);

  return (
    <div style={headerShellStyle}>
      <div
        style={{
          display: 'grid',
          gap: 6,
        }}
      >
        <div
          style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}
        >
          FoundryOS
        </div>
        <div
          style={{
            maxWidth: 960,
            color: 'var(--affine-text-secondary-color, #667085)',
            lineHeight: 1.55,
          }}
        >
          Native AFFiNE workspace view hosting the FoundryOS customer and admin
          surfaces inside the real workbench shell.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link
          to={customerPath}
          style={tabButtonStyle(pathname.includes('/foundryos/customer'))}
        >
          Customer
        </Link>
        <Link
          to={adminPath}
          style={tabButtonStyle(pathname.includes('/foundryos/admin'))}
        >
          Admin
        </Link>
      </div>
    </div>
  );
}

function SidebarSection({
  title,
  items,
}: {
  title: string;
  items: Array<[string, string]>;
}) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ fontWeight: 700 }}>{title}</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {items.map(([label, value]) => (
          <div
            key={label}
            style={{
              borderRadius: 14,
              border: '1px solid rgba(16, 24, 40, 0.08)',
              padding: 12,
              background: 'var(--affine-background-secondary-color, #fafbfc)',
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: 'var(--affine-text-secondary-color, #667085)',
              }}
            >
              {label}
            </div>
            <div
              style={{
                marginTop: 6,
                fontWeight: 700,
                wordBreak: 'break-word',
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const Component = () => {
  const location = useLocation();
  const params = useParams<{
    workspaceId: string;
    projectId?: string;
    section?: string;
  }>();
  const workspaceId = params.workspaceId ?? '';

  const title = location.pathname.includes('/foundryos/admin')
    ? 'FoundryOS Admin'
    : params.projectId
      ? 'FoundryOS Project'
      : 'FoundryOS Customer';

  return (
    <>
      <ViewTitle title={title} />
      <ViewIcon icon="collection" />
      <ViewHeader>
        <WorkspaceFoundryHeader
          workspaceId={workspaceId}
          pathname={location.pathname}
        />
      </ViewHeader>
      <ViewBody>
        <div
          style={{
            padding: 20,
            background: 'var(--affine-background-secondary-color, #f7f8fb)',
            minHeight: '100%',
          }}
        >
          <FoundryOSSurface workspaceId={workspaceId} embeddedInWorkbench />
        </div>
      </ViewBody>
      <ViewSidebarTab tabId="foundry-nav" icon={<ViewLayersIcon />}>
        <div style={{ padding: 16, display: 'grid', gap: 18 }}>
          <SidebarSection
            title="Workspace Context"
            items={[
              ['Workspace', workspaceId || 'n/a'],
              ['Route', location.pathname],
              [
                'Mode',
                location.pathname.includes('/admin') ? 'Admin' : 'Customer',
              ],
            ]}
          />
        </div>
      </ViewSidebarTab>
      <ViewSidebarTab tabId="foundry-context" icon={<TodayIcon />}>
        <div style={{ padding: 16, display: 'grid', gap: 18 }}>
          <SidebarSection
            title="Selection"
            items={[
              ['Project', params.projectId ?? 'Portfolio'],
              ['Section', params.section ?? 'customer'],
              ['Shell', 'Workbench-native AFFiNE'],
            ]}
          />
        </div>
      </ViewSidebarTab>
    </>
  );
};
