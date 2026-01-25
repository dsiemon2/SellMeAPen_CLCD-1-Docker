# SellMeAPen CLCD-1 - Setup Guide

## Quick Start

```bash
# Clone and start
cd SellMeAPen_CLCD-1-Docker
docker compose up -d --build

# Wait for healthy status
docker compose ps
```

## Access URLs

All URLs are prefixed with `/SellMeAPenExt` when running behind nginx.

### Frontend (User Training Interface)
| URL | Description |
|-----|-------------|
| http://localhost:8081/SellMeAPenExt/ | Home page / Splash |
| http://localhost:8081/SellMeAPenExt/auth/login | User login |
| http://localhost:8081/SellMeAPenExt/chat | Training chat interface |
| http://localhost:8081/SellMeAPenExt/dashboard | User dashboard |

### Backend (Admin Panel)
| URL | Description |
|-----|-------------|
| http://localhost:8081/SellMeAPenExt/admin/login | Admin login |
| http://localhost:8081/SellMeAPenExt/admin | Admin dashboard |

## Demo Credentials

### Frontend Users
| Email | Password | Role |
|-------|----------|------|
| user@demo.com | demo123 | user |

### Admin Users
| Email | Password | Role |
|-------|----------|------|
| admin@demo.com | admin123 | admin |

**Note:** Only users with `role: admin` can access the admin panel.

## Architecture

```
                    Port 8081
                       |
                    [Nginx]
                    /     \
                   /       \
    /SellMeAPenExt/*    /SellMeAPenExt/admin/*
         |                      |
    [App :3000]           [Admin :3001]
         \                     /
          \                   /
           [PostgreSQL :5432]
```

### Docker Services

| Service | Internal Port | External Port | Description |
|---------|---------------|---------------|-------------|
| postgres | 5432 | 5437 | PostgreSQL 15 database |
| app | 3000 | - | Main app (chat, auth, dashboard) |
| admin | 3001 | - | Admin panel |
| nginx | 80 | 8081 | Reverse proxy |

## URL Routing

Nginx routes requests based on path:

| External Path | Internal Route | Service |
|---------------|----------------|---------|
| `/SellMeAPenExt/admin/*` | `/admin/*` | admin:3001 |
| `/SellMeAPenExt/ws/*` | `/ws/*` | app:3000 (WebSocket) |
| `/SellMeAPenExt/*` | `/*` | app:3000 |

## Authentication Flow

### Frontend Login
1. User visits `/SellMeAPenExt/auth/login`
2. Enters email/password
3. If MFA enabled: redirected to MFA verification
4. On success: redirected to `/SellMeAPenExt/chat`

### Admin Login
1. Admin visits `/SellMeAPenExt/admin/login`
2. Enters email/password (must have `role: admin`)
3. On success: redirected to `/SellMeAPenExt/admin`

### Logout
- Frontend: Click logout -> `/SellMeAPenExt/auth/logout`
- Admin: Click logout in sidebar -> `/SellMeAPenExt/admin/logout`

## Docker Commands

```bash
# Start all services
docker compose up -d

# Rebuild after code changes
docker compose up -d --build

# View logs
docker compose logs -f app admin

# Stop all services
docker compose down

# Full rebuild (no cache)
docker compose down
docker compose build --no-cache
docker compose up -d

# Check container health
docker compose ps

# Access database
docker exec -it sellmeapenext_postgres psql -U sellmeapen -d sellmeapen_db
```

## Troubleshooting

### 502 Bad Gateway
```bash
# Check if containers are running
docker compose ps

# Restart containers
docker compose down && docker compose up -d --build
```

### Login Not Working
1. Verify correct URL: `/SellMeAPenExt/auth/login` (not `/auth/login`)
2. Check credentials: `user@demo.com` / `demo123`
3. For admin: `admin@demo.com` / `admin123`

### Database Issues
```bash
# Reset database
docker compose down -v
docker compose up -d --build
```

### Port Conflicts
Edit `docker-compose.yml` to change ports:
```yaml
services:
  nginx:
    ports:
      - "8082:80"  # Change 8081 to 8082
  postgres:
    ports:
      - "5438:5432"  # Change 5437 to 5438
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Required
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://sellmeapen:sellmeapen@postgres:5432/sellmeapen_db

# Security
ENCRYPTION_KEY=<64-char-hex>
SESSION_SECRET=<random-string>
ADMIN_TOKEN=admin

# Optional
PORT=3000
ADMIN_PORT=3001
DEFAULT_VOICE=alloy
```

## File Structure

```
SellMeAPen_CLCD-1-Docker/
├── docker/
│   ├── Dockerfile          # Multi-stage build
│   ├── entrypoint.sh       # Container startup
│   └── nginx.conf          # Reverse proxy config
├── src/
│   ├── routes/
│   │   ├── admin.ts        # Admin panel routes
│   │   ├── auth.ts         # Frontend auth routes
│   │   ├── chat.ts         # Chat API routes
│   │   └── dashboard.ts    # Dashboard routes
│   ├── middleware/
│   │   ├── auth.ts         # Authentication
│   │   ├── csrf.ts         # CSRF protection
│   │   └── permissions.ts  # RBAC
│   ├── server.ts           # Main app server
│   └── adminServer.ts      # Admin server
├── views/
│   ├── admin/              # Admin EJS templates
│   ├── auth/               # Auth EJS templates
│   └── *.ejs               # Other templates
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed.ts             # Sample data
└── docker-compose.yml      # Docker orchestration
```

## RBAC (Role-Based Access Control)

### Roles
| Role | Description | Admin Access |
|------|-------------|--------------|
| user | Regular user | No |
| content_manager | Content editing | No |
| analyst | Read-only analytics | No |
| admin | Full access | Yes |

### Admin-Only Features
- User management
- System settings
- Audit logs
- All configuration pages

---

*Last Updated: January 25, 2026*
