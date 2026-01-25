import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Permission codes
const PERMISSIONS = {
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  USERS_DELETE: 'users:delete',
  SESSIONS_READ: 'sessions:read',
  SESSIONS_WRITE: 'sessions:write',
  SESSIONS_DELETE: 'sessions:delete',
  CONFIG_READ: 'config:read',
  CONFIG_WRITE: 'config:write',
  CONTENT_READ: 'content:read',
  CONTENT_WRITE: 'content:write',
  ANALYTICS_READ: 'analytics:read',
  ANALYTICS_EXPORT: 'analytics:export',
  AI_READ: 'ai:read',
  AI_WRITE: 'ai:write',
  AUDIT_READ: 'audit:read',
  INTEGRATIONS_READ: 'integrations:read',
  INTEGRATIONS_WRITE: 'integrations:write',
  PAYMENTS_READ: 'payments:read',
  PAYMENTS_WRITE: 'payments:write',
} as const;

// Simple password hashing (matches auth middleware)
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function seedPermissions() {
  console.log('Seeding permissions...');

  const permissionDefs = [
    { code: PERMISSIONS.USERS_READ, name: 'View Users', category: 'users', description: 'View user list and details' },
    { code: PERMISSIONS.USERS_WRITE, name: 'Manage Users', category: 'users', description: 'Create and edit users' },
    { code: PERMISSIONS.USERS_DELETE, name: 'Delete Users', category: 'users', description: 'Delete user accounts' },
    { code: PERMISSIONS.SESSIONS_READ, name: 'View Sessions', category: 'sessions', description: 'View training sessions' },
    { code: PERMISSIONS.SESSIONS_WRITE, name: 'Manage Sessions', category: 'sessions', description: 'Edit session data' },
    { code: PERMISSIONS.SESSIONS_DELETE, name: 'Delete Sessions', category: 'sessions', description: 'Delete sessions' },
    { code: PERMISSIONS.CONFIG_READ, name: 'View Config', category: 'config', description: 'View app configuration' },
    { code: PERMISSIONS.CONFIG_WRITE, name: 'Edit Config', category: 'config', description: 'Modify app settings' },
    { code: PERMISSIONS.CONTENT_READ, name: 'View Content', category: 'content', description: 'View sales content' },
    { code: PERMISSIONS.CONTENT_WRITE, name: 'Edit Content', category: 'content', description: 'Manage sales content' },
    { code: PERMISSIONS.ANALYTICS_READ, name: 'View Analytics', category: 'analytics', description: 'View reports and analytics' },
    { code: PERMISSIONS.ANALYTICS_EXPORT, name: 'Export Analytics', category: 'analytics', description: 'Export analytics data' },
    { code: PERMISSIONS.AI_READ, name: 'View AI Settings', category: 'ai', description: 'View AI configuration' },
    { code: PERMISSIONS.AI_WRITE, name: 'Edit AI Settings', category: 'ai', description: 'Manage AI configuration' },
    { code: PERMISSIONS.AUDIT_READ, name: 'View Audit Logs', category: 'audit', description: 'View audit trail' },
    { code: PERMISSIONS.INTEGRATIONS_READ, name: 'View Integrations', category: 'integrations', description: 'View webhooks and integrations' },
    { code: PERMISSIONS.INTEGRATIONS_WRITE, name: 'Manage Integrations', category: 'integrations', description: 'Configure integrations' },
    { code: PERMISSIONS.PAYMENTS_READ, name: 'View Payments', category: 'payments', description: 'View payment settings' },
    { code: PERMISSIONS.PAYMENTS_WRITE, name: 'Manage Payments', category: 'payments', description: 'Configure payment gateways' },
  ];

  // Upsert permissions
  for (const perm of permissionDefs) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { name: perm.name, category: perm.category, description: perm.description },
      create: perm
    });
  }

  // Seed default role permissions for admin (admin gets all permissions)
  const allPermissions = await prisma.permission.findMany();
  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        role_permissionId: { role: 'admin', permissionId: perm.id }
      },
      update: {},
      create: { role: 'admin', permissionId: perm.id }
    });
  }

  console.log('Permissions seeded successfully');
}

async function main() {
  console.log('Seeding database...');

  // ========================================
  // PERMISSIONS
  // ========================================
  await seedPermissions();

  // ========================================
  // DEMO USERS
  // ========================================
  console.log('Creating demo users...');

  // Demo User (regular user)
  await prisma.user.upsert({
    where: { email: 'user@demo.com' },
    update: {},
    create: {
      email: 'user@demo.com',
      passwordHash: hashPassword('demo123'),
      name: 'Demo User',
      role: 'user',
      isActive: true
    }
  });

  // Demo Admin
  await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {},
    create: {
      email: 'admin@demo.com',
      passwordHash: hashPassword('admin123'),
      name: 'Demo Admin',
      role: 'admin',
      isActive: true
    }
  });

  console.log('Demo users created: user@demo.com / demo123, admin@demo.com / admin123');

  // App Configuration
  // Keywords that explicitly confirm intent to purchase - NOT generic affirmatives
  const successKeywordsArray = [
    // === DIRECT PURCHASE STATEMENTS ===
    'i\'ll buy it', 'i\'ll buy one', 'i\'ll buy the pen', 'i will buy', 'i will buy it',
    'i\'m buying', 'i\'m buying it', 'i\'m buying one', 'i\'m gonna buy',
    'i want to buy', 'i\'d like to buy', 'i would like to buy', 'let me buy',
    'i\'ll purchase', 'i\'ll purchase one', 'i want to purchase',

    // === TAKE/GET STATEMENTS ===
    'i\'ll take it', 'i\'ll take one', 'i\'ll take the pen', 'i will take it',
    'i\'ll get it', 'i\'ll get one', 'i\'ll get the pen', 'i will get one',
    'i\'ll have it', 'i\'ll have one', 'give me one', 'give me the pen',
    'i\'ll grab one', 'let me get one', 'let me have one',

    // === ORDER/RESERVE STATEMENTS ===
    'order one', 'order me one', 'order me a pen', 'order it for me',
    'put one aside', 'set one aside', 'hold one for me', 'save one for me',
    'reserve one', 'reserve it', 'reserve it for me', 'reserve the pen',
    'place the order', 'place my order', 'submit the order',

    // === PAYMENT/TRANSACTION ===
    'take my money', 'shut up and take my money', 'here\'s my money',
    'where do i pay', 'how do i pay', 'how much do i owe', 'what do i owe',
    'ring it up', 'ring me up', 'wrap it up', 'bag it up',
    'i\'ll pay now', 'i\'ll pay for it', 'let me pay', 'ready to pay',
    'charge me', 'charge my card', 'put it on my card',

    // === SOLD/CONVINCED ===
    'sold', 'i\'m sold', 'you sold me', 'consider me sold',
    'you convinced me', 'you got me', 'you win', 'you\'ve convinced me',
    'i\'m convinced', 'that convinced me',

    // === AGREEMENT/COMMITMENT ===
    'sign me up', 'where do i sign', 'i\'m in', 'count me in',
    'deal', 'you got a deal', 'it\'s a deal', 'we have a deal',
    'done', 'done deal', 'let\'s do it', 'let\'s make it happen',
    'make it happen', 'hook me up', 'set me up',

    // === YES + PURCHASE CONTEXT ===
    'yes i\'ll buy', 'yes i\'ll take', 'yes i want it', 'yes i want one',
    'yes please', 'yes order one', 'yes put one aside', 'yes reserve',
    'yeah i\'ll buy', 'yeah i\'ll take', 'yeah i want one',
    'sure i\'ll buy', 'sure i\'ll take', 'sure i want one',
    'ok i\'ll buy', 'ok i\'ll take', 'okay i\'ll get one',
    'fine i\'ll buy', 'fine i\'ll take', 'alright i\'ll buy',

    // === EXPLICIT CONFIRMATION RESPONSES ===
    // These are responses to "Would you like to order?" or "Can I put one aside?"
    'yes please', 'yes do it', 'yes order it', 'yes order one',
    'yes put one aside', 'yes reserve it', 'yes i\'d like that',
    'please do', 'go ahead', 'go for it', 'do it',
    'yes you can', 'yes go ahead', 'that would be great',

    // === ENTHUSIASM (only after being asked) ===
    'hell yes', 'heck yes', 'absolutely yes', 'definitely yes',
    'can\'t say no to that', 'you twisted my arm',

    // === QUANTITY SPECIFIC ===
    'give me two', 'i\'ll take two', 'i want two', 'make it two',
    'i\'ll buy two', 'order me two', 'i\'ll get a couple'
  ];

  // Keywords that explicitly decline to purchase - NOT generic negatives
  const objectionKeywordsArray = [
    // === DIRECT REFUSALS (contraction + full form) ===
    'don\'t want it', 'do not want it', 'don\'t want one', 'do not want one',
    'don\'t want the pen', 'do not want the pen', 'don\'t want to buy', 'do not want to buy',
    'i won\'t buy', 'i will not buy', 'won\'t buy it', 'will not buy it',
    'not buying', 'i\'m not buying', 'i am not buying', 'not gonna buy',
    'refuse to buy', 'i refuse to buy', 'won\'t be buying', 'will not be buying',

    // === NOT FOR ME ===
    'not for me', 'isn\'t for me', 'is not for me', 'it\'s not for me',
    'this isn\'t for me', 'this is not for me', 'the pen isn\'t for me',
    'that\'s not for me', 'that is not for me', 'just not for me',
    'this pen isn\'t for me', 'this pen is not for me',

    // === POLITE DECLINES ===
    'no thanks', 'no thank you', 'no but thanks', 'thanks but no',
    'i\'ll pass', 'i will pass', 'i\'m gonna pass', 'gonna pass',
    'pass on this', 'pass on the pen', 'i\'ll have to pass',
    'i\'m good', 'i\'m fine', 'i\'m okay', 'i\'m all set',
    'i\'m good thanks', 'no i\'m good', 'i think i\'m good',

    // === NOT INTERESTED ===
    'not interested', 'i\'m not interested', 'i am not interested',
    'doesn\'t interest me', 'does not interest me', 'not my thing',
    'not really interested', 'not that interested',

    // === DON\'T NEED ===
    'don\'t need it', 'do not need it', 'don\'t need one', 'do not need one',
    'don\'t need the pen', 'do not need the pen', 'don\'t need a pen',
    'i don\'t need it', 'i do not need it', 'don\'t really need',
    'no need', 'have no need', 'i have no need',

    // === STRONG REFUSALS ===
    'absolutely not', 'definitely not', 'certainly not', 'no way',
    'hell no', 'heck no', 'nope', 'nah', 'never',
    'forget it', 'forget about it', 'not happening', 'not gonna happen',
    'i refuse', 'i decline', 'hard pass', 'hard no',
    'no chance', 'not a chance', 'no way in hell',

    // === PRICE OBJECTIONS (as final answer) ===
    'too expensive', 'way too expensive', 'too much', 'too much money',
    'can\'t afford', 'cannot afford', 'can\'t afford it', 'cannot afford it',
    'out of my budget', 'over my budget', 'beyond my budget',
    'not worth it', 'not worth the money', 'not worth the price',
    'waste of money', 'waste my money', 'too pricey', 'too rich for me',

    // === NEGATIVE DEAL LANGUAGE ===
    'no deal', 'deal\'s off', 'deal is off', 'the deal is off',
    'not a deal', 'can\'t do the deal', 'cannot make this deal',

    // === CHANGED MIND / WALKING AWAY ===
    'i changed my mind', 'i\'ve changed my mind', 'changed my mind',
    'never mind', 'nevermind', 'forget i asked',
    'i\'m done', 'we\'re done', 'i\'m out', 'count me out',
    'i\'m leaving', 'i\'ll leave', 'goodbye', 'i\'m walking away',

    // === NOT TODAY / NOT NOW (as final answer) ===
    'not today', 'not now', 'not right now', 'maybe another time',
    'some other time', 'another day', 'not this time',

    // === ALREADY HAVE / DON\'T USE ===
    'i have a pen', 'i already have', 'already have one', 'got one already',
    'i have enough pens', 'don\'t use pens', 'i don\'t write',

    // === MISC REJECTIONS ===
    'i said no', 'the answer is no', 'my answer is no', 'still no',
    'i\'m saying no', 'that\'s a no', 'that is a no', 'it\'s a no from me',
    'no can do', 'not happening today', 'ain\'t buying', 'ain\'t gonna buy'
  ];

  await prisma.appConfig.upsert({
    where: { id: 'default' },
    update: {
      successKeywords: JSON.stringify(successKeywordsArray),
      objectionKeywords: JSON.stringify(objectionKeywordsArray)
    },
    create: {
      id: 'default',
      appName: 'AI Sales Training - Sell Me a Pen',
      greeting: 'Welcome to AI Sales, Sell Me a Pen Training App! When you\'re ready, just say "Sell me a pen" to begin your training session.',
      triggerPhrase: 'sell me a pen',
      selectedVoice: 'alloy',
      aiPersona: 'confident, charismatic sales professional who never pitches first but asks smart questions',
      successKeywords: JSON.stringify(successKeywordsArray),
      objectionKeywords: JSON.stringify(objectionKeywordsArray),
      maxClosingAttempts: 3
    }
  });

  // Pen Product
  await prisma.penProduct.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      name: 'Executive Signature Pen',
      tagline: 'Make Every Signature Count',
      basePrice: 49.99,
      premiumPrice: 129.99,
      features: JSON.stringify([
        'Precision-engineered tungsten carbide tip',
        'German-engineered ink flow system',
        'Aircraft-grade aluminum body',
        'Lifetime warranty',
        'Personalized engraving available',
        'Refillable cartridge system'
      ]),
      benefits: JSON.stringify([
        'Projects confidence and professionalism',
        'Never skips or smears - guaranteed',
        'Comfortable for hours of writing',
        'Makes a lasting impression in meetings',
        'Perfect balance and weight distribution'
      ]),
      variants: JSON.stringify([
        'Matte Black',
        'Brushed Silver',
        'Rose Gold',
        'Carbon Fiber Limited Edition'
      ]),
      scarcityMessage: 'Limited edition - only 47 remain in this finish'
    }
  });

  // Discovery Questions
  const discoveryQuestions = [
    {
      question: 'When was the last time you needed to write something really important?',
      purpose: 'Identifies writing frequency and importance',
      followUp: 'What were you signing or writing?',
      targetNeed: 'professionalism'
    },
    {
      question: 'Do you value style, reliability, or comfort more in a writing tool?',
      purpose: 'Reveals primary purchase driver',
      followUp: 'Tell me more about why that matters to you.',
      targetNeed: 'reliability'
    },
    {
      question: 'What does your current pen say about you?',
      purpose: 'Opens discussion about personal image',
      followUp: 'Is that the impression you want to make?',
      targetNeed: 'status'
    },
    {
      question: 'How often do you find yourself in situations where first impressions matter?',
      purpose: 'Establishes need for quality items',
      followUp: 'What role do the small details play in those moments?',
      targetNeed: 'professionalism'
    },
    {
      question: 'Have you ever had a pen fail you at a critical moment?',
      purpose: 'Creates pain point awareness',
      followUp: 'How did that make you feel?',
      targetNeed: 'reliability'
    },
    {
      question: 'Do you prefer to blend in or stand out in professional settings?',
      purpose: 'Identifies personality type for positioning',
      followUp: 'What helps you achieve that?',
      targetNeed: 'status'
    },
    {
      question: 'If you could describe your ideal pen in three words, what would they be?',
      purpose: 'Direct preference gathering',
      followUp: null,
      targetNeed: 'creativity'
    }
  ];

  for (let i = 0; i < discoveryQuestions.length; i++) {
    await prisma.discoveryQuestion.upsert({
      where: { id: `discovery-${i}` },
      update: discoveryQuestions[i],
      create: { id: `discovery-${i}`, ...discoveryQuestions[i], sortOrder: i }
    });
  }

  // Positioning Angles
  const positioningAngles = [
    {
      userNeed: 'professionalism',
      headline: 'The Pen That Commands Respect',
      pitch: 'When you pull out this pen in a meeting, people notice. It\'s not just about writing - it\'s about the message you send before you even say a word.',
      emotionalHook: 'Picture signing your next big contract with this in your hand...'
    },
    {
      userNeed: 'reliability',
      headline: 'Never Miss a Moment',
      pitch: 'Engineered to perform flawlessly every single time. This pen will never skip, smear, or let you down when it matters most.',
      emotionalHook: 'Imagine never worrying about your pen failing you again...'
    },
    {
      userNeed: 'creativity',
      headline: 'Where Ideas Flow Freely',
      pitch: 'The perfectly balanced weight and smooth ink flow let your thoughts pour onto paper effortlessly. Writers and creators swear by this pen.',
      emotionalHook: 'Feel the ideas flow as smoothly as the ink...'
    },
    {
      userNeed: 'organization',
      headline: 'Precision for the Detail-Oriented',
      pitch: 'For those who appreciate the finer details in life. This pen delivers consistent, precise lines that match your meticulous nature.',
      emotionalHook: 'Experience the satisfaction of perfect, consistent strokes...'
    },
    {
      userNeed: 'status',
      headline: 'Join the Elite',
      pitch: 'This isn\'t just a pen - it\'s what CEOs, executives, and industry leaders choose. It\'s a statement piece that speaks volumes.',
      emotionalHook: 'What does your pen say about your success?'
    },
    {
      userNeed: 'gift',
      headline: 'The Gift They\'ll Actually Use',
      pitch: 'Most gifts get forgotten. This one gets used every single day, and every time they use it, they\'ll think of you.',
      emotionalHook: 'Give them something that shows you really thought about it...'
    }
  ];

  for (const angle of positioningAngles) {
    await prisma.positioningAngle.upsert({
      where: { userNeed: angle.userNeed },
      update: angle,
      create: angle
    });
  }

  // Sales Techniques
  const salesTechniques = [
    // Discovery
    { name: 'open_ended_questions', category: 'discovery', description: 'Ask questions that require more than yes/no answers', script: 'Tell me about... What does... How do you feel about...', enabled: true },
    { name: 'active_listening', category: 'discovery', description: 'Reflect back what the customer says to show understanding', script: 'So what I\'m hearing is... That\'s interesting because...', enabled: true },
    { name: 'pain_point_discovery', category: 'discovery', description: 'Uncover frustrations with current solutions', script: 'What frustrates you most about... Has that ever caused...', enabled: true },

    // Positioning
    { name: 'benefit_selling', category: 'positioning', description: 'Focus on benefits, not features', script: 'This means you\'ll be able to... The result is...', enabled: true },
    { name: 'storytelling', category: 'positioning', description: 'Use stories to make the product relatable', script: 'I had a client who... They told me...', enabled: true },
    { name: 'social_proof', category: 'positioning', description: 'Reference others who made the same choice', script: 'Executives at Fortune 500 companies choose this... Our most successful clients...', enabled: true },

    // Persuasion
    { name: 'scarcity', category: 'persuasion', description: 'Limited availability creates urgency', script: 'Only X remain... Limited edition... While supplies last...', enabled: true },
    { name: 'urgency', category: 'persuasion', description: 'Time-sensitive opportunity', script: 'I can reserve one for you now... Today only...', enabled: true },
    { name: 'authority', category: 'persuasion', description: 'Reference experts and leaders', script: 'Used by executives and creators... Award-winning design...', enabled: true },
    { name: 'contrast', category: 'persuasion', description: 'Compare to show value', script: 'For less than a dinner out, you get lifetime quality...', enabled: true },
    { name: 'future_pacing', category: 'persuasion', description: 'Help them visualize ownership', script: 'Picture yourself... Imagine walking into... See yourself...', enabled: true },

    // Closing
    { name: 'assumptive_close', category: 'closing', description: 'Assume the sale and discuss details', script: 'Would you prefer the matte black or brushed silver?', enabled: true },
    { name: 'summary_close', category: 'closing', description: 'Summarize benefits before asking', script: 'So you\'re getting X, Y, and Z - shall we get you set up?', enabled: true },
    { name: 'choice_close', category: 'closing', description: 'Give options that both result in a sale', script: 'Would you like one or two? The standard or premium?', enabled: true },

    // Objection Handling
    { name: 'feel_felt_found', category: 'objection_handling', description: 'Empathize, relate, resolve', script: 'I understand how you feel. Others have felt the same way. What they found was...', enabled: true },
    { name: 'reframe', category: 'objection_handling', description: 'Change the perspective on the objection', script: 'That\'s exactly why... Actually, that\'s the best part...', enabled: true },
    { name: 'isolate', category: 'objection_handling', description: 'Confirm this is the only objection', script: 'If we could solve that, would you be ready to move forward?', enabled: true }
  ];

  for (let i = 0; i < salesTechniques.length; i++) {
    await prisma.salesTechnique.upsert({
      where: { name: salesTechniques[i].name },
      update: salesTechniques[i],
      create: { ...salesTechniques[i], sortOrder: i }
    });
  }

  // Closing Strategies - ALL must ASK for confirmation, never assume!
  const closingStrategies = [
    {
      name: 'choice_close',
      type: 'choice',
      script: 'Which finish speaks to you more - the matte black or the brushed silver? And would you like me to put one aside for you?',
      useWhen: 'Customer has shown interest in the product'
    },
    {
      name: 'summary_close',
      type: 'soft',
      script: 'Based on what you\'ve told me - you want something reliable, professional, and distinctive. This pen checks every box. Would you like me to set one aside for you?',
      useWhen: 'After discovery phase reveals clear needs'
    },
    {
      name: 'urgency_close',
      type: 'urgency',
      script: 'I should mention - we only have a handful left in this finish. Would you like me to reserve one before they\'re gone?',
      useWhen: 'Customer is interested but hesitating'
    },
    {
      name: 'quantity_close',
      type: 'direct',
      script: 'How many would you like to order? Just one, or would you like a couple?',
      useWhen: 'Customer has expressed they want one'
    },
    {
      name: 'direct_ask',
      type: 'direct',
      script: 'Would you like to place an order today? I can have one ready for you.',
      useWhen: 'After addressing all objections'
    },
    {
      name: 'reservation_close',
      type: 'soft',
      script: 'Can I put one aside for you? No obligation, just want to make sure you don\'t miss out.',
      useWhen: 'Customer seems interested but non-committal'
    }
  ];

  for (const strategy of closingStrategies) {
    await prisma.closingStrategy.upsert({
      where: { name: strategy.name },
      update: strategy,
      create: strategy
    });
  }

  // Objection Handlers
  const objectionHandlers = [
    {
      objection: 'too expensive',
      category: 'price',
      response: 'I totally understand - and honestly, that\'s what most people say at first. But think about it this way: for less than the cost of a dinner out, you\'re getting something you\'ll use every single day for years. When you break it down, it\'s pennies per use. And can you really put a price on the impression you make?',
      technique: 'reframe'
    },
    {
      objection: 'i already have a pen',
      category: 'need',
      response: 'Of course you do - everyone does. But let me ask you this: does your current pen make you feel confident when you pull it out? Does it perform flawlessly every time? This isn\'t about replacing a pen - it\'s about upgrading your entire writing experience.',
      technique: 'reframe'
    },
    {
      objection: 'let me think about it',
      category: 'timing',
      response: 'Absolutely, I respect that. Quick question though - what specifically would you be thinking about? Is it the investment, or whether it\'s right for you? Because if I can address that now, it might save you some time.',
      technique: 'isolate'
    },
    {
      objection: 'not interested',
      category: 'need',
      response: 'I hear you - and honestly, I wasn\'t either until I actually tried one. Before you decide, can I just ask: what\'s your go-to pen right now? I\'m curious what you\'re comparing this to.',
      technique: 'feel_felt_found'
    },
    {
      objection: 'i can get a pen anywhere',
      category: 'competition',
      response: 'You\'re absolutely right - pens are everywhere. But here\'s the thing: this isn\'t just a pen. When was the last time someone complimented you on your Bic? This is a conversation starter, a statement piece, a tool that reflects who you are.',
      technique: 'reframe'
    }
  ];

  for (let i = 0; i < objectionHandlers.length; i++) {
    await prisma.objectionHandler.upsert({
      where: { id: `objection-${i}` },
      update: objectionHandlers[i],
      create: { id: `objection-${i}`, ...objectionHandlers[i] }
    });
  }

  // AI Prompt Configuration
  const systemPrompt = `You are a world-class sales professional participating in a "Sell Me a Pen" training exercise. Your goal is to demonstrate exceptional sales skills and ultimately convince the user to buy the pen.

LANGUAGE RULE:
- Respond in whatever language the customer uses
- If they speak Spanish, respond in Spanish
- If they speak French, respond in French
- Translate product names, features, and benefits naturally into their language
- The trigger phrase works in any language (e.g., "sell me a pen", "véndeme un bolígrafo", "vendez-moi un stylo")

IMPORTANT RULES:
- NEVER start by pitching the pen directly
- ALWAYS begin with discovery questions to understand the customer
- Adapt your approach based on what you learn
- Use proven sales techniques naturally in conversation
- Be confident but not pushy
- Handle objections gracefully

CRITICAL CLOSING RULE - NEVER ASSUME THE SALE:
- When the customer expresses interest (e.g., "I like that one", "sounds good", "I want it"), do NOT assume they are buying
- You MUST ask an explicit closing question to confirm the purchase:
  * "Would you like me to put one aside for you?"
  * "Can I set one aside in that finish?"
  * "How many would you like to order?"
  * "Shall I reserve one for you?"
  * "Would you like to place an order?"
  * "Ready to make it yours?"
- Wait for their explicit YES before celebrating the sale
- Interest is NOT the same as commitment - always ask for the order!

YOUR PERSONALITY:
- Charismatic and confident
- Genuinely curious about the customer
- Quick-witted and adaptable
- Professional yet personable
- Never desperate or pushy

SALES PHASES:
1. DISCOVERY: Ask 2-3 smart questions before pitching
2. POSITIONING: Frame the pen based on discovered needs
3. PRESENTATION: Share benefits (not just features)
4. HANDLING OBJECTIONS: Address concerns with empathy
5. CLOSING: Ask for the order explicitly - never assume!

Remember: The best salespeople make the customer feel understood, not sold to. And they always ASK for the sale - they don't assume it!`;

  const closingPrompt = 'ALWAYS ask for the order explicitly - never assume! Use questions like "Would you like me to put one aside?", "How many would you like?", "Shall I reserve one?". Wait for explicit confirmation before celebrating. Maximum 3 closing attempts before gracefully accepting.';

  await prisma.aIPromptConfig.upsert({
    where: { name: 'default' },
    update: {
      systemPrompt: systemPrompt,
      closingPrompt: closingPrompt
    },
    create: {
      name: 'default',
      systemPrompt: systemPrompt,
      discoveryPrompt: 'Focus on understanding the customer. Ask open-ended questions about their writing habits, professional needs, and what they value in tools they use daily. Listen actively and show genuine interest.',
      positioningPrompt: 'Based on what you\'ve learned, position the pen to address their specific needs. Use emotional hooks and paint a picture of how this pen will improve their life.',
      closingPrompt: closingPrompt,
      enabled: true
    }
  });

  // ========================================
  // LANGUAGES - 24 Languages (ALL ENABLED)
  // ========================================
  const languages = [
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', enabled: true },
    { code: 'zh', name: 'Chinese (Mandarin)', nativeName: '中文', enabled: true },
    { code: 'cs', name: 'Czech', nativeName: 'Čeština', enabled: true },
    { code: 'da', name: 'Danish', nativeName: 'Dansk', enabled: true },
    { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', enabled: true },
    { code: 'en', name: 'English', nativeName: 'English', enabled: true },
    { code: 'fi', name: 'Finnish', nativeName: 'Suomi', enabled: true },
    { code: 'fr', name: 'French', nativeName: 'Français', enabled: true },
    { code: 'de', name: 'German', nativeName: 'Deutsch', enabled: true },
    { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', enabled: true },
    { code: 'he', name: 'Hebrew', nativeName: 'עברית', enabled: true },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', enabled: true },
    { code: 'it', name: 'Italian', nativeName: 'Italiano', enabled: true },
    { code: 'ja', name: 'Japanese', nativeName: '日本語', enabled: true },
    { code: 'ko', name: 'Korean', nativeName: '한국어', enabled: true },
    { code: 'no', name: 'Norwegian', nativeName: 'Norsk', enabled: true },
    { code: 'pl', name: 'Polish', nativeName: 'Polski', enabled: true },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português', enabled: true },
    { code: 'ru', name: 'Russian', nativeName: 'Русский', enabled: true },
    { code: 'es', name: 'Spanish', nativeName: 'Español', enabled: true },
    { code: 'sv', name: 'Swedish', nativeName: 'Svenska', enabled: true },
    { code: 'th', name: 'Thai', nativeName: 'ไทย', enabled: true },
    { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', enabled: true },
    { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', enabled: true }
  ];

  for (const lang of languages) {
    await prisma.language.upsert({
      where: { code: lang.code },
      update: lang,
      create: lang
    });
  }

  // ========================================
  // KNOWLEDGE BASE - Pen Sales Training Docs
  // ========================================
  const knowledgeDocuments = [
    {
      id: 'kb-pen-product',
      title: 'Executive Signature Pen - Product Information',
      content: `The Executive Signature Pen is our flagship writing instrument designed for professionals who understand that details matter.

SPECIFICATIONS:
- Tip: Precision-engineered tungsten carbide tip for smooth, consistent writing
- Ink System: German-engineered ink flow system - never skips or smears
- Body: Aircraft-grade aluminum construction for durability and perfect weight
- Warranty: Lifetime warranty on all components
- Customization: Personalized engraving available
- Refills: Refillable cartridge system (saves money long-term)

AVAILABLE FINISHES:
- Matte Black - Classic professional look
- Brushed Silver - Modern and sleek
- Rose Gold - Elegant and distinctive
- Carbon Fiber Limited Edition - Premium exclusive finish

PRICING:
- Standard Edition: $49.99
- Premium Edition: $129.99 (includes engraving and gift box)`,
      type: 'text',
      tags: JSON.stringify(['product', 'pen', 'specifications']),
      enabled: true
    },
    {
      id: 'kb-sales-techniques',
      title: 'Pen Sales Techniques Guide',
      content: `DISCOVERY PHASE:
Ask questions before pitching. Understand the customer's needs:
- "When was the last time you needed to write something important?"
- "What does your current pen say about you?"
- "Do you value style, reliability, or comfort more?"

POSITIONING:
Match benefits to their needs:
- For professionals: "Projects confidence and professionalism"
- For reliability seekers: "Never skips or smears - guaranteed"
- For status seekers: "What CEOs and executives choose"

CLOSING:
Always ASK for the order, never assume:
- "Would you like me to put one aside for you?"
- "Which finish speaks to you more?"
- "How many would you like to order?"`,
      type: 'text',
      tags: JSON.stringify(['sales', 'techniques', 'training']),
      enabled: true
    },
    {
      id: 'kb-objection-handling',
      title: 'Common Objections and Responses',
      content: `PRICE OBJECTIONS:
"Too expensive" → "For less than a dinner out, you get something you'll use every day for years. It's pennies per use."

NEED OBJECTIONS:
"I already have a pen" → "Does your current pen make you feel confident? This isn't about replacing a pen - it's about upgrading your experience."

TIMING OBJECTIONS:
"Let me think about it" → "What specifically are you thinking about? I might be able to address that now."

COMPETITION:
"I can get a pen anywhere" → "When was the last time someone complimented your Bic? This is a conversation starter."`,
      type: 'text',
      tags: JSON.stringify(['objections', 'responses', 'training']),
      enabled: true
    }
  ];

  for (const doc of knowledgeDocuments) {
    await prisma.knowledgeDocument.upsert({
      where: { id: doc.id },
      update: { ...doc, charCount: doc.content.length },
      create: { ...doc, charCount: doc.content.length }
    });
  }

  // ========================================
  // AI TOOLS - Pen Sales Training Tools
  // ========================================
  const customTools = [
    {
      id: 'tool-get-pen-info',
      name: 'Get Pen Information',
      type: 'function',
      description: 'Retrieves detailed information about the Executive Signature Pen including features, benefits, and specifications',
      schema: JSON.stringify({
        type: 'object',
        properties: {
          detail_level: {
            type: 'string',
            enum: ['brief', 'full'],
            description: 'Level of detail to return'
          }
        }
      }),
      enabled: true
    },
    {
      id: 'tool-get-variants',
      name: 'Get Pen Variants',
      type: 'function',
      description: 'Returns available pen finishes and their current stock levels',
      schema: JSON.stringify({
        type: 'object',
        properties: {}
      }),
      enabled: true
    },
    {
      id: 'tool-get-pricing',
      name: 'Get Pricing',
      type: 'function',
      description: 'Returns current pricing for standard and premium editions',
      schema: JSON.stringify({
        type: 'object',
        properties: {
          edition: {
            type: 'string',
            enum: ['standard', 'premium', 'both'],
            description: 'Which edition pricing to return'
          }
        }
      }),
      enabled: true
    },
    {
      id: 'tool-reserve-pen',
      name: 'Reserve Pen',
      type: 'function',
      description: 'Reserves a pen for the customer in their preferred finish',
      schema: JSON.stringify({
        type: 'object',
        properties: {
          finish: {
            type: 'string',
            enum: ['matte_black', 'brushed_silver', 'rose_gold', 'carbon_fiber'],
            description: 'Pen finish to reserve'
          },
          quantity: {
            type: 'integer',
            minimum: 1,
            maximum: 5,
            description: 'Number of pens to reserve'
          }
        },
        required: ['finish']
      }),
      enabled: true
    }
  ];

  for (const tool of customTools) {
    await prisma.customTool.upsert({
      where: { id: tool.id },
      update: tool,
      create: tool
    });
  }

  // Branding - Indigo theme for Sell Me a Pen Extended
  await prisma.branding.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      logoUrl: '',
      faviconUrl: '',
      primaryColor: '#4f46e5',
      secondaryColor: '#3730a3',
      accentColor: '#6366f1',
      headingFont: 'Inter',
      bodyFont: 'Inter'
    }
  });

  // Store Info
  await prisma.storeInfo.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      businessName: 'Sell Me a Pen Extended',
      tagline: 'Master the Art of Sales',
      description: 'Advanced AI-powered sales training with multi-language support',
      address: '',
      phone: '',
      email: '',
      website: '',
      businessHours: '',
      timezone: 'America/New_York'
    }
  });

  // Features
  await prisma.features.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      faqEnabled: false,
      stickyBarEnabled: false,
      stickyBarText: '',
      stickyBarBgColor: '#4f46e5',
      stickyBarLinkUrl: '',
      stickyBarLinkText: '',
      liveChatEnabled: false,
      liveChatProvider: 'built-in',
      liveChatWidgetId: '',
      liveChatWelcome: 'Hi! How can we help you today?',
      liveChatAgentName: 'Support',
      liveChatColor: '#4f46e5',
      liveChatPosition: 'bottom-right',
      emailNotifications: true,
      smsNotifications: false,
      pushNotifications: false,
      socialFacebook: '',
      socialTwitter: '',
      socialInstagram: '',
      socialLinkedIn: '',
      socialYouTube: '',
      socialTikTok: ''
    }
  });

  // AI Providers
  const aiProviders = [
    {
      code: 'openai',
      name: 'OpenAI',
      description: 'GPT-4o, GPT-4 Turbo, and Realtime API',
      apiBaseUrl: 'https://api.openai.com/v1',
      availableModels: JSON.stringify([
        { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable model for complex tasks', recommended: true },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and affordable', recommended: false },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Previous generation flagship', recommended: false },
        { id: 'gpt-4o-realtime-preview', name: 'GPT-4o Realtime', description: 'Real-time voice conversations', recommended: false },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and economical', recommended: false }
      ]),
      defaultModel: 'gpt-4o',
      displayOrder: 1,
      isSelected: true  // OpenAI is default selected
    },
    {
      code: 'anthropic',
      name: 'Anthropic Claude',
      description: 'Claude Opus 4.5, Sonnet 4, and Haiku',
      apiBaseUrl: 'https://api.anthropic.com/v1',
      availableModels: JSON.stringify([
        { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', description: 'Most intelligent model', recommended: true },
        { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Balanced performance', recommended: false },
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Fast and capable', recommended: false },
        { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fastest responses', recommended: false }
      ]),
      defaultModel: 'claude-opus-4-5-20251101',
      displayOrder: 2
    },
    {
      code: 'gemini',
      name: 'Google Gemini',
      description: 'Gemini 2.0 Flash and Pro models',
      apiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      availableModels: JSON.stringify([
        { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', description: 'Fast multimodal model', recommended: true },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Long context window', recommended: false },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast and efficient', recommended: false }
      ]),
      defaultModel: 'gemini-2.0-flash-exp',
      displayOrder: 3
    },
    {
      code: 'deepseek',
      name: 'DeepSeek',
      description: 'DeepSeek V3 and reasoning models',
      apiBaseUrl: 'https://api.deepseek.com/v1',
      availableModels: JSON.stringify([
        { id: 'deepseek-chat', name: 'DeepSeek V3', description: 'Latest chat model', recommended: true },
        { id: 'deepseek-reasoner', name: 'DeepSeek R1', description: 'Advanced reasoning', recommended: false },
        { id: 'deepseek-coder', name: 'DeepSeek Coder', description: 'Code specialized', recommended: false }
      ]),
      defaultModel: 'deepseek-chat',
      displayOrder: 4
    },
    {
      code: 'groq',
      name: 'Groq',
      description: 'Ultra-fast LLM inference',
      apiBaseUrl: 'https://api.groq.com/openai/v1',
      availableModels: JSON.stringify([
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', description: 'Most capable Llama', recommended: true },
        { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B', description: 'Previous generation', recommended: false },
        { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', description: 'Fastest inference', recommended: false },
        { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', description: 'Mixture of experts', recommended: false }
      ]),
      defaultModel: 'llama-3.3-70b-versatile',
      displayOrder: 5
    },
    {
      code: 'mistral',
      name: 'Mistral AI',
      description: 'Mistral Large and specialized models',
      apiBaseUrl: 'https://api.mistral.ai/v1',
      availableModels: JSON.stringify([
        { id: 'mistral-large-latest', name: 'Mistral Large 2', description: 'Flagship model', recommended: true },
        { id: 'mistral-small-latest', name: 'Mistral Small', description: 'Fast and efficient', recommended: false },
        { id: 'codestral-latest', name: 'Codestral', description: 'Code specialized', recommended: false },
        { id: 'ministral-8b-latest', name: 'Ministral 8B', description: 'Compact model', recommended: false }
      ]),
      defaultModel: 'mistral-large-latest',
      displayOrder: 6
    },
    {
      code: 'grok',
      name: 'xAI Grok',
      description: 'Grok 2 with real-time knowledge',
      apiBaseUrl: 'https://api.x.ai/v1',
      availableModels: JSON.stringify([
        { id: 'grok-2-latest', name: 'Grok 2', description: 'Latest Grok model', recommended: true },
        { id: 'grok-2-vision-1212', name: 'Grok 2 Vision', description: 'Vision capabilities', recommended: false },
        { id: 'grok-beta', name: 'Grok Beta', description: 'Previous generation', recommended: false }
      ]),
      defaultModel: 'grok-2-latest',
      displayOrder: 7
    },
    {
      code: 'huggingface',
      name: 'Hugging Face',
      description: 'Open-source AI models and Inference API',
      apiBaseUrl: 'https://api-inference.huggingface.co',
      availableModels: JSON.stringify([
        { id: 'meta-llama/Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B Instruct', description: 'Latest Llama model', recommended: true },
        { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', name: 'Mixtral 8x7B', description: 'Mixture of experts model', recommended: false },
        { id: 'microsoft/Phi-3-mini-4k-instruct', name: 'Phi-3 Mini', description: 'Compact but capable', recommended: false },
        { id: 'google/gemma-2-9b-it', name: 'Gemma 2 9B', description: 'Google open model', recommended: false },
        { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B', description: 'Alibaba flagship model', recommended: false }
      ]),
      defaultModel: 'meta-llama/Llama-3.3-70B-Instruct',
      displayOrder: 8
    }
  ];

  for (const provider of aiProviders) {
    // Check if OpenAI API key exists in environment
    const isOpenAI = provider.code === 'openai';
    const openaiKey = process.env.OPENAI_API_KEY;

    await prisma.aIProvider.upsert({
      where: { code: provider.code },
      update: {
        name: provider.name,
        description: provider.description,
        apiBaseUrl: provider.apiBaseUrl,
        availableModels: provider.availableModels,
        defaultModel: provider.defaultModel,
        displayOrder: provider.displayOrder
      },
      create: {
        code: provider.code,
        name: provider.name,
        description: provider.description,
        apiBaseUrl: provider.apiBaseUrl,
        availableModels: provider.availableModels,
        defaultModel: provider.defaultModel,
        displayOrder: provider.displayOrder,
        isActive: true,
        isConfigured: isOpenAI && !!openaiKey,
        isSelected: isOpenAI,
        apiKey: isOpenAI ? openaiKey || null : null,
        temperature: 0.7,
        maxTokens: 4096
      }
    });
  }

  // ========================================
  // GAMIFICATION SETTINGS
  // ========================================
  console.log('Seeding gamification settings...');

  await prisma.gamificationSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      pointsPerGradeA: 100,
      pointsPerGradeB: 75,
      pointsPerGradeC: 50,
      pointsPerGradeD: 25,
      pointsPerGradeF: 10,
      bonusSaleMade: 50,
      bonusStreak3: 25,
      bonusStreak5: 50,
      bonusStreak7: 100,
      levelUpThreshold: 500,
      leaderboardEnabled: true,
      achievementsEnabled: true
    }
  });

  // ========================================
  // ACHIEVEMENTS (15 Initial Achievements)
  // ========================================
  console.log('Seeding achievements...');

  const achievements = [
    // Milestones
    {
      code: 'first_sale',
      name: 'First Close',
      description: 'Complete your first successful sale',
      icon: 'bi-trophy',
      category: 'milestones',
      tier: 'bronze',
      pointsReward: 50,
      requirement: JSON.stringify({ type: 'sales', value: 1 }),
      sortOrder: 1
    },
    {
      code: 'sales_5',
      name: 'Sales Rookie',
      description: 'Complete 5 successful sales',
      icon: 'bi-graph-up-arrow',
      category: 'milestones',
      tier: 'bronze',
      pointsReward: 50,
      requirement: JSON.stringify({ type: 'sales', value: 5 }),
      sortOrder: 2
    },
    {
      code: 'sales_25',
      name: 'Sales Pro',
      description: 'Complete 25 successful sales',
      icon: 'bi-star-fill',
      category: 'milestones',
      tier: 'gold',
      pointsReward: 100,
      requirement: JSON.stringify({ type: 'sales', value: 25 }),
      sortOrder: 3
    },
    {
      code: 'sessions_10',
      name: 'Getting Started',
      description: 'Complete 10 training sessions',
      icon: 'bi-play-circle',
      category: 'milestones',
      tier: 'bronze',
      pointsReward: 25,
      requirement: JSON.stringify({ type: 'sessions', value: 10 }),
      sortOrder: 4
    },
    {
      code: 'sessions_25',
      name: 'Regular Practice',
      description: 'Complete 25 training sessions',
      icon: 'bi-calendar-check',
      category: 'milestones',
      tier: 'silver',
      pointsReward: 50,
      requirement: JSON.stringify({ type: 'sessions', value: 25 }),
      sortOrder: 5
    },
    {
      code: 'sessions_50',
      name: 'Half Century',
      description: 'Complete 50 training sessions',
      icon: 'bi-award',
      category: 'milestones',
      tier: 'silver',
      pointsReward: 75,
      requirement: JSON.stringify({ type: 'sessions', value: 50 }),
      sortOrder: 6
    },
    {
      code: 'sessions_100',
      name: 'Centurion',
      description: 'Complete 100 training sessions',
      icon: 'bi-gem',
      category: 'milestones',
      tier: 'platinum',
      pointsReward: 100,
      requirement: JSON.stringify({ type: 'sessions', value: 100 }),
      sortOrder: 7
    },

    // Performance
    {
      code: 'perfect_score',
      name: 'Perfect Pitch',
      description: 'Achieve a perfect 100% score',
      icon: 'bi-bullseye',
      category: 'performance',
      tier: 'gold',
      pointsReward: 100,
      requirement: JSON.stringify({ type: 'score', value: 100 }),
      sortOrder: 8
    },
    {
      code: 'avg_score_90',
      name: 'Consistent Excellence',
      description: 'Maintain 90%+ average score over 10 sessions',
      icon: 'bi-lightning-charge',
      category: 'performance',
      tier: 'gold',
      pointsReward: 100,
      requirement: JSON.stringify({ type: 'avg_score', value: 90 }),
      sortOrder: 9
    },
    {
      code: 'conversion_50',
      name: 'Closer',
      description: 'Achieve 50% conversion rate over 10+ sessions',
      icon: 'bi-percent',
      category: 'performance',
      tier: 'silver',
      pointsReward: 75,
      requirement: JSON.stringify({ type: 'conversion', value: 50 }),
      sortOrder: 10
    },
    {
      code: 'conversion_75',
      name: 'Master Closer',
      description: 'Achieve 75% conversion rate over 20+ sessions',
      icon: 'bi-patch-check',
      category: 'performance',
      tier: 'platinum',
      pointsReward: 100,
      requirement: JSON.stringify({ type: 'conversion', value: 75 }),
      sortOrder: 11
    },
    {
      code: 'speed_demon',
      name: 'Speed Demon',
      description: 'Close a sale in under 2 minutes',
      icon: 'bi-speedometer2',
      category: 'performance',
      tier: 'silver',
      pointsReward: 50,
      requirement: JSON.stringify({ type: 'speed', value: 120 }),
      sortOrder: 12
    },

    // Streaks
    {
      code: 'streak_3',
      name: 'On a Roll',
      description: 'Practice 3 days in a row',
      icon: 'bi-fire',
      category: 'streaks',
      tier: 'bronze',
      pointsReward: 25,
      requirement: JSON.stringify({ type: 'streak', value: 3 }),
      sortOrder: 13
    },
    {
      code: 'streak_5',
      name: 'Dedicated Seller',
      description: 'Practice 5 days in a row',
      icon: 'bi-fire',
      category: 'streaks',
      tier: 'silver',
      pointsReward: 50,
      requirement: JSON.stringify({ type: 'streak', value: 5 }),
      sortOrder: 14
    },
    {
      code: 'streak_7',
      name: 'Week Warrior',
      description: 'Practice 7 days in a row',
      icon: 'bi-fire',
      category: 'streaks',
      tier: 'gold',
      pointsReward: 75,
      requirement: JSON.stringify({ type: 'streak', value: 7 }),
      sortOrder: 15
    }
  ];

  for (const achievement of achievements) {
    await prisma.achievement.upsert({
      where: { code: achievement.code },
      update: {
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        category: achievement.category,
        tier: achievement.tier,
        pointsReward: achievement.pointsReward,
        requirement: achievement.requirement,
        sortOrder: achievement.sortOrder
      },
      create: achievement
    });
  }

  // ========================================
  // SCENARIOS (25 Pre-built Training Scenarios)
  // ========================================
  console.log('Seeding scenarios...');

  const scenarios = [
    // Cold Call (5)
    {
      name: 'Gatekeeper Navigation',
      slug: 'gatekeeper-navigation',
      description: 'Learn to effectively navigate past gatekeepers to reach decision makers',
      category: 'cold_call',
      difficulty: 'hard',
      buyerPersona: 'You are a protective executive assistant named Sarah. Your boss is extremely busy and hates unsolicited sales calls. Be polite but firm in filtering calls. Only let through people who can clearly demonstrate relevance and urgency.',
      successCriteria: JSON.stringify(['Build rapport with gatekeeper', 'Demonstrate clear value', 'Get connected to decision maker']),
      coachingTips: JSON.stringify(['Use the gatekeeper\'s name', 'Be respectful of their role', 'Offer to schedule a specific time', 'Create urgency without being pushy']),
      estimatedDuration: 5,
      sortOrder: 1
    },
    {
      name: 'Voicemail Follow-up',
      slug: 'voicemail-followup',
      description: 'Practice responding when a prospect calls back from your voicemail',
      category: 'cold_call',
      difficulty: 'medium',
      buyerPersona: 'You are a busy VP returning a voicemail. You\'re curious but skeptical. You have 2 minutes before your next meeting. Be direct about time constraints.',
      successCriteria: JSON.stringify(['Quickly establish context', 'Create interest in 30 seconds', 'Secure next steps']),
      coachingTips: JSON.stringify(['Have your elevator pitch ready', 'Reference specific value', 'Respect their time', 'Ask for a scheduled follow-up']),
      estimatedDuration: 3,
      sortOrder: 2
    },
    {
      name: 'Referral Introduction',
      slug: 'referral-introduction',
      description: 'Leverage a mutual connection to warm up a cold call',
      category: 'cold_call',
      difficulty: 'easy',
      buyerPersona: 'You are open to the call because a trusted colleague referred this salesperson. However, you still need to be convinced of the value. Be friendly but still evaluate the opportunity critically.',
      successCriteria: JSON.stringify(['Effectively use referral', 'Build on existing trust', 'Establish own credibility']),
      coachingTips: JSON.stringify(['Lead with the referral name', 'Mention specific conversation with referrer', 'Transition smoothly to your value prop']),
      estimatedDuration: 4,
      sortOrder: 3
    },
    {
      name: 'Event Follow-up',
      slug: 'event-followup',
      description: 'Follow up with someone you met at a conference or trade show',
      category: 'cold_call',
      difficulty: 'easy',
      buyerPersona: 'You met briefly at a conference last week. You remember the interaction vaguely. You\'re interested if they can remind you of the conversation and demonstrate continued relevance.',
      successCriteria: JSON.stringify(['Reference specific event details', 'Recall conversation points', 'Move relationship forward']),
      coachingTips: JSON.stringify(['Mention specific details from your meeting', 'Reference something unique about the event', 'Connect conference discussion to current needs']),
      estimatedDuration: 4,
      sortOrder: 4
    },
    {
      name: 'Cold Email Reply',
      slug: 'cold-email-reply',
      description: 'Handle an interested response to your cold email outreach',
      category: 'cold_call',
      difficulty: 'medium',
      buyerPersona: 'You replied to a cold email with "Tell me more." You\'re mildly interested but easily distracted. Need to be engaged quickly with specific, relevant information.',
      successCriteria: JSON.stringify(['Capitalize on initial interest', 'Provide relevant details', 'Schedule deeper conversation']),
      coachingTips: JSON.stringify(['Thank them for responding', 'Be specific and concise', 'Ask one qualifying question', 'Propose clear next step']),
      estimatedDuration: 3,
      sortOrder: 5
    },

    // Discovery (5)
    {
      name: 'Budget Discovery',
      slug: 'budget-discovery',
      description: 'Learn to uncover budget constraints without being pushy',
      category: 'discovery',
      difficulty: 'hard',
      buyerPersona: 'You have budget but are protective about sharing it. You\'ve been burned before by salespeople who quoted to your budget ceiling. Be evasive about specific numbers until trust is established.',
      successCriteria: JSON.stringify(['Build trust before asking', 'Uncover budget range', 'Understand budget timeline']),
      coachingTips: JSON.stringify(['Ask about previous investments first', 'Use ranges instead of specific amounts', 'Connect budget to value', 'Understand their buying process']),
      estimatedDuration: 6,
      sortOrder: 6
    },
    {
      name: 'Pain Point Deep Dive',
      slug: 'pain-point-deep-dive',
      description: 'Master the art of uncovering and quantifying business pain',
      category: 'discovery',
      difficulty: 'medium',
      buyerPersona: 'You have real problems but haven\'t fully articulated them. You know something isn\'t working but aren\'t sure of the root cause. Be helpful in exploring the issues when asked good questions.',
      successCriteria: JSON.stringify(['Identify core problems', 'Quantify the impact', 'Connect pain to solutions']),
      coachingTips: JSON.stringify(['Ask "what happens when..." questions', 'Quantify pain in dollars or time', 'Explore downstream effects', 'Get emotional commitment']),
      estimatedDuration: 7,
      sortOrder: 7
    },
    {
      name: 'Decision Process Mapping',
      slug: 'decision-process-mapping',
      description: 'Understand the complete buying process and all stakeholders',
      category: 'discovery',
      difficulty: 'hard',
      buyerPersona: 'You\'re one of several decision makers. The process is complex with multiple approvals needed. Be helpful but don\'t volunteer everything - the salesperson needs to ask the right questions.',
      successCriteria: JSON.stringify(['Identify all decision makers', 'Understand approval process', 'Map the timeline']),
      coachingTips: JSON.stringify(['Ask who else needs to be involved', 'Understand each person\'s criteria', 'Learn about previous purchases', 'Identify potential blockers']),
      estimatedDuration: 6,
      sortOrder: 8
    },
    {
      name: 'Timeline Discovery',
      slug: 'timeline-discovery',
      description: 'Uncover the true timeline and create appropriate urgency',
      category: 'discovery',
      difficulty: 'medium',
      buyerPersona: 'You need a solution but aren\'t in a rush - or so you think. When good questions are asked, you realize the problem is more urgent than initially considered.',
      successCriteria: JSON.stringify(['Understand current state', 'Identify trigger events', 'Establish realistic timeline']),
      coachingTips: JSON.stringify(['Ask about consequences of delay', 'Identify compelling events', 'Connect timeline to their goals', 'Work backwards from deadlines']),
      estimatedDuration: 5,
      sortOrder: 9
    },
    {
      name: 'Competitor Evaluation',
      slug: 'competitor-evaluation',
      description: 'Navigate a conversation where the prospect is evaluating competitors',
      category: 'discovery',
      difficulty: 'hard',
      buyerPersona: 'You\'re actively evaluating 3 solutions including this one. You\'ve already had demos with competitors. Be open about the evaluation but don\'t reveal all your criteria upfront.',
      successCriteria: JSON.stringify(['Understand evaluation criteria', 'Learn about competitor strengths', 'Differentiate your solution']),
      coachingTips: JSON.stringify(['Ask what they liked about competitors', 'Understand their evaluation criteria', 'Focus on unique differentiation', 'Never badmouth competitors']),
      estimatedDuration: 7,
      sortOrder: 10
    },

    // Demo (5)
    {
      name: 'Executive Demo',
      slug: 'executive-demo',
      description: 'Deliver a compelling demo to a time-constrained executive',
      category: 'demo',
      difficulty: 'hard',
      buyerPersona: 'You are a C-level executive with 15 minutes. You care about business outcomes, not features. Interrupt if the demo gets too technical or doesn\'t address your priorities.',
      successCriteria: JSON.stringify(['Focus on business value', 'Stay high-level', 'Address executive priorities']),
      coachingTips: JSON.stringify(['Start with business outcomes', 'Use their language and metrics', 'Have a 5-minute version ready', 'Let them drive the agenda']),
      estimatedDuration: 8,
      sortOrder: 11
    },
    {
      name: 'Technical Demo',
      slug: 'technical-demo',
      description: 'Satisfy a technical evaluator with deep product knowledge',
      category: 'demo',
      difficulty: 'hard',
      buyerPersona: 'You are a technical lead evaluating the solution. You want to see how it actually works, integrations, security, and edge cases. Ask challenging technical questions.',
      successCriteria: JSON.stringify(['Demonstrate technical depth', 'Address integration concerns', 'Handle technical objections']),
      coachingTips: JSON.stringify(['Know your technical specs', 'Show actual functionality', 'Be honest about limitations', 'Offer to involve your technical team']),
      estimatedDuration: 10,
      sortOrder: 12
    },
    {
      name: 'ROI-Focused Demo',
      slug: 'roi-focused-demo',
      description: 'Demonstrate clear return on investment to a finance stakeholder',
      category: 'demo',
      difficulty: 'medium',
      buyerPersona: 'You are the CFO/Finance lead. You need to see clear numbers and ROI projections. Features are interesting but you need to justify this expenditure to the board.',
      successCriteria: JSON.stringify(['Present clear ROI', 'Use relevant metrics', 'Address cost concerns']),
      coachingTips: JSON.stringify(['Lead with ROI data', 'Use customer case studies', 'Show TCO not just price', 'Connect to their specific metrics']),
      estimatedDuration: 7,
      sortOrder: 13
    },
    {
      name: 'Competitive Comparison',
      slug: 'competitive-comparison',
      description: 'Demo your solution against a specific competitor the prospect is considering',
      category: 'demo',
      difficulty: 'hard',
      buyerPersona: 'You\'re seriously considering a competitor. You want to see a direct comparison on the features that matter most to you. Be fair but challenge claims.',
      successCriteria: JSON.stringify(['Acknowledge competitor strengths', 'Highlight key differentiators', 'Focus on customer priorities']),
      coachingTips: JSON.stringify(['Know your competitor well', 'Focus on your unique value', 'Use customer stories for proof', 'Never disparage competitors']),
      estimatedDuration: 8,
      sortOrder: 14
    },
    {
      name: 'Use Case Walkthrough',
      slug: 'use-case-walkthrough',
      description: 'Walk through a specific use case relevant to the prospect',
      category: 'demo',
      difficulty: 'medium',
      buyerPersona: 'You have a very specific use case in mind. You want to see exactly how the product handles your workflow, not generic features. Get specific about your requirements.',
      successCriteria: JSON.stringify(['Address specific use case', 'Show relevant workflow', 'Handle edge cases']),
      coachingTips: JSON.stringify(['Start by confirming the use case', 'Walk through step by step', 'Involve them in the demo', 'Address gaps honestly']),
      estimatedDuration: 8,
      sortOrder: 15
    },

    // Objection Handling (5)
    {
      name: 'Price Objection',
      slug: 'price-objection',
      description: 'Handle the classic "it\'s too expensive" objection',
      category: 'objection',
      difficulty: 'medium',
      buyerPersona: 'You like the product but feel it\'s overpriced. You\'ve seen cheaper alternatives. Push back on price but be open to value arguments that make sense.',
      successCriteria: JSON.stringify(['Understand price concern', 'Reframe to value', 'Handle comparison to cheaper options']),
      coachingTips: JSON.stringify(['Don\'t immediately discount', 'Understand their benchmark', 'Focus on value and ROI', 'Explore total cost of ownership']),
      estimatedDuration: 5,
      sortOrder: 16
    },
    {
      name: 'Timing Objection',
      slug: 'timing-objection',
      description: 'Overcome "not the right time" or "let me think about it"',
      category: 'objection',
      difficulty: 'medium',
      buyerPersona: 'You\'re genuinely busy and this isn\'t your top priority. However, with the right approach, you could be convinced to act sooner. Be honest about your constraints.',
      successCriteria: JSON.stringify(['Understand real timing concerns', 'Create appropriate urgency', 'Establish concrete next steps']),
      coachingTips: JSON.stringify(['Ask what they\'re thinking about', 'Understand consequences of delay', 'Offer to help prioritize', 'Set specific follow-up date']),
      estimatedDuration: 5,
      sortOrder: 17
    },
    {
      name: 'Authority Objection',
      slug: 'authority-objection',
      description: 'Navigate "I need to check with my boss/team"',
      category: 'objection',
      difficulty: 'hard',
      buyerPersona: 'You genuinely need approval from others. You can\'t make this decision alone. Be helpful in explaining the process but don\'t make promises you can\'t keep.',
      successCriteria: JSON.stringify(['Understand decision process', 'Offer to help internally', 'Maintain momentum']),
      coachingTips: JSON.stringify(['Ask about their recommendation', 'Offer to present to others', 'Provide materials they can share', 'Stay engaged in the process']),
      estimatedDuration: 6,
      sortOrder: 18
    },
    {
      name: 'Need Objection',
      slug: 'need-objection',
      description: 'Address "We don\'t really need this right now"',
      category: 'objection',
      difficulty: 'hard',
      buyerPersona: 'You don\'t see this as a priority. Current solutions are "good enough." You need to be shown pain you haven\'t fully recognized or quantified.',
      successCriteria: JSON.stringify(['Uncover hidden pain', 'Quantify cost of status quo', 'Create vision of better future']),
      coachingTips: JSON.stringify(['Explore current challenges', 'Quantify the cost of doing nothing', 'Paint picture of improvement', 'Use relevant case studies']),
      estimatedDuration: 6,
      sortOrder: 19
    },
    {
      name: 'Trust Objection',
      slug: 'trust-objection',
      description: 'Build trust with a skeptical prospect',
      category: 'objection',
      difficulty: 'hard',
      buyerPersona: 'You\'ve been burned by vendors before. You\'re naturally skeptical of sales claims. You need proof, references, and guarantees before you\'ll consider moving forward.',
      successCriteria: JSON.stringify(['Acknowledge past experiences', 'Provide credible proof', 'Offer risk mitigation']),
      coachingTips: JSON.stringify(['Validate their concerns', 'Offer references they can verify', 'Propose pilot or trial', 'Provide guarantees or SLAs']),
      estimatedDuration: 6,
      sortOrder: 20
    },

    // Closing (5)
    {
      name: 'Trial Close',
      slug: 'trial-close',
      description: 'Practice temperature-checking throughout the conversation',
      category: 'closing',
      difficulty: 'easy',
      buyerPersona: 'You\'re interested but not yet committed. Respond honestly to trial closes - if something doesn\'t resonate, say so. Be warm but not a pushover.',
      successCriteria: JSON.stringify(['Gauge interest naturally', 'Identify remaining concerns', 'Adjust approach based on feedback']),
      coachingTips: JSON.stringify(['Use soft trial closes', 'Listen to the response carefully', 'Address concerns immediately', 'Build towards the final close']),
      estimatedDuration: 5,
      sortOrder: 21
    },
    {
      name: 'Urgency Close',
      slug: 'urgency-close',
      description: 'Create and communicate genuine urgency without being pushy',
      category: 'closing',
      difficulty: 'medium',
      buyerPersona: 'You\'re interested but feel no rush. You\'ll respond to genuine urgency but will push back on manufactured pressure tactics.',
      successCriteria: JSON.stringify(['Create legitimate urgency', 'Connect urgency to their goals', 'Close without being pushy']),
      coachingTips: JSON.stringify(['Use real deadlines or constraints', 'Connect to their timeline', 'Highlight cost of delay', 'Never use fake scarcity']),
      estimatedDuration: 5,
      sortOrder: 22
    },
    {
      name: 'Summary Close',
      slug: 'summary-close',
      description: 'Summarize value and ask for the business',
      category: 'closing',
      difficulty: 'medium',
      buyerPersona: 'You\'ve been through a good sales process. You need to hear a clear summary of why this makes sense before committing. React positively to accurate summaries.',
      successCriteria: JSON.stringify(['Accurately summarize needs', 'Connect solution to needs', 'Ask clearly for the business']),
      coachingTips: JSON.stringify(['Recap their stated needs', 'Show how you address each', 'Confirm understanding', 'Ask directly for the order']),
      estimatedDuration: 5,
      sortOrder: 23
    },
    {
      name: 'Alternative Close',
      slug: 'alternative-close',
      description: 'Offer options that all lead to a positive outcome',
      category: 'closing',
      difficulty: 'easy',
      buyerPersona: 'You\'re ready to buy but appreciate having options. You like feeling in control of the decision. Respond well to choices rather than single options.',
      successCriteria: JSON.stringify(['Present valid alternatives', 'Guide without pushing', 'Close on their chosen option']),
      coachingTips: JSON.stringify(['Offer 2-3 clear options', 'Explain benefits of each', 'Let them choose', 'Confirm and move forward']),
      estimatedDuration: 4,
      sortOrder: 24
    },
    {
      name: 'Assumptive Close',
      slug: 'assumptive-close',
      description: 'Master the art of assuming the sale appropriately',
      category: 'closing',
      difficulty: 'medium',
      buyerPersona: 'You\'ve shown clear buying signals and are essentially ready. Respond positively to confident assumptions but will correct if the salesperson gets ahead of themselves.',
      successCriteria: JSON.stringify(['Read buying signals correctly', 'Assume confidently but appropriately', 'Handle any final concerns']),
      coachingTips: JSON.stringify(['Watch for buying signals', 'Move to next steps naturally', 'Use "when" not "if"', 'Be ready to step back if needed']),
      estimatedDuration: 5,
      sortOrder: 25
    }
  ];

  for (const scenario of scenarios) {
    await prisma.scenario.upsert({
      where: { slug: scenario.slug },
      update: {
        name: scenario.name,
        description: scenario.description,
        category: scenario.category,
        difficulty: scenario.difficulty,
        buyerPersona: scenario.buyerPersona,
        successCriteria: scenario.successCriteria,
        coachingTips: scenario.coachingTips,
        estimatedDuration: scenario.estimatedDuration,
        sortOrder: scenario.sortOrder
      },
      create: scenario
    });
  }

  // ========================================
  // CRM INTEGRATIONS (Defaults)
  // ========================================
  console.log('Seeding CRM integrations...');

  const crmIntegrations = [
    {
      provider: 'salesforce',
      name: 'Salesforce',
      isEnabled: false,
      syncMode: 'realtime'
    },
    {
      provider: 'hubspot',
      name: 'HubSpot',
      isEnabled: false,
      syncMode: 'realtime'
    }
  ];

  for (const crm of crmIntegrations) {
    await prisma.crmIntegration.upsert({
      where: { provider: crm.provider },
      update: {
        name: crm.name
      },
      create: crm
    });
  }

  // ========================================
  // SAMPLE WEBHOOKS
  // ========================================
  console.log('Seeding sample webhooks...');

  const webhooks = [
    {
      id: 'webhook-session-complete',
      name: 'Session Complete Notification',
      url: 'https://example.com/webhooks/session-complete',
      events: 'session.completed,session.sale_made',
      secret: 'whsec_demo_secret_key_123',
      enabled: true
    },
    {
      id: 'webhook-analytics',
      name: 'Analytics Sync',
      url: 'https://analytics.example.com/api/ingest',
      events: 'session.completed,session.analytics',
      secret: 'whsec_analytics_key_456',
      enabled: true
    },
    {
      id: 'webhook-slack',
      name: 'Slack Notifications',
      url: 'https://hooks.slack.com/services/T00000000/B00000000/XXXX',
      events: 'session.sale_made',
      secret: '',
      enabled: false
    }
  ];

  for (const webhook of webhooks) {
    await prisma.webhook.upsert({
      where: { id: webhook.id },
      update: webhook,
      create: webhook
    });
  }

  // ========================================
  // SMS SETTINGS
  // ========================================
  console.log('Seeding SMS settings...');

  await prisma.smsSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      provider: 'twilio',
      fromNumber: '+15551234567',
      welcomeTemplate: 'Welcome to Sell Me a Pen Training! Reply START to begin.',
      completeTemplate: 'Great session! You scored {score}%. Reply AGAIN for more.',
      followupTemplate: 'Ready for more practice? Reply START anytime.',
      autoWelcome: true,
      autoComplete: true,
      autoFollowup: false
    }
  });

  // ========================================
  // CALL TRANSFER SETTINGS
  // ========================================
  console.log('Seeding call transfer settings...');

  await prisma.callTransferSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      mode: 'warm',
      holdMusic: 'jazz',
      timeout: 30,
      fallbackAction: 'voicemail',
      triggerSale: true,
      triggerEscalate: true,
      triggerComplex: false
    }
  });

  // Transfer destinations
  const transferDests = [
    { id: 'dest-coach', name: 'Sales Coach', number: '+15559876543', priority: 1, enabled: true },
    { id: 'dest-manager', name: 'Sales Manager', number: '+15559876544', priority: 2, enabled: true }
  ];
  for (const dest of transferDests) {
    await prisma.transferDestination.upsert({
      where: { id: dest.id },
      update: dest,
      create: dest
    });
  }

  // ========================================
  // DTMF SETTINGS
  // ========================================
  console.log('Seeding DTMF settings...');

  await prisma.dtmfSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      welcomeMessage: 'Press 1 to start training, 2 for scores, 3 for a coach.',
      inputTimeout: 5,
      invalidMessage: 'Invalid selection. Please try again.',
      maxRetries: 3,
      menuItems: JSON.stringify({
        '1': { action: 'start_session', label: 'Start Training' },
        '2': { action: 'view_scores', label: 'View Scores' },
        '3': { action: 'transfer', label: 'Speak to Coach' },
        '0': { action: 'main_menu', label: 'Main Menu' }
      })
    }
  });

  // ========================================
  // AI AGENTS
  // ========================================
  console.log('Seeding AI agents...');

  const aiAgents = [
    {
      id: 'agent-skeptical',
      name: 'Skeptical Steve',
      description: 'A tough, skeptical buyer who needs convincing',
      persona: 'You are Steve, a skeptical buyer. Push back on claims and ask for proof.',
      temperature: 0.8,
      tools: JSON.stringify(['get_pen_info', 'get_pricing']),
      enabled: true
    },
    {
      id: 'agent-friendly',
      name: 'Friendly Fran',
      description: 'An approachable buyer who engages easily',
      persona: 'You are Fran, friendly and curious. Engage warmly but need value shown.',
      temperature: 0.7,
      tools: JSON.stringify(['get_pen_info']),
      enabled: true
    },
    {
      id: 'agent-busy',
      name: 'Busy Barbara',
      description: 'A time-pressed executive',
      persona: 'You are Barbara, a busy exec with 3 minutes. Get to the point.',
      temperature: 0.6,
      tools: JSON.stringify(['get_pricing']),
      enabled: true
    },
    {
      id: 'agent-budget',
      name: 'Budget Bob',
      description: 'A price-focused buyer',
      persona: 'You are Bob, always looking for the best deal. Ask about discounts.',
      temperature: 0.7,
      tools: JSON.stringify(['get_pricing']),
      enabled: true
    },
    {
      id: 'agent-technical',
      name: 'Technical Tom',
      description: 'A detail-oriented evaluator',
      persona: 'You are Tom, a technical evaluator. Ask about specs and details.',
      temperature: 0.5,
      tools: JSON.stringify(['get_pen_info']),
      enabled: true
    }
  ];

  for (const agent of aiAgents) {
    await prisma.aiAgent.upsert({
      where: { id: agent.id },
      update: agent,
      create: agent
    });
  }

  // ========================================
  // LOGIC RULES
  // ========================================
  console.log('Seeding logic rules...');

  const logicRules = [
    {
      id: 'rule-price',
      name: 'Price Objection Handler',
      priority: 10,
      trigger: 'message_received',
      condition: 'message.includes("expensive") || message.includes("cost")',
      action: 'inject_prompt',
      params: JSON.stringify({ prompt: 'Use value reframing and ROI arguments.' }),
      enabled: true
    },
    {
      id: 'rule-competitor',
      name: 'Competitor Mention',
      priority: 8,
      trigger: 'message_received',
      condition: 'message.includes("competitor") || message.includes("alternative")',
      action: 'inject_prompt',
      params: JSON.stringify({ prompt: 'Focus on unique differentiators.' }),
      enabled: true
    },
    {
      id: 'rule-buying',
      name: 'Buying Signal',
      priority: 15,
      trigger: 'message_received',
      condition: 'message.includes("buy") || message.includes("order")',
      action: 'inject_prompt',
      params: JSON.stringify({ prompt: 'Move to close but ASK for the order.' }),
      enabled: true
    },
    {
      id: 'rule-silence',
      name: 'Silence Handler',
      priority: 5,
      trigger: 'silence_detected',
      condition: 'silenceDuration > 10',
      action: 'inject_prompt',
      params: JSON.stringify({ prompt: 'Re-engage with an open question.' }),
      enabled: true
    },
    {
      id: 'rule-objections',
      name: 'Multiple Objections',
      priority: 7,
      trigger: 'objection_count',
      condition: 'objectionCount >= 3',
      action: 'inject_prompt',
      params: JSON.stringify({ prompt: 'Consider if this is the right fit.' }),
      enabled: true
    }
  ];

  for (const rule of logicRules) {
    await prisma.logicRule.upsert({
      where: { id: rule.id },
      update: rule,
      create: rule
    });
  }

  // ========================================
  // CUSTOM FUNCTIONS
  // ========================================
  console.log('Seeding custom functions...');

  const customFunctions = [
    {
      id: 'func-discount',
      name: 'Calculate Discount',
      description: 'Calculates discount based on quantity',
      params: JSON.stringify(['quantity', 'customerType']),
      body: 'let d=0; if(quantity>=10)d=15; else if(quantity>=5)d=10; if(customerType==="enterprise")d+=10; return Math.min(d,25);',
      enabled: true
    },
    {
      id: 'func-inventory',
      name: 'Check Inventory',
      description: 'Checks pen inventory by finish',
      params: JSON.stringify(['finish']),
      body: 'const inv={matte_black:47,brushed_silver:23,rose_gold:12,carbon_fiber:5}; return {available:inv[finish]||0,lowStock:(inv[finish]||0)<15};',
      enabled: true
    },
    {
      id: 'func-price',
      name: 'Format Price',
      description: 'Formats price with currency',
      params: JSON.stringify(['amount', 'currency']),
      body: 'return new Intl.NumberFormat("en-US",{style:"currency",currency:currency||"USD"}).format(amount);',
      enabled: true
    }
  ];

  for (const func of customFunctions) {
    await prisma.customFunction.upsert({
      where: { id: func.id },
      update: func,
      create: func
    });
  }

  // ========================================
  // SAMPLE SESSIONS WITH ANALYTICS
  // ========================================
  console.log('Seeding sample sessions...');

  // Get demo user
  const demoUser = await prisma.user.findUnique({ where: { email: 'user@demo.com' } });

  if (demoUser) {
    const sessionData = [
      { outcome: 'sale_made', score: 92, messages: 14, daysAgo: 0 },
      { outcome: 'sale_made', score: 87, messages: 18, daysAgo: 1 },
      { outcome: 'no_sale', score: 65, messages: 22, daysAgo: 1 },
      { outcome: 'sale_made', score: 95, messages: 12, daysAgo: 2 },
      { outcome: 'no_sale', score: 58, messages: 25, daysAgo: 2 },
      { outcome: 'sale_made', score: 78, messages: 16, daysAgo: 3 },
      { outcome: 'no_sale', score: 72, messages: 20, daysAgo: 4 },
      { outcome: 'sale_made', score: 88, messages: 15, daysAgo: 5 },
      { outcome: 'sale_made', score: 91, messages: 13, daysAgo: 6 },
      { outcome: 'no_sale', score: 45, messages: 28, daysAgo: 7 }
    ];

    for (let i = 0; i < sessionData.length; i++) {
      const data = sessionData[i];
      const startedAt = new Date();
      startedAt.setDate(startedAt.getDate() - data.daysAgo);
      startedAt.setHours(10 + i, 0, 0, 0);

      const endedAt = new Date(startedAt);
      endedAt.setMinutes(endedAt.getMinutes() + Math.floor(Math.random() * 10) + 3);

      const session = await prisma.salesSession.upsert({
        where: { id: `demo-session-${i}` },
        update: {},
        create: {
          id: `demo-session-${i}`,
          sessionId: `demo-ws-session-${i}`,
          userId: demoUser.id,
          outcome: data.outcome,
          currentPhase: 'completed',
          startedAt,
          endedAt
        }
      });

      // Create analytics for the session
      await prisma.sessionAnalytics.upsert({
        where: { sessionId: session.id },
        update: {},
        create: {
          sessionId: session.id,
          totalMessages: data.messages,
          userMessageCount: Math.floor(data.messages / 2),
          aiMessageCount: Math.ceil(data.messages / 2),
          avgResponseLength: 45.5,
          discoveryQuestionsAsked: Math.floor(Math.random() * 4) + 1,
          objectionCount: Math.floor(Math.random() * 3),
          positiveSignals: data.outcome === 'sale_made' ? Math.floor(Math.random() * 5) + 3 : Math.floor(Math.random() * 2),
          negativeSignals: data.outcome === 'no_sale' ? Math.floor(Math.random() * 4) + 2 : Math.floor(Math.random() * 2),
          successfulTechniques: JSON.stringify(['open_ended_questions', 'benefit_selling']),
          failedTechniques: JSON.stringify([])
        }
      });

      // Create some sample messages
      const messages = [
        { role: 'assistant', content: 'Hello! I see you\'re interested in pens. Before I tell you about ours, I\'m curious - when was the last time you had to sign something really important?' },
        { role: 'user', content: 'Actually, I sign contracts almost every week for my business.' },
        { role: 'assistant', content: 'Every week! That\'s a lot of important signatures. Tell me, what does your current pen say about you when you pull it out in those moments?' },
        { role: 'user', content: 'Honestly, I just use whatever is lying around. I never really thought about it.' }
      ];

      for (let j = 0; j < Math.min(messages.length, data.messages); j++) {
        await prisma.message.create({
          data: {
            sessionId: session.id,
            role: messages[j % messages.length].role,
            content: messages[j % messages.length].content
          }
        });
      }
    }

    // ========================================
    // USER GAMIFICATION DATA
    // ========================================
    console.log('Seeding user gamification data...');

    // Create UserPoints for demo user
    await prisma.userPoints.upsert({
      where: { userId: demoUser.id },
      update: {},
      create: {
        userId: demoUser.id,
        totalPoints: 1250,
        level: 3,
        dailyPoints: 175,
        weeklyPoints: 625,
        monthlyPoints: 1250,
        currentStreak: 4,
        longestStreak: 7,
        lastActivityAt: new Date()
      }
    });

    // Award some achievements to demo user
    const earnedAchievements = ['first_sale', 'sessions_10', 'streak_3', 'sales_5'];
    for (const code of earnedAchievements) {
      const achievement = await prisma.achievement.findUnique({ where: { code } });
      if (achievement) {
        await prisma.userAchievement.upsert({
          where: {
            userId_achievementId: { userId: demoUser.id, achievementId: achievement.id }
          },
          update: {},
          create: {
            userId: demoUser.id,
            achievementId: achievement.id,
            notified: true
          }
        });
      }
    }

    // Create points history
    const pointsHistory = [
      { points: 100, reason: 'Session completed - Grade A', daysAgo: 0 },
      { points: 50, reason: 'Sale made bonus', daysAgo: 0 },
      { points: 75, reason: 'Session completed - Grade B', daysAgo: 1 },
      { points: 50, reason: 'Sale made bonus', daysAgo: 1 },
      { points: 50, reason: 'Session completed - Grade C', daysAgo: 2 },
      { points: 25, reason: 'Streak bonus (3 days)', daysAgo: 2 }
    ];

    for (const ph of pointsHistory) {
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - ph.daysAgo);
      await prisma.pointsHistory.create({
        data: {
          userId: demoUser.id,
          points: ph.points,
          reason: ph.reason,
          createdAt
        }
      });
    }
  }

  // ========================================
  // SAMPLE AUDIT LOGS
  // ========================================
  console.log('Seeding sample audit logs...');

  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@demo.com' } });

  if (adminUser) {
    const auditLogs = [
      { action: 'login', resource: 'auth', details: 'Admin login successful', daysAgo: 0 },
      { action: 'update', resource: 'config', details: 'Updated AI voice settings', daysAgo: 0 },
      { action: 'create', resource: 'webhook', details: 'Created webhook: Session Complete Notification', daysAgo: 1 },
      { action: 'update', resource: 'technique', details: 'Modified closing technique: assumptive_close', daysAgo: 1 },
      { action: 'delete', resource: 'session', details: 'Deleted test session', daysAgo: 2 },
      { action: 'update', resource: 'product', details: 'Updated pen pricing', daysAgo: 3 },
      { action: 'create', resource: 'user', details: 'Created user: user@demo.com', daysAgo: 5 },
      { action: 'update', resource: 'branding', details: 'Updated primary color', daysAgo: 6 }
    ];

    for (const log of auditLogs) {
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - log.daysAgo);
      createdAt.setHours(9 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60), 0, 0);

      await prisma.auditLog.create({
        data: {
          userId: adminUser.id,
          action: log.action,
          resource: log.resource,
          resourceId: 'sample',
          details: log.details,
          ipAddress: '192.168.1.' + Math.floor(Math.random() * 255),
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
          createdAt
        }
      });
    }
  }

  // ========================================
  // PAYMENT GATEWAY SETTINGS
  // ========================================
  console.log('Seeding payment gateway settings...');

  const paymentGateways = [
    { provider: 'stripe', name: 'Stripe', isEnabled: false, testMode: true },
    { provider: 'paypal', name: 'PayPal', isEnabled: false, testMode: true },
    { provider: 'square', name: 'Square', isEnabled: false, testMode: true }
  ];

  for (const gateway of paymentGateways) {
    await prisma.paymentGateway.upsert({
      where: { provider: gateway.provider },
      update: {},
      create: gateway
    });
  }

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
