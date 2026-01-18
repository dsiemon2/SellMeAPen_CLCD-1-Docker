# Sales Training Integration Guide

This guide explains how to adapt the **Sell Me a Pen** AI sales training platform for use in other applications and industries. The platform's modular architecture makes it easy to white-label and customize for any product or service.

---

## Overview

The sales training system uses a phased conversation approach powered by OpenAI's GPT-4o and Realtime API:

1. **Greeting** - Welcome the customer
2. **Discovery** - Ask questions to understand needs
3. **Positioning** - Present product/service based on discovered needs
4. **Closing** - Guide toward purchase decision

This methodology applies universally across industries.

---

## Integration Options

### Option 1: Embedded Widget (Recommended)

Embed the sales trainer as an iframe or web component in your existing application.

```html
<!-- Embed as iframe -->
<iframe
  src="https://your-sales-trainer.com/?product=concert-tickets&theme=dark"
  width="400"
  height="600"
  style="border: none; border-radius: 12px;">
</iframe>
```

### Option 2: API Integration

Use the REST API to integrate training sessions into your existing app flow.

```javascript
// Start a new training session
const response = await fetch('https://your-sales-trainer.com/api/session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    productId: 'vip-ticket-package',
    userName: 'John'
  })
});
const { sessionId } = await response.json();

// Send messages
await fetch(`/api/session/${sessionId}/message`, {
  method: 'POST',
  body: JSON.stringify({
    role: 'user',
    content: 'Tell me about the VIP experience'
  })
});
```

### Option 3: WebSocket Real-time Voice

Connect directly via WebSocket for voice-enabled training.

```javascript
const ws = new WebSocket('wss://your-sales-trainer.com/ws/chat');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'session.start',
    productConfig: { /* your product */ }
  }));
};
```

---

## Industry Examples

### 1. Event Tickets (SoupCookoof.com)

Train staff to sell concert tickets, festival passes, and VIP packages.

**Product Configuration:**
```json
{
  "name": "VIP Concert Experience",
  "tagline": "Front row memories that last forever",
  "basePrice": 150,
  "premiumPrice": 350,
  "features": [
    "Premium front-section seating",
    "Exclusive artist meet & greet",
    "Commemorative laminate pass",
    "Early venue entry",
    "VIP lounge access"
  ],
  "benefits": [
    "Create unforgettable memories",
    "Skip the crowds with early entry",
    "Get closer to your favorite artists",
    "Enjoy premium amenities"
  ],
  "variants": [
    { "name": "General Admission", "price": 75 },
    { "name": "Reserved Seating", "price": 150 },
    { "name": "VIP Package", "price": 350 },
    { "name": "Ultimate Fan Experience", "price": 500 }
  ],
  "scarcityMessage": "Only 12 VIP packages remaining for this show!"
}
```

**Discovery Questions:**
- "What kind of concert experience are you looking for?"
- "Is this for a special occasion?"
- "Have you seen this artist before? What was your experience?"
- "Are you coming with a group or looking for a solo experience?"
- "How important is being close to the stage for you?"

**Objection Handlers:**
| Objection | Response |
|-----------|----------|
| "Too expensive" | "I understand budget matters. Consider that VIP includes the meet & greet alone worth $100 elsewhere. Plus, you'll skip 2-hour merch lines. What's your time worth?" |
| "I'll just buy GA" | "GA is great for the atmosphere! Though from row 50, you'll mostly see screens. VIP puts you close enough to make eye contact. For a once-in-a-lifetime show, which memory do you want?" |
| "Need to check with friends" | "Totally get it! Should I hold these VIP spots for 24 hours while you check? They're going fast and I'd hate for your group to miss out." |

---

### 2. Hair Salons & Spas

Train receptionists and stylists to upsell services and retail products.

**Product Configuration:**
```json
{
  "name": "Signature Transformation Package",
  "tagline": "Because you deserve to feel amazing",
  "basePrice": 85,
  "premiumPrice": 195,
  "features": [
    "Consultation with senior stylist",
    "Precision cut & style",
    "Deep conditioning treatment",
    "Scalp massage",
    "Blowout & finishing"
  ],
  "benefits": [
    "Walk out feeling confident and refreshed",
    "Hair that's healthier AND looks amazing",
    "Expert advice on maintaining your look at home",
    "A relaxing escape from your busy day"
  ],
  "variants": [
    { "name": "Express Cut", "price": 45 },
    { "name": "Cut & Style", "price": 85 },
    { "name": "Signature Package", "price": 145 },
    { "name": "VIP Transformation", "price": 195 }
  ],
  "scarcityMessage": "Our senior stylist Sarah has just 2 openings this week!"
}
```

**Discovery Questions:**
- "What brings you in today - maintenance or looking for a change?"
- "How much time do you typically spend styling your hair each morning?"
- "Have you had any frustrations with your current cut or color?"
- "Do you have any special events coming up?"
- "What products are you currently using at home?"

