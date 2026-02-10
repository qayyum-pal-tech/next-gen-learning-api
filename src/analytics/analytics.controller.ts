import { Controller, Get, Body, UseGuards, Request, Post } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) { }

    @Post('quiz')
    async getQuizAnalytics(@Body() body: { userId: string }) {
        return {
            success: true,
            data: await this.analyticsService.getQuizAnalytics(body.userId),
        };
    }

    @Post('app')
    async getAppAnalytics(@Body() body: { userId: string }) {
        return {
            success: true,
            data: await this.analyticsService.getAppAnalytics(body.userId),
        };
    }
}
