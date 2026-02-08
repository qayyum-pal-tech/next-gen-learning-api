import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { RoadmapModule } from './roadmap/roadmap.module';
import { ContentModule } from './content/content.module';
import { AIModule } from './ai/ai.module';

@Module({
  imports: [
    // Environment configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // MongoDB connection
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri:
          configService.get<string>('MONGODB_URI') ||
          'mongodb://localhost:27017/learning-roadmap',
      }),
      inject: [ConfigService],
    }),

    AIModule,

    // Feature modules
    RoadmapModule,
    ContentModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
