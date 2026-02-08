import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateProgressDto {
  @IsOptional()
  @IsBoolean()
  topicCompleted?: boolean;

  @IsOptional()
  @IsBoolean()
  subtopicCompleted?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
