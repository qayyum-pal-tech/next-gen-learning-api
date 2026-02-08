import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UsePipes,
  Logger,
  ParseIntPipe,
} from '@nestjs/common';
import { ContentService } from './content.service';
import { GenerateContentDto } from './dto/generate-content.dto';
import SubtopicContentResponseDto from './dto/content-response.dto';

@Controller('content')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class ContentController {
  private readonly logger = new Logger(ContentController.name);

  constructor(private readonly contentService: ContentService) { }

  /**
   * Generate content for a subtopic
   * POST /content/generate
  //  */
  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  async generateContent(
    @Body() generateContentDto: GenerateContentDto,
  ): Promise<SubtopicContentResponseDto> {
    this.logger.log(
      `POST /content/generate - Generating content for ${generateContentDto.subtopicTitle}`,
    );
    return this.contentService.generateContent(generateContentDto);
  }

  /**
   * Get content for a specific subtopic
   * GET /content/:roadmapId/:topicOrder/:subtopicOrder
   */
  @Get(':roadmapId/:topicOrder/:subtopicOrder')
  @HttpCode(HttpStatus.OK)
  async getContent(
    @Param('roadmapId') roadmapId: string,
    @Param('topicOrder', ParseIntPipe) topicOrder: number,
    @Param('subtopicOrder', ParseIntPipe) subtopicOrder: number,
  ): Promise<SubtopicContentResponseDto> {
    this.logger.log(
      `GET /content/${roadmapId}/${topicOrder}/${subtopicOrder} - Fetching content`,
    );
    return this.contentService.getContent(roadmapId, topicOrder, subtopicOrder);
  }

  /**
   * Get all content for a roadmap
   * GET /content/roadmap/:roadmapId
   */
  @Get('roadmap/:roadmapId')
  @HttpCode(HttpStatus.OK)
  async getAllContentForRoadmap(
    @Param('roadmapId') roadmapId: string,
  ): Promise<SubtopicContentResponseDto[]> {
    this.logger.log(`GET /content/roadmap/${roadmapId} - Fetching all content`);
    return this.contentService.getAllContentForRoadmap(roadmapId);
  }

  /**
   * Get all content for a specific topic
   * GET /content/roadmap/:roadmapId/topic/:topicOrder
   */
  @Get('roadmap/:roadmapId/topic/:topicOrder')
  @HttpCode(HttpStatus.OK)
  async getAllContentForTopic(
    @Param('roadmapId') roadmapId: string,
    @Param('topicOrder', ParseIntPipe) topicOrder: number,
  ): Promise<SubtopicContentResponseDto[]> {
    this.logger.log(
      `GET /content/roadmap/${roadmapId}/topic/${topicOrder} - Fetching topic content`,
    );
    return this.contentService.getAllContentForTopic(roadmapId, topicOrder);
  }

  /**
   * Regenerate content for a subtopic
   * POST /content/regenerate/:roadmapId/:topicOrder/:subtopicOrder
   */
  @Post('regenerate/:roadmapId/:topicOrder/:subtopicOrder')
  @HttpCode(HttpStatus.OK)
  async regenerateContent(
    @Param('roadmapId') roadmapId: string,
    @Param('topicOrder', ParseIntPipe) topicOrder: number,
    @Param('subtopicOrder', ParseIntPipe) subtopicOrder: number,
    @Body()
    body: {
      subtopicTitle: string;
      topicContext?: string;
      difficultyLevel?: string;
      additionalInstructions?: string;
    },
  ): Promise<SubtopicContentResponseDto> {
    this.logger.log(
      `POST /content/regenerate/${roadmapId}/${topicOrder}/${subtopicOrder} - Regenerating content`,
    );
    return this.contentService.regenerateContent(
      roadmapId,
      topicOrder,
      subtopicOrder,
      body.subtopicTitle,
      body.topicContext,
      body.difficultyLevel,
      body.additionalInstructions,
    );
  }

  /**
   * Delete content for a subtopic
   * DELETE /content/:roadmapId/:topicOrder/:subtopicOrder
   */
  @Delete(':roadmapId/:topicOrder/:subtopicOrder')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteContent(
    @Param('roadmapId') roadmapId: string,
    @Param('topicOrder', ParseIntPipe) topicOrder: number,
    @Param('subtopicOrder', ParseIntPipe) subtopicOrder: number,
  ): Promise<void> {
    this.logger.log(
      `DELETE /content/${roadmapId}/${topicOrder}/${subtopicOrder} - Deleting content`,
    );
    return this.contentService.deleteContent(
      roadmapId,
      topicOrder,
      subtopicOrder,
    );
  }

  /**
   * Delete all content for a roadmap
   * DELETE /content/roadmap/:roadmapId
   */
  @Delete('roadmap/:roadmapId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAllContentForRoadmap(
    @Param('roadmapId') roadmapId: string,
  ): Promise<void> {
    this.logger.log(
      `DELETE /content/roadmap/${roadmapId} - Deleting all content`,
    );
    return this.contentService.deleteAllContentForRoadmap(roadmapId);
  }

  /**
   * Check if content exists for a subtopic
   * GET /content/exists/:roadmapId/:topicOrder/:subtopicOrder
   */
  @Get('exists/:roadmapId/:topicOrder/:subtopicOrder')
  @HttpCode(HttpStatus.OK)
  async contentExists(
    @Param('roadmapId') roadmapId: string,
    @Param('topicOrder', ParseIntPipe) topicOrder: number,
    @Param('subtopicOrder', ParseIntPipe) subtopicOrder: number,
  ): Promise<{ exists: boolean }> {
    this.logger.log(
      `GET /content/exists/${roadmapId}/${topicOrder}/${subtopicOrder} - Checking existence`,
    );
    const exists = await this.contentService.contentExists(
      roadmapId,
      topicOrder,
      subtopicOrder,
    );
    return { exists };
  }
}
