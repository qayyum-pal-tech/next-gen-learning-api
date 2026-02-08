import { Module } from '@nestjs/common';
import { SuggestionsController } from './suggestions.controller';
import { SuggestionsService } from './suggestions.service';
import { AIModule } from '../AI/ai.module';

@Module({
    imports: [AIModule],
    controllers: [SuggestionsController],
    providers: [SuggestionsService],
})
export class SuggestionsModule { }
