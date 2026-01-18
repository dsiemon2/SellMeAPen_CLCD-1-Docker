# Agent Implementation - SellMeAPen CLCD-1 (Variant)

## Project Overview

**Type**: Training & Education Platform
**Purpose**: Variant/iteration of the "Sell Me a Pen" sales training challenge

## Tech Stack

```
Backend:     Node.js + Express + TypeScript
Database:    SQLite + Prisma ORM
Voice:       OpenAI Realtime API (WebSockets)
Frontend:    EJS templates + Bootstrap 5 + Bootstrap Icons
Container:   Docker + Docker Compose
```

## Key Components

- `src/routes/` - Admin and training routes
- `prisma/schema.prisma` - Training schema
- Alternative version/branch of SellMeAPen_CLCD

## Key Features

- Same as SellMeAPen_CLCD (see that project)
- May include experimental features or different configurations

---

## Recommended Agents

*Same as SellMeAPen_CLCD-Docker*

### MUST IMPLEMENT (Priority 1)

| Agent | File | Use Case |
|-------|------|----------|
| **Backend Architect** | engineering/backend-architect.md | Session management, scoring system |
| **DevOps Automator** | engineering/devops-automator.md | Docker management |
| **AI Engineer** | engineering/ai-engineer.md | AI evaluator, sales technique assessment |
| **Database Admin** | data/database-admin.md | SQLite, training sessions |
| **Security Auditor** | security/security-auditor.md | User sessions |
| **Bug Debugger** | quality/bug-debugger.md | Voice and session issues |

### SHOULD IMPLEMENT (Priority 2)

| Agent | File | Use Case |
|-------|------|----------|
| **Frontend Developer** | engineering/frontend-developer.md | Training UI |
| **API Tester** | testing/api-tester.md | API validation |
| **Code Reviewer** | quality/code-reviewer.md | TypeScript patterns |
| **UI Designer** | design/ui-designer.md | Training interface |
| **Content Creator** | marketing/content-creator.md | Evaluation criteria |

---

## Agent Prompts Tailored for This Project

### AI Engineer Prompt Addition
```
Project Context:
- Variant of "Sell Me a Pen" challenge
- Same core functionality as SellMeAPen_CLCD
- May include different:
  - Buyer personas
  - Difficulty levels
  - Scoring algorithms
  - UI variations
- Voice interaction via OpenAI Realtime API
```

---

## Marketing & Growth Agents (When Production Ready)

Add these when the project is ready for public release/marketing:

### Social Media & Marketing

| Agent | File | Use Case |
|-------|------|----------|
| **TikTok Strategist** | marketing/tiktok-strategist.md | "Sell me a pen" challenges, sales technique clips |
| **Instagram Curator** | marketing/instagram-curator.md | Sales motivation, Wolf of Wall Street nostalgia |
| **Twitter/X Engager** | marketing/twitter-engager.md | Sales community, viral pen challenges |
| **Reddit Community Builder** | marketing/reddit-community-builder.md | r/sales, r/entrepreneur, r/movies |
| **Content Creator** | marketing/content-creator.md | Sales tips, evaluation rubrics, success stories |
| **SEO Optimizer** | marketing/seo-optimizer.md | "Sell me a pen" keywords, sales training SEO |
| **Visual Storyteller** | design/visual-storyteller.md | Training interface, pen imagery |

### Growth & Analytics

| Agent | File | Use Case |
|-------|------|----------|
| **Growth Hacker** | marketing/growth-hacker.md | Viral marketing, sales influencer partnerships |
| **Trend Researcher** | product/trend-researcher.md | Sales interview trends, training gamification |
| **Finance Tracker** | studio-operations/finance-tracker.md | Per-user revenue, usage metrics |
| **Analytics Reporter** | studio-operations/analytics-reporter.md | Pitch scores, improvement tracking |

---

## Note

This project appears to be a variant or experimental branch of SellMeAPen_CLCD. Consider:
1. Consolidating with the main project if differences are minimal
2. Documenting what makes this version different
3. Using feature flags instead of separate projects

---

## Implementation Commands

```bash
claude --agent engineering/backend-architect
claude --agent engineering/ai-engineer
claude --agent marketing/content-creator
claude --agent quality/bug-debugger
```
