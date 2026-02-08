import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export default class GenerateContentDto {
  @IsString()
  @IsOptional()
  id: string;
  @IsString()
  @IsNotEmpty()
  roadmapId: string;

  @IsNumber()
  @IsNotEmpty()
  topicOrder: number;

  @IsNumber()
  @IsNotEmpty()
  subtopicOrder: number;

  @IsString()
  @IsNotEmpty()
  subtopicTitle: string;

  @IsString()
  @IsOptional()
  topicContext?: string; // The parent topic title for better context

  @IsString()
  @IsOptional()
  difficultyLevel?: string; // beginner, intermediate, advanced

  createdAt: Date;
  updatedAt: Date;
}
