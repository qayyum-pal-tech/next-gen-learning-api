import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RoadmapService } from './roadmap.service';
import { RoadmapController } from './roadmap.controller';
import { RoadmapFlat, RoadmapFlatSchema } from '../schemas/roadmap-flat.schema';
import { AIModule } from 'src/ai/ai.module';
import { TeamsModule } from 'src/teams/teams.module';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RoadmapFlat.name, schema: RoadmapFlatSchema },
    ]),
    AIModule,
    TeamsModule
  ],
  controllers: [RoadmapController],
  providers: [RoadmapService],
  exports: [RoadmapService],
})
export class RoadmapModule {}
