# Development Guide

## Running Tests

### Local Tests
```bash
npm run test        # Run tests in watch mode
npm run test:run    # Run tests once
npm run coverage    # Run tests with coverage report
```

### Type Checking
```bash
npm run check       # Run TypeScript and Svelte type checking
```

## Testing CI Locally with Act

[Act](https://github.com/nektos/act) runs GitHub Actions workflows locally in Docker.

### Installation
```bash
brew install act
```

### Running CI Tests Locally
```bash
# Run the test workflow (matches GitHub Actions exactly)
act -j test --container-architecture linux/amd64

# List all available workflows
act -l
```

### Configuration
- Act is configured in `~/.config/act/actrc` to use the medium-sized runner image
- Requires `GITHUB_TOKEN` environment variable (set in `.envrc.local`)
- On M-series Macs, use `--container-architecture linux/amd64` flag

### Benefits
- Test CI changes before pushing to GitHub
- Faster iteration on workflow issues
- Matches GitHub Actions environment exactly (Node 22, Ubuntu)

## Node.js Version Management

This project uses Node.js 22 (LTS, supported until April 2027).

### Version Files and Locations

When updating the Node.js version, you must update these files:

1. **`.node-version`** - Auto-detected by `nvm`, `fnm`, and other version managers
2. **`.github/workflows/test.yml`** - Line 20: `node-version: '22'`
3. **`Dockerfile`** - Lines 2 and 24: `FROM node:22-slim`

Optional but recommended:
4. **`package.json`** - Add `engines` field to document version requirement:
   ```json
   "engines": {
     "node": ">=22.0.0"
   }
   ```

### Using the Correct Node Version Locally

This project uses `direnv` to automatically set the Node version from `.node-version`.

When you `cd` into the project directory, direnv will:
1. Read the Node version from `.node-version`
2. Add the Homebrew Node installation to your PATH
3. Show a message confirming which version is active

If the required version isn't installed, direnv will show a warning with the install command.

**Manual usage** (if you don't use direnv or need to override):

```bash
# With Homebrew (keg-only, not in PATH by default)
/opt/homebrew/opt/node@22/bin/node --version
/opt/homebrew/opt/node@22/bin/npm install

# Or add to PATH temporarily
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"

# With nvm (if installed)
nvm use 22

# With fnm (if installed)
fnm use 22
```

### Why Node 22?

- **LTS Status**: Long-term support until April 2027
- **Native Modules**: Better compatibility with `better-sqlite3` and other C++ addons
- **Consistency**: Matches production Docker environment

## Test Structure

Tests are located in:
- `src/lib/server/auth.test.ts` - Authentication and session tests
- `src/lib/db/schema.test.ts` - Database schema validation
- `src/tests/homepage.test.ts` - Route and page load tests

Framework: Vitest with happy-dom for browser environment simulation.
