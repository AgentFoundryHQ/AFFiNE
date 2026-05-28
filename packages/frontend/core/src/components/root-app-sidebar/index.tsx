// Import is already correct, no changes needed
import {
  AddPageButton,
  AppDownloadButton,
  AppSidebar,
  MenuItem,
  MenuLinkItem,
  QuickSearchInput,
  SidebarContainer,
  SidebarScrollableContainer,
} from '@affine/core/modules/app-sidebar/views';
import { ExternalMenuLinkItem } from '@affine/core/modules/app-sidebar/views/menu-item/external-menu-link-item';
import { AuthService, ServerService } from '@affine/core/modules/cloud';
import { WorkspaceDialogService } from '@affine/core/modules/dialogs';
import { FeatureFlagService } from '@affine/core/modules/feature-flag';
import { CMDKQuickSearchService } from '@affine/core/modules/quicksearch/services/cmdk';
import type { Workspace } from '@affine/core/modules/workspace';
import { useI18n } from '@affine/i18n';
import { track } from '@affine/track';
import type { Store } from '@blocksuite/affine/store';
import {
  AiOutlineIcon,
  AllDocsIcon,
  ImportIcon,
  JournalIcon,
  SettingsIcon,
  ViewLayersIcon,
} from '@blocksuite/icons/rc';
import { useLiveData, useService, useServices } from '@toeverything/infra';
import type { ReactElement } from 'react';
import { memo, useCallback, useEffect, useState } from 'react';

import {
  CollapsibleSection,
  NavigationPanelCollections,
  NavigationPanelFavorites,
  NavigationPanelMigrationFavorites,
  NavigationPanelOrganize,
  NavigationPanelTags,
} from '../../desktop/components/navigation-panel';
import { WorkbenchService } from '../../modules/workbench';
import { WorkspaceNavigator } from '../workspace-selector';
import {
  bottomContainer,
  quickSearch,
  quickSearchAndNewPage,
  workspaceAndUserWrapper,
  workspaceWrapper,
} from './index.css';
import { InviteMembersButton } from './invite-members-button';
import { AppSidebarJournalButton } from './journal-button';
import { NotificationButton } from './notification-button';
import { SidebarAudioPlayer } from './sidebar-audio-player';
import { TemplateDocEntrance } from './template-doc-entrance';
import { TrashButton } from './trash-button';
import { UpdaterButton } from './updater-button';
import UserInfo from './user-info';

export type RootAppSidebarProps = {
  isPublicWorkspace: boolean;
  onOpenQuickSearchModal: () => void;
  onOpenSettingModal: () => void;
  currentWorkspace: Workspace;
  openPage: (pageId: string) => void;
  createPage: () => Store;
  paths: {
    all: (workspaceId: string) => string;
    trash: (workspaceId: string) => string;
    shared: (workspaceId: string) => string;
  };
};

type FoundrySidebarProject = {
  project_id: string;
  display_name: string;
  asset_count?: number;
  routes?: {
    foundryos?: {
      overview?: string;
    };
  };
};

type FoundrySidebarPayload = {
  projects: FoundrySidebarProject[];
};

function resolveFoundrySidebarApiPath(path: string) {
  if (
    typeof window !== 'undefined' &&
    (window.location.port === '8080' || window.location.port === '')
  ) {
    return `/foundryos-api${path}`;
  }
  return `http://127.0.0.1:8000${path}`;
}

const AllDocsButton = () => {
  const t = useI18n();
  const { workbenchService } = useServices({
    WorkbenchService,
  });
  const workbench = workbenchService.workbench;
  const allPageActive = useLiveData(
    workbench.location$.selector(location => location.pathname === '/all')
  );

  return (
    <MenuLinkItem icon={<AllDocsIcon />} active={allPageActive} to={'/all'}>
      <span data-testid="all-pages">
        {t['com.affine.workspaceSubPath.all']()}
      </span>
    </MenuLinkItem>
  );
};

