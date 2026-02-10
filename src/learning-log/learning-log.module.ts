import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LearningLogService } from './learning-log.service';
import { LearningLogController } from './learning-log.controller';
import { LearningLog, LearningLogSchema } from 'src/schemas/learning-log.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: LearningLog.name, schema: LearningLogSchema },
        ]),
    ],
    controllers: [LearningLogController],
    providers: [LearningLogService],
    exports: [LearningLogService],
})
export class LearningLogModule { }