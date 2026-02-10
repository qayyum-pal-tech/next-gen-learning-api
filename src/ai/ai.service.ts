import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// import { GoogleGenAI } from '@google/genai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AssessmentType, QuestionType } from '../quiz/types';

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
  private geminiAI: GoogleGenerativeAI;
  private readonly defaultOptions: AIOptions = {
    provider: 'groq',
    model: 'llama-3.1-8b-instant',
    temperature: 0.7,
    maxTokens: 2000,
    jsonMode: true,
  };

  private readonly groqFallbackModels = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'deepseek-r1-distill-llama-70b',
    'mixtral-8x7b-32768',
    'gemma2-9b-it',
    'llama-3.2-3b-preview',
    'llama-3.2-1b-preview',
  ];

  constructor(private configService: ConfigService) {
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!geminiKey) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }

    // this.geminiAI = new GoogleGenAI({
    //   apiKey: geminiKey,
    // });
    this.geminiAI = new GoogleGenerativeAI(geminiKey);
  }

  async generateContent(request: AIContentRequest): Promise<any> {
    const options = { ...this.defaultOptions, ...request.options };

    try {
      let result: string;

      if (options.provider === 'gemini') {
        result = await this.callGemini(request.prompt, options);
      } else {
        // Groq logic with fallback models
        const modelsToTry = options.model && !this.groqFallbackModels.includes(options.model)
          ? [options.model, ...this.groqFallbackModels]
          : this.groqFallbackModels;

        let lastError: Error;
        let success = false;

        for (const model of modelsToTry) {
          try {
            console.log(`Trying Groq model: ${model}`);
            result = await this.callGroq(request.prompt, { ...options, model });
            success = true;
            break;
          } catch (error: any) {
            lastError = error;
            console.warn(`Groq model ${model} failed:`, error.message);
            // Continue to next model
          }
        }

        if (!success) {
          // If all Groq models fail, fallback to Gemini
          console.warn('All Groq models failed, falling back to Gemini:', lastError!.message);

          // Remove Groq-specific options to allow callGemini to use its defaults
          const { model: _, provider: __, ...fallbackOptions } = options;
          result = await this.callGemini(request.prompt, { ...fallbackOptions, provider: 'gemini' });
        }
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

  async callGemini(prompt: string, options?: Partial<AIOptions>): Promise<string> {
    const modelName = options?.model || 'gemini-2.5-flash';

    const model = this.geminiAI.getGenerativeModel({
      model: modelName,
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 2000,
        responseMimeType: options?.jsonMode ? 'application/json' : 'text/plain',
      },
    });

    return result.response.text();
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

    if (data.error) {
      throw new Error(data.error.message || 'Groq API error');
    }

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
    previousQuestions?: string[];
  }): Promise<{
    questionText: string;
    options: string[];
    questionType: string;
    difficultyLevel: number;
    subtopic: string;
    questionId: string;
  }> {
    const { category, coveredSubtopics, difficulty, type, previousQuestions = [] } = params;

    const previousContext = previousQuestions.length
      ? `\nPREVIOUS QUESTIONS (DO NOT REPEAT OR REPHRASE THESE):\n${previousQuestions.map(q => `- ${q}`).join('\n')}\n`
      : '';

    const prompt = `
You are an expert tutor creating a diagnostic quiz for "${category}".

GOAL: Assess overall knowledge by sampling from diverse subtopics.
ALREADY COVERED: ${coveredSubtopics.length ? coveredSubtopics.join(', ') : 'None'}
${previousContext}

Generate ONE ${type.toUpperCase()} question at difficulty ${difficulty}/5.

RULES:
- The question MUST be about "${category}". DO NOT generate questions about other technologies even if they are commonly used together (unless strictly necessary).
- For MULTIPLE_CHOICE: 4 options, one clearly correct
- For DESCRIPTIVE: Answerable in 1-2 sentences, has clear factual answer
- For SCENARIO: Present a realistic situation requiring application of knowledge (e.g., "You're debugging X... what do you check?")
- Assign it to a specific SUBTOPIC within ${category} (e.g., "Closures", "Event Loop")
- Avoid topics already covered, and DO NOT repeat previous questions.

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
    topicContent?: string | null;
    previousQuestions?: string[];
  }): Promise<{
    questionText: string;
    options: string[];
    questionType: string;
    difficultyLevel: number;
    questionId: string;
  }> {
    const { category, focusContent, difficulty, type, topicContent, previousQuestions = [] } = params;

    const contentSection = topicContent
      ? `
TOPIC CONTENT:
---
${topicContent}
---

CRITICAL: You MUST generate questions strictly based on the content provided above. Do NOT use external knowledge or make assumptions beyond what is explicitly mentioned in the topic content.
`
      : '';

    const previousContext = previousQuestions.length
      ? `\nPREVIOUS QUESTIONS (DO NOT REPEAT OR REPHRASE THESE):\n${previousQuestions.map(q => `- ${q}`).join('\n')}\n`
      : '';

    const prompt = `
You are acting as a strict examiner.
Target Concept: "${focusContent}"
Broad Category: "${category}"
Difficulty: ${difficulty}/5
Type: ${type.toUpperCase()}

${contentSection}
${previousContext}

INSTRUCTIONS:
1. Generate ONE question ONLY about "${focusContent}".
2. IF "${focusContent}" is a specific subtopic (e.g., "useEffect"), the question MUST be about that specific scope. DO NOT ask about generic "${category}" concepts or other siblings (like "useState" or "props") unless they are directly necessary for the context of "${focusContent}".
3. IGNORE any part of the "TOPIC CONTENT" that is not relevant to "${focusContent}".
4. The question must be unsolvable without knowledge of "${focusContent}".
5. If the content provided is not sufficient, use your general knowledge of "${focusContent}" within the context of "${category}", but prioritize the provided content.

RULES:
- No deviation to related topics.
- For SCENARIO: Create a realistic situation where "${focusContent}" is the key solution.
- For MULTIPLE_CHOICE: 4 options, one unambiguously correct.
- For DESCRIPTIVE: Clear, concise, objectively gradable answer.
- DO NOT repeat previous questions.

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


  async generateSkillSuggestions(query: string): Promise<string[]> {
    const prompt = `You are an educational content architect creating high-level learning pathways.

Generate 5-7 BROAD, COMPREHENSIVE learning path suggestions based on: "${query}"
Each suggestion should be a complete, standalone learning path that could be a full course.

CRITICAL RULES:
1. Each suggestion MUST be a broad, high-level learning path (not sub-topics)
2. Suggestions should represent FULL COURSES, not individual modules
3. Focus on practical, real-world learning journeys
4. Include technology combinations and ecosystem topics
5. For ambiguous queries, provide the most standard industry paths
6. For non-technical queries: return empty array

PATH CHARACTERISTICS:
- Broad scope (weeks/months of learning)
- Includes multiple technologies/frameworks
- Practical, career-oriented focus
- Industry-standard combinations
- Suitable for creating full video courses

EXACT FORMAT:
{
  "suggestions": [
    "Complete [Technology Stack] Learning Path",
    "[Tech Area] with [Related Tech] Mastery",
    "Full-Stack Development with [Primary Tech]",
    "[Domain] Development using [Tech Ecosystem]"
  ]
}

EXAMPLES OF WHAT I WANT (broad paths):

Query: "react"
Good Suggestions:
1. "Complete React Frontend Developer Path"
2. "React with Next.js Full-Stack Development"
3. "Modern React Ecosystem Mastery (Redux, Router, Testing)"
4. "React Native Mobile App Development"
5. "React for Enterprise Applications"
6. "React + TypeScript Professional Development"

Query: "python"
Good Suggestions:
1. "Python Full-Stack Web Development (Django/Flask)"
2. "Data Science and Machine Learning with Python"
3. "Python Automation and Scripting Mastery"
4. "Python Backend Development & APIs"
5. "Python for DevOps and Cloud Automation"
6. "Advanced Python Programming & Algorithms"

Query: "next"
Good Suggestions:
1. "Next.js Full-Stack Web Development"
2. "Next.js with TypeScript and Tailwind CSS"
3. "Next.js App Router & Server Components"
4. "Next.js for Production Applications"
5. "Next.js + React Ecosystem Mastery"
6. "Next.js E-commerce Development"

Query: "aws"
Good Suggestions:
1. "AWS Cloud Practitioner to Solutions Architect"
2. "AWS DevOps and CI/CD Pipeline"
3. "AWS Serverless Application Development"
4. "AWS for Machine Learning & AI"
5. "AWS Security and Compliance"
6. "AWS Database Services Mastery"

Query: "javascript"
Good Suggestions:
1. "Modern JavaScript Full-Stack Development"
2. "JavaScript Frameworks Comparison (React, Vue, Angular)"
3. "Node.js Backend Development with JavaScript"
4. "JavaScript Testing and Quality Assurance"
5. "JavaScript Performance Optimization"
6. "JavaScript for Interactive Web Applications"

BAD EXAMPLES (avoid - too narrow):
- "React Components and JSX Fundamentals" ❌
- "State Management in React" ❌
- "React Hooks" ❌
- These are SUB-TOPICS, not complete paths

NON-TECHNICAL QUERIES (return empty array):
- "banana", "clouds", "love", "random words"
- Completely unrelated to technology/learning
- Too vague: "things", "stuff", "computer"

ASSESSMENT CRITERIA:
1. If query is tech-related: provide broad learning paths
2. If query is too vague but tech: provide most common paths
3. If completely non-technical: return empty array
4. Each suggestion should be 3-8 words describing a complete journey

Return ONLY valid JSON in this exact format:
{
  "suggestions": [] // array of strings or empty array
}

Do NOT wrap in markdown code blocks.
Do NOT add explanations.
Each suggestion must be a COMPLETE LEARNING PATH, not a subtopic.`;

    try {
      const response = await this.generateContent({
        prompt,
        options: { jsonMode: true },
      });

      // Validate the response
      if (response && Array.isArray(response.suggestions)) {
        const filteredSuggestions = response.suggestions.filter(suggestion =>
          suggestion &&
          typeof suggestion === 'string' &&
          suggestion.length > 10 && // Minimum length to ensure it's substantial
          suggestion.length < 100 && // Maximum length to keep it concise
          !suggestion.toLowerCase().includes('fundamentals') && // Avoid sub-topics
          !suggestion.toLowerCase().includes('basics') && // Avoid sub-topics
          !suggestion.toLowerCase().includes('hooks') && // Avoid React-specific sub-topics
          !suggestion.toLowerCase().includes('components') // Avoid sub-topics
        );

        // Ensure we have broad enough suggestions
        const broadSuggestions = filteredSuggestions.filter(suggestion => {
          const words = suggestion.split(' ');
          return words.length >= 3 && words.length <= 8; // Broad paths have more words
        });

        return broadSuggestions.slice(0, 7);
      }

      return []; // Return empty array for any issues
    } catch (error) {
      console.error('Generate suggestions error:', error);
      return []; // Return empty array on error
    }
  }
}
