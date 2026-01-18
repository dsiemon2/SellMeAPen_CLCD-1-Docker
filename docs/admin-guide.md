# Admin Guide - Sell Me a Pen

## Accessing the Admin Panel

1. Start the admin server: `npm run dev:admin`
2. Open: `http://localhost:8021/admin?token=YOUR_TOKEN`
3. The token is set in your `.env` file as `ADMIN_TOKEN`

## Dashboard

The dashboard shows:
- **Total Sessions**: All training sessions conducted
- **Sales Made**: Sessions where a sale was completed
- **Conversion Rate**: Percentage of successful sales
- **Avg Messages/Sale**: How many exchanges before closing

Quick actions link to common configuration tasks.

## Sessions

### Viewing Sessions
- See all training sessions with outcomes
- Filter by date, outcome, phase
- Click "View" to see full conversation transcript

### Session Details
Each session shows:
- Complete message history (voice transcripts)
- Which sales phase each message was in
- Session duration
- Closing attempts made
- Final outcome (sale_made, no_sale, abandoned)

## Analytics

### Outcome Distribution
Pie chart showing:
- Sales Made (success)
- No Sale (customer declined or user gave up)
- Abandoned (disconnected)

### Top Performing Techniques
Shows which sales techniques have the highest success rate based on historical data.

### Learning Insights
AI-generated insights about patterns:
- Which discovery questions work best
- Common objection patterns
- Most effective closing strategies

## Voices & Languages

### Sales Mode
Choose who plays the salesperson:
- **AI Sells**: AI is the salesperson, user is the customer (default)
- **User Sells**: User is the salesperson, AI is the customer

### Difficulty Level (User Sells Mode Only)
How tough the AI customer is:
- **Easy**: Friendly, few objections, buys quickly
- **Medium**: Needs convincing, raises 2-3 objections
- **Hard**: Skeptical, challenges claims, requires excellent pitch
- **Expert**: "Wolf of Wall Street" level - dismissive, impatient, extremely tough

### Voice Selection
8 OpenAI voices available:
- **Male**: Ash, Echo, Verse
- **Female**: Alloy, Ballad, Coral, Sage, Shimmer

Each voice has different characteristics (confident, warm, energetic, etc.)

Note: Only American English accents are available through OpenAI. For British/other accents, integration with ElevenLabs or PlayHT would be required.

### Languages
- 15+ languages supported
- AI automatically responds in whatever language the user speaks
- Enable/disable languages as needed

## Greeting Configuration

### Welcome Message
The first message users hear. Should:
- Welcome them warmly
- Set expectations
- Tell them how to start

**AI Sells Mode Example:**
> "Welcome to AI Sales, Sell Me a Pen Training App! When you're ready, just say 'Sell me a pen' to begin your training session."

**User Sells Mode Example:**
> "Welcome to Sell Me a Pen training! You're the salesperson today, and I'm your customer. I'm set to medium difficulty. Ready? Alright... sell me this pen."

### Trigger Phrase
The phrase that starts the sales exercise in AI Sells mode (default: "sell me a pen").

## Pen Product Configuration

### Basic Info
- **Name**: Product name (e.g., "Executive Signature Pen")
- **Tagline**: Marketing tagline
- **Prices**: Base and premium pricing

### Features vs Benefits
- **Features**: What the pen HAS (technical specs)
- **Benefits**: What it DOES for the customer (outcomes)

The AI uses benefits for persuasion, features for credibility.

### Scarcity Message
Creates urgency (e.g., "Only 47 remain in this finish").

## Sales Techniques

Enable/disable individual techniques. Categories:
- **Discovery**: Question-asking techniques
- **Positioning**: How to frame the value
- **Persuasion**: Psychological influence
- **Closing**: Getting to yes
- **Objection Handling**: Responding to no

Each technique shows:
- Usage count
- Success rate (when used in successful sales)

## Discovery Questions

### Adding Questions
1. Enter the question text
2. Specify what it reveals (purpose)
3. Add optional follow-up
4. Select target need (professionalism, reliability, etc.)

### Best Practices
- Questions should be open-ended
- Focus on emotions and experiences
- Avoid yes/no questions

## Closing Strategies

Types of closes:
- **Assumptive**: Assumes the sale, asks about details
- **Soft**: Low pressure, tests interest
- **Urgency**: Creates time pressure
- **Summary**: Reviews benefits before asking

## Objection Handlers

Configure responses to common objections by category:
- **Price**: "Too expensive"
- **Need**: "I don't need it"
- **Timing**: "Let me think about it"
- **Trust**: "I'm not sure..."
- **Competition**: "I can get one anywhere"

## AI Configuration

### System Prompt
The main instruction set for the AI. Controls:
- Personality and tone
- Sales rules and approach
- Phase-specific behavior

### Phase Prompts
Additional guidance for each sales phase:
- Discovery: How to ask questions
- Positioning: How to present value
- Closing: How to ask for the sale

## Outcome Detection

The app uses **AI-powered detection** (not keyword matching) to determine outcomes:

