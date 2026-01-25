# Changelog

All notable changes to SellMeAPen CLCD-1 will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2026-01-25

### Added

#### Gamification System
- **Points & Levels** - Earn points for session grades (A=100, B=75, C=50, D=25, F=10) and sales bonuses
- **Achievements** - 15 achievements across milestones, performance, and streak categories
- **Leaderboards** - Daily, weekly, monthly, and all-time rankings
- **Streaks** - Track consecutive practice days with bonus points
- `src/services/gamificationService.ts` - Points calculation and awarding
- `src/services/achievementChecker.ts` - Achievement trigger logic
- `src/routes/gamification.ts` - Public gamification API endpoints
- `views/admin/gamification.ejs` - Admin overview dashboard
- `views/admin/achievements.ejs` - Achievement management
- `views/admin/leaderboard.ejs` - Leaderboard admin view

#### CRM Integrations
- **Salesforce** - OAuth 2.0 connection, session sync, field mapping
- **HubSpot** - OAuth 2.0 connection, engagement tracking, field mapping
- `src/services/crm/crmOAuth.ts` - OAuth flow handling
- `src/services/crm/salesforceClient.ts` - Salesforce API wrapper
- `src/services/crm/hubspotClient.ts` - HubSpot API wrapper
- `src/services/crm/crmSync.ts` - Session sync to CRM
- `views/admin/crm_integrations.ejs` - CRM configuration page
- Sync logs with retry capability

#### Pre-built Scenario Library
- **25 Scenarios** across 5 categories: Cold Call, Discovery, Demo, Objection, Closing
- Custom buyer personas with personality traits
- Difficulty levels: Easy, Medium, Hard, Expert
- Success criteria and coaching tips
- Usage tracking and average scores
- `views/admin/scenarios.ejs` - Scenario management page

#### Speech Analytics
- **Words Per Minute** - Speaking pace analysis
- **Filler Words** - Detection of um, uh, like, you know, etc.
- **Clarity Score** - Based on filler word percentage
- **Confidence Score** - Combined metrics analysis
- `src/services/speechAnalyzer.ts` - Speech analysis utilities
- Per-session speech metrics stored in database

#### Admin UX Improvements
- **Sidebar Scroll Persistence** - Scroll position saved to localStorage
- **Streamlined Navigation** - Removed Call Transfer and DTMF Menu (not relevant for chat-based training)
- **Renamed Telephony to Notifications** - SMS Settings for notifications only
- Active menu item auto-scrolls into view

#### Database Schema Updates
- `UserPoints` - Track user points, levels, streaks
- `Achievement` - Achievement definitions with tiers
- `UserAchievement` - Earned achievements per user
- `PointsHistory` - Points transaction log
- `GamificationSettings` - Configurable point values
- `CrmIntegration` - CRM provider connections
- `CrmFieldMapping` - Field mapping configuration
- `CrmSyncLog` - Sync transaction log
- `Scenario` - Pre-built training scenarios
- `SpeechAnalytics` - Per-session speech metrics

#### Sample Data
- 5 AI Agents (Skeptical Steve, Friendly Fran, Busy Barbara, Budget Bob, Technical Tom)
- 5 Logic Rules (price objection, competitor mention, buying signal, silence handler, multiple objections)
- 3 Custom Functions (calculate discount, check inventory, format price)
- 3 Webhooks with sample configurations
- 10 Sample Sessions with analytics
- User gamification data for demo user
- Audit log entries for demo admin

### Changed
- Updated sidebar navigation with new sections
- Trust proxy setting added for nginx reverse proxy
- Improved seed.ts with comprehensive sample data

### Fixed
- Nginx redirect now preserves port number (`$http_host` instead of `$host`)
- Express trust proxy for rate limiting behind nginx
- Prisma model name corrections in seed file

---

## [1.0.0] - 2026-01-23

### Added

#### Security Features
- **Two-Factor Authentication (MFA)** - TOTP-based MFA with QR code setup and 10 recovery codes
- **Role-Based Access Control (RBAC)** - 4 roles (user, content_manager, analyst, admin) with 18 granular permissions
- **Audit Logging** - Comprehensive action tracking with IP address, user agent, and success status
- **API Key Encryption** - AES-256-GCM encryption for sensitive credentials
- **Bcrypt Password Hashing** - 12 salt rounds with automatic legacy SHA256 migration
- **Rate Limiting** - Login protection (5 attempts per 15 minutes)
- **CSRF Protection** - Double-submit cookie pattern on all forms
- **Session Ownership** - Users can only access their own sessions (admin override)

#### MFA Implementation
- `views/auth/mfa_verify.ejs` - MFA code entry during login
- `views/auth/mfa_setup.ejs` - QR code setup with recovery codes
- `views/auth/settings.ejs` - User account settings page
- MFA routes in `src/routes/auth.ts` for setup, enable, disable, verify, recovery

