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
- Matches GitHub Actions environment exactly (Node 20, Ubuntu)

## Test Structure

Tests are located in:
- `src/lib/server/auth.test.ts` - Authentication and session tests
- `src/lib/db/schema.test.ts` - Database schema validation
- `src/tests/homepage.test.ts` - Route and page load tests

Framework: Vitest with happy-dom for browser environment simulation.
