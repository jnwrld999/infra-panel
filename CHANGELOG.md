# Changelog

All notable changes to InfraPanel are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [1.0.0] — 2026-03-25

### Added
- **Phase 1 — Backend Foundation**
  - FastAPI backend with SQLAlchemy 2.0, Alembic migrations, SQLite (WAL mode)
  - Discord OAuth2 authentication (authlib) with JWT access + refresh token rotation
  - HttpOnly cookie security with Fernet-encrypted sensitive fields
  - Role-based access control: owner, admin, operator, viewer, custom
  - Rate limiting via slowapi; token blocklist for immediate session revocation
  - Full audit log model with structured AppLog entries

- **Phase 2 — SSH & Server Management**
  - SSHService with Paramiko: RSA/Ed25519 key support, context manager interface
  - Server CRUD API with connection test endpoint
  - Background health-check service for all registered servers
  - Sequential server polling to avoid SQLAlchemy concurrency issues

- **Phase 3 — Plugins, Services, Sync & Logs**
  - Plugin management for Minecraft (.jar) and Discord bot cogs
  - Path traversal protection on all file operations
  - Systemd/Docker/PM2 service manager with injection-safe command builder
  - Sync jobs with dry-run mode; BackgroundTask-safe session handling
  - Structured log API with filtering by level, type, and server

- **Phase 4 — Discord Bot & User Management**
  - discord.py 2.x slash commands: /status, /ping, /restart, /suggest, /logs
  - /approve, /deny, /adduser owner-only commands with AuditLog writes
  - DM notification system for approval workflow events
  - Bot token whitelist per user (encrypted storage, normalized join table)
  - Approval/Freigabe workflow for operator proposals

- **Phase 5 — React Frontend & Electron Desktop App**
  - React 18, TypeScript, Vite, Tailwind CSS v4 (CSS-first theme)
  - Zustand auth store with 401 auto-refresh interceptor
  - i18next German + English localization
  - Pages: Dashboard, Servers, Plugins, Bots, Services, Sync, Users, Approvals, Logs, Settings
  - Electron 28 wrapper with nodeIntegration disabled, contextIsolation enabled

- **Phase 6 — Deploy Pipeline**
  - Nginx reverse proxy: HTTPS, rate limiting, security headers (HSTS, CSP), WebSocket support
  - Let's Encrypt SSL setup script for panel.galaxycraft.cc
  - PM2 ecosystem config for backend + bot process management
  - setup.sh, start.sh, start-electron.sh, deploy.sh scripts
  - XDG autostart + desktop application menu entry

- **Phase 7 — Version System**
  - `VERSION` file as single source of truth for semantic version
  - `GET /api/info` public endpoint: version, build date, environment
  - Version displayed in FastAPI docs, Sidebar header, and Settings → About
  - CHANGELOG.md (this file)

[Unreleased]: https://github.com/your-org/infra-panel/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/your-org/infra-panel/releases/tag/v1.0.0
