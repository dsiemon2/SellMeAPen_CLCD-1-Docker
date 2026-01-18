# AI-Powered Sale Detection

This document explains how to replace keyword-based sale detection with true AI analysis that understands context, nuance, and conversational intent.

---

## Current Approach: Keyword Matching

```javascript
// Current implementation - simple string matching
const successKeywords = ['i\'ll buy it', 'yes please', 'order one'];
const isSaleConfirmed = successKeywords.some(kw => text.includes(kw));
```

**Limitations:**
- "I would never buy it" contains "buy it" but means NO
- "Sure, whatever" is casual agreement but might not match
- Can't detect sarcasm: "Oh yeah, I'll DEFINITELY buy that" (sarcastic)
- Context blind - doesn't know what question was asked

---

## Proposed Approach: GPT Analysis

Instead of keyword matching, send the conversation to GPT for contextual analysis.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     User Message                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              OpenAI Realtime API (GPT-4o)                   │
│                   (Handles conversation)                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Sale Detection Analysis                        │
│         (Separate GPT call to analyze outcome)              │
│                                                             │
│   Input: Last 5-10 messages of conversation                 │
│   Output: SALE_CONFIRMED | SALE_DENIED | UNDECIDED          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Trigger Appropriate Action                     │
│         (Show popup, update database, etc.)                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation

### Step 1: Create the Analysis Function

```typescript
// src/services/saleAnalyzer.ts

import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type SaleOutcome = 'SALE_CONFIRMED' | 'SALE_DENIED' | 'UNDECIDED';

interface AnalysisResult {
  outcome: SaleOutcome;
  confidence: number;  // 0-100
  reasoning: string;
}

export async function analyzeSaleOutcome(
  messages: Array<{ role: string; content: string }>
): Promise<AnalysisResult> {

  const systemPrompt = `You are a sales conversation analyzer. Your job is to determine if a customer has committed to purchasing a product.

IMPORTANT DISTINCTIONS:
- Interest ("I like it", "sounds good") is NOT a commitment
- A sale is ONLY confirmed when the customer explicitly agrees to purchase, order, or reserve
- The salesperson must have ASKED a closing question (e.g., "Would you like to order?")
- The customer must have given an affirmative response to that specific question

ANALYZE the conversation and return ONLY a JSON object:
{
  "outcome": "SALE_CONFIRMED" | "SALE_DENIED" | "UNDECIDED",
  "confidence": <0-100>,
  "reasoning": "<brief explanation>"
}

SALE_CONFIRMED: Customer explicitly agreed to buy/order/reserve after being asked
SALE_DENIED: Customer explicitly declined to purchase
UNDECIDED: Conversation is ongoing, no clear commitment either way

Be conservative - when in doubt, return UNDECIDED.`;

  const conversationText = messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',  // Use mini for speed/cost, or gpt-4o for accuracy
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Analyze this sales conversation:\n\n${conversationText}` }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,  // Low temperature for consistent analysis
    max_tokens: 200
  });

  const result = JSON.parse(response.choices[0].message.content || '{}');

  return {
    outcome: result.outcome || 'UNDECIDED',
    confidence: result.confidence || 0,
    reasoning: result.reasoning || 'Unable to analyze'
  };
}
```

### Step 2: Integrate into Chat Handler

```typescript
// In src/realtime/chatHandler.ts

import { analyzeSaleOutcome, SaleOutcome } from '../services/saleAnalyzer.js';

