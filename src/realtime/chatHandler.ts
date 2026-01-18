import { WebSocket } from 'ws';
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../db/prisma.js';
import { detectSaleOutcome, detectUserSaleOutcome } from '../services/saleAnalyzer.js';

const logger = pino();

// Difficulty-based customer personas for "User Sells" mode
const customerPersonas: Record<string, string> = {
  easy: `You are a FRIENDLY potential customer in a "Sell Me a Pen" training exercise.
You are EASY to sell to:
- You're genuinely interested in buying a pen
- You have few objections and they're mild
- You respond positively to basic sales techniques
- After 2-3 good points from the salesperson, you're ready to buy
- Say things like "That sounds interesting" and "Tell me more"
- Be warm and encouraging
- If they ask good discovery questions, give helpful answers
- If they make a decent pitch, agree to buy fairly quickly
- You WANT to be convinced`,

  medium: `You are a NEUTRAL potential customer in a "Sell Me a Pen" training exercise.
You are MODERATELY challenging:
- You're open to buying but need convincing
- Raise 2-3 objections (price, "I already have pens", "let me think about it")
- Respond well to good discovery questions and emotional pitches
- Need to see clear value before committing
- Be skeptical but fair - good salesmanship should win you over
- If they handle objections well, you'll buy
- Don't be a pushover, but don't be impossible either`,

  hard: `You are a SKEPTICAL potential customer in a "Sell Me a Pen" training exercise.
You are DIFFICULT to sell to:
- You're skeptical and hard to please
- Raise multiple objections: price, need, timing, alternatives
- Challenge their claims and ask for proof
- Use phrases like "I'm not convinced", "That's what they all say", "Prove it"
- Require excellent objection handling and emotional connection
- Only buy if they demonstrate exceptional sales skills
- Make them work hard for the sale
- You CAN be convinced, but only by truly skilled selling`,

  expert: `You are the TOUGHEST customer in a "Sell Me a Pen" training exercise - "Wolf of Wall Street" level.
You are EXTREMELY challenging:
- You're dismissive, skeptical, and have heard every pitch
- Interrupt them, challenge everything, show impatience
- Use objections like: "I have 50 pens", "This is a waste of time", "You can't sell", "Get to the point"
- Only the most exceptional, creative, and emotionally intelligent pitch has a chance
- Look for: Do they stay calm under pressure? Are they creative? Do they truly connect?
- You might buy if they show EXTRAORDINARY skill (persistence, creativity, emotional intelligence)
- Make them prove they deserve the sale
- Be tough but not impossible - Jordan Belfort could sell you this pen`
};

