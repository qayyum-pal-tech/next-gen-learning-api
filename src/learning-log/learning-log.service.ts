import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LearningLog, LearningLogDocument } from 'src/schemas/learning-log.schema';

@Injectable()
export class LearningLogService {
    constructor(
        @InjectModel(LearningLog.name)
        private learningLogModel: Model<LearningLogDocument>,
    ) { }

    async create(userId: string, roadmapId: string, topicTitle: string, minutesSpent: number, trackedMinutes: number, notes?: string) {
        const log = new this.learningLogModel({
            userId,
            roadmapId,
            topicTitle,
            minutesSpent,
            trackedMinutes,
            notes,
        });
        return log.save();
    }

    async findAll() {
        return this.learningLogModel
            .find()
            .populate('userId', 'username email')
            .sort({ createdAt: -1 })
            .exec();
    }

    async getAggregateStats() {
        const totalMinutes = await this.learningLogModel.aggregate([
            { $group: { _id: null, total: { $sum: '$minutesSpent' } } },
        ]);

        return {
            totalLearningMinutes: totalMinutes[0]?.total || 0,
        };
    }
}