**Closing Strategies:**
- **Assumptive**: "I'll book you with Sarah for the Signature Package on Thursday at 2pm - does that work?"
- **Add-on**: "Since you mentioned dryness, should I include the keratin treatment? It's normally $60 but just $35 when added to your package."
- **Urgency**: "Sarah's fully booked next month, but I can squeeze you in this Saturday if you'd like the VIP experience."

---

### 3. Auto Mechanic Shops

Train service advisors to recommend necessary maintenance and repairs.

**Product Configuration:**
```json
{
  "name": "Complete Vehicle Health Package",
  "tagline": "Keep your car running like new",
  "basePrice": 89,
  "premiumPrice": 289,
  "features": [
    "Full 50-point inspection",
    "Oil & filter change (synthetic)",
    "Tire rotation & pressure check",
    "Brake inspection",
    "Fluid top-off (all systems)",
    "Battery health test",
    "Air filter inspection"
  ],
  "benefits": [
    "Catch small problems before they become expensive repairs",
    "Extend the life of your vehicle",
    "Drive with confidence knowing everything's checked",
    "Maintain your warranty requirements",
    "Save money on fuel with proper maintenance"
  ],
  "variants": [
    { "name": "Basic Oil Change", "price": 49 },
    { "name": "Standard Service", "price": 89 },
    { "name": "Complete Health Package", "price": 189 },
    { "name": "Premium Detail & Service", "price": 289 }
  ],
  "scarcityMessage": "We have 2 bays available today - same-day service if you book now!"
}
```

**Discovery Questions:**
- "When was your last oil change or service?"
- "Have you noticed any unusual sounds, vibrations, or warning lights?"
- "How many miles do you drive per week?"
- "Any road trips or long drives coming up?"
- "Is this your daily driver or a secondary vehicle?"

**Objection Handlers:**
| Objection | Response |
|-----------|----------|
| "I just need an oil change" | "Absolutely, we can do just that. Though with 75K miles, a quick brake check takes 5 minutes and could save you from a $800 rotor replacement. Want me to have the tech take a quick look while it's up on the lift?" |
| "That's more than the dealer" | "I hear you. The dealer charges $350 for this same service, plus you'd wait 3 hours. We're $189, done in 90 minutes, and I'll personally call you if we find anything concerning." |
| "Let me think about it" | "Of course! Just so you know, that check engine light could be a $50 sensor or a $2000 catalytic converter. A quick diagnostic is $49 and gets credited toward any repair. Peace of mind for the cost of dinner?" |

---

### 4. Retail Merchandise (Apparel, Electronics, etc.)

Train floor staff to enhance the shopping experience and increase average order value.

**Product Configuration:**
```json
{
  "name": "Premium Wireless Headphones",
  "tagline": "Hear every detail, block every distraction",
  "basePrice": 199,
  "premiumPrice": 349,
  "features": [
    "Active noise cancellation",
    "40-hour battery life",
    "Premium leather ear cushions",
    "Bluetooth 5.3 multipoint",
    "Built-in microphone array",
    "Carrying case included"
  ],
  "benefits": [
    "Focus deeply on work without distractions",
    "Crystal-clear calls even in noisy environments",
    "All-day comfort for long listening sessions",
    "Seamlessly switch between phone and laptop"
  ],
  "variants": [
    { "name": "Sport Earbuds", "price": 129 },
    { "name": "Standard Over-ear", "price": 199 },
    { "name": "Premium ANC", "price": 279 },
    { "name": "Audiophile Edition", "price": 349 }
  ],
  "scarcityMessage": "This color is selling fast - only 3 left in stock!"
}
```

**Discovery Questions:**
- "What will you primarily use these for - music, calls, gaming?"
- "Do you work in a noisy environment or open office?"
- "How important is sound quality versus portability?"
- "What's your current setup and what's missing from it?"
- "Do you need them for workouts or just everyday use?"

---

### 5. Restaurant / Food Service

Train servers to enhance the dining experience through strategic recommendations.

**Product Configuration:**
```json
{
  "name": "Chef's Tasting Experience",
  "tagline": "A culinary journey crafted just for you",
  "basePrice": 45,
  "premiumPrice": 125,
  "features": [
    "5-course curated menu",
    "Wine pairing with each course",
    "Chef's tableside visit",
    "Amuse-bouche & palate cleanser",
    "Exclusive seasonal ingredients"
  ],
  "benefits": [
    "Experience dishes not on the regular menu",
    "Perfect for celebrations and special occasions",
    "Let our chef surprise and delight you",
    "Share a unique experience with your dining companions"
  ],
  "variants": [
    { "name": "Prix Fixe (3 course)", "price": 45 },
    { "name": "Chef's Selection (5 course)", "price": 75 },
    { "name": "With Wine Pairing", "price": 110 },
    { "name": "Ultimate Experience", "price": 125 }
  ],
  "scarcityMessage": "We only prepare 6 tasting menus per evening - 2 spots left tonight!"
}
```

