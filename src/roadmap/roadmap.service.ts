import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  RoadmapFlat,
  RoadmapFlatDocument,
} from '../schemas/roadmap-flat.schema';
import { CreateRoadmapDto } from './dto/create-roadmap.dto';
import { RoadmapResponseDto } from './dto/roadmap-response.dto';
import { AIService } from 'src/ai/ai.service';
import { TeamsService } from 'src/teams/teams.service';
import { ShareRoadmapDto } from './dto/share-roadmap.dto';
@Injectable()
export class RoadmapService {
  private readonly logger = new Logger(RoadmapService.name);

  constructor(
    @InjectModel(RoadmapFlat.name)
    private roadmapModel: Model<RoadmapFlatDocument>,
    private aiService: AIService,
    private teamService: TeamsService
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
        version: aiRoadmap.version,
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
        enabled: true,
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
2. **identify the LATEST STABLE VERSION of ${subject}** (e.g., "React 18", "Python 3.11", "Next.js 14").
3. **Ensure ALL content, code snippets, and strict practices are valid for this specific version.**
4. Each topic should have:
   - title: clear, concise topic name
   - order: sequential number (1, 2, 3...)
   - description: brief explanation (1-2 sentences)
   - estimatedDuration: realistic time estimate
   - subtopics: array of subtopics

5. Each subtopic should have:
   - title: clear, concise subtopic name
   - order: sequential number within the topic (1, 2, 3...)
   - description: brief explanation
   - estimatedDuration: realistic time estimate

6. Include 5-8 main topics
7. Each topic should have 2-5 subtopics
8. Make it progressive - from fundamentals to advanced concepts
9. Be specific and practical

Return ONLY a valid JSON object in this exact format:
{
  "version": "The specific version used (e.g. 'React 18.2')",
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

    if (!roadmap.version) {
      this.logger.warn('Roadmap generated without explicit version');
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
      version: roadmap.version,
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
      acceptanceStatus: roadmap.acceptanceStatus,
      sharedBy: roadmap.sharedBy,
      teamId: roadmap.teamId,
      aiGeneratedMetadata: roadmap.aiGeneratedMetadata,
      createdAt: roadmap.createdAt,
      updatedAt: roadmap.updatedAt,
    };
  }


  async shareRoadmap(dto: ShareRoadmapDto): Promise<{ createdCount: number }> {
    const { roadmapId, shareType, sharedBy } = dto;
    const enabledByDefault = shareType === 'USERS';

    // 1. Fetch original roadmap (must be the OWNER copy)
    const source = await this.roadmapModel.findOne({ _id: roadmapId }).lean();
    if (!source) {
      throw new NotFoundException(`Roadmap ${roadmapId} not found`);
    }

    // 2. Resolve target users
    let targetUserIds = await this.resolveShareTargets(dto);

    // 3. REMOVE self-sharing
    targetUserIds = targetUserIds.filter((userId) => userId !== sharedBy);
    if (targetUserIds.length === 0) return { createdCount: 0 };

    // 4. Find already shared users
    const existingShares = await this.roadmapModel.find(
      {
        originalRoadmapId: roadmapId,
        sharedBy,
        userId: { $in: targetUserIds },
      },
      { userId: 1 }
    ).lean();

    const alreadySharedUserIds = new Set(existingShares.map((doc) => doc.userId.toString()));

    // 5. Keep only NEW users
    const newTargetUserIds = targetUserIds.filter((userId) => !alreadySharedUserIds.has(userId));
    if (newTargetUserIds.length === 0) return { createdCount: 0 };

    // 6. Clone roadmap
    const clonedDocs = newTargetUserIds.map((targetUserId) => {
      const { _id, createdAt, updatedAt, ...rest } = source;
      return {
        ...rest,
        originalRoadmapId: roadmapId,
        userId: targetUserId,
        sharedBy,
        enabled: enabledByDefault,
        status: 'not_started',
        acceptanceStatus: shareType === 'TEAM' ? 'pending' : 'accepted',
        progressPercentage: 0,
        topics: rest.topics.map((topic) => ({
          ...topic,
          isCompleted: false,
          subtopics: topic.subtopics.map((sub) => ({
            ...sub,
            isCompleted: false,
            notes: '',
          })),
        })),
        ...(shareType === 'TEAM' ? { teamId: dto.teamId } : {}),
      };
    });

    const result = await this.roadmapModel.insertMany(clonedDocs);
    return { createdCount: result.length };
  }

  private async resolveShareTargets(dto: ShareRoadmapDto): Promise<string[]> {
    const { shareType, userIds, teamId, sharedBy } = dto;

    if (shareType === 'USERS') {
      if (!userIds?.length) throw new BadRequestException('userIds required for USERS share');
      return userIds;
    }

    if (shareType === 'TEAM') {
      if (!teamId) throw new BadRequestException('teamId required for TEAM share');
      const team = await this.teamService.getTeamById(teamId, sharedBy);
      if (!team?.members?.length) throw new NotFoundException('Team not found or empty');

      return team.members.map((member) => {
        if (typeof member === 'object' && member._id) return member._id.toString();
        return member.toString();
      });
    }

    return [];
  }

  async getTeamSharedRoadmaps(teamId: string, userId?: string) {
    // Group by originalRoadmapId to show unique shared roadmaps
    const groupQuery: any[] = [
      { $match: { teamId } },
      {
        $group: {
          _id: '$originalRoadmapId',
          subject: { $first: '$subject' },
          description: { $first: '$description' },
          totalEstimatedDuration: { $first: '$totalEstimatedDuration' },
          difficultyLevel: { $first: '$difficultyLevel' },
          sharedBy: { $first: '$sharedBy' },
          count: { $sum: 1 },
          // If we have a userId, let's also find THEIR specific status for this shared roadmap
          users: { $push: { userId: '$userId', acceptanceStatus: '$acceptanceStatus' } }
        },
      },
      { $sort: { subject: 1 } },
    ];

    const roadmaps = await this.roadmapModel.aggregate(groupQuery);

    return roadmaps.map((r) => {
      let myStatus = 'pending';
      if (userId) {
        const found = r.users.find((u: any) => u.userId === userId);
        if (found) myStatus = found.acceptanceStatus;
      }

      return {
        originalRoadmapId: r._id,
        subject: r.subject,
        description: r.description,
        totalEstimatedDuration: r.totalEstimatedDuration,
        difficultyLevel: r.difficultyLevel,
        sharedBy: r.sharedBy,
        memberCount: r.count,
        acceptanceStatus: myStatus, // Add this for UI to disable denied ones
      };
    });
  }

  async getTeamRoadmapProgress(teamId: string, originalRoadmapId: string) {
    // 1. Get all roadmap instances for this team/roadmap that are ACCEPTED
    const instances = await this.roadmapModel
      .find({ teamId, originalRoadmapId, acceptanceStatus: 'accepted' })
      .exec();

    // 2. Resolve users for these instances
    const userIds = instances.map((ins) => ins.userId);
    const users = await this.teamService.getUsersByIds(userIds);
    const userMap = new Map(users.map((u: any) => [u._id.toString(), u.username]));

    // 3. Get the OWNER (manager) instance too
    const ownerInstance = await this.roadmapModel.findById(originalRoadmapId).exec();

    // 4. Verify the roadmap was shared with this team at all if no accepted members found
    if (!instances.length && !ownerInstance) {
      const sharingExists = await this.roadmapModel.exists({ teamId, originalRoadmapId });
      if (!sharingExists) {
        throw new NotFoundException('No shared roadmaps found for this team');
      }
    }
    let managerProgress = null;
    if (ownerInstance) {
      const ownerUser = await this.teamService.getUsersByIds([ownerInstance.userId]);
      const ownerUsername = ownerUser[0]?.username || 'Manager';

      const firstIncomplete = ownerInstance.topics.find((t) => !t.isCompleted);
      const currentTopicOrder = firstIncomplete ? firstIncomplete.order : (ownerInstance.topics.length > 0 ? ownerInstance.topics[ownerInstance.topics.length - 1].order : 1);

      managerProgress = {
        userId: ownerInstance.userId,
        username: `${ownerUsername} (Manager)`,
        currentTopicOrder,
        progressPercentage: ownerInstance.progressPercentage,
      };
    }

    // 4. Calculate current topic for each shared member
    const membersProgress = instances.map((ins) => {
      let currentTopicOrder = 1;
      const firstIncomplete = ins.topics.find((t) => !t.isCompleted);
      if (firstIncomplete) {
        currentTopicOrder = firstIncomplete.order;
      } else if (ins.topics.length > 0) {
        currentTopicOrder = ins.topics[ins.topics.length - 1].order;
      }

      return {
        userId: ins.userId,
        username: userMap.get(ins.userId.toString()) || 'Unknown User',
        currentTopicOrder,
        progressPercentage: ins.progressPercentage,
      };
    });

    // 5. Build clean structure (strip local completions)
    // Use ownerInstance for structure if available, otherwise fallback to first instance
    const structureSource = ownerInstance || instances[0];
    if (!structureSource) {
      throw new NotFoundException('Roadmap structure not found');
    }
    const structure = this.mapToResponseDto(structureSource);
    structure.topics.forEach(t => {
      t.isCompleted = false;
      t.subtopics.forEach(st => st.isCompleted = false);
    });

    return {
      roadmap: structure,
      membersProgress: managerProgress ? [managerProgress, ...membersProgress] : membersProgress,
    };
  }

  async updateAcceptanceStatus(id: string, userId: string, status: string) {
    const roadmap = await this.roadmapModel.findOne({ _id: id, userId });
    if (!roadmap) throw new NotFoundException(`Roadmap ${id} not found`);

    roadmap.acceptanceStatus = status;
    if (status === 'accepted') {
      roadmap.enabled = true;
    } else if (status === 'denied') {
      roadmap.enabled = false;
    }

    return roadmap.save();
  }
}
