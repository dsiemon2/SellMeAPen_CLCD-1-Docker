import OpenAI from 'openai';
import pino from 'pino';
import { prisma } from '../db/prisma.js';

const logger = pino();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface CategoryScore {
  score: number;      // 0-25 points
  feedback: string;   // Short feedback
  highlights: string[]; // What they did well
  improvements: string[]; // What to improve
}

export interface SessionScore {
  total: number;  // 0-100 total score
  grade: string;  // A, B, C, D, F
  discovery: CategoryScore;
  positioning: CategoryScore;
  objections: CategoryScore;
  closing: CategoryScore;
  overallFeedback: string;
  tips: string[];
  mode: string;   // ai_sells or user_sells
}

/**
 * Calculate performance score for a completed session using AI analysis
 */
export async function calculateSessionScore(sessionId: string): Promise<SessionScore | null> {
  try {
    // Get session with messages and config
    const session = await prisma.salesSession.findUnique({
      where: { sessionId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        analytics: true
      }
    });

    if (!session || session.messages.length === 0) {
      logger.warn({ sessionId }, 'Session not found or has no messages');
      return null;
    }

    // Get the config to determine mode
    const config = await prisma.appConfig.findFirst();
    const salesMode = config?.salesMode || 'ai_sells';

    // Build conversation text for AI analysis
    const conversationText = session.messages
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    // Different system prompts for different modes
    const systemPrompt = salesMode === 'user_sells'
      ? getUserSellsPrompt(session.outcome)
      : getAiSellsPrompt(session.outcome);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Evaluate this sales conversation:\n\n${conversationText}` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 1000
    });

    const content = response.choices[0].message.content || '{}';
    const result = JSON.parse(content);

    // Calculate total score
    const total = (result.discovery?.score || 0) +
                  (result.positioning?.score || 0) +
                  (result.objections?.score || 0) +
                  (result.closing?.score || 0);

    const score: SessionScore = {
      total,
      grade: result.grade || getGrade(total),
      discovery: result.discovery || { score: 0, feedback: 'Unable to evaluate', highlights: [], improvements: [] },
      positioning: result.positioning || { score: 0, feedback: 'Unable to evaluate', highlights: [], improvements: [] },
      objections: result.objections || { score: 0, feedback: 'Unable to evaluate', highlights: [], improvements: [] },
      closing: result.closing || { score: 0, feedback: 'Unable to evaluate', highlights: [], improvements: [] },
      overallFeedback: result.overallFeedback || 'Session completed.',
      tips: result.tips || ['Practice discovery questions', 'Focus on benefits over features', 'Always ask for the sale'],
      mode: salesMode
    };

    logger.info({ sessionId, total: score.total, grade: score.grade, mode: salesMode }, 'Session score calculated');

    return score;

  } catch (error) {
    logger.error({ error, sessionId }, 'Failed to calculate session score');
    return null;
  }
}

function getGrade(total: number): string {
  if (total >= 90) return 'A';
  if (total >= 80) return 'B';
  if (total >= 70) return 'C';
  if (total >= 60) return 'D';
  return 'F';
}

/**
 * System prompt for evaluating USER as the salesperson (user_sells mode)
 */
function getUserSellsPrompt(outcome: string): string {
  return `You are a sales training coach evaluating a trainee's performance in a "Sell Me a Pen" training session.

The USER was the SALESPERSON trying to sell a pen to the AI CUSTOMER.

Evaluate the USER's sales performance across 4 categories (each worth 0-25 points):

1. DISCOVERY (0-25 points):
   - Did they ask questions to understand the customer's needs BEFORE pitching?
   - Did they listen to responses and acknowledge them?
   - Did they identify pain points or use cases?
   - Poor: Jumped straight into pitching without questions
   - Good: Asked 2-3 relevant questions about customer's needs
   - Excellent: Deep discovery, identified specific needs

2. POSITIONING (0-25 points):
   - Did they connect pen features to customer benefits?
   - Did they personalize the pitch based on discovered needs?
   - Features vs Benefits focus (benefits = better)
   - Poor: Generic feature dump
   - Good: Connected features to some benefits
   - Excellent: Customized pitch addressing specific customer needs

3. OBJECTION HANDLING (0-25 points):
   - How did they respond to customer resistance or objections?
   - Did they acknowledge concerns before addressing them?
   - Did they use techniques like feel-felt-found, reframing, etc?
   - Poor: Argued, ignored, or gave up on objections
   - Good: Addressed objections adequately
   - Excellent: Turned objections into opportunities

4. CLOSING (0-25 points):
   - Did they ask for the sale?
   - Did they use appropriate closing techniques?
   - Was the timing right?
   - Poor: Never asked for the sale
   - Good: Asked but too early or too late
   - Excellent: Natural close at the right moment with clear call-to-action

For each category provide:
- score: 0-25
- feedback: 1 sentence evaluation
- highlights: 1-2 things done well (array of strings)
- improvements: 1-2 things to improve (array of strings)

Also provide:
- overallFeedback: 2-3 sentence summary of performance
- tips: 3 specific actionable tips for improvement (array of strings)
- grade: A (90-100), B (80-89), C (70-79), D (60-69), F (<60)

Session outcome: ${outcome}

Return ONLY a JSON object matching this structure:
{
  "discovery": { "score": 0-25, "feedback": "", "highlights": [], "improvements": [] },
  "positioning": { "score": 0-25, "feedback": "", "highlights": [], "improvements": [] },
  "objections": { "score": 0-25, "feedback": "", "highlights": [], "improvements": [] },
  "closing": { "score": 0-25, "feedback": "", "highlights": [], "improvements": [] },
  "overallFeedback": "",
  "tips": [],
  "grade": ""
}`;
}

/**
 * System prompt for evaluating AI as the salesperson (ai_sells mode)
 */
function getAiSellsPrompt(outcome: string): string {
  return `You are a sales training coach evaluating a salesperson's performance in a "Sell Me a Pen" training session.

The AI was the SALESPERSON trying to sell a pen to the USER (customer).

Evaluate the AI salesperson's performance across 4 categories (each worth 0-25 points):

1. DISCOVERY (0-25 points):
   - Did they ask questions to understand the customer's needs BEFORE pitching?
   - Did they listen to responses and acknowledge them?
   - Did they identify pain points or use cases?
   - Poor: Jumped straight into pitching without questions
   - Good: Asked 2-3 relevant questions about customer's needs
   - Excellent: Deep discovery, identified specific needs

2. POSITIONING (0-25 points):
   - Did they connect pen features to customer benefits?
   - Did they personalize the pitch based on discovered needs?
   - Features vs Benefits focus (benefits = better)
   - Poor: Generic feature dump
   - Good: Connected features to some benefits
   - Excellent: Customized pitch addressing specific customer needs

3. OBJECTION HANDLING (0-25 points):
   - How did they respond to customer resistance or objections?
   - Did they acknowledge concerns before addressing them?
   - Did they use techniques like feel-felt-found, reframing, etc?
   - Poor: Argued, ignored, or gave up on objections
   - Good: Addressed objections adequately
   - Excellent: Turned objections into opportunities

4. CLOSING (0-25 points):
   - Did they ask for the sale?
   - Did they use appropriate closing techniques?
   - Was the timing right?
   - Poor: Never asked for the sale
   - Good: Asked but too early or too late
   - Excellent: Natural close at the right moment with clear call-to-action

For each category provide:
- score: 0-25
- feedback: 1 sentence evaluation
- highlights: 1-2 things done well (array of strings)
- improvements: 1-2 things to improve (array of strings)

Also provide:
- overallFeedback: 2-3 sentence summary of performance
- tips: 3 specific actionable tips for improvement (array of strings)
- grade: A (90-100), B (80-89), C (70-79), D (60-69), F (<60)

Session outcome: ${outcome}

Return ONLY a JSON object matching this structure:
{
  "discovery": { "score": 0-25, "feedback": "", "highlights": [], "improvements": [] },
  "positioning": { "score": 0-25, "feedback": "", "highlights": [], "improvements": [] },
  "objections": { "score": 0-25, "feedback": "", "highlights": [], "improvements": [] },
  "closing": { "score": 0-25, "feedback": "", "highlights": [], "improvements": [] },
  "overallFeedback": "",
  "tips": [],
  "grade": ""
}`;
}
