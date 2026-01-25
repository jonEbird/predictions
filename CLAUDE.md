# Claude Code Guidelines

This document contains guidelines for Claude when working on this repository.

## Git Commits

- **Do NOT include "Co-Authored-By: Claude" lines in commit messages**
- Keep commit messages clear and concise
- Focus on what changed and why
- **ALWAYS use specific file paths with `git add`** - Never use `git add -A`, `git add .`, or wildcard patterns
  - Good: `git add src/lib/db/index.ts vps/nginx/buckeyepredictions.conf`
  - Bad: `git add -A`, `git add .`, `git add *.md`
  - This prevents accidentally committing personal notes, build artifacts, or temporary files

## Development Workflow

- Always test changes locally with `act` before pushing to GitHub
- Use `act -j test --container-architecture linux/amd64` to run CI locally
- Verify tests pass before committing

## Environment Setup

- This repo uses `direnv` for environment management
- Local overrides go in `.envrc.local` (not committed)
- Docker setup uses vessel for compatibility (internal tool, not in committed files)
