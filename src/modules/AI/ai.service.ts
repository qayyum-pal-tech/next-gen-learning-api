import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { AssessmentType, QuestionType } from '../Quiz/types';

interface AIOptions {
  provider?: 'gemini' | 'groq';
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

interface AIContentRequest {
  prompt: string;
  options?: AIOptions;
}

@Injectable()
export class AIService {
  private geminiAI: GoogleGenAI;
  private readonly defaultOptions: AIOptions = {
    provider: 'groq',
    model: 'llama-3.1-8b-instant',
    temperature: 0.7,
    maxTokens: 2000,
    jsonMode: true,
  };

  constructor(private configService: ConfigService) {
    const geminiKey = process.env.GEMINI_API_KEY;
    console.log("geminiKey", geminiKey)

    if (!geminiKey) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }

    this.geminiAI = new GoogleGenAI({
      apiKey: geminiKey,
    });
  }

  async generateContent(request: AIContentRequest): Promise<any> {
    const options = { ...this.defaultOptions, ...request.options };

    try {
      let result: string;

      if (options.provider === 'gemini') {
        result = await this.callGemini(request.prompt, options);
      } else {
        result = await this.callGroq(request.prompt, options);
      }

      if (!result) {
        throw new Error('No response from AI');
      }

      if (options.jsonMode) {
        try {
          return JSON.parse(result);
        } catch {
          return result;
        }
      }

      return result;
    } catch (error) {
      console.error('AI Service Error:', error);
      throw error;
    }
  }

