import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatModule } from './modules/Chat/chat.module';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { QuizModule } from './modules/Quiz/quiz.module';
import { AIModule } from './modules/AI/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      ignoreEnvFile: false,
      cache: true,
    }),
    MongooseModule.forRoot('mongodb://localhost:27017/skill-sync'),
    AIModule,
    ChatModule,
    QuizModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
