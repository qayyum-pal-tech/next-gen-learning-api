import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AIService } from "../ai/ai.service";
import { Quiz } from "./quiz.schema";
import { AssessmentType, QuestionType, QuizStatus } from './types';
import { Types } from 'mongoose';
import { RoadmapFlat } from '../schemas/roadmap-flat.schema';
import { SubtopicContent } from '../schemas/subtopic-content.schema';
import { RoadmapService } from '../roadmap/roadmap.service';

@Injectable()
export class QuizService {
  constructor(
    @InjectModel(Quiz.name) private quizModel: Model<Quiz>,
    @InjectModel(RoadmapFlat.name) private roadmapModel: Model<RoadmapFlat>,
    @InjectModel(SubtopicContent.name) private subtopicContentModel: Model<SubtopicContent>,
    private aiService: AIService,
    private roadmapService: RoadmapService,
  ) { }


  private inFlightGenerations = new Map<string, Promise<any>>();


  /**
   * Helper method to fetch topic content from database
   * @param pathId - The roadmap ID
   * @param stepId - The topic order/step ID
   * @returns Formatted content string containing topic and subtopic information
   */
  private async fetchTopicContent(pathId: string, stepId: string, subtopicTitle?: string): Promise<string> {
    try {
      // Fetch the roadmap by ID
      const roadmap = await this.roadmapModel.findById(pathId);
      if (!roadmap) {
        throw new NotFoundException('Roadmap not found');
      }

      // Parse stepId as topic order number
      const topicOrder = parseInt(stepId, 10);
      if (isNaN(topicOrder)) {
        throw new BadRequestException('Invalid stepId format');
      }

      // Find the specific topic by order
      const topic = roadmap.topics.find(t => t.order === topicOrder);
      if (!topic) {
        throw new NotFoundException(`Topic with order ${topicOrder} not found`);
      }

      // Fetch subtopic content from SubtopicContent collection
      const filter: any = {
        roadmapId: pathId,
        topicOrder: topicOrder,
      };

      // Fetch subtopic content from SubtopicContent collection
      const subtopicContents = await this.subtopicContentModel.find(filter).sort({ subtopicOrder: 1 });

      // Build comprehensive content string
      let content = `# ${topic.title}\n\n`;
      if (topic.description && !subtopicTitle) {
        content += `${topic.description}\n\n`;
      }

      // Add subtopic information
      for (const subtopic of topic.subtopics) {
        // If subtopicTitle is provided, skip other subtopics
        if (subtopicTitle && subtopic.title.toLowerCase() !== subtopicTitle.toLowerCase()) {
          continue;
        }

        content += `## ${subtopic.title}\n`;
        if (subtopic.description) {
          content += `${subtopic.description}\n`;
        }

        // Find matching content from SubtopicContent collection
        const matchingContent = subtopicContents.find(
          sc => sc.subtopicOrder === subtopic.order
        );

        if (matchingContent) {
          content += `\n${matchingContent.content}\n`;

          // Add code examples if available
          if (matchingContent.codeExamples && matchingContent.codeExamples.length > 0) {
            content += `\n### Code Examples:\n`;
            for (const example of matchingContent.codeExamples) {
              content += `\n**${example.title}**\n`;
              content += `\`\`\`${example.language}\n${example.code}\n\`\`\`\n`;
              if (example.explanation) {
                content += `${example.explanation}\n`;
              }
            }
          }

          // Add interview questions if available
          if (matchingContent.interviewQuestions && matchingContent.interviewQuestions.length > 0) {
            content += `\n### Interview Questions:\n`;
            for (const qa of matchingContent.interviewQuestions) {
              content += `\nQ: ${qa.question}\n`;
              content += `A: ${qa.answer}\n`;
            }
          }
        }
        content += `\n`;

        // If we found the specific subtopic, we can stop
        if (subtopicTitle) break;
      }

      return content;
    } catch (error) {
      console.error('Error fetching topic content:', error);
      throw error;
    }
  }