  async callGemini(
    prompt: string,
    options?: Partial<AIOptions>,
  ): Promise<string> {
    const model = options?.model || 'gemini-1.5-flash';

    const response = await this.geminiAI.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: options?.temperature || 0.7,
        maxOutputTokens: options?.maxTokens || 2000,
        responseMimeType: options?.jsonMode ? 'application/json' : 'text/plain',
      },
    });

    return response.text;
  }

  async callGroq(
    prompt: string,
    options?: Partial<AIOptions>,
  ): Promise<string> {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    const model = options?.model || 'llama-3.1-8b-instant';

    const messages = [{ role: 'user', content: prompt }];

    const body: any = {
      model,
      messages,
      temperature: options?.temperature || 0.7,
      max_tokens: options?.maxTokens || 2000,
    };

    if (options?.jsonMode) {
      messages.unshift({
        role: 'system',
        content: 'You must respond with valid JSON only.',
      });
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    const data = await response.json();
    console.log('got:', data);
    return data.choices?.[0]?.message?.content;
  }

  async generateQuestion(params: {
    category: string;
    subtopic: string | null;
    difficulty: number;
    type: QuestionType;
  }): Promise<{
    questionText: string;
    options: string[];
    questionType: string;
    difficultyLevel: number;
    questionId: string;
  }> {
    const { category, subtopic, difficulty, type } = params;

    const subtopicStr = subtopic || 'General';

    const prompt =
      type === QuestionType.MULTIPLE_CHOICE
        ? `
Generate a CRYSTAL CLEAR multiple choice quiz question where ONE option is DEFINITELY correct and others are clearly wrong.

CATEGORY: ${category}
SUBCATEGORY: ${subtopicStr}
DIFFICULTY: ${difficulty}/5

REQUIREMENTS:
- Create 1 unambiguous question with exactly 4 options
- ONE option must be 100% factually correct based on established knowledge
- Other 3 options must be clearly incorrect with no ambiguity
- Avoid "trick" questions or debatable answers
- Question should test clear factual knowledge, not interpretation
- Make it appropriate for difficulty level ${difficulty}

Return ONLY valid JSON:
{
  "questionText": "clear direct question",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "questionType": "multiple_choice",
  "difficultyLevel": ${difficulty}
}
Do NOT wrap the response in markdown code blocks (no \`\`\`json).
Return ONLY valid JSON.
`
        : `
Generate a SPECIFIC descriptive question that can be answered in 1-2 lines and has a clear, evaluatable correct answer.

CATEGORY: ${category}
SUBCATEGORY: ${subtopicStr}
DIFFICULTY: ${difficulty}/5

REQUIREMENTS:
- Question should be answerable in 1-2 sentences maximum
- Must have ONE clear correct answer based on facts, not opinions
- Should test specific knowledge that can be objectively evaluated
- Avoid open-ended or general discussion questions
- Focus on definitions, processes, or specific concepts
- Make it appropriate for difficulty level ${difficulty}

Return ONLY valid JSON:
{
  "questionText": "specific factual question",
  "options": [],
  "questionType": "descriptive",
  "difficultyLevel": ${difficulty}
}
Do NOT wrap the response in markdown code blocks (no \`\`\`json).
Return ONLY valid JSON.
`;

    const response = await this.generateContent({
      prompt,
      options: { jsonMode: true },
    });

    if (typeof response !== 'object' || !response) {
      throw new Error('AI returned invalid question format');
    }

    const questionId = `q_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    return {
      questionText: response.questionText || '',
      options: Array.isArray(response.options) ? response.options : [],
      questionType: response.questionType || type,
      difficultyLevel: typeof response.difficultyLevel === 'number'
        ? response.difficultyLevel
        : difficulty,
      questionId,
    };
  }
  async evaluateAnswer(params: {
    questionText: string;
    questionType: QuestionType;
    userAnswer?: string;
    category: string;
    subtopic: string | null;
  }): Promise<{
    wasCorrect: boolean;
    correctAnswer: string;
    score: number;
    explanation: string;
  }> {
    const { questionText, questionType, userAnswer = '', category, subtopic } = params;

    const subtopicStr = subtopic || 'General';

    const evaluationRules =
      questionType === QuestionType.MULTIPLE_CHOICE
        ? '- Check if answer exactly matches the correct option\n- Score: 10 if correct, 0 if wrong'
        : '- Evaluate completeness and accuracy (0-10)\n- Score based on key points covered';

    const prompt = `
Evaluate the answer and provide a SHORT explanation:

QUESTION: ${questionText}
USER'S ANSWER: ${userAnswer}
QUESTION TYPE: ${questionType}

CATEGORY: ${category}
SUBCATEGORY: ${subtopicStr}

EVALUATION RULES:
${evaluationRules}

CORRECT ANSWER REQUIREMENTS:
- For multiple choice: provide the exact correct option text
- For descriptive: provide a SHORT ideal answer (1-2 lines maximum, 10-20 words)
- Keep descriptive answers concise and focused on key points only
- Avoid lengthy explanations in the correct answer field

EXPLANATION REQUIREMENTS:
- Keep it VERY SHORT (1 sentence maximum)
- Focus on the KEY LEARNING POINT only
- Explain the correct concept directly to the user
- Do NOT mention "user gave" or "user answered"
- Do NOT repeat the question or options
- Just state the core concept clearly

RESPONSE FORMAT (JSON only):
{
  "wasCorrect": boolean,
  "correctAnswer": "string",
  "score": number,
  "explanation": "one short sentence with key learning point"
}
Do NOT wrap the response in markdown code blocks (no \`\`\`json).
Return ONLY valid JSON.
`;

    const response = await this.generateContent({
      prompt,
      options: { jsonMode: true },
    });

    if (typeof response !== 'object' || !response) {
      throw new Error('AI returned invalid evaluation format');
    }

    return {
      wasCorrect: Boolean(response.wasCorrect),
      correctAnswer: String(response.correctAnswer || ''),
      score: typeof response.score === 'number' ? response.score : 0,
      explanation: String(response.explanation || 'No explanation provided.'),
    };
  }
  async generateQuizInsights(params: {
    records: Array<{
      question: string;
      subtopicTitle?: string;
      score: number;
      questionType: QuestionType;
    }>;
    category: string;
    assessmentType: AssessmentType;
    totalScore: number;
    maxScore: number;
  }): Promise<{
    overallFeedback: string;
    strengths: string[];
    weaknesses: string[];
    areasToImprove: string[];
  }> {
    const { records, category, assessmentType, totalScore, maxScore } = params;

    const performancePercentage = Math.round((totalScore / maxScore) * 100);
    const totalQuestions = records.length;

    // Group by subtopic (if available)
    const subtopicMap: Record<string, { correct: number; total: number }> = {};
    const allSubtopics = new Set<string>();

    for (const record of records) {
      const subtopic = record.subtopicTitle || 'General';
      allSubtopics.add(subtopic);
      if (!subtopicMap[subtopic]) {
        subtopicMap[subtopic] = { correct: 0, total: 0 };
      }
      subtopicMap[subtopic].total += 1;
      if (record.score >= 7) {
        subtopicMap[subtopic].correct += 1;
      }
    }

    // Build topic performance summary
    const topicPerformance = Object.entries(subtopicMap).map(([topic, stats]) => {
      const pct = Math.round((stats.correct / stats.total) * 100);
      return `${topic}: ${stats.correct}/${stats.total} (${pct}%)`;
    });

    const prompt = `
You are an expert tutor analyzing a learner's quiz performance.

CONTEXT:
- Category: ${category}
- Assessment Type: ${assessmentType === 'PRE_ASSESSMENT' ? 'Broad diagnostic across multiple subtopics' : 'Focused skill check on specific concept'}
- Total Score: ${totalScore}/${maxScore} (${performancePercentage}%)
- Total Questions: ${totalQuestions}

TOPIC PERFORMANCE:
${topicPerformance.length > 0 ? topicPerformance.join('\n') : 'No subtopic data available'}

RECORDS SUMMARY:
${records.map(r => `- [${r.score}/10] ${r.question} (Subtopic: ${r.subtopicTitle || 'General'})`).join('\n')}

YOUR TASK:
Generate structured feedback with EXACTLY these 4 fields in JSON:

{
  "overallFeedback": "One-sentence encouraging summary of performance",
  "strengths": ["List 1-3 specific topics or concepts the user mastered well"],
  "weaknesses": ["List 1-3 specific topics or concepts the user struggled with"],
  "areasToImprove": ["List 2-3 concrete, actionable study recommendations"]
}

RULES:
- Be specific: mention actual topics (e.g., "Closures", "Event Loop"), not vague terms
- For SKILL_CHECK: focus deeply on the single subtopic
- For PRE_ASSESSMENT: compare across subtopics
- Keep lists concise (max 3 items each)
- Use professional but encouraging tone
- Do NOT include markdown, explanations, or extra text

Return ONLY valid JSON.
`;

    try {
      const response = await this.generateContent({
        prompt,
        options: { jsonMode: true },
      });

      // Validate structure
      if (typeof response !== 'object') {
        throw new Error('Invalid AI response format');
      }

      return {
        overallFeedback: String(response.overallFeedback || 'Great effort!'),
        strengths: Array.isArray(response.strengths) ? response.strengths : [],
        weaknesses: Array.isArray(response.weaknesses) ? response.weaknesses : [],
        areasToImprove: Array.isArray(response.areasToImprove) ? response.areasToImprove : [],
      };
    } catch (error) {
      console.error('AI Insights generation failed:', error);

      // Fallback logic
      const isStrong = performancePercentage >= 80;
      const isMedium = performancePercentage >= 50;

      return {
        overallFeedback: isStrong
          ? `Excellent work! You scored ${totalScore}/${maxScore}.`
          : isMedium
            ? `Good effort! You scored ${totalScore}/${maxScore}.`
            : `You're on the right track. Score: ${totalScore}/${maxScore}.`,

        strengths: isStrong ? [category] : [],
        weaknesses: !isStrong ? [category] : [],
        areasToImprove: isStrong
          ? [`Explore advanced topics in ${category}`]
          : [`Review core concepts in ${category}`, `Practice more questions on weak areas`],
      };
    }
  }

  async generatePreAssessmentQuestion(params: {
    category: string;
    coveredSubtopics: string[];
    difficulty: number;
    type: QuestionType;
  }): Promise<{
    questionText: string;
    options: string[];
    questionType: string;
    difficultyLevel: number;
    subtopic: string;
    questionId: string;
  }> {
    const { category, coveredSubtopics, difficulty, type } = params;

    const prompt = `
You are an expert tutor creating a diagnostic quiz for "${category}".

GOAL: Assess overall knowledge by sampling from diverse subtopics.
ALREADY COVERED: ${coveredSubtopics.length ? coveredSubtopics.join(', ') : 'None'}

Generate ONE ${type.toUpperCase()} question at difficulty ${difficulty}/5.

RULES:
- For MULTIPLE_CHOICE: 4 options, one clearly correct
- For DESCRIPTIVE: Answerable in 1-2 sentences, has clear factual answer
- For SCENARIO: Present a realistic situation requiring application of knowledge (e.g., "You're debugging X... what do you check?")
- Assign it to a specific SUBTOPIC within ${category} (e.g., "Closures", "Event Loop")
- Avoid topics already covered

RESPONSE FORMAT (JSON ONLY):
{
  "questionText": "string",
  "options": ["string"],
  "questionType": "${type}",
  "difficultyLevel": ${difficulty},
  "subtopic": "specific subtopic name"
}
Do NOT use markdown. Return ONLY valid JSON.
`;

    const response = await this.generateContent({ prompt, options: { jsonMode: true } });

    return {
      questionText: response.questionText || '',
      options: Array.isArray(response.options) ? response.options : [],
      questionType: response.questionType || type,
      difficultyLevel: typeof response.difficultyLevel === 'number' ? response.difficultyLevel : difficulty,
      subtopic: response.subtopic || 'General',
      questionId: `q_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
    };
  }

  async generateSkillCheckQuestion(params: {
    category: string;
    focusContent: string;
    difficulty: number;
    type: QuestionType;
  }): Promise<{
    questionText: string;
    options: string[];
    questionType: string;
    difficultyLevel: number;
    questionId: string;
  }> {
    const { category, focusContent, difficulty, type } = params;

    const prompt = `
You are testing deep understanding of this specific concept:
> ${focusContent}

CATEGORY: ${category}
DIFFICULTY: ${difficulty}/5
TYPE: ${type.toUpperCase()}

RULES:
- Question MUST be strictly about the provided concept
- No deviation to related topics
- For SCENARIO: Create a realistic situation where this concept is applied
- For MULTIPLE_CHOICE: 4 options, one unambiguously correct
- For DESCRIPTIVE: Clear, concise, objectively gradable answer

RESPONSE FORMAT (JSON ONLY):
{
  "questionText": "string",
  "options": ["string"],
  "questionType": "${type}",
  "difficultyLevel": ${difficulty}
}
Do NOT use markdown. Return ONLY valid JSON.
`;

    const response = await this.generateContent({ prompt, options: { jsonMode: true } });

    return {
      questionText: response.questionText || '',
      options: Array.isArray(response.options) ? response.options : [],
      questionType: response.questionType || type,
      difficultyLevel: typeof response.difficultyLevel === 'number' ? response.difficultyLevel : difficulty,
      questionId: `q_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
    };
  }


}
