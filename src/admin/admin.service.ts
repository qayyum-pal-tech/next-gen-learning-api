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
        const now = new Date();
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        // Fetch all data for organization oversight
        const [userCount, roadmapCount, logs] = await Promise.all([
            this.userModel.countDocuments(),
            this.roadmapModel.countDocuments({ originalRoadmapId: { $exists: false } }),
            this.learningLogModel.find().lean(),
        ]);

        const totalMinutes = logs.reduce((acc, log) => acc + (log.minutesSpent || 0), 0);

        // Aggregate activity for chart in JS for better compatibility and consistency
        const activityMap = new Map();
        logs.forEach(log => {
            const dateVal = log.timestamp || (log as any).createdAt;
            if (dateVal) {
                const logDate = new Date(dateVal);
                // Compare using UTC date strings to avoid timezone shifts at midnight
                const dateStr = logDate.toISOString().split('T')[0];
                activityMap.set(dateStr, (activityMap.get(dateStr) || 0) + (log.minutesSpent || 0));
            }
        });

        // Create the 7-day window in UTC
        const activityStats = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(now);
            date.setUTCDate(now.getUTCDate() - (6 - i));
            const dateStr = date.toISOString().split('T')[0];

            activityStats.push({
                date: dateStr,
                label: date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
                minutes: activityMap.get(dateStr) || 0,
            });
        }

        // Aggregate overall progress
        const roadmaps = await this.roadmapModel.find({}, { progressPercentage: 1 }).lean();
        const avgProgress = roadmaps.length > 0
            ? roadmaps.reduce((acc, r) => acc + (r.progressPercentage || 0), 0) / roadmaps.length
            : 0;

        return {
            userCount,
            roadmapCount,
            totalLearningMinutes: totalMinutes,
            totalTrackedMinutes: logs.reduce((acc, log) => acc + (log.trackedMinutes || 0), 0),
            averageProgress: Math.round(avgProgress),
            activityStats,
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