#### User Management
- `views/admin/users.ejs` - Full user management interface
- Create, edit, delete users with role assignment
- Password reset capability
- Account activation/deactivation
- Bulk operations support

#### Audit System
- `views/admin/audit_logs.ejs` - Audit log viewer with filtering
- `src/middleware/auditLog.ts` - Logging middleware and utilities
- Action types: login, logout, create, update, delete, export
- Resource tracking for all configurable entities

#### Permission System
- `src/middleware/permissions.ts` - Full permission middleware
- 18 permission codes covering all admin functions
- Permission seeding on server startup
- Role-permission mapping with caching

#### Encryption Utilities
- `src/utils/encryption.ts` - AES-256-GCM encryption
- `src/utils/mfa.ts` - TOTP generation and verification
- Automatic detection of encrypted vs plain values
- Recovery code hashing and verification

#### Admin Panel Enhancements
- `views/admin/positioning.ejs` - Positioning angles management
- Updated `views/admin/_sidebar.ejs` - Added links to Positioning, Users, Audit Logs
- CSRF tokens added to all admin templates
- basePath support in all JavaScript fetch calls

#### Docker Updates
- Updated `docker-compose.yml` with SESSION_SECRET and ENCRYPTION_KEY
- `seedPermissions()` called at admin server startup
- Database seeding includes permissions

### Changed

#### Authentication Flow
- Login now checks for MFA and redirects to verification if enabled
- Password verification is now async (bcrypt)
- Legacy SHA256 passwords automatically upgraded on login
- Session creation includes lastLoginAt update

#### User Model
- Added `mfaEnabled`, `mfaSecret`, `recoveryCodes`, `mfaVerifiedAt` fields
- User type extended with `mfaEnabled` and `passwordHash`

#### Admin Server
- Startup now seeds permissions automatically
- Error handling improved for permission seeding

### Fixed

#### UI Compliance
- All admin templates now have CSRF tokens
- All action buttons have Bootstrap tooltips
- All data tables have row selection, pagination, bulk actions
- basePath used consistently across all templates

#### Security
- Session ownership enforced on all chat endpoints
- Admin routes protected with rate limiting
- CSRF protection on all state-changing operations

### Technical Debt Addressed

- Migrated from SHA256 to bcrypt password hashing
- Added comprehensive permission system
- Implemented proper audit logging
- Added API key encryption at rest

---

## [0.9.0] - 2026-01-22

### Added

#### Core Platform
- PostgreSQL database migration from SQLite
- Docker Compose deployment configuration
- Nginx reverse proxy with URL prefix support
- Multi-service architecture (app, admin, postgres, nginx)

#### Sales Training Features
- Discovery questions management
- Closing strategies management
- Objection handlers management
- Sales techniques management
- Positioning angles management
- Product configuration

#### AI Integration
- OpenAI Realtime API for voice conversations
- Multi-provider AI support (7 providers)
- Custom AI tools and agents
- Logic rules engine
- Custom functions with JavaScript execution

#### Admin Panel
- 25+ management pages
- Session management with detail view
- Analytics dashboard
- Webhook configuration
- SMS settings (Twilio)
- Call transfer configuration
- DTMF menu setup
- Payment gateway configuration
- Knowledge base management
- Branding customization

---

## [0.8.0] - 2026-01-20

### Added

#### Initial Release
- Basic chat interface
- Voice AI conversations
- Session tracking
- Admin panel foundation
- User authentication
- SQLite database

---

## Migration Notes

### Upgrading to 1.0.0

1. **Database Migration Required**
   ```bash
   npx prisma db push
   ```

2. **New Environment Variables**
   ```bash
   ENCRYPTION_KEY=<generate-with-node-crypto>
   SESSION_SECRET=<random-string>
   ```

3. **Permission Seeding**
   - Permissions are seeded automatically on admin server startup
   - Run `seedPermissions()` manually if needed

4. **MFA Setup**
   - Users can enable MFA at `/auth/settings`
   - Recovery codes should be saved securely

5. **Docker Rebuild**
   ```bash
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   ```

---

## Upcoming Features

### Planned for 1.1.0
- Salesforce CRM integration
- HubSpot CRM integration
- Gamification (leaderboards)
- Pre-built scenario library

### Planned for 1.2.0
- Speech coaching (pace, filler words)
- Methodology templates (SPIN, MEDDPICC)
- Enhanced reporting
- API rate limiting

### Planned for 2.0.0
- Meeting integrations (Zoom, Google Meet)
- Video avatars
- Mobile app
- Live call assistant

---

*For more details, see [gap_analysis.md](./gap_analysis.md)*
