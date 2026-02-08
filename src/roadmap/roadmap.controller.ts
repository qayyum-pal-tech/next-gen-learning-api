import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  Query,
  ValidationPipe,
  UsePipes,
  Logger,
} from '@nestjs/common';
import { RoadmapService } from './roadmap.service';
import { CreateRoadmapDto } from './dto/create-roadmap.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { RoadmapResponseDto } from './dto/roadmap-response.dto';

@Controller('roadmaps')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class RoadmapController {
  private readonly logger = new Logger(RoadmapController.name);

  constructor(private readonly roadmapService: RoadmapService) {}

  /**
   * Create a new roadmap
   * POST /roadmaps
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createRoadmapDto: CreateRoadmapDto,
  ): Promise<RoadmapResponseDto> {
    this.logger.log(
      `POST /roadmaps - Creating roadmap for subject: ${createRoadmapDto.subject}`,
    );
    return this.roadmapService.create(createRoadmapDto);
  }

  /**
   * Get all roadmaps for a user
   * GET /roadmaps?userId=xxx
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query('userId') userId: string,
  ): Promise<RoadmapResponseDto[]> {
    this.logger.log(`GET /roadmaps - Fetching roadmaps for user: ${userId}`);

    if (!userId) {
      throw new Error('userId query parameter is required');
    }

    return this.roadmapService.findAllByUser(userId);
  }

  /**
   * Get a specific roadmap by ID
   * GET /roadmaps/:id?userId=xxx
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param('id') id: string,
    @Query('userId') userId: string,
  ): Promise<RoadmapResponseDto> {
    this.logger.log(
      `GET /roadmaps/${id} - Fetching roadmap for user: ${userId}`,
    );

    if (!userId) {
      throw new Error('userId query parameter is required');
    }

    return this.roadmapService.findOne(id, userId);
  }

  /**
   * Update topic completion status
   * PATCH /roadmaps/:id/topics/:topicOrder
   */
  @Patch(':id/topics/:topicOrder')
  @HttpCode(HttpStatus.OK)
  async updateTopicProgress(
    @Param('id') id: string,
    @Param('topicOrder') topicOrder: string,
    @Query('userId') userId: string,
    @Body() updateProgressDto: UpdateProgressDto,
  ): Promise<RoadmapResponseDto> {
    this.logger.log(
      `PATCH /roadmaps/${id}/topics/${topicOrder} - Updating topic progress`,
    );

    if (!userId) {
      throw new Error('userId query parameter is required');
    }

    if (updateProgressDto.topicCompleted === undefined) {
      throw new Error('topicCompleted field is required in request body');
    }

    return this.roadmapService.updateTopicProgress(
      id,
      userId,
      parseInt(topicOrder, 10),
      updateProgressDto.topicCompleted,
    );
  }

  /**
   * Update subtopic completion status
   * PATCH /roadmaps/:id/topics/:topicOrder/subtopics/:subtopicOrder
   */
  @Patch(':id/topics/:topicOrder/subtopics/:subtopicOrder')
  @HttpCode(HttpStatus.OK)
  async updateSubtopicProgress(
    @Param('id') id: string,
    @Param('topicOrder') topicOrder: string,
    @Param('subtopicOrder') subtopicOrder: string,
    @Query('userId') userId: string,
    @Body() updateProgressDto: UpdateProgressDto,
  ): Promise<RoadmapResponseDto> {
    this.logger.log(
      `PATCH /roadmaps/${id}/topics/${topicOrder}/subtopics/${subtopicOrder} - Updating subtopic progress`,
    );

    if (!userId) {
      throw new Error('userId query parameter is required');
    }

    if (updateProgressDto.subtopicCompleted === undefined) {
      throw new Error('subtopicCompleted field is required in request body');
    }

    return this.roadmapService.updateSubtopicProgress(
      id,
      userId,
      parseInt(topicOrder, 10),
      parseInt(subtopicOrder, 10),
      updateProgressDto.subtopicCompleted,
      updateProgressDto.notes,
    );
  }

  /**
   * Delete a roadmap
   * DELETE /roadmaps/:id?userId=xxx
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @Query('userId') userId: string,
  ): Promise<void> {
    this.logger.log(`DELETE /roadmaps/${id} - Deleting roadmap`);

    if (!userId) {
      throw new Error('userId query parameter is required');
    }

    return this.roadmapService.remove(id, userId);
  }
}
