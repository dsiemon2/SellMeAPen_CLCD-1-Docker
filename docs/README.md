# SellMeAPenExt - Extended Sales Training AI

**Type:** Sales Training Application
**Port:** 8081
**URL Prefix:** `/SellMeAPenExt/`

---

## Quick Start

```bash
# Start the application
docker compose up -d

# Access URLs
# Chat: http://localhost:8081/SellMeAPenExt/
# Admin: http://localhost:8081/SellMeAPenExt/admin?token=admin
```

---

## Features Overview

### Sales Training
- **Sessions** - Practice sales conversations with AI
- **Pen Product** - Product knowledge and specifications
- **Techniques** - Sales methodology training
- **Discovery Questions** - Customer needs assessment
- **Closing Strategies** - Deal closing techniques
- **Objection Handling** - Response to customer concerns

### AI Configuration
- AI Config settings
- Knowledge Base
- Greeting customization

---

## Database

**Database:** PostgreSQL 15 (via Docker)
**ORM:** Prisma

### Connection Details (Docker)
| Property | Value |
|----------|-------|
| Host | localhost |
| Port | 5437 |
| Database | sellmeapen_db |
| User | sellmeapen |

### Key Models
- `Session` - Sales practice sessions
- `PenProduct` - Product information
- `SalesTechnique` - Sales methodologies
- `DiscoveryQuestion` - Assessment questions
- `ClosingStrategy` - Closing techniques
- `Objection` - Common objections and responses
- `CallLog` - Session logs
- `IntentLog` - AI intent tracking

---

## Color Theme

| Element | Color | Hex |
|---------|-------|-----|
| Primary | Blue | `#2563eb` |
| Secondary | Dark Blue | `#1d4ed8` |
| Accent | Light Blue | `#3b82f6` |

---

## Related Documentation

- [CLAUDE.md](../../../CLAUDE.md) - Master reference
- [THEMING.md](../../../THEMING.md) - Theming guide
- [DATABASE-SCHEMAS.md](../../../DATABASE-SCHEMAS.md) - Full schemas
- [SAMPLE-DATA.md](../../../SAMPLE-DATA.md) - Sample data
