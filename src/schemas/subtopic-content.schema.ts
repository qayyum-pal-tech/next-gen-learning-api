import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SubtopicContentDocument = SubtopicContent & Document;

// Link object for articles and documentation
class Link {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  url: string;

  @Prop()
  description?: string;

  @Prop()
  source?: string; // e.g., "Medium", "Dev.to", "Official Docs"
}

// Interview Question and Answer
class InterviewQA {
  @Prop({ required: true })
  question: string;

  @Prop({ required: true })
  answer: string; // Can be markdown formatted

  @Prop({ type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' })
  difficulty: string;

  @Prop([String])
  tags?: string[]; // e.g., ["hooks", "state management"]
}

// Code snippet
class CodeSnippet {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  code: string;

  @Prop({ required: true })
  language: string; // e.g., "javascript", "python", "typescript"

  @Prop()
  explanation?: string;
}

@Schema({ timestamps: true })
export class SubtopicContent {
  @Prop({ required: true })
  roadmapId: string; // Reference to parent roadmap

  @Prop({ required: true })
  topicOrder: number; // Which topic this belongs to

  @Prop({ required: true })
  subtopicOrder: number; // Which subtopic this is

  @Prop({ required: true })
  subtopicTitle: string; // For easy identification

  // Main content in Markdown format
  @Prop({ required: true, type: String })
  content: string; // Full markdown content with headings, bold, code blocks, etc.

  // Structured code examples (in addition to inline code in content)
  @Prop({ type: [CodeSnippet], default: [] })
  codeExamples: CodeSnippet[];

  // Real-world examples/use cases (markdown)
  @Prop({ type: String })
  realWorldExamples?: string;

  // Top articles and blog posts
  @Prop({ type: [Link], default: [] })
  articleLinks: Link[];

  // Official documentation links
  @Prop({ type: [Link], default: [] })
  documentationLinks: Link[];

  // Interview questions with answers
  @Prop({ type: [InterviewQA], default: [] })
  interviewQuestions: InterviewQA[];

  // Metadata
  @Prop({ type: Object })
  aiGeneratedMetadata?: {
    model: string;
    generatedAt: Date;
    prompt: string;
    responseTime: number;
  };

  @Prop({ default: false })
  isGenerated: boolean; // Whether content has been generated

  @Prop()
  estimatedReadTime?: string; // e.g., "15 mins"
  createdAt: Date;
  updatedAt: Date;
}

export const SubtopicContentSchema =
  SchemaFactory.createForClass(SubtopicContent);

// Indexes for efficient queries
SubtopicContentSchema.index(
  { roadmapId: 1, topicOrder: 1, subtopicOrder: 1 },
  { unique: true },
);
SubtopicContentSchema.index({ roadmapId: 1 });