### Sale Made Triggers
- User says "yes", "I'll take it", "sold", "deal", etc.
- In User Sells mode: AI customer agrees to buy

### No Sale Triggers
- User says "no thanks", "not interested", "I'll pass"
- User ends session: "bye", "goodbye", "I'm done"
- In User Sells mode: User gives up ("I quit", "forget it")

Popup notifications appear immediately when outcomes are detected.

## General Settings

- **App Name**: Display name for the application
- **AI Persona**: How the AI presents itself
- **Voice**: TTS voice selection

---

## Advanced Features

### AI Tools

Configure built-in and custom tools that the AI can use during conversations.

**Built-in Tools:**
- Toggle individual tools on/off
- Configure tool-specific settings

**Custom Tools:**
- Create custom API integrations
- Define webhook-based tools
- Configure function tools
- Set up database query tools

Each custom tool requires:
- Name and description
- Type (api, webhook, function, database)
- Endpoint URL (for API/webhook types)
- Parameter schema (JSON)

### AI Agents

Create specialized AI personas for different scenarios.

**Agent Configuration:**
- **Name**: Display name for the agent
- **Description**: What this agent specializes in
- **Persona**: System prompt defining behavior
- **Temperature**: Creativity level (0.0-1.0)
- **Tools**: Which tools this agent can use

Use cases:
- Different customer types for training
- Specialized sales scenarios
- Industry-specific personas

### Logic Rules

Define conditional flow rules that trigger actions based on events.

**Rule Components:**
- **Name**: Descriptive name
- **Priority**: Execution order (lower = first)
- **Trigger**: When to evaluate (message_received, session_start, etc.)
- **Condition**: JavaScript expression to evaluate
- **Action**: What to do when condition is true
- **Parameters**: Action-specific settings

Example rules:
- Auto-escalate when sentiment is negative for 3+ turns
- Switch to closing phase when interest signals detected
- Send webhook when sale is made

### Custom Functions

Create reusable JavaScript functions for advanced logic.

**Function Definition:**
- **Name**: Function identifier
- **Description**: What it does
- **Parameters**: Input parameters as JSON array
- **Body**: JavaScript code

Functions can be:
- Called from Logic Rules
- Used by AI Agents
- Triggered via webhooks

**Security Note:** Functions run in a sandboxed environment.

---

## Telephony Settings

### SMS Settings

Configure SMS notifications and templates for Twilio integration.

**Provider Configuration:**
- Provider (Twilio)
- Account SID
- Auth Token
- From Number

**Message Templates:**
- Welcome message (on session start)
- Completion message (on sale made)
- Follow-up message (post-session)

**Automation Toggles:**
- Auto-send welcome SMS
- Auto-send completion SMS
- Auto-send follow-up SMS

### Call Transfer

Configure live call transfer for escalation scenarios.

**Transfer Settings:**
- **Mode**: Blind, Warm, or Queue
- **Hold Music**: Default or custom URL
- **Timeout**: Seconds before fallback
- **Fallback Action**: What happens if transfer fails

**Transfer Destinations:**
- Add multiple destinations with priority
- Enable/disable individual destinations
- Configure phone numbers

**Trigger Conditions:**
- Transfer on sale made
- Transfer on escalation request
- Transfer on complex query

### DTMF Menu

Configure touch-tone menu options for phone interactions.

**Menu Settings:**
- Welcome message
- Input timeout (seconds)
- Invalid selection message
- Max retries before fallback

**Menu Items:**
- Map key presses (0-9, *, #) to actions
- Actions: transfer, message, end call, etc.

---

## Integrations

### WebHooks

Send events to external systems when things happen.

**Webhook Configuration:**
- **Name**: Descriptive name
- **URL**: Endpoint to call
- **Events**: Comma-separated event types
- **Secret**: HMAC signing secret (optional)

**Available Events:**
- session_started
- session_ended
- sale_made
- sale_denied
- message_received
- phase_changed

**Features:**
- Enable/disable individual webhooks
- Test webhooks with sample payload
- View last triggered time and fail count

### Payments

Configure payment processing for demo/real transactions.

**Provider Settings:**
- Provider (Stripe)
- API Key (publishable)
- Secret Key
- Webhook Secret
- Environment (test/live)

**Payment Options:**
- Currency (USD, EUR, etc.)
- Tax rate percentage
- Statement descriptor
- Collect billing address
- Allow coupon codes
- Send receipts

**Transaction History:**
- View recent transactions
- Status (pending, succeeded, failed, refunded)
- Amount and customer info

---

## Best Practices

### Improving Conversion
1. Review successful sessions for patterns
2. Enable techniques with high success rates
3. Refine discovery questions based on results
4. Update objection handlers for common blockers

### Monitoring Performance
1. Check analytics weekly
2. Look for declining conversion rates
3. Identify new objection patterns
4. Review abandoned sessions for issues

### Training Users (User Sells Mode)
1. Start with Easy difficulty
2. Progress to Medium once comfortable
3. Use Hard to challenge experienced salespeople
4. Expert mode for advanced training
