import { Injectable } from '@nestjs/common';
import { AIService } from "../../ai/ai.service";

export interface ChatServiceResponse {
  success: boolean;
  message: string;
  timestamp: string;
  provider?: string;
  tokenUsage?: number;
}

@Injectable()
export class ChatService {
  constructor(private readonly aiService: AIService) { }

  async processMessage(userMessage: string): Promise<ChatServiceResponse> {
    try {
      this.validateMessage(userMessage);
    } catch (error) {
      return {
        success: false,
        message: error.message,
        timestamp: new Date().toISOString(),
      };
    }

    const cleanedMessage = userMessage.trim();

    const prompt = this.createChatPrompt(cleanedMessage);
    const provider = this.selectProvider(cleanedMessage);

    try {
      const response = await this.aiService.generateContent({
        prompt,
        options: {
          provider,
          jsonMode: false,
          temperature: 0.7,
          maxTokens: 200,
        },
      });

      return {
        success: true,
        message: response,
        timestamp: new Date().toISOString(),
        provider,
        tokenUsage: cleanedMessage.length + response.length,
      };
    } catch (error) {
      console.error('ChatService Error:', error);
      return {
        success: false,
        message: this.getFallbackResponse(cleanedMessage),
        timestamp: new Date().toISOString(),
        provider: 'fallback',
      };
    }
  }

  private validateMessage(message: string): void {
    if (!message?.trim()) {
      throw new Error('Message cannot be empty');
    }

    if (message.length > 1000) {
      throw new Error('Message too long (max 1000 characters)');
    }
  }

  private createChatPrompt(userMessage: string): string {
    return `You are LearnBot. User: "${userMessage}". Respond concisely in 2-3 sentences.`;
  }

  private selectProvider(userMessage: string): 'gemini' | 'groq' {
    const complexKeywords = ['explain', 'tutorial', 'learn', 'course', 'path'];
    const isComplex = complexKeywords.some((keyword) =>
      userMessage.toLowerCase().includes(keyword),
    );
    return isComplex ? 'gemini' : 'groq';
  }

  private getFallbackResponse(userMessage: string): string {
    if (
      userMessage.toLowerCase().includes('hello') ||
      userMessage.toLowerCase().includes('hi')
    ) {
      return "Hello! I'm having some technical issues, but I'm here to help!";
    }
    return "I'm temporarily unavailable. Please try again in a moment!";
  }
}
