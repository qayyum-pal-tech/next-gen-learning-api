import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TeamsModule } from './teams/teams.module';
import { ChatModule } from './modules/Chat/chat.module';

import { RoadmapModule } from './roadmap/roadmap.module';
import { ContentModule } from './content/content.module';
import { AIModule } from './ai/ai.module';
import { QuizModule } from "./quiz/quiz.module";
import { SuggestionsModule } from "./suggestions/suggestions.module";
import { AdminModule } from './admin/admin.module';
import { LearningLogModule } from './learning-log/learning-log.module';

import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    // Global env configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      cache: true,
    }),

    // MongoDB connection
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri:
          configService.get<string>('MONGODB_URI') ||
          'mongodb://localhost:27017/nextgen-learning',
      }),
      inject: [ConfigService],
    }),

    // Feature modules
    AuthModule,
    UsersModule,
    TeamsModule,
    ChatModule,
    AIModule,
    RoadmapModule,
    ContentModule,
    QuizModule,
    SuggestionsModule,
    AdminModule,
    LearningLogModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
