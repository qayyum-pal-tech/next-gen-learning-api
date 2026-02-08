import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import {
  SubtopicContent,
  SubtopicContentSchema,
} from '../schemas/subtopic-content.schema';
import { AIModule } from 'src/ai/ai.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SubtopicContent.name, schema: SubtopicContentSchema },
    ]),
    AIModule,
  ],
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
