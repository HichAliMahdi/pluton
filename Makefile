.PHONY: help build run build-agents build-agents-only clean clean-all clean-cache clean-build

help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "Targets:"
	@echo "  help        Show this help message"
	@echo "  build       Build all workspace packages"
	@echo "  build-agents Build workspace packages + agent installers (.exe/.deb)"
	@echo "  build-agents-only Build only the downloadable agent installers (.exe/.deb)"
	@echo "  run         Run backend and frontend in development mode"
	@echo "  clean       Remove build + Pluton runtime data (plans, backups, caches)"
	@echo "  clean-build Remove build artifacts only"
	@echo "  clean-cache Remove runtime cache files (database-staging, downloads, etc)"
	@echo "  clean-all   Remove all artifacts including node_modules"

build:
	@if [ ! -d node_modules ]; then \
		echo "node_modules not found, installing dependencies..."; \
		pnpm install --frozen-lockfile; \
	fi
	pnpm build

build-agents: build
	@echo "Building downloadable agent installers..."
	pnpm build:agents
	@echo "Agent installers generated:"
	@ls -lh installers/windows/pluton-agent.exe installers/linux/pluton-agent.deb 2>/dev/null || true

build-agents-only:
	@if [ ! -d node_modules ]; then \
		echo "node_modules not found, installing dependencies..."; \
		pnpm install --frozen-lockfile; \
	fi
	@echo "Building downloadable agent installers only..."
	pnpm build:agents
	@echo "Agent installers generated:"
	@ls -lh installers/windows/pluton-agent.exe installers/linux/pluton-agent.deb 2>/dev/null || true

run:
	@if [ ! -d node_modules ]; then \
		echo "node_modules not found, installing dependencies..."; \
		pnpm install --frozen-lockfile; \
	fi
	pnpm dev

clean-build:
	@echo "Cleaning build artifacts..."
	rm -rf .turbo
	rm -rf dist
	rm -rf backend/dist backend/public backend/.turbo
	rm -rf frontend/dist frontend/dist-lib frontend/.turbo
	@echo "Build artifacts cleaned!"

clean:
	@echo "Cleaning build artifacts + Pluton runtime data..."
	$(MAKE) clean-build
	$(MAKE) clean-cache
	rm -rf data
	rm -rf /tmp/pluton
	rm -rf /var/lib/pluton 2>/dev/null || true
	@echo "Runtime data cleaned (workspace data/, /tmp/pluton, and /var/lib/pluton if permitted)."

clean-cache:
	@echo "Cleaning runtime cache and staging directories..."
	rm -rf /tmp/pluton/cache/database-staging
	rm -rf /tmp/pluton/cache/source-staging
	rm -rf /tmp/pluton/downloads
	rm -rf /tmp/pluton/restores
	@echo "Cache directories cleaned!"

clean-all: clean
	@echo "Removing node_modules and lock files..."
	rm -rf node_modules pnpm-lock.yaml
	rm -rf backend/node_modules
	rm -rf frontend/node_modules
	@echo "Full clean complete! Run 'make build' to reinstall dependencies."
