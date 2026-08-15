.PHONY: help setup test run clean check coverage

# Use the Node version pinned in .node-version, not whatever is on the ambient PATH.
# Mismatched Node versions break native modules like better-sqlite3.
NODE_VERSION := $(shell tr -d '[:space:]' < .node-version)
NODE_BIN := /opt/homebrew/opt/node@$(NODE_VERSION)/bin
export PATH := $(NODE_BIN):$(PATH)

# Default target - show help
help:
	@echo "Available targets:"
	@echo "  make setup    - Ensure dependencies are installed (fast if already done)"
	@echo "  make test     - Run type checking and tests (matches CI)"
	@echo "  make check    - Run type checking only"
	@echo "  make coverage - Run tests with coverage report"
	@echo "  make run      - Start development server"
	@echo "  make clean    - Remove build artifacts and dependencies"

# Setup - run setup script (fast/quiet if already done)
setup:
	@./scripts/setup.sh

# Test - run what CI runs (type checking + tests)
test: setup
	@echo "==> Running type checking..."
	@npm run check
	@echo ""
	@echo "==> Running tests..."
	@npm run test:run

# Check - type checking only
check: setup
	@npm run check

# Coverage - run tests with coverage report
coverage: setup
	@npm run coverage

# Run - start development server
run: setup
	@npm run dev

# Clean - remove build artifacts and dependencies
clean:
	@echo "==> Cleaning build artifacts and dependencies..."
	rm -rf node_modules .svelte-kit build dist coverage
	@echo "✓ Cleaned!"
