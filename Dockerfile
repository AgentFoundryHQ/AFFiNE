# AFFiNE — FoundryOS Frontend Shell
# Runs the rspack dev server (affine bundle --dev) which:
#   - serves the @affine/web SPA on port 8080 (0.0.0.0)
#   - proxies /foundryos-api → $FOUNDRYOS_API_URL (defaults to http://localhost:8000)
#
# In Docker Compose the proxy target is overridden to http://cockpit-api:8000
# via the FOUNDRYOS_API_URL environment variable.

FROM node:22-slim

WORKDIR /app

# Copy Yarn Berry release and workspace config first (cache layer)
COPY .yarnrc.yml .yarnrc.yml
COPY package.json yarn.lock* ./

# Copy .yarn directory (contains releases/yarn-4.13.0.cjs and patches)
# Exclude cache/unplugged via .dockerignore
COPY .yarn/ .yarn/

# Copy all workspace packages
COPY packages/ packages/
COPY blocksuite/ blocksuite/
COPY tools/ tools/
COPY scripts/ scripts/
COPY docs/ docs/
COPY tests/ tests/
COPY tsconfig.json tsconfig.node.json tsconfig.web.json tsconfig.eslint.json ./

# Create a minimal .git directory so the rspack html-plugin git-info lookup doesn't crash.
# The AFFiNE dev server reads git metadata (branch/commit) for injection into HTML.
# Without a repo it throws a fatal error at startup — a bare init is sufficient.
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/* \
    && git init && git config user.email "docker@foundryos" && git config user.name "FoundryOS" \
    && git commit --allow-empty -m "init"

# Patch root package.json to remove lifecycle scripts that fail in Docker:
#   postinstall: "yarn affine init && yarn husky"
#     - "yarn affine init" runs a build/codegen step requiring full source + built tools
#     - "yarn husky" sets up git hooks, which requires an interactive git repo
# --mode=skip-build does NOT suppress the ROOT workspace's own postinstall/prepare;
# it only skips lifecycle scripts for workspace *dependencies*. The only reliable
# fix is to delete the scripts before install runs.
RUN node -e "\
  const fs = require('fs'); \
  const p = JSON.parse(fs.readFileSync('package.json', 'utf8')); \
  const toRemove = ['postinstall', 'prepare']; \
  toRemove.forEach(s => { \
    if (p.scripts && p.scripts[s]) { \
      console.log('Docker build: removing root script:', s, '->', p.scripts[s]); \
      delete p.scripts[s]; \
    } \
  }); \
  fs.writeFileSync('package.json', JSON.stringify(p, null, 2)); \
  "

# Install dependencies
# Disable global cache (not useful in Docker).
# HUSKY=0 is kept as belt-and-suspenders in case any workspace dep tries to invoke husky.
RUN YARN_ENABLE_GLOBAL_CACHE=false HUSKY=0 \
    node .yarn/releases/yarn-4.13.0.cjs install --no-immutable

ENV NODE_ENV=development
ENV FOUNDRYOS_API_URL=http://cockpit-api:8000

# Port 8080 is hardcoded in DEFAULT_DEV_SERVER_CONFIG (host: 0.0.0.0)
EXPOSE 8080

# Runs rspack-dev-server for @affine/web, which reads FOUNDRYOS_API_URL
# to set the proxy target for /foundryos-api
CMD ["node", ".yarn/releases/yarn-4.13.0.cjs", "affine", "web", "dev"]