// After receiving user transcript...
case 'conversation.item.input_audio_transcription.completed':
  // Log the message
  await logMessage(dbSessionId, 'user', event.transcript, currentPhase);

  // Only analyze in closing phase
  if (currentPhase === 'closing') {
    // Get recent conversation history
    const recentMessages = await prisma.message.findMany({
      where: { sessionId: dbSessionId },
      orderBy: { createdAt: 'desc' },
      take: 10  // Last 10 messages for context
    });

    // Reverse to chronological order
    const messages = recentMessages.reverse().map(m => ({
      role: m.role,
      content: m.content
    }));

    // Analyze with AI
    const analysis = await analyzeSaleOutcome(messages);

    logger.info({
      outcome: analysis.outcome,
      confidence: analysis.confidence,
      reasoning: analysis.reasoning
    }, 'AI sale analysis');

    // Only act on high-confidence results
    if (analysis.confidence >= 80) {
      if (analysis.outcome === 'SALE_CONFIRMED') {
        await prisma.salesSession.update({
          where: { id: dbSessionId },
          data: {
            outcome: 'sale_made',
            saleConfirmed: true,
            currentPhase: 'completed',
            endedAt: new Date()
          }
        });
        clientWs.send(JSON.stringify({ type: 'sale_made' }));

      } else if (analysis.outcome === 'SALE_DENIED') {
        await prisma.salesSession.update({
          where: { id: dbSessionId },
          data: {
            outcome: 'no_sale',
            saleConfirmed: false,
            currentPhase: 'completed',
            endedAt: new Date()
          }
        });
        clientWs.send(JSON.stringify({ type: 'sale_denied' }));
      }
      // UNDECIDED = continue conversation
    }
  }
  break;
```

### Step 3: Optimize for Real-Time Performance

The above implementation adds latency. Here are optimization strategies:

#### Option A: Async Analysis (Non-Blocking)

```typescript
// Fire and forget - don't block the conversation
analyzeSaleOutcome(messages).then(analysis => {
  if (analysis.confidence >= 80 && analysis.outcome !== 'UNDECIDED') {
    // Update database and notify client
    handleSaleOutcome(analysis.outcome);
  }
}).catch(err => logger.error(err, 'Sale analysis failed'));
```

#### Option B: Debounced Analysis

```typescript
// Only analyze after 2 seconds of silence
let analysisTimeout: NodeJS.Timeout | null = null;

function scheduleAnalysis() {
  if (analysisTimeout) clearTimeout(analysisTimeout);

  analysisTimeout = setTimeout(async () => {
    const analysis = await analyzeSaleOutcome(messages);
    // Handle result...
  }, 2000);  // Wait 2 seconds after last message
}
```

#### Option C: Periodic Batch Analysis

```typescript
// Analyze every 5 messages instead of every message
let messagesSinceAnalysis = 0;

// After each message...
messagesSinceAnalysis++;
if (messagesSinceAnalysis >= 5) {
  messagesSinceAnalysis = 0;
  const analysis = await analyzeSaleOutcome(messages);
  // Handle result...
}
```

---

## Advanced: Structured Output with Tool Calls

For even more reliable parsing, use function calling:

```typescript
const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: conversationText }
  ],
  tools: [{
    type: 'function',
    function: {
      name: 'report_sale_outcome',
      description: 'Report the outcome of analyzing a sales conversation',
      parameters: {
        type: 'object',
        properties: {
          outcome: {
            type: 'string',
            enum: ['SALE_CONFIRMED', 'SALE_DENIED', 'UNDECIDED'],
            description: 'The determined outcome of the sales conversation'
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 100,
            description: 'Confidence level in the analysis (0-100)'
          },
          reasoning: {
            type: 'string',
            description: 'Brief explanation for the outcome determination'
          },
          key_phrase: {
            type: 'string',
            description: 'The specific customer phrase that determined the outcome'
          }
        },
        required: ['outcome', 'confidence', 'reasoning']
      }
    }
  }],
  tool_choice: { type: 'function', function: { name: 'report_sale_outcome' } }
});

const toolCall = response.choices[0].message.tool_calls?.[0];
const result = JSON.parse(toolCall?.function.arguments || '{}');
```

---

## Example Scenarios

### Scenario 1: Clear Sale
```
ASSISTANT: Would you like me to put one aside for you in the matte black?
USER: Yes, please do that.

