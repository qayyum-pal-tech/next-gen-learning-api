import {
  IsString,
  IsNumber,
  IsArray,
  IsBoolean,
  IsOptional,
  IsEnum,
} from 'class-validator';

export class SubtopicDto {
  @IsString()
  title: string;

  @IsNumber()
  order: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  isCompleted: boolean;

  @IsString()
  @IsOptional()
  estimatedDuration?: string;

  @IsArray()
  @IsOptional()
  resources?: string[];

  @IsString()
  @IsOptional()
  notes?: string;
}

export class TopicDto {
  @IsString()
  title: string;

  @IsNumber()
  order: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  subtopics: SubtopicDto[];

  @IsBoolean()
  isCompleted: boolean;

  @IsString()
  @IsOptional()
  estimatedDuration?: string;
}

export class RoadmapResponseDto {
  @IsString()
  id: string;

  @IsString()
  subject: string;

  @IsString()
  userId: string;

  @IsString()
  @IsOptional()
  version?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  topics: TopicDto[];

  @IsEnum(['not_started', 'in_progress', 'completed'])
  status: string;

  @IsString()
  @IsOptional()
  difficultyLevel?: string;

  @IsString()
  @IsOptional()
  totalEstimatedDuration?: string;

  @IsNumber()
  progressPercentage: number;

  @IsEnum(['pending', 'accepted', 'denied'])
  @IsOptional()
  acceptanceStatus?: string;

  @IsString()
  @IsOptional()
  sharedBy?: string;

  @IsString()
  @IsOptional()
  teamId?: string;

  @IsOptional()
  aiGeneratedMetadata?: {
    model: string;
    generatedAt: Date;
    prompt: string;
    responseTime?: number;
  };

  createdAt: Date;
  updatedAt: Date;
}
