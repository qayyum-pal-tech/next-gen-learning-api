import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AssessmentType, QuizStatus, QuestionType } from './types';

class QuizQuestion {
  @Prop({ required: true })
  questionText: string;

  @Prop({ required: true })
  questionType: QuestionType;

  @Prop([String])
  options?: string[];

  @Prop()
  userAnswer?: string;

  @Prop()
  correctAnswer?: string;

  @Prop()
  explanation?: string;

  @Prop({ default: 0 })
  score: number;

  @Prop()
  subtopicTitle?: string;
}

const InsightsSchema = {
  strengths: [String],
  weaknesses: [String],
  areasToImprove: [String],
};

@Schema({ collection: "quizzes", timestamps: true })
export class Quiz {
  @Prop({ type: String, required: true })
  userId: string;

  @Prop({ type: String, enum: AssessmentType, required: true })
  assessmentType: AssessmentType;

  @Prop({ type: String, required: true })
  pathId: string;

  @Prop({ type: String })
  stepId?: string;

  @Prop({ type: String, required: true })
  categoryId: string;

  @Prop({ type: String, required: true })
  categoryTitle: string;

  @Prop({ type: String })
  subtopicTitle?: string;

  @Prop({ type: String, enum: QuizStatus, default: QuizStatus.IN_PROGRESS })
  status: QuizStatus;

  @Prop({ type: Date, default: Date.now })
  startedAt: Date;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop([QuizQuestion])
  questions: QuizQuestion[];

  @Prop({ type: Number })
  finalScore?: number;

  @Prop({ type: String })
  finalFeedback?: string;

  // ✅ Fixed: Explicit schema definition
  @Prop({ type: InsightsSchema })
  insights?: {
    strengths: string[];
    weaknesses: string[];
    areasToImprove: string[];
  };
}

export const QuizSchema = SchemaFactory.createForClass(Quiz);