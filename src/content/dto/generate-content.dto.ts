import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class GenerateContentDto {
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

  @IsString()
  @IsOptional()
  additionalInstructions?: string; // User suggestions for regeneration

}
