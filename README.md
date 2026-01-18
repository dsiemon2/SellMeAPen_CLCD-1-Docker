# Sell Me A Pen

AI sales training - classic "sell me this pen" exercise.

**Production Domain:** www.sellmeapen.net

## Tech Stack

### Backend
- **Runtime:** Node.js
- **Framework:** Express 4.19
- **Language:** TypeScript 5.6
- **Database:** SQLite
- **ORM:** Prisma 5.19
- **WebSockets:** ws 8.18.0
- **AI:** OpenAI Realtime API

### Frontend
- **Templating:** EJS 3.1
- **CSS Framework:** Bootstrap 5
- **Icons:** Bootstrap Icons

## Training Features
- Skeptical AI buyer persona
- Evaluates: needs discovery, value proposition, urgency, objection handling, closing
- Voice interaction via OpenAI Realtime API

## Ports

| Service | Port | Description |
|---------|------|-------------|
| Nginx Proxy | 8081 | Main entry point |
| App Server | 3000 | Internal - Main application |
| Admin Server | 3001 | Internal - Admin panel |

## Local Development URLs

- **Landing Page:** http://localhost:8081/SellMeAPenExt/
- **Admin Panel:** http://localhost:8081/SellMeAPenExt/admin?token=admin

## Docker Setup

```bash
# Start all services
docker compose up -d

# Rebuild and start
docker compose up -d --build

# View logs
docker compose logs -f

# Stop all services
docker compose down
```

## Author

Daniel Siemon
