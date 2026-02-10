import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { QuizController } from './quiz.controller';
import { QuizService } from './quiz.service';

import { Quiz, QuizSchema } from "./quiz.schema";
import { AIModule } from "../ai/ai.module";
import { RoadmapFlat, RoadmapFlatSchema } from '../schemas/roadmap-flat.schema';
import { SubtopicContent, SubtopicContentSchema } from '../schemas/subtopic-content.schema';
import { RoadmapModule } from 'src/roadmap/roadmap.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Quiz.name, schema: QuizSchema },
            { name: RoadmapFlat.name, schema: RoadmapFlatSchema },
            { name: SubtopicContent.name, schema: SubtopicContentSchema },
        ]),
        AIModule,
        RoadmapModule
    ],
    controllers: [QuizController],
    providers: [QuizService],
})
export class QuizModule { }