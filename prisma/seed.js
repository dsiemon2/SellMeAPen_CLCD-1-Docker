import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    console.log('Seeding database...');
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
