.PHONY: help build run clean

help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "Targets:"
	@echo "  help   Show this help message"
	@echo "  build  Build all workspace packages"
	@echo "  run    Run backend and frontend in development mode"
	@echo "  clean  Remove generated build artifacts"

build:
	@if [ ! -d node_modules ]; then \
		echo "node_modules not found, installing dependencies..."; \
		pnpm install --frozen-lockfile; \
	fi
	pnpm build

run:
	@if [ ! -d node_modules ]; then \
		echo "node_modules not found, installing dependencies..."; \
		pnpm install --frozen-lockfile; \
	fi
	pnpm dev

clean:
	rm -rf .turbo
	rm -rf dist
	rm -rf backend/dist backend/public
	rm -rf frontend/dist frontend/dist-lib
