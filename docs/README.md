# SellMeAPen CLCD-1 - AI Sales Training Platform

**Version:** 1.0.0 (January 2026)
**Type:** AI-Powered Sales Training Application
**Stack:** Node.js + Express + TypeScript + PostgreSQL + OpenAI Realtime API

---

## Quick Start

```bash
# Start with Docker
docker compose up -d

# Access URLs
Main App:    http://localhost:8081/SellMeAPenExt/
Admin Panel: http://localhost:8081/SellMeAPenExt/admin?token=admin
User Login:  http://localhost:8081/SellMeAPenExt/auth/login

# Demo Credentials
User:  user@demo.com / demo123
Admin: admin@demo.com / admin123
```

---

## Platform Overview

SellMeAPen is an enterprise-grade AI sales training platform that provides realistic voice-based roleplay practice for sales professionals. The platform uses OpenAI's Realtime API for natural conversations and supports multiple AI providers.

### Key Differentiators

- **Dual Training Modes** - AI can play salesperson OR buyer role
- **7 AI Providers** - OpenAI, Anthropic, Gemini, DeepSeek, Groq, Mistral, Grok
- **24 Languages** - Full multi-language support
- **Enterprise Security** - MFA, RBAC, audit logging, encryption
- **Self-Hosted** - Docker deployment for data sovereignty

---

## Features

### Core Training (10 Features)

| Feature | Description |
|---------|-------------|
| Real-time Voice Chat | WebSocket-based natural conversations |
| 8 AI Voice Options | Ash, Echo, Verse, Alloy, Ballad, Coral, Sage, Shimmer |
| Dual Sales Modes | AI sells to user OR user sells to AI |
| 4 Difficulty Levels | Easy, Medium, Hard, Expert |
| Sales Phase Tracking | Greeting > Discovery > Positioning > Closing |
| Session Management | Full lifecycle with outcome tracking |
| Message History | Complete conversation logs with metadata |
| Sentiment Analysis | Track positive/negative signals |
| Keyword Detection | Success and objection phrase detection |
| Performance Scoring | AI-powered 100-point scoring system |

### Sales Content Management (7 Features)

| Feature | Description |
|---------|-------------|
| Discovery Questions | Configurable questions with follow-ups |
| Closing Strategies | Multiple closing types with scripts |
| Objection Handlers | Category-based response library |
| Sales Techniques | Technique library with effectiveness tracking |
| Positioning Angles | Need-based messaging strategies |
| Product Configuration | Full pen product customization |
| Knowledge Base | Document library for AI context |

### Analytics & Reporting (7 Features)

| Feature | Description |
|---------|-------------|
| Session Scoring | Per-session grades with breakdown |
| Phase Analytics | Discovery, Positioning, Objections, Closing scores |
| Global Dashboard | Platform-wide metrics and trends |
| Technique Tracking | Success rate per technique |
| Learning Insights | AI-generated improvement suggestions |
| 14-Day Trends | Rolling performance analysis |
| Conversion Metrics | Sale/no-sale outcome tracking |

### Security & Authentication (10 Features)

| Feature | Description |
|---------|-------------|
| Bcrypt Passwords | 12 salt rounds with legacy migration |
| Two-Factor Auth | TOTP with recovery codes |
| Rate Limiting | 5 attempts per 15 minutes |
| CSRF Protection | Double-submit cookie pattern |
| Session Security | Ownership enforcement, secure cookies |
| API Key Encryption | AES-256-GCM encryption |
| Audit Logging | Full action tracking with IP/user agent |
| RBAC System | 4 roles with 18 permissions |
| Permission Caching | 5-minute TTL for performance |
| Account Management | Activate/deactivate users |

### Admin Panel (30+ Pages)

| Section | Pages |
|---------|-------|
| Dashboard | Overview with metrics |
| Training Content | Sessions, Discovery, Techniques, Closing, Objections, Positioning, Scenarios |
| AI Configuration | Providers, Prompts, Tools, Agents, Logic Rules, Functions |
| Gamification | Overview, Achievements, Leaderboard |
| Integration | Webhooks, SMS, CRM, Payments |
| System | Users, Audit Logs, Settings, Branding, Features |

### Integrations (8 Features)

| Feature | Description |
|---------|-------------|
| Webhooks | Event-driven with HMAC signing |
| Twilio SMS | Welcome, completion, follow-up messages |
| Call Transfer | Blind, warm, queue transfer modes |
| DTMF Menus | IVR-style phone menus |
| Payment Gateways | Stripe, Square, Braintree, Authorize.net |
| 7 AI Providers | Full multi-provider support |
| Custom Functions | JavaScript sandbox execution |
| REST APIs | Full programmatic access |

### Multi-Language Support (24 Languages)

English, Spanish, French, German, Italian, Portuguese, Chinese, Japanese, Korean, Arabic, Hindi, Russian, Polish, Dutch, Turkish, Swedish, Danish, Norwegian, Finnish, Czech, Greek, Hebrew, Thai, Vietnamese

---

## Architecture

```
+-------------------+     +-------------------+     +-------------------+
|    Nginx Proxy    | --> |   Main App (:3000)|     |  Admin App (:3001)|
|    (Port 8081)    |     |   Chat Interface  |     |   Admin Panel     |
+-------------------+     +-------------------+     +-------------------+
                                   |                        |
                                   v                        v
                          +-------------------+     +-------------------+
                          |   PostgreSQL DB   | <-- |   Prisma ORM      |
                          |   (Port 5437)     |     |   25+ Models      |
                          +-------------------+     +-------------------+
                                   |
                                   v
                          +-------------------+
                          |   OpenAI API      |
                          |   Realtime Voice  |
                          +-------------------+
```