  async startQuizHandler(body: any) {
    try {
      const { userId, assessmentType, pathId, stepId, categoryId, categoryTitle, subtopicTitle } = body;

      if (!userId || !assessmentType || !pathId || !categoryId || !categoryTitle) {
        throw new BadRequestException('Missing required fields');
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
        questions: [],
      });

      await quiz.save();

      return {
        success: true,
        message: 'Quiz session created',
        data: { quizId: quiz._id.toString() },
      };
    } catch (error) {
      console.error('Start quiz error:', error);
      throw new InternalServerErrorException('Failed to start quiz');
    }
  }

  async submitAnswerHandler(body: any) {
    try {
      const { userId, quizId, question, questionType, userAnswer, subtopicTitle, options } = body;

      if (!userId || !quizId || !question || !questionType) {
        throw new BadRequestException('Missing required fields');
      }

      const quiz = await this.quizModel.findOne({ _id: new Types.ObjectId(quizId), userId });
      if (!quiz) {
        throw new NotFoundException('Quiz not found');
      }

      // Evaluate answer
      const aiEval = await this.aiService.evaluateAnswer({
        questionText: question,
        questionType: questionType as QuestionType,
        userAnswer,
        category: quiz.categoryTitle,
        subtopic: subtopicTitle || null,
      });
      let currentQuestionDifficulty = 3;
      if (quiz.questions.length > 0) {
        const lastStoredQuestion = quiz.questions[quiz.questions.length - 1];
        const lastDiff = lastStoredQuestion.difficultyLevel || 3;
        // Re-calculate what the difficulty of THIS question should have been
        currentQuestionDifficulty = lastStoredQuestion.score >= 7
          ? Math.min(lastDiff + 1, 5)
          : Math.max(lastDiff - 1, 1);
      }

      // Add question to embedded array
      quiz.questions.push({
        questionText: question,
        questionType: questionType as QuestionType,
        options: options || [],
        userAnswer,
        correctAnswer: aiEval.correctAnswer,
        explanation: aiEval.explanation,
        score: aiEval.score,
        subtopicTitle,
        difficultyLevel: currentQuestionDifficulty,
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
        // Update Roadmap Progress if quiz is associated with a roadmap
        if (quiz.pathId && quiz.stepId && quiz.assessmentType === AssessmentType.SKILL_CHECK) {
          const topicOrder = parseInt(quiz.stepId, 10);
          if (!isNaN(topicOrder)) {
            try {
              // Mark the topic as completed in the roadmap
              // We pass true because finishing the quiz implies mastery of the topic
              await this.roadmapService.updateTopicProgress(
                quiz.pathId,
                quiz.userId,
                topicOrder,
                true
              );
              console.log(`Updated roadmap ${quiz.pathId} topic ${topicOrder} completion via quiz`);
            } catch (error) {
              console.error('Failed to update roadmap progress from quiz completion:', error);
            }
          }
        }

        return {
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
        };
      }

      // Generate next question
      // Calculate NEXT difficulty based on the current answer performance
      const nextDifficulty = aiEval.wasCorrect
        ? Math.min(currentQuestionDifficulty + 1, 5)
        : Math.max(currentQuestionDifficulty - 1, 1);

      const nextType: QuestionType =
        Math.random() > 0.5 ? QuestionType.DESCRIPTIVE : QuestionType.MULTIPLE_CHOICE;

      // Collect previous questions (including the one just answered/pushed)
      const previousQuestions = quiz.questions.map(q => q.questionText);

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
          previousQuestions,
        });
      } else {
        // Fetch topic content for skill assessment
        let topicContent = null;
        if (quiz.pathId && quiz.stepId) {
          try {
            topicContent = await this.fetchTopicContent(quiz.pathId, quiz.stepId, quiz.subtopicTitle);
          } catch (error) {
            console.error('Failed to fetch topic content:', error);
            // Continue without topic content if fetching fails
          }
        }

        const focusContent = quiz.subtopicTitle || quiz.categoryTitle;
        nextQuestion = await this.aiService.generateSkillCheckQuestion({
          category: quiz.categoryTitle,
          focusContent,
          difficulty: nextDifficulty,
          type: nextType,
          topicContent,
          previousQuestions,
        });
      }
      console.log("next", nextQuestion)

      await quiz.save();

      return {
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
      };
    } catch (error) {
      console.error('Submit answer error:', error);
      throw new InternalServerErrorException('Failed to submit answer');
    }
  }

  async resumeQuizHandler(body: any) {
    try {
      const { userId, quizId } = body;
      if (!userId || !quizId) {
        throw new BadRequestException('userId and quizId required');
      }
      console.log(quizId, userId, "got")

      const quiz = await this.quizModel.findOne({ _id: quizId, userId, status: QuizStatus.IN_PROGRESS });
      if (!quiz) {
        throw new NotFoundException('No active quiz found');
      }

      // De-duplicate AI generation calls
      const generationKey = `${userId}:${quizId}`;
      if (this.inFlightGenerations.has(generationKey)) {
        return {
          success: true,
          data: {
            quizId: quiz._id.toString(),
            question: await this.inFlightGenerations.get(generationKey),
            currentQuestionNumber: quiz.questions.length + 1,
          },
        };
      }

      const generationPromise = (async () => {
        try {
          // Collect previous questions to avoid repetition
          const previousQuestions = quiz.questions.map(q => q.questionText);

          let nextQuestion;

          // Handle fresh quiz (no questions yet)
          if (quiz.questions.length === 0) {
            if (quiz.assessmentType === AssessmentType.PRE_ASSESSMENT) {
              nextQuestion = await this.aiService.generatePreAssessmentQuestion({
                category: quiz.categoryTitle,
                coveredSubtopics: [],
                difficulty: 3,
                type: QuestionType.MULTIPLE_CHOICE,
                previousQuestions,
              });
            } else {
              // Fetch topic content for skill assessment
              let topicContent = null;
              if (quiz.pathId && quiz.stepId) {
                try {
                  topicContent = await this.fetchTopicContent(quiz.pathId, quiz.stepId, quiz.subtopicTitle);
                } catch (error) {
                  console.error('Failed to fetch topic content:', error);
                  // Continue without topic content if fetching fails
                }
              }

              const focusContent = quiz.subtopicTitle || quiz.categoryTitle;
              nextQuestion = await this.aiService.generateSkillCheckQuestion({
                category: quiz.categoryTitle,
                focusContent,
                difficulty: 3,
                type: QuestionType.MULTIPLE_CHOICE,
                topicContent,
                previousQuestions,
              });
            }
          }
          // Handle in-progress quiz (has questions)
          else {
            const lastQuestion = quiz.questions[quiz.questions.length - 1];

            let nextDifficulty = 3; // Default
            if (lastQuestion.score !== undefined) {
              nextDifficulty = lastQuestion.score >= 7
                ? Math.min((lastQuestion.difficultyLevel || 3) + 1, 5)
                : Math.max((lastQuestion.difficultyLevel || 3) - 1, 1);
            }

            const nextType = Math.random() > 0.5 ? QuestionType.DESCRIPTIVE : QuestionType.MULTIPLE_CHOICE;

            if (quiz.assessmentType === AssessmentType.PRE_ASSESSMENT) {
              const coveredSubtopics = [...new Set(
                quiz.questions.map(q => q.subtopicTitle).filter(Boolean)
              )];

              nextQuestion = await this.aiService.generatePreAssessmentQuestion({
                category: quiz.categoryTitle,
                coveredSubtopics,
                difficulty: nextDifficulty,
                type: nextType,
                previousQuestions,
              });
            } else {
              // SKILL_ASSESSMENT
              let topicContent = null;
              if (quiz.pathId && quiz.stepId) {
                try {
                  topicContent = await this.fetchTopicContent(quiz.pathId, quiz.stepId, quiz.subtopicTitle);
                } catch (error) {
                  console.error('Failed to fetch topic content:', error);
                }
              }

              const focusContent = quiz.subtopicTitle || quiz.categoryTitle;
              nextQuestion = await this.aiService.generateSkillCheckQuestion({
                category: quiz.categoryTitle,
                focusContent,
                difficulty: nextDifficulty,
                type: nextType,
                topicContent,
                previousQuestions,
              });
            }
          }
          return nextQuestion;
        } finally {
          this.inFlightGenerations.delete(generationKey);
        }
      })();

      this.inFlightGenerations.set(generationKey, generationPromise);
      const nextQuestion = await generationPromise;

      console.log("next", nextQuestion)

      return {
        success: true,
        data: {
          quizId: quiz._id.toString(),
          question: nextQuestion,
          currentQuestionNumber: quiz.questions.length + 1,
        },
      };
    } catch (error) {
      console.error('Resume error:', error);
      throw new InternalServerErrorException('Resume failed');
    }
  }

  async getQuizPreviewHandler(body: any) {
    try {
      const { userId, quizId } = body;
      if (!userId || !quizId) {
        throw new BadRequestException('userId and quizId required');
      }

      const quiz = await this.quizModel.findOne({ _id: quizId, userId });
      if (!quiz) {
        throw new NotFoundException('Quiz not found');
      }

      return {
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
      };
    } catch (error) {
      console.error('Preview error:', error);
      throw new InternalServerErrorException('Preview failed');
    }
  }

  async getQuizDetailsByIdHandler(body: any) {
    try {
      const { quizId } = body;
      if (!quizId) {
        throw new BadRequestException('quizId required');
      }

      const quiz = await this.quizModel.findById(quizId);
      if (!quiz) {
        throw new NotFoundException('Quiz not found');
      }

      return {
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
      };
    } catch (error) {
      console.error('Get details error:', error);
      throw new InternalServerErrorException('Fetch failed');
    }
  }
  async getQuizResultsHandler(body: any) {
    try {
      const { quizId, userId } = body;

      if (!quizId || !userId) {
        throw new BadRequestException('quizId and userId required');
      }

      const quiz = await this.quizModel.findOne({ _id: new Types.ObjectId(quizId), userId });
      if (!quiz || quiz.status !== QuizStatus.COMPLETED) {
        throw new NotFoundException('Completed quiz not found');
      }

      const totalQuestions = quiz.questions.length;
      const totalScore = quiz.questions.reduce((sum, q) => sum + (q.score || 0), 0);
      const maxPossibleScore = totalQuestions * 10;
      const percentage = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;

      let performanceLevel = 'beginner';
      if (percentage >= 90) performanceLevel = 'expert';
      else if (percentage >= 70) performanceLevel = 'advanced';
      else if (percentage >= 50) performanceLevel = 'intermediate';

      return {
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
      };
    } catch (error) {
      console.error('Get results error:', error);
      throw new InternalServerErrorException('Failed to fetch results');
    }
  }
}