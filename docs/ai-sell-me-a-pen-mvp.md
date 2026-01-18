# AI Digital Assistant MVP - Sell Me a Pen

## Overview
This MVP demonstrates an AI-powered voice assistant for sales training based on the famous "Sell Me This Pen" challenge from *The Wolf of Wall Street*.

The app supports **two training modes**:
- **AI Sells Mode**: AI is the salesperson, user practices sales resistance
- **User Sells Mode**: User is the salesperson, AI is a customer with configurable difficulty

> **Status**: IMPLEMENTED - Full voice support via OpenAI Realtime API

### Quick Start
```bash
npm install
cp .env.example .env  # Add your OPENAI_API_KEY
npx prisma db push && npx prisma db seed
npm run dev           # Voice chat on :8020
npm run dev:admin     # Admin on :8021
```

---

## Technology Stack

### Voice Processing
- **OpenAI GPT-4o Realtime API**: Real-time voice conversation
- **OpenAI Whisper**: Speech-to-text transcription
- **OpenAI TTS**: Text-to-speech with 8 voice options
- **WebSocket**: Bidirectional audio streaming

### Key Differentiator
This is **NOT** keyword/intent matching like Alexa or Google Assistant. It's pure AI understanding - the model comprehends context, nuance, and can handle any conversation flow naturally.

---

## Training Modes

### AI Sells Mode (Default)
The AI acts as a professional salesperson using:
- Discovery questions before pitching
- Need-based positioning
- Objection handling
- Multiple closing strategies

User practices **resisting** sales pressure and recognizing techniques.

### User Sells Mode
The AI acts as a potential customer with difficulty levels:

| Difficulty | Behavior |
|------------|----------|
| Easy | Friendly, few objections, buys quickly |
| Medium | Needs convincing, raises 2-3 objections |
| Hard | Skeptical, challenges claims, requires excellent pitch |
| Expert | "Wolf of Wall Street" level - dismissive, impatient, extremely tough |

User practices **making** sales and handling objections.

---

## How the AI Works

### 1. Discovery Phase
The AI *never* starts by pitching the pen.

Instead, it asks questions like:
- "When was the last time you needed to write something important?"
- "Do you value style, reliability, or comfort more in a writing tool?"
- "What does your current pen say about you?"

This establishes **context + emotional value**, the core of persuasive selling.

---

### 2. Positioning the Pen
After discovery, the AI frames the pen based on user needs:

| User Need | AI Selling Angle |
|----------|------------------|
| Professionalism | Frame pen as a status symbol |
| Reliability | Emphasize ink flow, durability |
| Creativity | Emphasize free-flow writing and inspiration |
| Organization | Emphasize precision, clarity, daily reliability |

---

### 3. Persuasion Techniques Used
- **Scarcity**: "This model sells out quickly."
- **Urgency**: "I can reserve one for you now."
- **Authority**: "Used by executives and creators."
- **Contrast principle**: Starts with premium, then offers standard.
- **Future pacing**: "Picture signing your next contract with this…"

---

### 4. Closing Strategies
The AI cycles through:
- **Assumptive closes** → "Want the matte black or brushed steel version?"
- **Soft closes** → "Would you like me to summarize why this fits you?"
- **Urgency closes** → "The last few units are in stock right now."

---

## Outcome Detection

The app uses **AI-powered analysis** to detect outcomes:

### Sale Made
- User agrees to purchase ("yes", "I'll take it", "sold")
- In User Sells mode: AI customer agrees to buy

### No Sale
- User declines ("no thanks", "not interested")
- User exits session ("bye", "goodbye", "I'm done")
- In User Sells mode: User gives up ("I quit", "forget it")

**Popup notifications** appear immediately when outcomes are detected.

---

## Language Support

- **15+ languages** supported
- AI **automatically responds in whatever language the user speaks**
- No configuration needed - speak Spanish, get Spanish responses

---

## Technical Architecture

### Core Components
- Real-time voice conversation via WebSocket
- State tracking for sales phases
- AI-powered outcome detection (not keyword matching)
- Configurable voices, difficulty, and techniques

### Stack
- **Backend**: Node.js + Express + TypeScript
- **Database**: Prisma + SQLite
- **AI**: OpenAI GPT-4o Realtime API
- **Frontend**: EJS + Bootstrap 5

---

## Example User Flows

### AI Sells Mode
**User:** Sell me this pen.
**AI:** "Sure — but first, what kind of situations do you most often find yourself needing a reliable pen for?"

(User answers)

**AI adapts:** "Oh, so signing client contracts is part of your routine. In that case, you'll want something that reflects credibility the moment you take it out…"

**AI closes:** "Should I reserve one for you in brushed silver or deep matte black?"

### User Sells Mode (Hard Difficulty)
**AI:** "Alright, sell me this pen."
**User:** "This pen will change the way you write."
**AI:** "That's what they all say. I have 50 pens already. Why do I need another one?"
**User:** "When was the last time a pen made you feel confident?"
**AI:** "Hmm, interesting question. Go on..."

---

## Test Scenarios

Use these to evaluate sales skills:

- "Sell me this pen without knowing anything about me."
- "Now ask me 3 questions before pitching."
- "Sell it to me like I'm a CEO."
- "Sell it to me like I'm a stressed-out student."
- "Sell it using only emotional appeal."
- "Convince me I *need* the pen even though I don't."

---

## Expansion Ideas (Future Roadmap)
- Multi-product selling (not just pens)
- Sales analytics dashboard with technique performance
- Role-based personas (aggressive, soft, luxury, humorous)
- CRM integration
- Gamified employee assessment mode with scoring
- Team leaderboards

---

## License
MIT — free to use, modify, and expand.

---

## Final Notes
This MVP showcases:
- Sales psychology
- Voice AI conversation design
- Adaptive reasoning
- Real-time outcome detection

It can be used for:
- Sales training programs
- Interview assessments
- AI agent demos
- Customer engagement prototypes
- Entertainment & gamification

---

**Enjoy your AI "Sell Me a Pen" Assistant!**
