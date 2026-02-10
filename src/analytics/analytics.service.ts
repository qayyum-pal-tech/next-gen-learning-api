import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Quiz } from '../quiz/quiz.schema';
import { RoadmapFlat } from '../schemas/roadmap-flat.schema';
import { QuizStatus } from '../quiz/types';

@Injectable()
export class AnalyticsService {
    constructor(
        @InjectModel(Quiz.name) private quizModel: Model<Quiz>,
        @InjectModel(RoadmapFlat.name) private roadmapModel: Model<RoadmapFlat>,
    ) { }

    async getQuizAnalytics(userId: string) {
        try {
            const quizzes = await this.quizModel.find({ userId }).sort({ completedAt: -1 });

            const completedQuizzes = quizzes.filter(q => q.status === QuizStatus.COMPLETED);
            const totalQuizzes = quizzes.length;

            const averageScore = completedQuizzes.length > 0
                ? completedQuizzes.reduce((acc, q) => acc + (q.finalScore || 0), 0) / completedQuizzes.length
                : 0;

            const highestScore = completedQuizzes.length > 0
                ? Math.max(...completedQuizzes.map(q => q.finalScore || 0))
                : 0;

            const quizHistory = quizzes.map(q => ({
                id: q._id.toString(),
                date: q.completedAt ? new Date(q.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : new Date(q.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                category: q.categoryTitle,
                questionsCount: q.questions.length,
                score: q.finalScore || 0,
                status: q.status.toLowerCase(),
            }));

            return {
                totalQuizzes,
                averageScore: Math.round(averageScore * 10) / 10,
                highestScore,
                quizHistory: quizHistory.slice(0, 10), // Return recent 10
            };
        } catch (error) {
            console.error('Quiz analytics error:', error);
            throw new InternalServerErrorException('Failed to fetch quiz analytics');
        }
    }

    async getAppAnalytics(userId: string) {
        try {
            const roadmaps = await this.roadmapModel.find({ userId });

            const completedRoadmaps = roadmaps.filter(r => r.status === 'completed');
            const inProgressRoadmaps = roadmaps.filter(r => r.status === 'in_progress');

            // Calculate total learning hours (parsing "X hours" string)
            let totalHours = 0;
            roadmaps.forEach(r => {
                if (r.totalEstimatedDuration) {
                    const match = r.totalEstimatedDuration.match(/(\d+)/);
                    if (match) {
                        totalHours += parseInt(match[1], 10);
                    }
                }
            });

            // Domain breakdown (Group by subject)
            const domainMap = new Map<string, number>();
            roadmaps.forEach(r => {
                const domain = r.subject || 'Other'; // Using subject as domain for now
                domainMap.set(domain, (domainMap.get(domain) || 0) + 1);
            });

            const domains = Array.from(domainMap.entries()).map(([name, count]) => ({
                name,
                count,
                description: 'Learning Path', // Placeholder description
            }));

            // Recent Activity
            const recentActivity = roadmaps
                .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                .slice(0, 3)
                .map(r => ({
                    id: r._id.toString(),
                    pathTitle: r.subject,
                    progress: r.progressPercentage,
                    lastActivity: this.timeSince(new Date(r.updatedAt)),
                    estimatedCompletion: r.totalEstimatedDuration || 'Unknown', // Placeholder logic 
                    quizTrend: [50, 60, 70, 80], // TODO: Fetch actual quiz trend for this path if available needed
                    difficulty: r.difficultyLevel || 'Intermediate',
                }));

            // Skill Insights
            // Deriving simple insights from quiz performance by category
            const quizzes = await this.quizModel.find({ userId, status: QuizStatus.COMPLETED });
            const skillMap = new Map<string, { totalScore: number; count: number }>();

            quizzes.forEach(q => {
                const cat = q.categoryTitle;
                const current = skillMap.get(cat) || { totalScore: 0, count: 0 };
                current.totalScore += (q.finalScore || 0); // Assuming score is out of 100 max
                current.count += 1;
                skillMap.set(cat, current);
            });

            const skillInsights = Array.from(skillMap.entries()).map(([skill, stats]) => ({
                skill,
                level: Math.round(stats.totalScore / stats.count), // Avg score as level
                progress: 10, // Placeholder
                projects: stats.count, // Using quiz count as proxy for projects/engagement
            })).slice(0, 4);

            return {
                pathsCompleted: completedRoadmaps.length,
                totalLearningHours: totalHours,
                pathsInProgress: inProgressRoadmaps.length,
                domains,
                recentActivity,
                skillInsights,
            };
        } catch (error) {
            console.error('App analytics error:', error);
            throw new InternalServerErrorException('Failed to fetch app analytics');
        }
    }

    private timeSince(date: Date) {
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " years ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutes ago";
        return Math.floor(seconds) + " seconds ago";
    }
}