### Database Schema (25+ Models)

**Core:** User, UserSession, SalesSession, Message, SessionAnalytics
**Content:** PenProduct, SalesTechnique, DiscoveryQuestion, ClosingStrategy, ObjectionHandler, PositioningAngle
**AI:** AIProvider, AIPromptConfig, CustomTool, AiAgent, LogicRule, CustomFunction
**Integration:** Webhook, SmsSettings, CallTransferSettings, DtmfSettings, PaymentGateway
**System:** AuditLog, Permission, RolePermission, Branding, StoreInfo, Features

---

## API Endpoints

### Chat APIs
```
POST   /chat/api/session                    Create new session
POST   /chat/api/session/:id/end            End session
GET    /chat/api/session/:id                Get session details
POST   /chat/api/session/:id/message        Log message
GET    /chat/api/session/:id/score          Get session score
GET    /chat/api/config                     Get configuration
```

### WebSocket
```
WS     /ws/chat                             Real-time chat connection
```

### Admin APIs
```
GET    /admin/api/sessions                  List sessions
DELETE /admin/api/sessions/:id              Delete session
GET    /admin/api/techniques                List techniques
POST   /admin/api/techniques                Create technique
PUT    /admin/api/techniques/:id            Update technique
DELETE /admin/api/techniques/:id            Delete technique
# ... similar patterns for all content types
```

---

## Configuration

### Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://user:pass@host:5432/db

# Security
ENCRYPTION_KEY=<64-char-hex>
SESSION_SECRET=<random-string>
ADMIN_TOKEN=<admin-panel-token>

# Optional
PORT=8030
ADMIN_PORT=8031
DEFAULT_VOICE=alloy

# Integrations
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
STRIPE_SECRET=...
```

### Docker Compose Services

| Service | Port | Description |
|---------|------|-------------|
| postgres | 5437 | PostgreSQL 15 database |
| app | 3000 (internal) | Main chat application |
| admin | 3001 (internal) | Admin panel |
| nginx | 8081 | Reverse proxy |

---

## Security

### Authentication Flow

1. User submits email/password
2. Rate limiter checks (5 attempts/15 min)
3. bcrypt verifies password (legacy SHA256 migrated)
4. If MFA enabled: redirect to TOTP verification
5. Session token created with configurable expiry
6. Secure cookie set (httpOnly, secure, sameSite)

### Permission System

```typescript
// 18 Permission Codes
USERS_READ, USERS_WRITE, USERS_DELETE
SESSIONS_READ, SESSIONS_WRITE, SESSIONS_DELETE
CONFIG_READ, CONFIG_WRITE
CONTENT_READ, CONTENT_WRITE
ANALYTICS_READ, ANALYTICS_EXPORT
AI_READ, AI_WRITE
AUDIT_READ
INTEGRATIONS_READ, INTEGRATIONS_WRITE
PAYMENTS_READ, PAYMENTS_WRITE

// 4 Default Roles
user            - Basic access
content_manager - Content editing
analyst         - Read-only analytics
admin           - Full access
```

### Audit Logging

All admin actions logged with:
- User ID and email
- Action type (create, update, delete, login, etc.)
- Resource type and ID
- IP address and user agent
- Success/failure status
- Timestamp

---

## Documentation

| Document | Description |
|----------|-------------|
| [README.md](./README.md) | This file - platform overview |
| [setup-guide.md](./setup-guide.md) | Installation and deployment |
| [admin-guide.md](./admin-guide.md) | Admin panel documentation |
| [ai-sale-detection.md](./ai-sale-detection.md) | Sale detection algorithm |
| [sales-psychology.md](./sales-psychology.md) | Sales methodology |
| [integration-guide.md](./integration-guide.md) | API and webhook integration |
| [scenario-integration-guide.md](./scenario-integration-guide.md) | Custom scenarios |
| [fullyramped-features-reference.md](./fullyramped-features-reference.md) | Feature reference |
| [recruiting-industry-guide.md](./recruiting-industry-guide.md) | Industry-specific guide |

---

## Roadmap

### ✅ Completed - January 2026

- [x] **Gamification MVP** - Points, levels, streaks, 15 achievements, leaderboards
- [x] **CRM Integrations** - Salesforce & HubSpot OAuth, field mapping, sync logs
- [x] **Scenario Library** - 25 pre-built training scenarios across 5 categories
- [x] **Speech Analytics** - WPM, filler words, clarity/confidence scoring
- [x] **Admin UX** - Sidebar scroll persistence, streamlined navigation

### Q2 2026 - Enhanced Training
- [ ] Methodology templates (SPIN, MEDDPICC, Challenger)
- [ ] Enhanced reporting dashboards
- [ ] Real-time speech coaching during sessions
- [ ] API rate limiting

### Q3 2026 - Advanced Features
- [ ] Meeting integrations (Zoom, Google Meet)
- [ ] Real call analysis
- [ ] Video avatars
- [ ] Mobile app MVP

### Q4 2026 - Market Leadership
- [ ] Live call assistant
- [ ] Hiring assessments
- [ ] Advanced AI analytics
- [ ] SOC 2 / ISO 27001 certification

---

## Support

- **Issues:** Report bugs and feature requests
- **Documentation:** See `/docs` directory
- **Admin Help:** Access admin panel at `/admin?token=YOUR_TOKEN`

---

## License

Proprietary - All rights reserved

---

*Last Updated: January 25, 2026*
