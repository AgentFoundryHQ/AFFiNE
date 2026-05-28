export const WORKSPACE_ROUTE_PATH = '/workspace/:workspaceId/*';
export const SHARE_ROUTE_PATH = '/share/:workspaceId/:pageId';
export const NOT_FOUND_ROUTE_PATH = '/404';
export const CATCH_ALL_ROUTE_PATH = '*';
export const FOUNDRYOS_ROOT_ROUTE_PATH = '/foundryos';
export const FOUNDRYOS_CUSTOMER_ROUTE_PATH = '/foundryos/customer';
export const FOUNDRYOS_ADMIN_ROUTE_PATH = '/foundryos/admin';
export const FOUNDRYOS_PROJECT_ROUTE_PATH =
  '/foundryos/projects/:projectId/:section';
export const WORKSPACE_FOUNDRYOS_ROOT_ROUTE_PATH =
  '/workspace/:workspaceId/foundryos';
export const WORKSPACE_FOUNDRYOS_CUSTOMER_ROUTE_PATH =
  '/workspace/:workspaceId/foundryos/customer';
export const WORKSPACE_FOUNDRYOS_ADMIN_ROUTE_PATH =
  '/workspace/:workspaceId/foundryos/admin';
export const WORKSPACE_FOUNDRYOS_PROJECT_ROUTE_PATH =
  '/workspace/:workspaceId/foundryos/projects/:projectId/:section';

export function getWorkspaceDocPath(workspaceId: string, docId: string) {
  return `/workspace/${workspaceId}/${docId}`;
}

export function getFoundryOSProjectPath(projectId: string, section: string) {
  return `/foundryos/projects/${projectId}/${section}`;
}

export function getWorkspaceFoundryOSCustomerPath(workspaceId: string) {
  return `/workspace/${workspaceId}/foundryos/customer`;
}

export function getWorkspaceFoundryOSAdminPath(workspaceId: string) {
  return `/workspace/${workspaceId}/foundryos/admin`;
}

export function getWorkspaceFoundryOSProjectPath(
  workspaceId: string,
  projectId: string,
  section: string
) {
  return `/workspace/${workspaceId}/foundryos/projects/${projectId}/${section}`;
}
