import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export enum ShareType {
  TEAM = 'TEAM',
  USERS = 'USERS',
}

export class ShareRoadmapDto {
  @IsString()
  roadmapId: string;

  @IsEnum(ShareType)
  shareType: ShareType;

  // when shareType = USERS
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];

  // when shareType = TEAM
  @IsOptional()
  @IsString()
  teamId?: string;

  // who is sharing
  @IsOptional()
  @IsString()
  sharedBy?: string;

}
