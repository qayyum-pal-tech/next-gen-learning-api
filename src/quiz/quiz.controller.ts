import { Controller, Post, Body, Param } from '@nestjs/common';
import { QuizService } from "./quiz.service";

@Controller('quiz')
export class QuizController {
  constructor(private readonly quizService: QuizService) { }

  @Post('start')
  startQuiz(@Body() body: any) {
    return this.quizService.startQuizHandler(body);
  }

  @Post('submit-answer')
  submitAnswer(@Body() body: any) {
    return this.quizService.submitAnswerHandler(body);
  }

  @Post('resume')
  resumeQuiz(@Body() body: any) {
    return this.quizService.resumeQuizHandler(body);
  }

  @Post('preview/:quizId')
  getQuizPreview(@Param('quizId') quizId: string, @Body() body: any) {
    const payload = { ...(body || {}), quizId };
    return this.quizService.getQuizPreviewHandler(payload);
  }

  @Post('getdetails')
  getQuizDetailsById(@Body() body: any) {
    return this.quizService.getQuizDetailsByIdHandler(body);
  }
  @Post('results/:quizId')
  getQuizResults(@Param('quizId') quizId: string, @Body() body: any) {
    const payload = { ...(body || {}), quizId };
    return this.quizService.getQuizResultsHandler(payload);
  }
}