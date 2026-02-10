import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { AIService } from "../ai/ai.service";

@Injectable()
export class SuggestionsService {
    constructor(private aiService: AIService) { }

    async getSkillSuggestionsHandler(query: string) {
        if (!query || query.trim().length < 2) {
            throw new BadRequestException('Query must be at least 2 characters long');
        }

        try {
            const suggestions = await this.aiService.generateSkillSuggestions(query.trim());
            return {
                success: true,
                suggestions,
            };
        } catch (error) {
            console.error('Suggestions error:', error);
            throw new InternalServerErrorException('Failed to generate suggestions');
        }
    }
}
