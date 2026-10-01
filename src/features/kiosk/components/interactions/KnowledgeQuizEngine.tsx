import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Award,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { KioskQuizConfig, KioskQuizQuestion } from '../../../../types/kiosk/validation.types';

export interface KnowledgeQuizEngineProps {
  quiz: KioskQuizConfig;
  onPass: (score: number) => void;
  onFail?: (score: number) => void;
  highContrast?: boolean;
  allowRetake?: boolean;
  className?: string;
}

export const KnowledgeQuizEngine: React.FC<KnowledgeQuizEngineProps> = ({
  quiz,
  onPass,
  onFail,
  highContrast = false,
  allowRetake = true,
  className = ''
}) => {
  const { t } = useTranslation('kiosk');

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  // Store user selections per question: { [questionIndex]: selectedOptionIndex }
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  // Track if current question's answer is submitted/revealed
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  // Track quiz finished state
  const [isFinished, setIsFinished] = useState(false);

  const questions = quiz.questions || [];
  const totalQuestions = questions.length;
  const currentQuestion = questions[currentQuestionIndex];
  const passingScore = quiz.passingScore || 70;

  // Calculate score
  const calculateResults = () => {
    let correctCount = 0;
    questions.forEach((q: KioskQuizQuestion, idx: number) => {
      if (selectedAnswers[idx] === q.correctOptionIndex) {
        correctCount++;
      }
    });
    const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const isPassed = percentage >= passingScore;
    return { correctCount, percentage, isPassed };
  };

  const handleSelectOption = (optionIndex: number) => {
    if (isAnswerRevealed) return; // Answer already revealed for this question

    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQuestionIndex]: optionIndex
    }));
    setIsAnswerRevealed(true);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setIsAnswerRevealed(false);
    } else {
      // Finished all questions
      setIsFinished(true);
      const { percentage, isPassed } = calculateResults();
      if (isPassed) {
        onPass(percentage);
      } else {
        onFail?.(percentage);
      }
    }
  };

  const handleRetake = () => {
    setSelectedAnswers({});
    setCurrentQuestionIndex(0);
    setIsAnswerRevealed(false);
    setIsFinished(false);
  };

  // Keyboard navigation for assistive keypads & switches (K-ACC-003)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key >= '1' && e.key <= '9') {
        const optionIdx = parseInt(e.key, 10) - 1;
        if (currentQuestion && optionIdx < currentQuestion.options.length) {
          e.preventDefault();
          handleSelectOption(optionIdx);
        }
      } else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        if (isAnswerRevealed) {
          e.preventDefault();
          handleNextQuestion();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQuestion, isAnswerRevealed, currentQuestionIndex, totalQuestions]);

  // If no questions defined
  if (!currentQuestion) {
    return (
      <div data-testid="knowledge-quiz-engine" className="p-8 text-center text-slate-400">
        <p>{t('quiz.noQuestions', { defaultValue: 'No quiz questions configured.' })}</p>
      </div>
    );
  }

  // Quiz Results Screen
  if (isFinished) {
    const { correctCount, percentage, isPassed } = calculateResults();

    return (
      <div
        data-testid="knowledge-quiz-engine"
        className={`w-full max-w-xl mx-auto rounded-3xl border p-8 space-y-6 text-center shadow-2xl transition-all ${
          highContrast
            ? 'bg-black border-2 border-amber-400 text-white'
            : isPassed
            ? 'bg-slate-900 border-emerald-500/50 text-white'
            : 'bg-slate-900 border-rose-500/50 text-white'
        } ${className}`}
      >
        <div className="flex justify-center">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center border-2 ${
              isPassed
                ? highContrast
                  ? 'bg-amber-400 text-black border-amber-300'
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500'
                : 'bg-rose-500/20 text-rose-400 border-rose-500'
            }`}
          >
            {isPassed ? <Award className="w-10 h-10" /> : <AlertTriangle className="w-10 h-10" />}
          </div>
        </div>

        <div className="space-y-2">
          <h3
            data-testid={isPassed ? 'quiz-pass-banner' : 'quiz-fail-banner'}
            className="text-2xl sm:text-3xl font-black tracking-tight"
          >
            {isPassed
              ? t('quiz.passedTitle', { defaultValue: 'Knowledge Check Passed!' })
              : t('quiz.failedTitle', { defaultValue: 'Knowledge Check Incomplete' })}
          </h3>
          <p className="text-sm text-slate-400">
            {isPassed
              ? t('quiz.passedSubtitle', { defaultValue: 'You demonstrated required comprehension of safety guidelines.' })
              : t('quiz.failedSubtitle', { defaultValue: 'Score did not meet the required threshold for operational clearance.' })}
          </p>
        </div>

        {/* Score Card */}
        <div
          data-testid="quiz-result-score"
          data-score={percentage}
          data-passed={isPassed}
          className={`p-6 rounded-2xl border flex items-center justify-around ${
            highContrast
              ? 'bg-neutral-900 border-amber-400 text-amber-300'
              : 'bg-slate-950/70 border-slate-800'
          }`}
        >
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold">{percentage}%</div>
            <div className="text-xs uppercase tracking-wider text-slate-400 mt-0.5">
              {t('quiz.yourScore', { defaultValue: 'Your Score' })}
            </div>
          </div>
          <div className="h-10 w-px bg-slate-800" />
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-slate-300">{passingScore}%</div>
            <div className="text-xs uppercase tracking-wider text-slate-400 mt-0.5">
              {t('quiz.requiredPass', { defaultValue: 'Pass Mark' })}
            </div>
          </div>
          <div className="h-10 w-px bg-slate-800" />
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-slate-300">
              {correctCount} / {totalQuestions}
            </div>
            <div className="text-xs uppercase tracking-wider text-slate-400 mt-0.5">
              {t('quiz.correctAnswers', { defaultValue: 'Correct' })}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          {allowRetake && !isPassed && (
            <button
              type="button"
              data-testid="quiz-retake-btn"
              onClick={handleRetake}
              className={`flex-1 min-h-[56px] px-6 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center space-x-2 transition active:scale-95 ${
                highContrast
                  ? 'bg-amber-400 text-black border border-amber-300'
                  : 'bg-slate-800 hover:bg-slate-750 text-white border border-slate-700'
              }`}
            >
              <RotateCcw className="w-5 h-5" />
              <span>{t('quiz.retake', { defaultValue: 'Retake Quiz' })}</span>
            </button>
          )}

          {isPassed && (
            <button
              type="button"
              data-testid="quiz-continue-btn"
              onClick={() => onPass(percentage)}
              className={`w-full min-h-[64px] min-w-[64px] px-8 py-4 rounded-2xl font-black text-base flex items-center justify-center space-x-2 transition active:scale-95 ${
                highContrast
                  ? 'bg-amber-400 text-black border-2 border-amber-300 shadow-xl'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-xl shadow-emerald-500/20'
              }`}
            >
              <span>{t('quiz.continue', { defaultValue: 'Continue Briefing' })}</span>
              <ArrowRight className="w-6 h-6 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Active Question View
  const selectedOptionIndex = selectedAnswers[currentQuestionIndex];
  const isSelected = selectedOptionIndex !== undefined;
  const isCorrect = isSelected && selectedOptionIndex === currentQuestion.correctOptionIndex;

  const optionLetters = ['A', 'B', 'C', 'D', 'E'];

  return (
    <div
      data-testid="knowledge-quiz-engine"
      className={`w-full max-w-2xl mx-auto rounded-3xl border p-6 sm:p-8 space-y-6 shadow-2xl transition-all ${
        highContrast
          ? 'bg-black border-2 border-amber-400 text-white'
          : 'bg-slate-900/80 border-slate-800 text-white backdrop-blur-md'
      } ${className}`}
    >
      {/* Progress & Question Counter */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
          <span className="flex items-center space-x-1.5">
            <HelpCircle className="w-4 h-4 text-emerald-400" />
            <span>{t('quiz.knowledgeCheck', { defaultValue: 'Knowledge Check' })}</span>
          </span>
          <span className={highContrast ? 'text-amber-300' : 'text-slate-300'}>
            {t('quiz.questionNumber', {
              defaultValue: `Question ${currentQuestionIndex + 1} of ${totalQuestions}`,
              current: currentQuestionIndex + 1,
              total: totalQuestions
            })}
          </span>
        </div>

        {/* Question progress bar */}
        <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
          <div
            className={`h-full transition-all duration-300 ${
              highContrast ? 'bg-amber-400' : 'bg-emerald-500'
            }`}
            style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
          />
        </div>
      </div>

      {/* Question Prompt */}
      <h3
        data-testid="quiz-question-title"
        className="text-lg sm:text-xl font-bold tracking-tight text-white leading-snug"
      >
        {currentQuestion.question}
      </h3>

      {/* Multiple-Choice Options */}
      <div className="space-y-3">
        {currentQuestion.options.map((option: string, optIdx: number) => {
          const isThisSelected = selectedOptionIndex === optIdx;
          const isThisCorrect = optIdx === currentQuestion.correctOptionIndex;

          let optionStyle = '';

          if (isAnswerRevealed) {
            if (isThisCorrect) {
              optionStyle = highContrast
                ? 'bg-amber-400 text-black border-amber-300 font-black'
                : 'bg-emerald-950/60 border-emerald-500 text-emerald-200 shadow-md shadow-emerald-500/20';
            } else if (isThisSelected && !isThisCorrect) {
              optionStyle = highContrast
                ? 'bg-neutral-900 border-rose-500 text-rose-300'
                : 'bg-rose-950/40 border-rose-500/80 text-rose-200';
            } else {
              optionStyle = 'opacity-50 bg-slate-950/40 border-slate-800 text-slate-400';
            }
          } else {
            optionStyle = highContrast
              ? 'bg-black border-neutral-700 text-white hover:border-amber-400'
              : 'bg-slate-950/60 border-slate-800 text-slate-200 hover:border-slate-700 hover:bg-slate-900';
          }

          return (
            <button
              key={optIdx}
              type="button"
              id={`quiz-option-${optIdx}`}
              data-testid={`quiz-option-${optIdx}`}
              disabled={isAnswerRevealed}
              onClick={() => handleSelectOption(optIdx)}
              className={`w-full min-h-[58px] p-4 rounded-2xl border-2 text-left flex items-center justify-between transition-all active:scale-[0.99] select-none focus-visible:outline-4 focus-visible:outline-sky-500 focus-visible:ring-4 focus-visible:ring-sky-500/30 ${optionStyle}`}
            >
              <div className="flex items-center space-x-3.5 min-w-0 pr-2">
                <span
                  className={`w-8 h-8 rounded-xl font-black text-sm flex items-center justify-center shrink-0 border ${
                    isAnswerRevealed && isThisCorrect
                      ? highContrast
                        ? 'bg-black text-amber-300 border-black'
                        : 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : isAnswerRevealed && isThisSelected
                      ? 'bg-rose-500 text-white border-rose-400'
                      : 'bg-slate-900 border-slate-800 text-slate-300'
                  }`}
                >
                  {optionLetters[optIdx] || optIdx + 1}
                </span>
                <span className="text-sm sm:text-base font-medium leading-tight">{option}</span>
              </div>

              {/* Status Icon */}
              {isAnswerRevealed && (
                <div className="shrink-0">
                  {isThisCorrect ? (
                    <CheckCircle2 className={`w-6 h-6 stroke-[2.5] ${highContrast ? 'text-black' : 'text-emerald-400'}`} />
                  ) : isThisSelected ? (
                    <XCircle className="w-6 h-6 stroke-[2.5] text-rose-400" />
                  ) : null}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Answer Explanation Panel */}
      {isAnswerRevealed && (
        <div
          data-testid="quiz-explanation"
          className={`p-4 sm:p-5 rounded-2xl border animate-fade-in flex items-start space-x-3 text-sm ${
            isCorrect
              ? highContrast
                ? 'bg-neutral-900 border-amber-400 text-amber-200'
                : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
          }`}
        >
          {isCorrect ? (
            <Sparkles className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
          )}
          <div className="space-y-1">
            <span className="font-bold uppercase tracking-wider text-xs block">
              {isCorrect ? t('quiz.correct', { defaultValue: 'Correct!' }) : t('quiz.incorrect', { defaultValue: 'Incorrect' })}
            </span>
            <p className="leading-relaxed opacity-95">
              {currentQuestion.explanation ||
                (isCorrect
                  ? t('quiz.defaultCorrectExpl', { defaultValue: 'Great job! You selected the compliant safety action.' })
                  : t('quiz.defaultIncorrectExpl', { defaultValue: 'Review the highlighted correct answer before proceeding.' }))}
            </p>
          </div>
        </div>
      )}

      {/* Next Question / Finish Action */}
      {isAnswerRevealed && (
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            id="quiz-next-btn"
            data-testid="quiz-next-btn"
            onClick={handleNextQuestion}
            className={`min-h-[64px] min-w-[64px] px-8 py-4 rounded-2xl font-black text-sm sm:text-base flex items-center space-x-2 transition active:scale-95 shadow-xl ${
              highContrast
                ? 'bg-amber-400 text-black border-2 border-amber-300 hover:bg-amber-300'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
            }`}
          >
            <span>
              {currentQuestionIndex < totalQuestions - 1
                ? t('quiz.nextQuestion', { defaultValue: 'Next Question' })
                : t('quiz.viewResults', { defaultValue: 'View Results' })}
            </span>
            <ArrowRight className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>
      )}
    </div>
  );
};

export default KnowledgeQuizEngine;
