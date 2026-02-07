import { Controller, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { QuizService } from "./quiz.service";

@Controller('quiz')
export class QuizController {
  constructor(private readonly quizService: QuizService) { }

  @Post('start')
  startQuiz(@Req() req: Request, @Res() res: Response) {
    return this.quizService.startQuizHandler(req, res);
  }

  @Post('submit-answer')
  submitAnswer(@Req() req: Request, @Res() res: Response) {
    return this.quizService.submitAnswerHandler(req, res);
  }

  @Post('resume')
  resumeQuiz(@Req() req: Request, @Res() res: Response) {
    return this.quizService.resumeQuizHandler(req, res);
  }

  @Post('preview/:quizId')
  getQuizPreview(@Req() req: Request, @Res() res: Response) {
    return this.quizService.getQuizPreviewHandler(req, res);
  }

  @Post('getdetails')
  getQuizDetailsById(@Req() req: Request, @Res() res: Response) {
    return this.quizService.getQuizDetailsByIdHandler(req, res);
  }
  @Post('results/:quizId')
  getQuizResults(@Req() req: Request, @Res() res: Response) {
    return this.quizService.getQuizResultsHandler(req, res);
  }
}