**Discovery Questions:**
- "Is tonight a special occasion for you?"
- "Any dietary restrictions or preferences I should know about?"
- "Are you feeling adventurous or in the mood for familiar flavors?"
- "How hungry are we tonight - looking to share or have your own courses?"

---

## Configuration Steps

### Step 1: Database Setup

Update the `PenProduct` table (rename conceptually to `Product` for your use case):

```sql
-- Via Prisma Admin or direct SQL
UPDATE PenProduct SET
  name = 'Your Product Name',
  tagline = 'Your compelling tagline',
  basePrice = 99.00,
  premiumPrice = 199.00,
  features = '["Feature 1", "Feature 2", "Feature 3"]',
  benefits = '["Benefit 1", "Benefit 2", "Benefit 3"]',
  variants = '[{"name": "Basic", "price": 49}, {"name": "Premium", "price": 149}]',
  scarcityMessage = 'Limited availability!'
WHERE id = 1;
```

### Step 2: Customize Discovery Questions

Add questions relevant to your industry:

```sql
INSERT INTO DiscoveryQuestion (question, targetNeed, orderIndex, isActive)
VALUES
  ('What brings you in today?', 'general', 1, true),
  ('Is this for yourself or a gift?', 'occasion', 2, true),
  ('What is your budget range?', 'price_sensitivity', 3, true);
```

### Step 3: Configure AI Prompts

Update the `AIPromptConfig` for each phase:

```sql
UPDATE AIPromptConfig SET content = '
You are a friendly, knowledgeable sales associate at [YOUR BUSINESS].
Your goal is to understand customer needs and guide them to the right solution.
Be warm, professional, and focused on solving their problem.
Never be pushy - let the value speak for itself.
' WHERE phase = 'system';
```

### Step 4: Set Up Objection Handlers

```sql
INSERT INTO ObjectionHandler (objection, response, category, isActive)
VALUES (
  'too expensive',
  'I understand price is important. Let me show you the value breakdown - when you consider [specific benefits], it actually saves you money long-term.',
  'price',
  true
);
```

### Step 5: Configure Closing Strategies

```sql
INSERT INTO ClosingStrategy (name, description, promptText, orderIndex, isActive)
VALUES (
  'assumptive',
  'Assume the sale and move to logistics',
  'Assume they want to proceed. Ask about delivery preference or booking time.',
  1,
  true
);
```

---

## Admin Panel Customization

Access the admin panel at `/admin?token=your-token` to configure:

| Section | What to Configure |
|---------|-------------------|
| **Product** | Name, pricing, features, benefits, variants |
| **Greeting** | Welcome message and conversation trigger |
| **Discovery** | Questions to understand customer needs |
| **Closing** | Sales closing techniques and strategies |
| **Objections** | Responses to common customer concerns |
| **AI Config** | System prompts for each conversation phase |
| **Settings** | App name, AI voice, persona |

---

## Analytics & Training Insights

The platform tracks key metrics to improve sales performance:

- **Conversion Rate** - Sessions resulting in sales
- **Average Session Length** - Time to close
- **Top Performing Techniques** - Which strategies work best
- **Common Objections** - What customers push back on
- **Discovery Effectiveness** - Which questions lead to sales

Use the Analytics dashboard to identify:
1. Which discovery questions correlate with higher close rates
2. What objections need better responses
3. Which closing strategies are most effective
4. Where customers typically drop off

---

## Deployment Considerations

### Multi-tenant Setup

For SaaS deployments serving multiple businesses:

```typescript
// Add tenant context to sessions
interface SessionConfig {
  tenantId: string;
  productId: string;
  branding: {
    primaryColor: string;
    logo: string;
    companyName: string;
  };
}
```

### Environment Variables

```env
# Required
OPENAI_API_KEY=sk-...
DATABASE_URL=file:./prod.db
ADMIN_TOKEN=secure-random-token

# Optional
PORT=8020
ADMIN_PORT=8021
AI_MODEL=gpt-4o
DEFAULT_VOICE=alloy
```

### Scaling

- **SQLite** works for single-instance deployments
- For multi-instance, migrate to **PostgreSQL** or **MySQL**
- WebSocket connections require sticky sessions or Redis pub/sub

---

## White-Label Checklist

- [ ] Update product configuration for your offering
- [ ] Customize discovery questions for your industry
- [ ] Write objection handlers for common concerns
- [ ] Configure closing strategies appropriate to your sales cycle
- [ ] Update AI system prompts with your brand voice
- [ ] Customize the chat UI with your branding
- [ ] Set up analytics dashboards for your KPIs
- [ ] Train your team using the platform before customer deployment

---

## Support & Resources

- **API Documentation**: `/docs/api`
- **WebSocket Protocol**: `/docs/websocket`
- **Admin Guide**: `/docs/admin`

For technical support or custom integrations, contact your implementation team.
