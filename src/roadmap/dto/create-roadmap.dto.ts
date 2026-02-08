import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class CreateRoadmapDto {
  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsOptional()
  @IsEnum(['beginner', 'intermediate', 'advanced'])
  difficultyLevel?: string;

  @IsString()
  @IsOptional()
  additionalContext?: string;
}
