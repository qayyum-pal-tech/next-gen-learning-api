import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Request, Response } from 'express';
import { AIService } from '../AI/ai.service';
import { Quiz } from "./quiz.schema";
import { AssessmentType, QuestionType, QuizStatus } from './types';
import { Types } from 'mongoose';
@Injectable()
export class QuizService {
  constructor(
    @InjectModel(Quiz.name) private quizModel: Model<Quiz>,
    private aiService: AIService,
  ) { }

  async startQuizHandler(req: Request, res: Response) {
    try {
      const { userId, assessmentType, pathId, stepId, categoryId, categoryTitle, subtopicTitle } = req.body;

      if (!userId || !assessmentType || !pathId || !categoryId || !categoryTitle) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }

      const quiz = new this.quizModel({
        userId,
        assessmentType: assessmentType as AssessmentType,
        pathId,
        stepId,
        categoryId,
        categoryTitle,
        subtopicTitle,
        status: QuizStatus.IN_PROGRESS,
        questions: [], // Initialize empty questions array
      });

      await quiz.save();

      return res.json({
        success: true,
        message: 'Quiz session created',
        data: { quizId: quiz._id.toString() },
      });
    } catch (error) {
      console.error('Start quiz error:', error);
      return res.status(500).json({ success: false, error: 'Failed to start quiz' });
    }
  }

  async submitAnswerHandler(req: Request, res: Response) {
    try {
      const { userId, quizId, question, questionType, userAnswer, subtopicTitle } = req.body;

      if (!userId || !quizId || !question || !questionType) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }

      const quiz = await this.quizModel.findOne({ _id: new Types.ObjectId(quizId), userId });
      if (!quiz) {
        return res.status(404).json({ success: false, error: 'Quiz not found' });
      }

      // Evaluate answer
      const aiEval = await this.aiService.evaluateAnswer({
        questionText: question,
        questionType: questionType as QuestionType,
        userAnswer,
        category: quiz.categoryTitle,
        subtopic: subtopicTitle || null,
      });

      // Add question to embedded array
      quiz.questions.push({
        questionText: question,
        questionType: questionType as QuestionType,
        options: [], // Populate if needed
        userAnswer,
        correctAnswer: aiEval.correctAnswer,
        explanation: aiEval.explanation,
        score: aiEval.score,
        subtopicTitle,
      });

      const MAX_QUESTIONS = 5;
      const quizCompleted = quiz.questions.length >= MAX_QUESTIONS;
      const currentQuestionNumber = quiz.questions.length + 1;
      const totalQuestions = MAX_QUESTIONS;

      if (quizCompleted) {
        // Calculate final score
        const totalScore = quiz.questions.reduce((sum, q) => sum + (q.score || 0), 0);


        // Generate insights
        const insights = await this.aiService.generateQuizInsights({
          records: quiz.questions.map(q => ({
            question: q.questionText,
            subtopicTitle: q.subtopicTitle,
            score: q.score,
            questionType: q.questionType,
          })),
          category: quiz.categoryTitle,
          assessmentType: quiz.assessmentType,
          totalScore,
          maxScore: MAX_QUESTIONS * 10,
        });

        // Update quiz with final results
        quiz.status = QuizStatus.COMPLETED;
        quiz.completedAt = new Date();
        quiz.finalScore = totalScore;
        quiz.finalFeedback = insights.overallFeedback;
        quiz.insights = {
          strengths: insights.strengths,
          weaknesses: insights.weaknesses,
          areasToImprove: insights.areasToImprove,
        };

        await quiz.save();

        return res.json({
          success: true,
          message: 'Quiz completed!',
          data: {
            evaluation: aiEval,
            quizCompleted: true,
            progress: {
              current: currentQuestionNumber,
              total: totalQuestions,
            },
            finalScore: totalScore,
            finalFeedback: insights.overallFeedback,
            insights,
          },
        });
      }

      // Generate next question
      const lastDifficulty = 3;
      const nextDifficulty = aiEval.wasCorrect
        ? Math.min(lastDifficulty + 1, 5)
        : Math.max(lastDifficulty - 1, 1);

      const nextType: QuestionType =
        Math.random() > 0.7 ? QuestionType.DESCRIPTIVE : QuestionType.MULTIPLE_CHOICE;

      let nextQuestion;
      if (quiz.assessmentType === AssessmentType.PRE_ASSESSMENT) {
        const coveredSubtopics = [...new Set(
          quiz.questions.map(q => q.subtopicTitle).filter(Boolean)
        )];
        nextQuestion = await this.aiService.generatePreAssessmentQuestion({
          category: quiz.categoryTitle,
          coveredSubtopics,
          difficulty: nextDifficulty,
          type: nextType,
        });
      } else {
        const focusContent = quiz.subtopicTitle || quiz.categoryTitle;
        nextQuestion = await this.aiService.generateSkillCheckQuestion({
          category: quiz.categoryTitle,
          focusContent,
          difficulty: nextDifficulty,
          type: nextType,
        });
      }

      await quiz.save(); // Save progress

      return res.json({
        success: true,
        message: 'Answer submitted',
        data: {
          evaluation: aiEval,
          quizCompleted: false,
          nextQuestion,
          progress: {
            current: currentQuestionNumber,
            total: totalQuestions,
          },
        },
      });
    } catch (error) {
      console.error('Submit answer error:', error);
      return res.status(500).json({ success: false, error: 'Failed to submit answer' });
    }
  }

  async resumeQuizHandler(req: Request, res: Response) {
    try {
      const { userId, quizId } = req.body;
      if (!userId || !quizId) {
        return res.status(400).json({ success: false, error: 'userId and quizId required' });
      }

      const quiz = await this.quizModel.findOne({ _id: quizId, userId, status: QuizStatus.IN_PROGRESS });
      if (!quiz) {
        return res.status(404).json({ success: false, error: 'No active quiz found' });
      }


      let nextQuestion;

      // Handle fresh quiz (no questions yet)
      if (quiz.questions.length === 0) {
        if (quiz.assessmentType === AssessmentType.PRE_ASSESSMENT) {
          nextQuestion = await this.aiService.generatePreAssessmentQuestion({
            category: quiz.categoryTitle,
            coveredSubtopics: [],
            difficulty: 3,
            type: QuestionType.MULTIPLE_CHOICE,
          });
        } else {
          const focusContent = quiz.subtopicTitle || quiz.categoryTitle;
          nextQuestion = await this.aiService.generateSkillCheckQuestion({
            category: quiz.categoryTitle,
            focusContent,
            difficulty: 3,
            type: QuestionType.MULTIPLE_CHOICE,
          });
        }
      }
      // Handle in-progress quiz (has questions)
      else {
        const lastQuestion = quiz.questions[quiz.questions.length - 1];
        const subtopic = quiz.subtopicTitle || lastQuestion?.subtopicTitle || null;

        nextQuestion = await this.aiService.generateQuestion({
          category: quiz.categoryTitle,
          subtopic,
          difficulty: 3,
          type: QuestionType.MULTIPLE_CHOICE,
        });
      }

      return res.json({
        success: true,
        data: {
          quizId: quiz._id.toString(),
          question: nextQuestion,
          currentQuestionNumber: quiz.questions.length + 1,
        },
      });
    } catch (error) {
      console.error('Resume error:', error);
      return res.status(500).json({ success: false, error: 'Resume failed' });
    }
  }

  async getQuizPreviewHandler(req: Request, res: Response) {
    try {
      const { userId, quizId } = req.body;
      if (!userId || !quizId) {
        return res.status(400).json({ success: false, error: 'userId and quizId required' });
      }

      const quiz = await this.quizModel.findOne({ _id: quizId, userId });
      if (!quiz) {
        return res.status(404).json({ success: false, error: 'Quiz not found' });
      }

      return res.json({
        success: true,
        data: {
          quizId: quiz._id.toString(),
          assessmentType: quiz.assessmentType,
          categoryTitle: quiz.categoryTitle,
          subtopicTitle: quiz.subtopicTitle,
          status: quiz.status,
          questions: quiz.questions,
          finalScore: quiz.finalScore,
          finalFeedback: quiz.finalFeedback,
          insights: quiz.insights,
          startedAt: quiz.startedAt,
          completedAt: quiz.completedAt,
        },
      });
    } catch (error) {
      console.error('Preview error:', error);
      return res.status(500).json({ success: false, error: 'Preview failed' });
    }
  }

  async getQuizDetailsByIdHandler(req: Request, res: Response) {
    try {
      const { quizId } = req.body;
      if (!quizId) {
        return res.status(400).json({ success: false, error: 'quizId required' });
      }

      const quiz = await this.quizModel.findById(quizId);
      if (!quiz) {
        return res.status(404).json({ success: false, error: 'Quiz not found' });
      }

      return res.json({
        success: true,
        data: {
          quizId: quiz._id.toString(),
          assessmentType: quiz.assessmentType,
          pathId: quiz.pathId,
          stepId: quiz.stepId,
          categoryTitle: quiz.categoryTitle,
          subtopicTitle: quiz.subtopicTitle,
          status: quiz.status,
          startedAt: quiz.startedAt,
          completedAt: quiz.completedAt,
          finalScore: quiz.finalScore,
          insights: quiz.insights,
        },
      });
    } catch (error) {
      console.error('Get details error:', error);
      return res.status(500).json({ success: false, error: 'Fetch failed' });
    }
  }
  async getQuizResultsHandler(req: Request, res: Response) {
    try {
      const { quizId } = req.body;
      const userId = req.body.userId;

      if (!quizId || !userId) {
        return res.status(400).json({ success: false, error: 'quizId and userId required' });
      }

      const quiz = await this.quizModel.findOne({ _id: new Types.ObjectId(quizId), userId });
      if (!quiz || quiz.status !== QuizStatus.COMPLETED) {
        return res.status(404).json({ success: false, error: 'Completed quiz not found' });
      }

      const totalQuestions = quiz.questions.length;
      const totalScore = quiz.questions.reduce((sum, q) => sum + (q.score || 0), 0);
      const maxPossibleScore = totalQuestions * 10;
      const percentage = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;

      let performanceLevel = 'beginner';
      if (percentage >= 90) performanceLevel = 'expert';
      else if (percentage >= 70) performanceLevel = 'advanced';
      else if (percentage >= 50) performanceLevel = 'intermediate';

      return res.json({
        success: true,
        data: {
          quizId: quiz._id.toString(),
          category: quiz.categoryTitle,
          subcategory: quiz.subtopicTitle || quiz.categoryTitle,
          assessmentType: quiz.assessmentType,

          score: totalScore,
          totalScore: maxPossibleScore,
          percentage,
          questionsCount: totalQuestions,
          performanceLevel,

          performanceFeedback: quiz.finalFeedback || '',
          strengths: quiz.insights?.strengths || [],
          weaknesses: quiz.insights?.weaknesses || [],
          areasToImprove: quiz.insights?.areasToImprove || [],

          startedAt: quiz.startedAt,
          completedAt: quiz.completedAt,
          duration: quiz.completedAt && quiz.startedAt
            ? Math.floor((new Date(quiz.completedAt).getTime() - new Date(quiz.startedAt).getTime()) / 1000)
            : 0,
        },
      });
    } catch (error) {
      console.error('Get results error:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch results' });
    }
  }
}