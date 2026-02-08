import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LearningLog, LearningLogSchema } from '../schemas/learning-log.schema';
import { LearningLogService } from './learning-log.service';
import { LearningLogController } from './learning-log.controller';

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
