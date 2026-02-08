import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Team, TeamDocument } from './schemas/team.schema';
import { CreateTeamDto } from './dto/create-team.dto';
import { AddMembersDto } from './dto/add-member.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class TeamsService {
  constructor(
    @InjectModel(Team.name)
    private readonly teamModel: Model<TeamDocument>,

    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  /* ---------------- CREATE ---------------- */
  async createTeam(userId: string, dto: CreateTeamDto) {
    const creatorId = new Types.ObjectId(userId);

    const members = new Set(dto.members || []);
    members.add(userId);

    return this.teamModel.create({
      teamName: dto.teamName,
      description: dto.description,
      createdBy: creatorId,
      members: Array.from(members).map((id) => new Types.ObjectId(id)),
    });
  }

  /* ---------------- READ ---------------- */

  // Teams created by user
  async getCreatedTeams(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    return this.teamModel
      .find({ createdBy: userObjectId })
      .populate('members', 'username email');
  }

  // Teams where user is a member but not creator
  async getJoinedTeams(userId: string) {
    const teamObjectId = new Types.ObjectId(userId);
    return this.teamModel
      .find({
        members: teamObjectId,
        createdBy: { $ne: teamObjectId },
      })
      .populate('members', 'username email');
  }

  // Team details (member only)
  async getTeamById(teamId: string, userId: string) {
    const teamObjectId = new Types.ObjectId(teamId);
    const team = await this.teamModel
      .findById(teamObjectId)
      .populate('members', 'username email');

    if (!team) throw new NotFoundException('Team not found');

    const isMember = team.members.some((m: any) => m._id.toString() === userId);

    // if (!isMember) throw new ForbiddenException();

    return team;
  }

  /* ---------------- UPDATE ---------------- */

  async updateTeam(teamId: string, userId: string, dto: UpdateTeamDto) {
    const team = await this.teamModel.findById(teamId);
    if (!team) throw new NotFoundException();

    if (team.createdBy.toString() !== userId) {
      throw new ForbiddenException('Only creator can edit team');
    }

    Object.assign(team, dto);
    return team.save();
  }

  /* ---------------- MEMBERS ---------------- */

  async addMembers(teamId: string, userId: string, dto: AddMembersDto) {
    const team = await this.teamModel.findById(teamId);
    if (!team) throw new NotFoundException();

    if (team.createdBy.toString() !== userId) {
      throw new ForbiddenException();
    }

    const memberSet = new Set(team.members.map((m) => m.toString()));
    dto.members.forEach((id) => memberSet.add(id));

    team.members = Array.from(memberSet).map((id) => new Types.ObjectId(id));

    return team.save();
  }

  async removeMember(teamId: string, userId: string, memberId: string) {
    const team = await this.teamModel.findById(teamId);
    if (!team) throw new NotFoundException();

    if (team.createdBy.toString() !== userId) {
      throw new ForbiddenException();
    }

    team.members = team.members.filter((m) => m.toString() !== memberId);

    return team.save();
  }

  // Member exits team (not creator)
  async exitTeam(teamId: string, userId: string) {
    const team = await this.teamModel.findById(teamId);
    if (!team) throw new NotFoundException();

    if (team.createdBy.toString() === userId) {
      throw new ForbiddenException('Creator cannot exit team');
    }

    team.members = team.members.filter((m) => m.toString() !== userId);

    return team.save();
  }

  /* ---------------- DELETE ---------------- */

  async deleteTeam(teamId: string, userId: string) {
    const team = await this.teamModel.findById(teamId);
    if (!team) throw new NotFoundException();

    if (team.createdBy.toString() !== userId) {
      throw new ForbiddenException();
    }

    await team.deleteOne();
    return { message: 'Team deleted successfully' };
  }

  async getAvailableUsers(teamId: string, userId: string, search?: string) {
    const teamObjectId = new Types.ObjectId(teamId);
    // const userObjectId = new Types.ObjectId(userId);

    const team = await this.teamModel.findById(teamObjectId);
    if (!team) throw new NotFoundException('Team not found');

    // Only creator can add members (optional but recommended)
    // if (team.createdBy !== userObjectId) {
    //   throw new ForbiddenException();
    // }

    // Exclude users already in team
    const excludedUserIds = team.members.map((id) => new Types.ObjectId(id));

    const query: any = {
      _id: { $nin: excludedUserIds },
    };

    // Search by username or email
    if (search && search.trim()) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    return this.userModel.find(query).select('_id username email').limit(5);
  }
}
