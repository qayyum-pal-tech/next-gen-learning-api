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
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import { RoadmapService } from './roadmap.service';
import { CreateRoadmapDto } from './dto/create-roadmap.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { RoadmapResponseDto } from './dto/roadmap-response.dto';
import { ShareRoadmapDto } from './dto/share-roadmap.dto';

@Controller('roadmaps')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class RoadmapController {
  private readonly logger = new Logger(RoadmapController.name);

  constructor(private readonly roadmapService: RoadmapService) { }

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
      throw new BadRequestException('userId query parameter is required');
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
      throw new BadRequestException('userId query parameter is required');
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
    @Param('topicOrder', ParseIntPipe) topicOrder: number,
    @Query('userId') userId: string,
    @Body() updateProgressDto: UpdateProgressDto,
  ): Promise<RoadmapResponseDto> {
    this.logger.log(
      `PATCH /roadmaps/${id}/topics/${topicOrder} - Updating topic progress`,
    );

    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    if (updateProgressDto.topicCompleted === undefined) {
      throw new BadRequestException('topicCompleted field is required in request body');
    }

    return this.roadmapService.updateTopicProgress(
      id,
      userId,
      topicOrder,
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
    @Param('topicOrder', ParseIntPipe) topicOrder: number,
    @Param('subtopicOrder', ParseIntPipe) subtopicOrder: number,
    @Query('userId') userId: string,
    @Body() updateProgressDto: UpdateProgressDto,
  ): Promise<RoadmapResponseDto> {
    this.logger.log(
      `PATCH /roadmaps/${id}/topics/${topicOrder}/subtopics/${subtopicOrder} - Updating subtopic progress`,
    );

    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    if (updateProgressDto.subtopicCompleted === undefined) {
      throw new BadRequestException('subtopicCompleted field is required in request body');
    }

    return this.roadmapService.updateSubtopicProgress(
      id,
      userId,
      topicOrder,
      subtopicOrder,
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
      throw new BadRequestException('userId query parameter is required');
    }

    return this.roadmapService.remove(id, userId);
  }

  @Post('share')
  @HttpCode(HttpStatus.CREATED)
  async shareRoadmap(
    @Body() dto: ShareRoadmapDto,
  ): Promise<{ createdCount: number }> {
    this.logger.log(
      `POST /roadmaps/share - roadmap=${dto.roadmapId}, type=${dto.shareType}`,
    );

    return this.roadmapService.shareRoadmap(dto);
  }

  @Get('team/:teamId')
  @HttpCode(HttpStatus.OK)
  async getTeamRoadmaps(@Param('teamId') teamId: string) {
    this.logger.log(`GET /roadmaps/team/${teamId} - Fetching team roadmaps`);
    return this.roadmapService.getTeamSharedRoadmaps(teamId);
  }

  @Get('team/:teamId/roadmap/:roadmapId/progress')
  @HttpCode(HttpStatus.OK)
  async getTeamRoadmapProgress(
    @Param('teamId') teamId: string,
    @Param('roadmapId') roadmapId: string,
  ) {
    this.logger.log(
      `GET /roadmaps/team/${teamId}/roadmap/${roadmapId}/progress - Fetching progress`,
    );
    return this.roadmapService.getTeamRoadmapProgress(teamId, roadmapId);
  }

  @Patch(':id/acceptance')
  @HttpCode(HttpStatus.OK)
  async updateAcceptanceStatus(
    @Param('id') id: string,
    @Query('userId') userId: string,
    @Body('status') status: string,
  ) {
    this.logger.log(`PATCH /roadmaps/${id}/acceptance - status=${status}`);
    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }
    return this.roadmapService.updateAcceptanceStatus(id, userId, status);
  }
}
