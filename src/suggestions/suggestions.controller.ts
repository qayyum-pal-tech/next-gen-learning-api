import { Controller, Get, Query } from '@nestjs/common';
import { SuggestionsService } from './suggestions.service';

@Controller('suggestions')
export class SuggestionsController {
    constructor(private readonly suggestionsService: SuggestionsService) { }

    @Get()
    getSuggestions(@Query('query') query: string) {
        return this.suggestionsService.getSkillSuggestionsHandler(query);
    }
}
