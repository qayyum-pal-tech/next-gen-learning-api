import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RoadmapFlatDocument = RoadmapFlat & Document;

class EmbeddedSubtopic {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  order: number;

  @Prop()
  description?: string;

  @Prop({ default: false })
  isCompleted: boolean;

  @Prop()
  estimatedDuration?: string;

  @Prop([String])
  resources?: string[];

  @Prop()
  notes?: string;
}

class EmbeddedTopic {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  order: number;

  @Prop()
  description?: string;

  @Prop({ type: [EmbeddedSubtopic], default: [] })
  subtopics: EmbeddedSubtopic[];

  @Prop({ default: false })
  isCompleted: boolean;

  @Prop()
  estimatedDuration?: string;
}

@Schema({ timestamps: true })
export class RoadmapFlat {
  @Prop({ required: true })
  subject: string;

  @Prop({ required: true })
  userId: string;

  @Prop()
  description?: string;

  @Prop({ type: [EmbeddedTopic], default: [] })
  topics: EmbeddedTopic[];

  @Prop({
    type: String,
    enum: ['not_started', 'in_progress', 'completed'],
    default: 'not_started',
  })
  status: string;

  @Prop()
  difficultyLevel?: string;

  @Prop()
  totalEstimatedDuration?: string;

  @Prop({ default: 0 })
  progressPercentage: number;

  @Prop({ type: Object })
  aiGeneratedMetadata?: {
    model: string;
    generatedAt: Date;
    prompt: string;
    responseTime?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export const RoadmapFlatSchema = SchemaFactory.createForClass(RoadmapFlat);

RoadmapFlatSchema.index({ userId: 1, subject: 1 });
RoadmapFlatSchema.index({ createdAt: -1 });
RoadmapFlatSchema.index({ status: 1 });
