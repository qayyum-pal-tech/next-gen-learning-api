import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { AddMembersDto } from './dto/add-member.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('teams')
@UseGuards(JwtAuthGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  create(@Req() req, @Body() dto: CreateTeamDto) {
    return this.teamsService.createTeam(req.user.userId, dto);
  }

  @Get('created')
  getCreated(@Req() req) {
    return this.teamsService.getCreatedTeams(req.user.userId);
  }

  @Get('joined')
  getJoined(@Req() req) {
    return this.teamsService.getJoinedTeams(req.user.userId);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @Req() req) {
    return this.teamsService.getTeamById(id, req.user.userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Req() req, @Body() dto: UpdateTeamDto) {
    return this.teamsService.updateTeam(id, req.user.userId, dto);
  }

  @Post(':id/members')
  addMembers(@Param('id') id: string, @Req() req, @Body() dto: AddMembersDto) {
    return this.teamsService.addMembers(id, req.user.userId, dto);
  }

  @Delete(':id/members/:memberId')
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Req() req,
  ) {
    return this.teamsService.removeMember(id, req.user.userId, memberId);
  }

  @Post(':id/exit')
  exit(@Param('id') id: string, @Req() req) {
    return this.teamsService.exitTeam(id, req.user.userId);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Req() req) {
    return this.teamsService.deleteTeam(id, req.user.userId);
  }

  // teams.controller.ts

  @Get(':id/available-users')
  getAvailableUsers(
    @Param('id') teamId: string,
    @Query('search') search: string,
    @Req() req,
  ) {
    return this.teamsService.getAvailableUsers(teamId, req.user.userId, search);
  }
}
