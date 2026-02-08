import {
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateTeamDto {
  @IsString()
  @IsNotEmpty()
  teamName: string;

  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  members?: string[];

  @IsOptional()
  @IsString()
  description?: string;
}