export async function handleChatConnection(clientWs: WebSocket) {
  logger.info('New chat client connected');

  const sessionId = uuidv4();
  let openaiWs: WebSocket | null = null;
  let dbSessionId: string = '';
  let currentPhase = 'greeting';
  let isWaitingForUserTranscript = false;
  let bufferedAssistantTranscript: string[] = [];
  let salesMode = 'ai_sells';
  let difficulty = 'medium';

  try {
    // Load configuration
    const config = await prisma.appConfig.findFirst();
    const penProduct = await prisma.penProduct.findFirst();
    const aiPromptConfig = await prisma.aIPromptConfig.findFirst({ where: { enabled: true } });
    const discoveryQuestions = await prisma.discoveryQuestion.findMany({ where: { enabled: true }, orderBy: { sortOrder: 'asc' } });
    const positioningAngles = await prisma.positioningAngle.findMany({ where: { enabled: true } });
    const closingStrategies = await prisma.closingStrategy.findMany({ where: { enabled: true } });
    const objectionHandlers = await prisma.objectionHandler.findMany({ where: { enabled: true } });

    // Get mode and difficulty
    salesMode = config?.salesMode || 'ai_sells';
    difficulty = config?.difficulty || 'medium';
    logger.info({ salesMode, difficulty }, 'Session mode configured');

    // Create database session
    const dbSession = await prisma.salesSession.create({
      data: {
        sessionId,
        currentPhase: 'greeting'
      }
    });
    dbSessionId = dbSession.id;

    // Create analytics entry
    await prisma.sessionAnalytics.create({
      data: { sessionId: dbSession.id }
    });

    // Build the system prompt based on mode
    const penFeatures = JSON.parse(penProduct?.features || '[]');
    const penBenefits = JSON.parse(penProduct?.benefits || '[]');
    const penVariants = JSON.parse(penProduct?.variants || '[]');

    let systemPrompt: string;

    if (salesMode === 'user_sells') {
      // USER SELLS MODE: AI is the customer
      const customerPersona = customerPersonas[difficulty] || customerPersonas.medium;

      systemPrompt = `${customerPersona}

CONTEXT: You're being pitched a pen by a salesperson (the user). This is a training exercise.

THE PEN BEING SOLD TO YOU:
- Name: ${penProduct?.name || 'Executive Signature Pen'}
- Tagline: "${penProduct?.tagline || 'Make Every Signature Count'}"
- Price: Around $50-130
- Features: ${penFeatures.join(', ')}
- Available in: ${penVariants.join(', ')}

YOUR ROLE:
1. After greeting, say "Alright, sell me this pen" or similar to start the exercise
2. Listen to their pitch and respond as a ${difficulty} customer would
3. If they ask discovery questions, answer based on your persona
4. Raise appropriate objections based on difficulty level
5. If you decide to buy, say clearly "Okay, I'll take it" or "You convinced me, I'll buy it"
6. If you decide NOT to buy, say clearly "No thanks, I'm not interested" or "Sorry, you haven't convinced me"

IMPORTANT RULES:
1. Keep responses conversational (2-4 sentences)
2. Stay in character as a ${difficulty} customer
3. NEVER use emojis - this is voice conversation
4. LANGUAGE: You MUST respond in the SAME language the user speaks. If they speak English, respond in English. If they speak Spanish, respond in Spanish. Match their language EXACTLY.
5. Be fair - if they demonstrate good sales skills matching the difficulty, let them win
6. Don't buy too easily (unless Easy mode) - make them earn it
7. If user says "bye", "goodbye", "I'm done", "end session", or similar exit phrases, acknowledge the end of the session politely and say goodbye`;

    } else {
      // AI SELLS MODE: AI is the salesperson (original behavior)
      const discoveryQuestionsText = discoveryQuestions
        .map(q => `- "${q.question}" (reveals: ${q.purpose})`)
        .join('\n');

      const positioningText = positioningAngles
        .map(p => `- For ${p.userNeed}: "${p.headline}" - ${p.emotionalHook}`)
        .join('\n');

      const closingText = closingStrategies
        .map(c => `- ${c.name}: "${c.script}" (use when: ${c.useWhen})`)
        .join('\n');

      const objectionText = objectionHandlers
        .map(o => `- If they say "${o.objection}": ${o.response.substring(0, 150)}...`)
        .join('\n');

      systemPrompt = `${aiPromptConfig?.systemPrompt || 'You are a world-class sales professional.'}

THE PEN YOU'RE SELLING:
- Name: ${penProduct?.name || 'Executive Signature Pen'}
- Tagline: "${penProduct?.tagline || 'Make Every Signature Count'}"
- Price: $${penProduct?.basePrice || 49.99} (Premium: $${penProduct?.premiumPrice || 129.99})
- Features: ${penFeatures.join(', ')}
- Benefits: ${penBenefits.join(', ')}
- Available in: ${penVariants.join(', ')}
- Scarcity: ${penProduct?.scarcityMessage || 'Limited edition'}

TRIGGER PHRASE: When the user says "${config?.triggerPhrase || 'sell me a pen'}", begin the sales process.

DISCOVERY QUESTIONS TO USE:
${discoveryQuestionsText}

POSITIONING ANGLES (match to discovered needs):
${positioningText}

CLOSING STRATEGIES:
${closingText}

OBJECTION HANDLING:
${objectionText}

SALES PHASES:
1. GREETING: Welcome them warmly. Wait for trigger phrase.
2. DISCOVERY: Ask 2-3 questions BEFORE pitching. Never pitch first!
3. POSITIONING: Frame the pen based on discovered needs.
4. CLOSING: Use appropriate closing techniques.

IMPORTANT RULES:
1. Keep responses conversational (2-4 sentences)
2. NEVER pitch before asking discovery questions
3. Listen to what they say and adapt
4. Be confident but not pushy
5. NEVER use emojis - this is voice conversation
6. LANGUAGE: You MUST respond in the SAME language the user speaks. If they speak English, respond in English ONLY. If they speak Spanish, respond in Spanish. Match their language EXACTLY - never switch languages unless they do first.
7. When they agree to buy (say yes, sold, I'll take it, etc.), celebrate naturally and confirm the sale
8. If user says "bye", "goodbye", "I'm done", "end session", or similar exit phrases, acknowledge politely and end the session`;
    }

    // Get OpenAI API key from database (selected provider) or fallback to env
    const openaiProvider = await prisma.aIProvider.findFirst({
      where: { code: 'openai', isConfigured: true }
    });
    const openaiApiKey = openaiProvider?.apiKey || process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      logger.error('No OpenAI API key configured');
      clientWs.send(JSON.stringify({ type: 'error', message: 'No OpenAI API key configured. Please add your API key in Admin > AI Providers.' }));
      clientWs.close();
      return;
    }

    // Connect to OpenAI Realtime API
    openaiWs = new WebSocket(
      'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview',
      {
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      }
    );

    // Store greeting config for later use - different based on mode
    let greetingMessage: string;
    if (salesMode === 'user_sells') {
      greetingMessage = `Welcome to Sell Me a Pen training! You're the salesperson today, and I'm your customer. I'm set to ${difficulty} difficulty. Ready? Alright... sell me this pen.`;
    } else {
      greetingMessage = config?.greeting || 'Welcome to AI Sales, Sell Me a Pen Training App! When you\'re ready, just say "Sell me a pen" to begin your training session.';
    }
    let sessionReady = false;

    openaiWs.on('open', () => {
      logger.info('Connected to OpenAI Realtime API');

      // Configure the session
      const sessionConfig = {
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: systemPrompt,
          voice: config?.selectedVoice || 'alloy',
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          input_audio_transcription: {
            model: 'whisper-1'
          },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500
          }
        }
      };

      openaiWs!.send(JSON.stringify(sessionConfig));
      logger.info('Sent session.update to OpenAI');
    });

    // Function to send greeting
    const sendGreeting = async () => {
      if (openaiWs && openaiWs.readyState === WebSocket.OPEN && !sessionReady) {
        sessionReady = true;
        logger.info({ greeting: greetingMessage }, 'Sending greeting to OpenAI');

        openaiWs.send(JSON.stringify({
          type: 'response.create',
          response: {
            modalities: ['text', 'audio'],
            instructions: `Say exactly: "${greetingMessage}"`
          }
        }));

        // Log greeting
        await logMessage(dbSessionId, 'assistant', greetingMessage, 'greeting');
      }
    };

    openaiWs.on('message', async (data) => {
      try {
        const event = JSON.parse(data.toString());

        if (event.type === 'response.done' || event.type === 'error') {
          logger.info({ type: event.type, error: event.error }, 'OpenAI event');
        }

        switch (event.type) {
          case 'session.created':
          case 'session.updated':
            logger.info({ type: event.type }, 'OpenAI session ready');
            // Notify client we're ready
            clientWs.send(JSON.stringify({ type: 'ready', sessionId }));
            // Send greeting now that session is confirmed
            await sendGreeting();
            break;

          case 'input_audio_buffer.speech_started':
            isWaitingForUserTranscript = true;
            bufferedAssistantTranscript = [];
            break;

          case 'response.audio.delta':
            // Forward audio to client
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'audio',
                audio: event.delta
              }));
            }
            break;

          case 'response.audio_transcript.delta':
            if (isWaitingForUserTranscript) {
              bufferedAssistantTranscript.push(event.delta);
            } else if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'assistant_transcript',
                text: event.delta
              }));
            }
            break;

          case 'response.audio_transcript.done':
            // Log complete assistant message
            if (event.transcript) {
              await logMessage(dbSessionId, 'assistant', event.transcript, currentPhase);

              // In USER_SELLS mode: AI is the customer - detect when AI agrees to buy
              if (salesMode === 'user_sells' && currentPhase !== 'greeting') {
                const conversationHistory = await prisma.message.findMany({
                  where: { sessionId: dbSessionId },
                  orderBy: { createdAt: 'asc' },
                  take: 15
                });

                const messages = conversationHistory.map(m => ({
                  role: m.role,
                  content: m.content
                }));

                // Use AI to detect if the customer (AI) has decided to buy or reject
                const analysis = await detectUserSaleOutcome(messages, difficulty);

                logger.info({
                  mode: 'user_sells',
                  aiResponse: event.transcript.substring(0, 100),
                  outcome: analysis.outcome,
                  confidence: analysis.confidence,
                  reasoning: analysis.reasoning
                }, 'User sells mode - AI customer analysis');

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
                    clientWs.send(JSON.stringify({
                      type: 'sale_made',
                      headline: analysis.popupHeadline || 'YOU MADE THE SALE!',
                      message: analysis.popupMessage || 'Great job! The customer bought the pen!'
                    }));
                    logger.info({ reasoning: analysis.reasoning }, 'User sells - Sale confirmed!');

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
                    clientWs.send(JSON.stringify({
                      type: 'sale_denied',
                      headline: analysis.popupHeadline || 'NO SALE',
                      message: analysis.popupMessage || 'The customer said no. Try a different approach!'
                    }));
                    logger.info({ reasoning: analysis.reasoning }, 'User sells - Sale denied!');
                  }
                }
              } else if (salesMode === 'ai_sells') {
                // AI SELLS mode: Check for sale success in AI's celebration response
                const lowerTranscript = event.transcript.toLowerCase();
                if (lowerTranscript.includes('congratulations') || lowerTranscript.includes('excellent choice') || lowerTranscript.includes('great choice')) {
                  // Don't trigger here - let the user transcript handler do the detection
                }
              }
            }
            break;

          case 'conversation.item.input_audio_transcription.completed':
            // User's speech transcribed
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'user_transcript',
                text: event.transcript
              }));

              // Log user message
              await logMessage(dbSessionId, 'user', event.transcript, currentPhase);

              // Phase handling differs by mode
              if (salesMode === 'ai_sells') {
                // AI SELLS MODE: Original behavior

                // Check for trigger phrase
                const triggerPhrase = config?.triggerPhrase?.toLowerCase() || 'sell me a pen';
                if (event.transcript.toLowerCase().includes(triggerPhrase)) {
                  currentPhase = 'discovery';
                  await prisma.salesSession.update({
                    where: { id: dbSessionId },
                    data: { currentPhase: 'discovery' }
                  });
                }

                // Phase progression: discovery -> positioning -> closing
                const messageCount = await prisma.message.count({ where: { sessionId: dbSessionId, role: 'user' } });

                if (currentPhase === 'discovery' && messageCount >= 3) {
                  currentPhase = 'positioning';
                  await prisma.salesSession.update({
                    where: { id: dbSessionId },
                    data: { currentPhase: 'positioning' }
                  });
                  logger.info({ phase: currentPhase, messageCount }, 'Phase advanced to positioning');
                } else if (currentPhase === 'positioning' && messageCount >= 5) {
                  currentPhase = 'closing';
                  await prisma.salesSession.update({
                    where: { id: dbSessionId },
                    data: { currentPhase: 'closing' }
                  });
                  logger.info({ phase: currentPhase, messageCount }, 'Phase advanced to closing');
                }

                // Check for exit phrases that should trigger sale detection immediately
                const lowerTranscript = event.transcript.toLowerCase();
                const exitPhrases = ['bye', 'goodbye', 'i\'m done', 'end session', 'not interested', 'no thanks', 'i don\'t want', 'forget it', 'never mind', 'i\'ll pass'];
                const buyPhrases = ['i\'ll take it', 'i\'ll buy', 'sold', 'deal', 'yes', 'sign me up', 'i want it', 'i\'m in'];
                const isExitSignal = exitPhrases.some(phrase => lowerTranscript.includes(phrase));
                const isBuySignal = buyPhrases.some(phrase => lowerTranscript.includes(phrase));

                // AI-powered sale detection - run on closing phase OR when exit/buy signal detected
                if (currentPhase === 'closing' || isExitSignal || isBuySignal || currentPhase !== 'greeting') {
                  const conversationHistory = await prisma.message.findMany({
                    where: { sessionId: dbSessionId },
                    orderBy: { createdAt: 'asc' },
                    take: 15
                  });

                  const messages = conversationHistory.map(m => ({
                    role: m.role,
                    content: m.content
                  }));

                  const analysis = await detectSaleOutcome(messages);

                  logger.info({
                    phase: currentPhase,
                    text: event.transcript,
                    outcome: analysis.outcome,
                    confidence: analysis.confidence,
                    reasoning: analysis.reasoning,
                    keyPhrase: analysis.keyPhrase,
                    isExitSignal,
                    isBuySignal
                  }, 'AI sale analysis');

                  // Lower confidence threshold for clear exit signals
                  const confidenceThreshold = isExitSignal ? 60 : 80;

                  if (analysis.confidence >= confidenceThreshold) {
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
                      clientWs.send(JSON.stringify({
                        type: 'sale_made',
                        headline: analysis.popupHeadline || 'SALE MADE!',
                        message: analysis.popupMessage || 'Congratulations! You closed the deal!'
                      }));
                      logger.info({ reasoning: analysis.reasoning }, 'Sale confirmed!');

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
                      clientWs.send(JSON.stringify({
                        type: 'sale_denied',
                        headline: analysis.popupHeadline || 'NO SALE',
                        message: analysis.popupMessage || 'The customer declined. Better luck next time!'
                      }));
                      logger.info({ reasoning: analysis.reasoning }, 'Sale denied!');
                    }
                  } else {
                    logger.info({ confidence: analysis.confidence }, 'Low confidence - continuing conversation');
                  }
                }
              } else {
                // USER SELLS MODE: User is the salesperson
                // Phase progression based on user messages (they're pitching)
                if (currentPhase === 'greeting') {
                  currentPhase = 'pitching';
                  await prisma.salesSession.update({
                    where: { id: dbSessionId },
                    data: { currentPhase: 'pitching' }
                  });
                  logger.info({ mode: 'user_sells' }, 'User started pitching');
                }

                // Check if user (salesperson) is giving up or leaving
                const lowerTranscript = event.transcript.toLowerCase();
                const giveUpPhrases = ['bye', 'goodbye', 'i give up', 'i\'m done', 'forget it', 'never mind', 'i quit', 'end session'];
                const isGivingUp = giveUpPhrases.some(phrase => lowerTranscript.includes(phrase));

                if (isGivingUp) {
                  // User gave up - trigger sale denied
                  await prisma.salesSession.update({
                    where: { id: dbSessionId },
                    data: {
                      outcome: 'no_sale',
                      saleConfirmed: false,
                      currentPhase: 'completed',
                      endedAt: new Date()
                    }
                  });
                  clientWs.send(JSON.stringify({
                    type: 'sale_denied',
                    headline: 'SESSION ENDED',
                    message: 'You ended the session without making a sale. Keep practicing!'
                  }));
                  logger.info({ transcript: event.transcript }, 'User sells - User gave up');
                }
                // Other sale detection happens in response.audio_transcript.done for user_sells mode
              }

              // Send buffered assistant transcript
              if (bufferedAssistantTranscript.length > 0) {
                clientWs.send(JSON.stringify({
                  type: 'assistant_transcript',
                  text: bufferedAssistantTranscript.join('')
                }));
                bufferedAssistantTranscript = [];
              }
            }
            isWaitingForUserTranscript = false;
            break;

          case 'error':
            logger.error({ error: event.error }, 'OpenAI error');
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'error',
                message: event.error?.message || 'Unknown error'
              }));
            }
            break;
        }
      } catch (err) {
        logger.error({ err }, 'Error processing OpenAI message');
      }
    });

    openaiWs.on('error', (err) => {
      logger.error({ err }, 'OpenAI WebSocket error');
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ type: 'error', message: 'OpenAI connection error' }));
      }
    });

    openaiWs.on('close', () => {
      logger.info('OpenAI connection closed');
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close();
      }
    });

  } catch (err) {
    logger.error({ err }, 'Error initializing chat session');
    clientWs.send(JSON.stringify({ type: 'error', message: 'Failed to initialize session' }));
    return;
  }

  // Handle messages from client
  clientWs.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === 'audio' && openaiWs && openaiWs.readyState === WebSocket.OPEN) {
        // Forward audio to OpenAI
        openaiWs.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: message.audio
        }));
      } else if (message.type === 'text' && openaiWs && openaiWs.readyState === WebSocket.OPEN) {
        // Send text message
        openaiWs.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text: message.text }]
          }
        }));
        openaiWs.send(JSON.stringify({ type: 'response.create' }));
      }
    } catch (err) {
      logger.error({ err }, 'Error processing client message');
    }
  });

  clientWs.on('close', async () => {
    logger.info({ sessionId }, 'Chat client disconnected');
    if (openaiWs) {
      openaiWs.close();
    }

    // Mark session as abandoned if not completed
    try {
      const session = await prisma.salesSession.findUnique({ where: { id: dbSessionId } });
      if (session && !session.endedAt) {
        await prisma.salesSession.update({
          where: { id: dbSessionId },
          data: {
            outcome: 'abandoned',
            endedAt: new Date()
          }
        });
      }
    } catch (err) {
      logger.error({ err }, 'Error closing session');
    }
  });

  clientWs.on('error', (err) => {
    logger.error({ err }, 'WebSocket error');
    if (openaiWs) {
      openaiWs.close();
    }
  });
}

async function logMessage(sessionId: string, role: string, content: string, phase: string) {
  try {
    await prisma.message.create({
      data: {
        sessionId,
        role,
        content,
        phase
      }
    });
  } catch (err) {
    logger.error({ err }, 'Error logging message');
  }
}
