import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SubtopicContent,
  SubtopicContentDocument,
} from '../schemas/subtopic-content.schema';
import { GenerateContentDto } from './dto/generate-content.dto';
import SubtopicContentResponseDto from './dto/content-response.dto';
import { AIService } from 'src/ai/ai.service';

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    @InjectModel(SubtopicContent.name)
    private contentModel: Model<SubtopicContentDocument>,
    private aiService: AIService,
  ) { }

  /**
   * Generate content for a subtopic using AI
   */
  async generateContent(
    generateContentDto: GenerateContentDto,
  ): Promise<SubtopicContentResponseDto> {
    const {
      roadmapId,
      topicOrder,
      subtopicOrder,
      subtopicTitle,
      topicContext,
      difficultyLevel,
      additionalInstructions,
    } = generateContentDto;

    this.logger.log(
      `Generating content for subtopic: ${subtopicTitle} (${topicOrder}.${subtopicOrder})`,
    );

    // Check if content already exists
    const existingContent = await this.contentModel.findOne({
      roadmapId,
      topicOrder,
      subtopicOrder,
    });

    if (existingContent && existingContent.isGenerated) {
      throw new ConflictException(
        `Content already exists for this subtopic. Use the regenerate endpoint to create new content.`,
      );
    }

    const startTime = Date.now();

    try {
      // Generate content using AI directly
      const prompt = this.buildContentPrompt(
        subtopicTitle,
        topicContext,
        difficultyLevel || 'beginner',
        additionalInstructions,
      );

      //   const aiContent = await this.aiService.generateContent({
      //   prompt,
      //   options: {
      //     provider: 'gemini', // Better for detailed content
      //     model: 'gemini-2.5-flash',
      //     temperature: 0.7,
      //     maxTokens: 8192,
      //     jsonMode: true,
      //   },
      // });

      const aiContent = await this.aiService.generateContent({
        prompt,
        options: {
          provider: 'groq',
          model: 'llama-3.3-70b-versatile', // strong all-rounder (very common in 2026)
          // or other good alternatives:
          // 'qwen/qwen3-32b'             ← great reasoning & speed balance
          // 'openai/gpt-oss-20b'         ← fast + built-in tool use if needed
          // 'llama-3.1-8b-instant'       ← very fast & cheap (your current default)
          temperature: 0.7,
          maxTokens: 8192,
          jsonMode: true,
        },
      });

      const responseTime = Date.now() - startTime;

      // Validate the response
      this.validateContentStructure(aiContent);

      // Create or update content document
      const content = existingContent || new this.contentModel();

      content.roadmapId = roadmapId;
      content.topicOrder = topicOrder;
      content.subtopicOrder = subtopicOrder;
      content.subtopicTitle = subtopicTitle;
      content.content = aiContent.content;
      content.codeExamples = aiContent.codeExamples || [];
      content.realWorldExamples = aiContent.realWorldExamples;
      content.articleLinks = aiContent.articleLinks || [];
      content.documentationLinks = aiContent.documentationLinks || [];
      content.interviewQuestions = aiContent.interviewQuestions || [];
      content.estimatedReadTime = aiContent.estimatedReadTime;
      content.isGenerated = true;
      content.aiGeneratedMetadata = {
        model: 'gemini-1.5-flash',
        generatedAt: new Date(),
        prompt: `Generate content for ${subtopicTitle}`,
        responseTime,
      };

      await content.save();

      this.logger.log(`Content generated successfully for ${subtopicTitle}`);

      return this.mapToResponseDto(content);
    } catch (error) {
      // Handle race condition: duplicate key error (E11000)
      if (error.code === 11000) {
        this.logger.warn(
          `Race condition detected: Content for ${subtopicTitle} was created by another request. Returning existing content.`,
        );
        const raceWinContent = await this.contentModel.findOne({
          roadmapId,
          topicOrder,
          subtopicOrder,
        });
        if (raceWinContent) {
          return this.mapToResponseDto(raceWinContent);
        }
      }

      this.logger.error(
        `Failed to generate content: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Build the prompt for content generation
   */
  private buildContentPrompt(
    subtopicTitle: string,
    topicContext?: string,
    difficultyLevel: string = 'beginner',
    additionalInstructions?: string,
  ): string {
    return `Generate comprehensive learning content for the topic: "${subtopicTitle}"
${topicContext ? `Context: This is part of learning "${topicContext}"` : ''}
Difficulty Level: ${difficultyLevel}
${additionalInstructions ? `\nIMPORTANT User Instructions/Feedback for regeneration: "${additionalInstructions}"\nPlease strictly follow these instructions to improve the content.` : ''}

Create detailed content in the following JSON structure:

{
  "content": "Main content in MARKDOWN format. Include:
    - Clear explanations with headings (##, ###)
    - Key concepts in **bold**
    - Important points in bullet lists
    - Inline code examples where relevant using backticks
    - Tables if helpful
    - Step-by-step explanations
    
    Make it comprehensive (500-1000 words) but easy to understand for ${difficultyLevel} level.",
  
  "codeExamples": [
    {
      "title": "Descriptive title of what this example demonstrates",
      "code": "Complete, runnable code example",
      "language": "javascript",
      "explanation": "What this code does and why it matters"
    }
  ],
  
  "realWorldExamples": "Markdown formatted text describing 2-3 real-world scenarios where this concept is used. Include practical applications, industry use cases, or common patterns.",
  
  "articleLinks": [
    {
      "title": "Article title",
      "url": "https://actual-url.com",
      "description": "Brief description of what the article covers",
      "source": "Medium"
    }
  ],
  
  "documentationLinks": [
    {
      "title": "Official documentation title",
      "url": "https://official-docs-url.com",
      "description": "What section of docs this covers",
      "source": "Official Docs"
    }
  ],
  
  "interviewQuestions": [
    {
      "question": "Specific interview question",
      "answer": "Detailed answer in markdown format. Can include code blocks using triple backticks, bullet points, etc.",
      "difficulty": "easy",
      "tags": ["relevant", "tags"]
    }
  ],
  
  "estimatedReadTime": "15 mins"
}

Important guidelines:
1. Content should be in MARKDOWN format with proper formatting
2. Include AT LEAST 2-3 code examples
3. Provide 3-5 real article links (use actual, popular resources from Medium, Dev.to, freeCodeCamp, etc.)
4. Provide 2-3 official documentation links
5. Include 5-8 interview questions with comprehensive answers
6. Make interview questions progressive (easy to hard)
7. Code examples should be complete and runnable
8. Real-world examples should be practical and relatable
9. All links should be real and currently active (2025)
10. Content should be educational but not overwhelming


`;
  }

  /**
   * Validate content structure
   */
  private validateContentStructure(content: any): void {
    if (!content.content || typeof content.content !== 'string') {
      throw new Error('Missing or invalid required field: content');
    }

    // Ensure arrays exist
    content.codeExamples = Array.isArray(content.codeExamples)
      ? content.codeExamples
      : [];

    content.articleLinks = Array.isArray(content.articleLinks)
      ? content.articleLinks
      : [];

    content.documentationLinks = Array.isArray(content.documentationLinks)
      ? content.documentationLinks
      : [];

    content.interviewQuestions = Array.isArray(content.interviewQuestions)
      ? content.interviewQuestions
      : [];
  }

  /**
   * Get content for a specific subtopic
   */
  async getContent(
    roadmapId: string,
    topicOrder: number,
    subtopicOrder: number,
  ): Promise<SubtopicContentResponseDto> {
    this.logger.log(
      `Fetching content for roadmap ${roadmapId}, topic ${topicOrder}, subtopic ${subtopicOrder}`,
    );

    const content = await this.contentModel.findOne({
      roadmapId,
      topicOrder,
      subtopicOrder,
    });

    if (!content) {
      throw new NotFoundException(
        `Content not found for topic ${topicOrder}, subtopic ${subtopicOrder}`,
      );
    }

    return this.mapToResponseDto(content);
  }

  /**
   * Get all content for a roadmap
   */
  async getAllContentForRoadmap(
    roadmapId: string,
  ): Promise<SubtopicContentResponseDto[]> {
    this.logger.log(`Fetching all content for roadmap ${roadmapId}`);

    const contents = await this.contentModel
      .find({ roadmapId })
      .sort({ topicOrder: 1, subtopicOrder: 1 })
      .exec();

    return contents.map((content) => this.mapToResponseDto(content));
  }

  /**
   * Get all content for a specific topic in a roadmap
   */
  async getAllContentForTopic(
    roadmapId: string,
    topicOrder: number,
  ): Promise<SubtopicContentResponseDto[]> {
    this.logger.log(
      `Fetching all content for roadmap ${roadmapId}, topic ${topicOrder}`,
    );

    const contents = await this.contentModel
      .find({ roadmapId, topicOrder })
      .sort({ subtopicOrder: 1 })
      .exec();

    return contents.map((content) => this.mapToResponseDto(content));
  }

  /**
   * Regenerate content for a subtopic
   */
  async regenerateContent(
    roadmapId: string,
    topicOrder: number,
    subtopicOrder: number,
    subtopicTitle: string,
    topicContext?: string,
    difficultyLevel?: string,
    additionalInstructions?: string,
  ): Promise<SubtopicContentResponseDto> {
    this.logger.log(`Regenerating content for ${subtopicTitle}`);

    // Delete existing content
    await this.contentModel.deleteOne({
      roadmapId,
      topicOrder,
      subtopicOrder,
    });

    // Generate new content
    return this.generateContent({
      roadmapId,
      topicOrder,
      subtopicOrder,
      subtopicTitle,
      topicContext,
      difficultyLevel,
      additionalInstructions,
    });
  }

  /**
   * Delete content for a subtopic
   */
  async deleteContent(
    roadmapId: string,
    topicOrder: number,
    subtopicOrder: number,
  ): Promise<void> {
    this.logger.log(
      `Deleting content for roadmap ${roadmapId}, topic ${topicOrder}, subtopic ${subtopicOrder}`,
    );

    const result = await this.contentModel.deleteOne({
      roadmapId,
      topicOrder,
      subtopicOrder,
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException(
        `Content not found for topic ${topicOrder}, subtopic ${subtopicOrder}`,
      );
    }

    this.logger.log('Content deleted successfully');
  }

  /**
   * Delete all content for a roadmap
   */
  async deleteAllContentForRoadmap(roadmapId: string): Promise<void> {
    this.logger.log(`Deleting all content for roadmap ${roadmapId}`);

    await this.contentModel.deleteMany({ roadmapId });

    this.logger.log('All content deleted successfully');
  }

  /**
   * Check if content exists for a subtopic
   */
  async contentExists(
    roadmapId: string,
    topicOrder: number,
    subtopicOrder: number,
  ): Promise<boolean> {
    const count = await this.contentModel.countDocuments({
      roadmapId,
      topicOrder,
      subtopicOrder,
      isGenerated: true,
    });

    return count > 0;
  }

  /**
   * Map database document to response DTO
   */
  private mapToResponseDto(content: SubtopicContentDocument) {
    return {
      id: content._id.toString(),
      roadmapId: content.roadmapId,
      topicOrder: content.topicOrder,
      subtopicOrder: content.subtopicOrder,
      subtopicTitle: content.subtopicTitle,
      content: content.content,
      codeExamples: content.codeExamples.map((example) => ({
        title: example.title,
        code: example.code,
        language: example.language,
        explanation: example.explanation,
      })),
      realWorldExamples: content.realWorldExamples,
      articleLinks: content.articleLinks.map((link) => ({
        title: link.title,
        url: link.url,
        description: link.description,
        source: link.source,
      })),
      documentationLinks: content.documentationLinks.map((link) => ({
        title: link.title,
        url: link.url,
        description: link.description,
        source: link.source,
      })),
      interviewQuestions: content.interviewQuestions.map((qa) => ({
        question: qa.question,
        answer: qa.answer,
        difficulty: qa.difficulty,
        tags: qa.tags,
      })),
      aiGeneratedMetadata: content.aiGeneratedMetadata,
      isGenerated: content.isGenerated,
      estimatedReadTime: content.estimatedReadTime,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
    };
  }
}