const AIChatButton = () => {
  const t = useI18n();
  const featureFlagService = useService(FeatureFlagService);
  const serverService = useService(ServerService);
  const serverFeatures = useLiveData(serverService.server.features$);
  const enableAI = useLiveData(featureFlagService.flags.enable_ai.$);

  const { workbenchService } = useServices({
    WorkbenchService,
  });
  const workbench = workbenchService.workbench;
  const aiChatActive = useLiveData(
    workbench.location$.selector(location => location.pathname === '/chat')
  );

  if (!enableAI || !serverFeatures?.copilot) {
    return null;
  }

  return (
    <MenuLinkItem icon={<AiOutlineIcon />} active={aiChatActive} to={'/chat'}>
      <span data-testid="ai-chat">
        {t['com.affine.workspaceSubPath.chat']()}
      </span>
    </MenuLinkItem>
  );
};

const FoundryOSButton = () => {
  const { workbenchService } = useServices({
    WorkbenchService,
  });
  const workbench = workbenchService.workbench;
  const foundryActive = useLiveData(
    workbench.location$.selector(location =>
      location.pathname.startsWith('/foundryos')
    )
  );

  return (
    <MenuLinkItem
      icon={<ViewLayersIcon />}
      active={foundryActive}
      to={'/foundryos/customer'}
    >
      <span data-testid="foundryos-entry">FoundryOS</span>
    </MenuLinkItem>
  );
};

const FoundryOSWorkspaceSection = () => {
  const { workbenchService } = useServices({
    WorkbenchService,
  });
  const workbench = workbenchService.workbench;
  const pathname = useLiveData(
    workbench.location$.selector(location => location.pathname)
  );
  const [projects, setProjects] = useState<FoundrySidebarProject[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch(
          resolveFoundrySidebarApiPath('/views/customer-shell'),
          {
            signal: controller.signal,
            headers: {
              Accept: 'application/json',
            },
          }
        );

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as FoundrySidebarPayload;
        setProjects(payload.projects ?? []);
      } catch {
        if (!controller.signal.aborted) {
          setProjects([]);
        }
      }
    };

    load().catch(() => {});
    return () => controller.abort();
  }, []);

  return (
    <CollapsibleSection
      path={['foundryos']}
      title="FoundryOS"
      contentStyle={{ padding: '6px 8px 0 8px' }}
      testId="navigation-panel-foundryos"
    >
      <MenuLinkItem
        icon={<ViewLayersIcon />}
        active={pathname?.startsWith('/foundryos/customer')}
        to="/foundryos/customer"
      >
        <span>Customer Console</span>
      </MenuLinkItem>
      <MenuLinkItem
        icon={<SettingsIcon />}
        active={pathname?.startsWith('/foundryos/admin')}
        to="/foundryos/admin"
      >
        <span>Admin Console</span>
      </MenuLinkItem>
      {projects.map(project => {
        const target =
          project.routes?.foundryos?.overview ??
          `/foundryos/projects/${project.project_id}/overview`;

        return (
          <MenuLinkItem
            key={project.project_id}
            icon={<AllDocsIcon />}
            active={pathname?.startsWith(
              `/foundryos/projects/${project.project_id}/`
            )}
            to={target}
          >
            <span>
              {project.display_name}
              {typeof project.asset_count === 'number'
                ? ` (${project.asset_count})`
                : ''}
            </span>
          </MenuLinkItem>
        );
      })}
    </CollapsibleSection>
  );
};

/**
 * This is for the whole affine app sidebar.
 * This component wraps the app sidebar in `@affine/component` with logic and data.
 *
 */
