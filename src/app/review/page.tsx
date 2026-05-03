'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getContentTypeConfig, type ContentType } from '@/lib/content-type';
import MistakeCard from '@/components/MistakeCard';
import ExpressionCard from '@/components/ExpressionCard';
import { useToast } from '@/components/ToastProvider';
import { useSwipe } from '@/hooks/useSwipe';

interface Mistake {
  id: string;
  error_sentence: string;
  correct_sentence: string;
  explanation?: string;
  status: string;
  content_type?: ContentType; // v2.0: 内容类型
  next_review_at?: string;
  review_stage?: number;
  review_count?: number;
  last_reviewed_at?: string | null;
  last_score?: number | null;
  previous_interval?: number | null;
}

const scoreLabels: Record<number, string> = {
  0: '忘了',
  1: '困难',
  2: '还行',
  3: '很熟',
};

function getStageInfo(stage = 0) {
  if (stage <= 0) {
    return { label: '初见', description: '刚开始建立记忆', tone: 'bg-slate-600' };
  }

  if (stage <= 2) {
    return { label: '起步', description: '短间隔巩固中', tone: 'bg-sky-600' };
  }

  if (stage <= 5) {
    return { label: '巩固', description: '记忆正在变稳定', tone: 'bg-emerald-600' };
  }

  if (stage <= 9) {
    return { label: '稳定', description: '进入较长间隔', tone: 'bg-violet-600' };
  }

  return { label: '长期', description: '长期记忆维护', tone: 'bg-amber-600' };
}