Analysis: {
  "outcome": "SALE_CONFIRMED",
  "confidence": 95,
  "reasoning": "Customer explicitly agreed ('Yes, please do that') to the closing question about reserving a pen."
}
```

### Scenario 2: Interest but No Commitment
```
ASSISTANT: The matte black is our most popular. What do you think?
USER: I like that one.

Analysis: {
  "outcome": "UNDECIDED",
  "confidence": 85,
  "reasoning": "Customer expressed interest but no closing question was asked. 'I like that one' is preference, not purchase commitment."
}
```

### Scenario 3: Polite Decline
```
ASSISTANT: Would you like to place an order today?
USER: I appreciate the offer, but I think I'm good for now.

Analysis: {
  "outcome": "SALE_DENIED",
  "confidence": 90,
  "reasoning": "Customer politely declined the closing question with 'I'm good for now'."
}
```

### Scenario 4: Sarcasm Detection
```
ASSISTANT: This pen will change your life!
USER: Oh sure, a pen is definitely going to change my life.

Analysis: {
  "outcome": "UNDECIDED",
  "confidence": 75,
  "reasoning": "Response appears sarcastic. No genuine purchase interest detected."
}
```

### Scenario 5: Ambiguous Response
```
ASSISTANT: Can I put one aside for you?
USER: I mean, I guess?

Analysis: {
  "outcome": "UNDECIDED",
  "confidence": 60,
  "reasoning": "Response is hesitant and ambiguous. Not a clear commitment - salesperson should clarify."
}
```

---

## Cost & Performance Considerations

| Approach | Latency | Cost per Analysis | Accuracy |
|----------|---------|-------------------|----------|
| Keyword Matching | <1ms | $0 | Low (pattern-based) |
| GPT-4o-mini | 300-800ms | ~$0.0001 | High |
| GPT-4o | 500-1500ms | ~$0.001 | Very High |

### Recommendations

1. **Development/Testing**: Use GPT-4o for best accuracy
2. **Production**: Use GPT-4o-mini with confidence threshold
3. **High-Volume**: Consider caching common patterns + AI fallback

---

## Hybrid Approach (Best of Both)

Combine keyword matching for obvious cases with AI for nuanced ones:

```typescript
async function detectSaleOutcome(
  text: string,
  messages: Message[]
): Promise<SaleOutcome> {

  // Fast path: Check for obvious keywords first
  const obviousYes = ['yes i\'ll buy', 'i\'ll take it', 'order one'];
  const obviousNo = ['no thanks', 'not interested', 'i\'ll pass'];

  const lowerText = text.toLowerCase();

  if (obviousYes.some(kw => lowerText.includes(kw))) {
    return 'SALE_CONFIRMED';
  }

  if (obviousNo.some(kw => lowerText.includes(kw))) {
    return 'SALE_DENIED';
  }

  // Slow path: AI analysis for ambiguous cases
  const analysis = await analyzeSaleOutcome(messages);

  if (analysis.confidence >= 80) {
    return analysis.outcome;
  }

  return 'UNDECIDED';
}
```

---

## Database Schema Addition

Track AI analysis for learning and improvement:

```prisma
model SaleAnalysis {
  id            String   @id @default(cuid())
  sessionId     String
  outcome       String   // SALE_CONFIRMED, SALE_DENIED, UNDECIDED
  confidence    Int
  reasoning     String
  keyPhrase     String?
  wasCorrect    Boolean? // For human review/feedback
  createdAt     DateTime @default(now())

  session       SalesSession @relation(fields: [sessionId], references: [id])
}
```

---

## Summary

| Feature | Keyword Matching | AI Analysis |
|---------|-----------------|-------------|
| Speed | Instant | 300-1500ms |
| Cost | Free | ~$0.0001-0.001/analysis |
| Context Awareness | None | Full conversation |
| Sarcasm Detection | No | Yes |
| Nuance Handling | No | Yes |
| Ambiguity Handling | No | Yes (with confidence) |
| Maintenance | Manual keyword updates | Self-improving |

The AI approach transforms sale detection from pattern matching to true understanding, enabling the system to handle the infinite ways humans express agreement or disagreement.
