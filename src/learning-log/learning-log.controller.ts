import { Controller, Post, Body, UseGuards, Req, Get } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LearningLogService } from './learning-log.service';

@Controller('learning-logs')
export class LearningLogController {
    constructor(private readonly learningLogService: LearningLogService) { }

    @Post()
    @UseGuards(JwtAuthGuard)
    async create(@Req() req: any, @Body() body: any) {
        const { roadmapId, topicTitle, minutesSpent, trackedMinutes, notes } = body;
        const userId = req.user.userId;
        return this.learningLogService.create(userId, roadmapId, topicTitle, minutesSpent, trackedMinutes, notes);
    }

    @Get('my-logs')
    @UseGuards(JwtAuthGuard)
    async getMyLogs(@Req() req: any) {
        // Optional: filter by user if needed
    }
}