# FoundryOS Integration

This document records the current upstream AFFiNE integration with the local
FoundryOS backend.

## Route Surface

The AFFiNE web app now exposes a dedicated FoundryOS route area:

- `/foundryos/customer`
- `/foundryos/admin`
- `/foundryos/projects/:projectId/:section`

Supported project sections:

- `overview`
- `content`
- `workflows`
- `observability`
- `runtime`

The route tree is mounted in
`packages/frontend/core/src/desktop/router.tsx`.

## Current UI Shape

The current AFFiNE implementation is no longer just a contract dump.

The customer-facing route now renders:

- a portfolio-style customer dashboard
- project cards with direct navigation into project surfaces
- curated runtime health summaries
- an asset-explorer-style content view for project content
- an operations-focused admin dashboard

The main customer surface lives in:

- `packages/frontend/core/src/desktop/pages/foundryos/index.tsx`

This is still a dedicated FoundryOS route area inside AFFiNE, not yet a
workbench-native AFFiNE workspace route backed by AFFiNE docs/collections.
That distinction matters because the full AFFiNE screenshots people expect come
from the native workspace/workbench stack, not from a standalone route page.

## Backend Contract

The route area reads from the FoundryOS cockpit API:

- `GET /views/customer-shell`
- `GET /views/admin-shell`
- `GET /projects/{project_id}`
- `GET /projects/{project_id}/content`
- `GET /projects/{project_id}/activity`
- `GET /projects/{project_id}/runtime-context`

The FoundryOS backend now also exposes:

- explicit `shell.routes.foundryos` values for customer/admin shells
- explicit `project.routes.foundryos` values for project sections
- CORS support for local AFFiNE web origins

## API Base Resolution

The AFFiNE route resolves the FoundryOS API base in this order:

1. query parameter `foundryos_api_base`
2. `window.__FOUNDRYOS_API_BASE__`
3. `localStorage['foundryos.apiBase']`
4. `/foundryos-api` when running on the local AFFiNE dev server
5. same-origin when running from FoundryOS on port `8000`
6. fallback `http://127.0.0.1:8000`

For direct browser testing against a different FoundryOS host, open a route such
as:

```text
http://localhost:8080/foundryos/customer?foundryos_api_base=http://127.0.0.1:8000
```

## Local Development

Start FoundryOS first:

```powershell
cd C:\_projects_\AgentFoundryHQ\FoundryOS\foundries\container-foundry\cockpit-api
. .\.venv\Scripts\Activate.ps1
$env:FOUNDRYOS_CONFIG_PROFILE = 'dev'
python -m uvicorn foundry_cockpit_api.app:app --host 127.0.0.1 --port 8000
```

Then start the AFFiNE web app from the repo-pinned Yarn runtime:

```powershell
cd C:\_projects_\AgentFoundryHQ\AFFiNE
node .yarn\releases\yarn-4.13.0.cjs install
node .yarn\releases\yarn-4.13.0.cjs affine server dev
node .yarn\releases\yarn-4.13.0.cjs affine web dev
```

The AFFiNE dev server proxies `/foundryos-api` to `http://localhost:8000`.

## Current Ownership Boundary

- AFFiNE owns the user-facing route area and presentation layer.
- FoundryOS owns project truth, runtime status, workflow state, approvals, and
  observability state.
- The AFFiNE content launch contract still comes from FoundryOS project content
  metadata.
- A future workbench-native implementation should reuse AFFiNE's workspace,
  sidebar, view, and explorer systems instead of keeping FoundryOS confined to a
  standalone route page.
