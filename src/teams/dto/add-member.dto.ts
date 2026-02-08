import { IsArray, IsMongoId } from 'class-validator';

export class AddMembersDto {
  @IsArray()
  @IsMongoId({ each: true })
  members: string[];
}
