import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import {
  SubtopicContent,
  SubtopicContentSchema,
} from '../schemas/subtopic-content.schema';
import { RoadmapFlat, RoadmapFlatSchema } from '../schemas/roadmap-flat.schema';
import { AIModule } from 'src/ai/ai.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SubtopicContent.name, schema: SubtopicContentSchema },
      { name: RoadmapFlat.name, schema: RoadmapFlatSchema },
    ]),
    AIModule,
  ],
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule { }
