# Claude Code Session Memory

> **This file persists context between Claude Code sessions. Update this file as you work.**

## Project: Sell Me a Pen - AI Sales Training App

### Tech Stack
- **Backend**: Node.js + Express + TypeScript
- **Database**: Prisma + SQLite
- **Frontend**: EJS templates + Bootstrap 5 + Bootstrap Icons
- **Real-time**: WebSockets (OpenAI Realtime API)

### Architecture Overview
```
src/
  server.ts           - Main server (port 3000)
  adminServer.ts      - Admin panel server (port 3001)
  db/prisma.ts        - Prisma client
  routes/
    health.ts         - Health check endpoint
    chat.ts           - Chat API routes
    admin.ts          - Admin panel routes
  services/
    salesAI.ts        - AI sales logic
    saleAnalyzer.ts   - Sales analytics
  realtime/
    chatHandler.ts    - WebSocket chat handling

views/
  chat.ejs            - Main chat interface
  admin/              - Admin panel pages (20+ pages)
    dashboard.ejs
    sessions.ejs
    ai_config.ejs
    techniques.ejs
    ... and more

prisma/
  schema.prisma       - Database models (20+ models)
```

### Database Models (Key Ones)
- `SalesSession` - Training sessions
- `Message` - Chat messages
- `SessionAnalytics` - Per-session metrics
- `AppConfig` - App settings (greeting, voice, persona)
- `PenProduct` - Product details
- `SalesTechnique` - Sales strategies
- `DiscoveryQuestion` - Discovery phase questions
- `ClosingStrategy` - Closing techniques
- `ObjectionHandler` - Objection handling scripts

### Admin Routes
All admin routes require `?token=<ADMIN_TOKEN>` query parameter.

### Scripts
- `npm run dev` - Run main server with hot reload
- `npm run dev:admin` - Run admin server with hot reload
- `npm run build` - Compile TypeScript
- `npm run db:push` - Push schema to DB
- `npm run db:seed` - Seed database

---

## Current Session State

### Last Updated
2025-12-15

### In Progress
(Update this section when starting new work)
- None currently

### Recently Completed
(Move items here when done)
- Added Knowledge Base page with full CRUD functionality
  - Created KnowledgeDocument model in Prisma schema
  - Added /admin/knowledge-base route and view
  - Added sidebar nav link under AI Settings
  - Features: search, filter, bulk actions, pagination
- Updated docs/admin-guide.md with all missing sections (AI Tools, AI Agents, Logic Rules, Functions, SMS Settings, Call Transfer, DTMF Menu, WebHooks, Payments)
- Updated docs/README.md with complete admin panel feature list
- Verified all admin sidebar navigation items present and functional
- Confirmed all 9 sections work: WebHooks, SMS Settings, Call Transfer, DTMF Menu, AI Tools, AI Agents, Logic Rules, Functions, Payments
- Created persistent memory system (this file)

### Known Issues
(Track bugs and problems here)
- User reported sidebar items missing - RESOLVED (items were always present, may have been caching issue)

### TODO / Backlog
(Track future tasks here)
- None documented yet

---

## Important Notes for Future Sessions

### CRITICAL RULES
1. **NEVER kill processes on ports other than 8020 and 8021** - Only this app's ports
   - Main server (frontend): **PORT 8020**
   - Admin server (backend): **PORT 8021**
   - Do NOT touch any other ports when starting/restarting servers

### UI Standards (from CLAUDE.md)
- ALL action buttons need Bootstrap tooltips
- ALL data tables need: row selection, pagination, bulk actions
- Initialize tooltips on every page with JS

### Key Files to Check First
1. `prisma/schema.prisma` - Database structure
2. `src/routes/admin.ts` - Admin API endpoints
3. `views/admin/` - Admin panel templates
4. `.env` - Environment variables

---

## Session Log

### 2024-12-15
- Created CLAUDE_MEMORY.md for session persistence
- Explored project structure
- Documented architecture and key files

(Add new entries at the top when starting each session)
