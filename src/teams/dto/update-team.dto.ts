import { IsOptional, IsString } from 'class-validator';

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  teamName?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
