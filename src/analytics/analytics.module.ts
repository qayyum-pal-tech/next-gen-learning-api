import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsService } from "./analytics.service";
import { AnalyticsController } from "./analytics.controller";
import { Quiz, QuizSchema } from '../quiz/quiz.schema';
import { RoadmapFlat, RoadmapFlatSchema } from '../schemas/roadmap-flat.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Quiz.name, schema: QuizSchema },
            { name: RoadmapFlat.name, schema: RoadmapFlatSchema },
        ]),
    ],
    controllers: [AnalyticsController],
    providers: [AnalyticsService],
})
export class AnalyticsModule { }
