import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { QuizController } from './quiz.controller';
import { QuizService } from './quiz.service';

import { Quiz, QuizSchema } from "./quiz.schema";
import { AIModule } from "../AI/ai.module";

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Quiz.name, schema: QuizSchema },
        ]),
        AIModule,
    ],
    controllers: [QuizController],
    providers: [QuizService],
})
export class QuizModule { }