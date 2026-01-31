import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

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
}
