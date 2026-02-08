import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { RoadmapFlat, RoadmapFlatDocument } from '../schemas/roadmap-flat.schema';
import { LearningLog, LearningLogDocument } from '../schemas/learning-log.schema';

@Injectable()
export class AdminService {
    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @InjectModel(RoadmapFlat.name) private roadmapModel: Model<RoadmapFlatDocument>,
        @InjectModel(LearningLog.name) private learningLogModel: Model<LearningLogDocument>,
    ) { }

    async getStats() {
        const [userCount, roadmapCount, logs] = await Promise.all([
            this.userModel.countDocuments(),
            this.roadmapModel.countDocuments({ originalRoadmapId: { $exists: false } }), // Only unique user roadmaps
            this.learningLogModel.find().lean(),
        ]);

        const totalMinutes = logs.reduce((acc, log) => acc + log.minutesSpent, 0);

        // Aggregate progress
        const roadmaps = await this.roadmapModel.find({}, { progressPercentage: 1 }).lean();
        const avgProgress = roadmaps.length > 0
            ? roadmaps.reduce((acc, r) => acc + (r.progressPercentage || 0), 0) / roadmaps.length
            : 0;

        return {
            userCount,
            roadmapCount,
            totalLearningMinutes: totalMinutes,
            averageProgress: Math.round(avgProgress),
        };
    }

    async getLogs() {
        return this.learningLogModel
            .find()
            .populate('userId', 'username email')
            .sort({ createdAt: -1 })
            .exec();
    }
}