function formatReviewDate(value?: string | null) {
  if (!value) return '暂无';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '暂无';

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export default function ReviewPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showRetireModal, setShowRetireModal] = useState(false);

  const fetchTodayMistakes = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const response = await fetch('/api/review-queue?mode=today');
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
            ? payload.error
            : 'Failed to fetch review queue';
        throw new Error(message);
      }

      if (!Array.isArray(payload)) {
        throw new Error('Unexpected response format from review queue');
      }

      setMistakes(payload);
      setReviewing(false);
      setCurrentIndex(0);
      setShowAnswer(false);
    } catch (error) {
      console.error("Error fetching review queue:", error);
      setMistakes([]);
      setErrorMessage(error instanceof Error ? error.message : "Failed to fetch review queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodayMistakes();
  }, [fetchTodayMistakes]);

  // v3.0: Handle 4-level scoring
  const handleReviewResponse = useCallback(async (score: 0 | 1 | 2 | 3) => {
    if (currentIndex >= mistakes.length) return;

    const currentMistake = mistakes[currentIndex];
    const contentType = currentMistake.content_type || 'mistake';

    try {
      const response = await fetch(`/api/mistakes/${currentMistake.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          score,           // v3.0: 4-level score
          contentType
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update mistake');
      }

      // Note: 不再需要"stay on card for retry"逻辑
      // 当日重现会通过reappear机制处理

      // Move to next card (or finish)
      if (currentIndex < mistakes.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setShowAnswer(false);
      } else {
        showToast(`复习完成，已处理 ${mistakes.length} 条内容。`, 'success');
        router.push('/');
      }
    } catch (error) {
      console.error('Error updating mistake:', error);
      showToast('更新复习结果失败，请重试。', 'error');
    }
  }, [currentIndex, mistakes, router, showToast]);

  const handleRetire = useCallback(async () => {
    if (currentIndex >= mistakes.length) return;

    const currentMistake = mistakes[currentIndex];

    try {
      const response = await fetch(`/api/mistakes/${currentMistake.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          retire: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to retire item');
      }

      // Move to next card (or finish)
      if (currentIndex < mistakes.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setShowAnswer(false);
      } else {
        showToast(`复习完成，已处理 ${mistakes.length} 条内容。`, 'success');
        router.push('/');
      }
    } catch (error) {
      console.error('Error retiring item:', error);
      showToast('停止复习失败，请重试。', 'error');
    }
  }, [currentIndex, mistakes, router, showToast]);

  const startReview = () => {
    if (mistakes.length === 0) {
      showToast('今天没有需要复习的内容。');
      return;
    }
    setReviewing(true);
    setCurrentIndex(0);
    setShowAnswer(false);
  };

  // Keyboard navigation for two-page flow
  const goToShowAnswer = useCallback(() => {
    setShowAnswer(true);
  }, []);

  const goToPrevious = useCallback(() => {
    if (showAnswer) {
      setShowAnswer(false);
    }
  }, [showAnswer]);

  const goToNext = useCallback(() => {
    if (showAnswer && currentIndex < mistakes.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowAnswer(false);
    }
  }, [showAnswer, currentIndex, mistakes.length]);

  const swipeRef = useSwipe<HTMLDivElement>({
    enabled: reviewing,
    onSwipeLeft: () => {
      if (!showAnswer) {
        setShowAnswer(true);
        return;
      }

      if (currentIndex < mistakes.length - 1) {
        setCurrentIndex((prev) => prev + 1);
        setShowAnswer(false);
      }
    },
    onSwipeRight: () => {
      if (showAnswer) {
        setShowAnswer(false);
      }
    },
  });

  useEffect(() => {
    if (!reviewing) return;

    const handler = (e: KeyboardEvent) => {
      // Don't interfere with input fields
      if (document.activeElement instanceof HTMLInputElement ||
          document.activeElement instanceof HTMLTextAreaElement) {
        return;
      }

      // PAGE 1 (no answer shown)
      if (!showAnswer) {
        if (e.key === "ArrowRight") {
          goToShowAnswer();
        }
        return;
      }

      // PAGE 2 (answer shown)
      if (showAnswer) {
        if (e.key === "ArrowLeft") {
          goToPrevious();
        }
        if (e.key === "ArrowRight") {
          goToNext();
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [reviewing, showAnswer, goToShowAnswer, goToPrevious, goToNext]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!reviewing) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">开始复习</h1>
            <Link href="/" className="text-sm font-medium text-blue-600 hover:text-blue-800">
              返回首页
            </Link>
          </div>

          <div className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200 md:p-8">
            {errorMessage && (
              <div className="mb-6 rounded-2xl border border-red-300 bg-red-100 px-4 py-3 text-red-700">
                {errorMessage}
              </div>
            )}
            <div className="mb-6">
              <div className="mb-4 text-5xl">📚</div>
              <h2 className="mb-2 text-xl font-semibold text-slate-800 md:text-2xl">
                准备开始
              </h2>
              <p className="text-base text-slate-600 md:text-lg">
                今天有 {mistakes.length} 条内容等待复习。
              </p>
            </div>

            <div className="space-y-4">
              <button
                onClick={startReview}
                disabled={mistakes.length === 0}
                className="w-full rounded-2xl bg-blue-600 px-8 py-4 text-base font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400 md:w-auto md:text-lg"
              >
                {mistakes.length === 0 ? '今天没有待复习内容' : '开始复习'}
              </button>

              {mistakes.length === 0 && (
                <Link
                  href="/add"
                  className="block text-sm text-blue-600 hover:text-blue-800"
                >
                  去添加一些内容
                </Link>
              )}

              <button
                onClick={fetchTodayMistakes}
                className="block w-full text-sm text-blue-600 hover:text-blue-800"
              >
                刷新列表
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentMistake = mistakes[currentIndex];
  // v2.0: 获取当前内容类型的配置
  const config = getContentTypeConfig(currentMistake?.content_type || 'mistake');

  if (!currentMistake) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md space-y-4 rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">没有可复习内容</h2>
          <p className="text-slate-600">
            可以先刷新列表，或者回去添加新内容。
          </p>
          <div className="space-x-2">
            <button
              onClick={fetchTodayMistakes}
              className="rounded-xl bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
            >
              刷新
            </button>
            <Link
              href="/add"
              className="inline-block rounded-xl bg-slate-100 px-4 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-200"
            >
              添加
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const progress = mistakes.length > 0 ? ((currentIndex + 1) / mistakes.length) * 100 : 0;
  const stage = currentMistake.review_stage ?? 0;
  const stageInfo = getStageInfo(stage);
  const stageProgress = Math.min(100, Math.max(8, ((stage + 1) / 11) * 100));
  const reviewCount = currentMistake.review_count ?? 0;
  const previousInterval = currentMistake.previous_interval;
  const lastScoreLabel =
    typeof currentMistake.last_score === 'number'
      ? scoreLabels[currentMistake.last_score] ?? '未知'
      : '未评分';

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-5 md:px-6 md:py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-500">复习中</p>
            <h1 className="text-xl font-bold text-slate-900 md:text-2xl">第 {currentIndex + 1} / {mistakes.length} 条</h1>
          </div>
          <Link href="/" className="text-sm font-medium text-blue-600 hover:text-blue-800">
            退出
          </Link>
        </div>

        <div className="mb-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="mb-2 flex justify-between text-sm font-medium text-slate-600">
            <span>
              进度 {currentIndex + 1} / {mistakes.length}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200">
            <div
              className="h-2 rounded-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="mb-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-bold text-white ${stageInfo.tone}`}>
                {stage}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-900">{stageInfo.label}</p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                    Stage {stage}
                  </span>
                </div>
                <p className="text-sm text-slate-500">{stageInfo.description}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center sm:min-w-72">
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">已复习</p>
                <p className="text-sm font-semibold text-slate-900">{reviewCount} 次</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">上次</p>
                <p className="text-sm font-semibold text-slate-900">{lastScoreLabel}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">下次</p>
                <p className="text-sm font-semibold text-slate-900">
                  {formatReviewDate(currentMistake.next_review_at)}
                </p>
              </div>
            </div>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${stageInfo.tone}`}
              style={{ width: `${stageProgress}%` }}
            />
          </div>
          {typeof previousInterval === 'number' && previousInterval > 0 && (
            <p className="mt-2 text-xs text-slate-500">当前记忆间隔约 {previousInterval} 天。</p>
          )}
        </div>

        <div
          ref={swipeRef}
          className="mb-28 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 md:mb-8 md:p-8"
        >
          {config.label === 'Expression' ? (
            <ExpressionCard
              originalExpression={currentMistake.error_sentence}
              improvedExpression={currentMistake.correct_sentence}
              explanation={currentMistake.explanation}
              showAnswer={showAnswer}
            />
          ) : (
            <MistakeCard
              errorSentence={currentMistake.error_sentence}
              correctSentence={currentMistake.correct_sentence}
              explanation={currentMistake.explanation}
              showAnswer={showAnswer}
            />
          )}
        </div>

        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-40 px-4 md:static md:px-0">
          <div className="mx-auto max-w-4xl rounded-[1.75rem] border border-slate-200 bg-white/98 p-3 shadow-lg backdrop-blur md:border-0 md:bg-transparent md:p-0 md:shadow-none">
            {!showAnswer ? (
              <button
                onClick={() => setShowAnswer(true)}
                className="w-full rounded-2xl bg-blue-600 px-6 py-4 text-base font-medium text-white transition-colors hover:bg-blue-700"
              >
                显示答案
              </button>
            ) : (
              <div className="space-y-3">
                <div className="px-1 text-center text-xs text-slate-400">
                  左滑查看下一条，右滑返回题面
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleReviewResponse(0)}
                    className="rounded-2xl bg-red-600 px-4 py-4 text-sm font-semibold text-white transition-colors hover:bg-red-700"
                  >
                    忘了
                  </button>
                  <button
                    onClick={() => handleReviewResponse(1)}
                    className="rounded-2xl bg-orange-500 px-4 py-4 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
                  >
                    困难
                  </button>
                  <button
                    onClick={() => handleReviewResponse(2)}
                    className="rounded-2xl bg-emerald-600 px-4 py-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                  >
                    还行
                  </button>
                  <button
                    onClick={() => handleReviewResponse(3)}
                    className="rounded-2xl bg-blue-600 px-4 py-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                  >
                    很熟
                  </button>
                </div>
                <button
                  onClick={() => setShowRetireModal(true)}
                  className="w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200"
                >
                  不再复习
                </button>
              </div>
            )}
          </div>
        </div>

        {showRetireModal && (
          <div className="fixed inset-0 z-50 flex items-end bg-slate-950/35 p-4 md:items-center md:justify-center">
            <div className="w-full max-w-sm rounded-[1.75rem] bg-white p-5 shadow-2xl ring-1 ring-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">停止复习这条内容？</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                这会把当前内容标记为已掌握，并从后续复习里移除。
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowRetireModal(false)}
                  className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    setShowRetireModal(false);
                    handleRetire();
                  }}
                  className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-red-700"
                >
                  确认移除
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