export const RootAppSidebar = memo((): ReactElement => {
  const { workbenchService, cMDKQuickSearchService, authService } = useServices(
    {
      WorkbenchService,
      CMDKQuickSearchService,
      AuthService,
    }
  );

  const sessionStatus = useLiveData(authService.session.status$);
  const t = useI18n();
  const workspaceDialogService = useService(WorkspaceDialogService);
  const workbench = workbenchService.workbench;
  const workspaceSelectorOpen = useLiveData(workbench.workspaceSelectorOpen$);
  const onOpenQuickSearchModal = useCallback(() => {
    cMDKQuickSearchService.toggle();
  }, [cMDKQuickSearchService]);

  const onWorkspaceSelectorOpenChange = useCallback(
    (open: boolean) => {
      workbench.setWorkspaceSelectorOpen(open);
    },
    [workbench]
  );

  const onOpenSettingModal = useCallback(() => {
    workspaceDialogService.open('setting', {
      activeTab: 'appearance',
    });
    track.$.navigationPanel.$.openSettings();
  }, [workspaceDialogService]);

  const handleOpenDocs = useCallback(
    (result: {
      docIds: string[];
      entryId?: string;
      isWorkspaceFile?: boolean;
    }) => {
      const { docIds, entryId, isWorkspaceFile } = result;
      // If the imported file is a workspace file, open the entry page.
      if (isWorkspaceFile && entryId) {
        workbench.openDoc(entryId);
      } else if (!docIds.length) {
        return;
      }
      // Open all the docs when there are multiple docs imported.
      if (docIds.length > 1) {
        workbench.openAll();
      } else {
        // Otherwise, open the only doc.
        workbench.openDoc(docIds[0]);
      }
    },
    [workbench]
  );

  const onOpenImportModal = useCallback(() => {
    track.$.navigationPanel.importModal.open();
    workspaceDialogService.open('import', undefined, payload => {
      if (!payload) {
        return;
      }
      handleOpenDocs(payload);
    });
  }, [workspaceDialogService, handleOpenDocs]);

  return (
    <AppSidebar>
      <SidebarContainer>
        <div className={workspaceAndUserWrapper}>
          <div className={workspaceWrapper}>
            <WorkspaceNavigator
              showEnableCloudButton
              showSyncStatus
              open={workspaceSelectorOpen}
              onOpenChange={onWorkspaceSelectorOpenChange}
              dense
            />
          </div>
          <UserInfo />
        </div>
        <div className={quickSearchAndNewPage}>
          <QuickSearchInput
            className={quickSearch}
            data-testid="slider-bar-quick-search-button"
            data-event-props="$.navigationPanel.$.quickSearch"
            onClick={onOpenQuickSearchModal}
          />
          <AddPageButton />
        </div>
        <AllDocsButton />
        <AppSidebarJournalButton />
        <FoundryOSButton />
        {sessionStatus === 'authenticated' && <NotificationButton />}
        <AIChatButton />
        <MenuItem
          data-testid="slider-bar-workspace-setting-button"
          icon={<SettingsIcon />}
          onClick={onOpenSettingModal}
        >
          <span data-testid="settings-modal-trigger">
            {t['com.affine.settingSidebar.title']()}
          </span>
        </MenuItem>
      </SidebarContainer>
      <SidebarScrollableContainer>
        <NavigationPanelFavorites />
        <NavigationPanelOrganize />
        <NavigationPanelMigrationFavorites />
        <FoundryOSWorkspaceSection />
        <NavigationPanelTags />
        <NavigationPanelCollections />
        <CollapsibleSection
          path={['others']}
          title={t['com.affine.rootAppSidebar.others']()}
          contentStyle={{ padding: '6px 8px 0 8px' }}
        >
          <TrashButton />
          <MenuItem
            data-testid="slider-bar-import-button"
            icon={<ImportIcon />}
            onClick={onOpenImportModal}
          >
            <span data-testid="import-modal-trigger">{t['Import']()}</span>
          </MenuItem>
          <InviteMembersButton />
          <TemplateDocEntrance />
          <ExternalMenuLinkItem
            href="https://affine.pro/blog?tag=Release+Note"
            icon={<JournalIcon />}
            label={t['com.affine.app-sidebar.learn-more']()}
          />
        </CollapsibleSection>
      </SidebarScrollableContainer>
      <SidebarContainer className={bottomContainer}>
        <SidebarAudioPlayer />
        {BUILD_CONFIG.isElectron ? <UpdaterButton /> : <AppDownloadButton />}
      </SidebarContainer>
    </AppSidebar>
  );
});

RootAppSidebar.displayName = 'memo(RootAppSidebar)';
