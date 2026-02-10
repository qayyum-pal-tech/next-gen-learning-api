import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LearningLogDocument = LearningLog & Document;

@Schema({ timestamps: true })
export class LearningLog {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    userId: Types.ObjectId;

    @Prop({ required: true })
    roadmapId: string;

    @Prop({ required: true })
    topicTitle: string;

    @Prop({ required: true })
    minutesSpent: number;

    @Prop({ required: true, default: 0 })
    trackedMinutes: number;

    @Prop()
    notes?: string;

    @Prop({ default: Date.now })
    timestamp: Date;
}

export const LearningLogSchema = SchemaFactory.createForClass(LearningLog);

LearningLogSchema.index({ userId: 1 });
LearningLogSchema.index({ timestamp: -1 });