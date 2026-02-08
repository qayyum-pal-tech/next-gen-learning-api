import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  RoadmapFlat,
  RoadmapFlatDocument,
} from '../schemas/roadmap-flat.schema';
import { CreateRoadmapDto } from './dto/create-roadmap.dto';
import { RoadmapResponseDto } from './dto/roadmap-response.dto';
import { AIService } from 'src/ai/ai.service';

@Injectable()
export class RoadmapService {
  private readonly logger = new Logger(RoadmapService.name);

  constructor(
    @InjectModel(RoadmapFlat.name)
    private roadmapModel: Model<RoadmapFlatDocument>,
    private aiService: AIService,
  ) { }

  /**
   * Create a new roadmap using AI
   */
  async create(
    createRoadmapDto: CreateRoadmapDto,
  ): Promise<RoadmapResponseDto> {
    const { subject, userId, difficultyLevel, additionalContext } =
      createRoadmapDto;

    this.logger.log(`Creating roadmap for user ${userId}, subject: ${subject}`);

    // Check if user already has a roadmap for this subject
    const existingRoadmap = await this.roadmapModel.findOne({
      userId,
      subject: { $regex: new RegExp(`^${subject}$`, 'i') },
    });

    if (existingRoadmap) {
      throw new ConflictException(
        `You already have a roadmap for "${subject}". Use the existing one or delete it first.`,
      );
    }

    const startTime = Date.now();

    try {
      // Generate roadmap using AI directly
      const prompt = this.buildRoadmapPrompt(
        subject,
        difficultyLevel || 'beginner',
        additionalContext,
      );

      const aiRoadmap = await this.aiService.generateContent({
        prompt,
        options: {
          provider: 'groq', // Fast for structured data
          model: 'llama-3.1-8b-instant',
          temperature: 0.7,
          maxTokens: 4000,
          jsonMode: true,
        },
      });

      const responseTime = Date.now() - startTime;

      // Validate the response
      this.validateRoadmapStructure(aiRoadmap);

      // Create roadmap document
      const roadmap = new this.roadmapModel({
        subject,
        userId,
        description: aiRoadmap.description,
        topics: aiRoadmap.topics.map((topic) => ({
          ...topic,
          isCompleted: false,
          subtopics: topic.subtopics.map((subtopic) => ({
            ...subtopic,
            isCompleted: false,
            resources: [],
            notes: '',
          })),
        })),
        status: 'not_started',
        difficultyLevel: difficultyLevel || 'beginner',
        totalEstimatedDuration: aiRoadmap.totalEstimatedDuration,
        progressPercentage: 0,
        aiGeneratedMetadata: {
          model: 'llama-3.1-8b-instant',
          generatedAt: new Date(),
          prompt: `Generate roadmap for ${subject} at ${difficultyLevel} level`,
          responseTime,
        },
      });

      await roadmap.save();

      this.logger.log(`Roadmap created successfully with ID: ${roadmap._id}`);

      return this.mapToResponseDto(roadmap);
    } catch (error) {
      this.logger.error(
        `Failed to create roadmap: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Build the prompt for roadmap generation
   */
  private buildRoadmapPrompt(
    subject: string,
    difficultyLevel: string,
    additionalContext?: string,
  ): string {
    return `Create a comprehensive learning roadmap for "${subject}" at ${difficultyLevel} level.

${additionalContext ? `Additional context: ${additionalContext}\n` : ''}

Requirements:
1. Structure the roadmap as a JSON object with topics and subtopics
2. Each topic should have:
   - title: clear, concise topic name
   - order: sequential number (1, 2, 3...)
   - description: brief explanation (1-2 sentences)
   - estimatedDuration: realistic time estimate
   - subtopics: array of subtopics

3. Each subtopic should have:
   - title: clear, concise subtopic name
   - order: sequential number within the topic (1, 2, 3...)
   - description: brief explanation
   - estimatedDuration: realistic time estimate

4. Include 5-8 main topics
5. Each topic should have 2-5 subtopics
6. Make it progressive - from fundamentals to advanced concepts
7. Be specific and practical

Return ONLY a valid JSON object in this exact format:
{
  "description": "Brief overview of the ${subject} learning path",
  "totalEstimatedDuration": "estimated total time",
  "topics": [
    {
      "title": "Topic Name",
      "order": 1,
      "description": "Topic description",
      "estimatedDuration": "time estimate",
      "subtopics": [
        {
          "title": "Subtopic Name",
          "order": 1,
          "description": "Subtopic description",
          "estimatedDuration": "time estimate"
        }
      ]
    }
  ]
}`;
  }

  /**
   * Validate roadmap structure
   */
  private validateRoadmapStructure(roadmap: any): void {
    if (!roadmap.topics || !Array.isArray(roadmap.topics)) {
      throw new Error('Invalid roadmap structure: missing topics array');
    }

    roadmap.topics.forEach((topic, topicIndex) => {
      if (!topic.title || typeof topic.order !== 'number') {
        throw new Error(`Invalid topic at index ${topicIndex}`);
      }

      if (!topic.subtopics || !Array.isArray(topic.subtopics)) {
        topic.subtopics = [];
      }

      topic.subtopics.forEach((subtopic, subtopicIndex) => {
        if (!subtopic.title || typeof subtopic.order !== 'number') {
          throw new Error(
            `Invalid subtopic at topic ${topicIndex}, subtopic ${subtopicIndex}`,
          );
        }
      });
    });
  }

  /**
   * Get all roadmaps for a user
   */
  async findAllByUser(userId: string): Promise<RoadmapResponseDto[]> {
    this.logger.log(`Fetching all roadmaps for user: ${userId}`);

    const roadmaps = await this.roadmapModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .exec();

    return roadmaps.map((roadmap) => this.mapToResponseDto(roadmap));
  }

  /**
   * Get a specific roadmap by ID
   */
  async findOne(id: string, userId: string): Promise<RoadmapResponseDto> {
    this.logger.log(`Fetching roadmap ${id} for user ${userId}`);

    const roadmap = await this.roadmapModel.findOne({ _id: id, userId }).exec();

    if (!roadmap) {
      throw new NotFoundException(`Roadmap with ID ${id} not found`);
    }

    return this.mapToResponseDto(roadmap);
  }

  /**
   * Update topic completion status
   */
  async updateTopicProgress(
    roadmapId: string,
    userId: string,
    topicOrder: number,
    isCompleted: boolean,
  ): Promise<RoadmapResponseDto> {
    this.logger.log(
      `Updating topic ${topicOrder} completion status for roadmap ${roadmapId}`,
    );

    const roadmap = await this.roadmapModel.findOne({
      _id: roadmapId,
      userId,
    });

    if (!roadmap) {
      throw new NotFoundException(`Roadmap with ID ${roadmapId} not found`);
    }

    const topic = roadmap.topics.find((t) => t.order === topicOrder);

    if (!topic) {
      throw new NotFoundException(`Topic with order ${topicOrder} not found`);
    }

    topic.isCompleted = isCompleted;

    await this.updateProgress(roadmap);
    roadmap.markModified('topics');
    await roadmap.save();

    return this.mapToResponseDto(roadmap);
  }

  /**
   * Update subtopic completion status
   */
  async updateSubtopicProgress(
    roadmapId: string,
    userId: string,
    topicOrder: number,
    subtopicOrder: number,
    isCompleted: boolean,
    notes?: string,
  ): Promise<RoadmapResponseDto> {
    this.logger.log(
      `Updating subtopic ${topicOrder}.${subtopicOrder} for roadmap ${roadmapId}`,
    );

    const roadmap = await this.roadmapModel.findOne({
      _id: roadmapId,
      userId,
    });

    if (!roadmap) {
      throw new NotFoundException(`Roadmap with ID ${roadmapId} not found`);
    }

    const topic = roadmap.topics.find((t) => t.order === topicOrder);

    if (!topic) {
      throw new NotFoundException(`Topic with order ${topicOrder} not found`);
    }

    const subtopic = topic.subtopics.find((st) => st.order === subtopicOrder);

    if (!subtopic) {
      throw new NotFoundException(
        `Subtopic with order ${subtopicOrder} not found in topic ${topicOrder}`,
      );
    }

    subtopic.isCompleted = isCompleted;

    if (notes !== undefined) {
      subtopic.notes = notes;
    }

    // Quiz Logic: Topic completion is no longer automatic.
    // It requires explicit "Take Quiz" action.
    // const allSubtopicsCompleted = topic.subtopics.every((st) => st.isCompleted);
    // topic.isCompleted = allSubtopicsCompleted;

    await this.updateProgress(roadmap);
    roadmap.markModified('topics'); // Explicitly mark topics as modified for nested updates
    await roadmap.save();

    return this.mapToResponseDto(roadmap);
  }

  /**
   * Delete a roadmap
   */
  async remove(id: string, userId: string): Promise<void> {
    this.logger.log(`Deleting roadmap ${id} for user ${userId}`);

    const result = await this.roadmapModel.deleteOne({ _id: id, userId });

    if (result.deletedCount === 0) {
      throw new NotFoundException(`Roadmap with ID ${id} not found`);
    }

    this.logger.log(`Roadmap ${id} deleted successfully`);
  }

  /**
   * Calculate and update progress percentage
   */
  private async updateProgress(roadmap: RoadmapFlatDocument): Promise<void> {
    let totalItems = 0;
    let completedItems = 0;

    roadmap.topics.forEach((topic) => {
      totalItems += 1;
      totalItems += topic.subtopics.length;

      if (topic.isCompleted) {
        completedItems += 1;
      }

      topic.subtopics.forEach((subtopic) => {
        if (subtopic.isCompleted) {
          completedItems += 1;
        }
      });
    });

    roadmap.progressPercentage =
      totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    if (roadmap.progressPercentage === 0) {
      roadmap.status = 'not_started';
    } else if (roadmap.progressPercentage === 100) {
      roadmap.status = 'completed';
    } else {
      roadmap.status = 'in_progress';
    }
  }

  /**
   * Map database document to response DTO
   */
  private mapToResponseDto(roadmap: RoadmapFlatDocument): RoadmapResponseDto {
    return {
      id: roadmap._id.toString(),
      subject: roadmap.subject,
      userId: roadmap.userId,
      description: roadmap.description,
      topics: roadmap.topics.map((topic) => ({
        title: topic.title,
        order: topic.order,
        description: topic.description,
        subtopics: topic.subtopics.map((subtopic) => ({
          title: subtopic.title,
          order: subtopic.order,
          description: subtopic.description,
          isCompleted: subtopic.isCompleted,
          estimatedDuration: subtopic.estimatedDuration,
          resources: subtopic.resources,
          notes: subtopic.notes,
        })),
        isCompleted: topic.isCompleted,
        estimatedDuration: topic.estimatedDuration,
      })),
      status: roadmap.status,
      difficultyLevel: roadmap.difficultyLevel,
      totalEstimatedDuration: roadmap.totalEstimatedDuration,
      progressPercentage: roadmap.progressPercentage,
      aiGeneratedMetadata: roadmap.aiGeneratedMetadata,
      createdAt: roadmap.createdAt,
      updatedAt: roadmap.updatedAt,
    };
  }
}
