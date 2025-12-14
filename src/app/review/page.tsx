'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getContentTypeConfig, type ContentType } from '@/lib/content-type';
import MistakeCard from '@/components/MistakeCard';
import ExpressionCard from '@/components/ExpressionCard';

interface Mistake {
  id: string;
  error_sentence: string;
  correct_sentence: string;
  explanation?: string;
  status: string;
  content_type?: ContentType; // v2.0: 内容类型
}

export default function ReviewPage() {
  const router = useRouter();
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
  const handleReviewResponse = async (score: 0 | 1 | 2 | 3) => {
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
        const itemLabel = mistakes.length === 1 ? 'item' : 'items';
        alert(`Review completed! You reviewed ${mistakes.length} ${itemLabel}.`);
        router.push('/');
      }
    } catch (error) {
      console.error('Error updating mistake:', error);
      alert('Error updating mistake. Please try again.');
    }
  };

  const handleRetire = async () => {
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
        const itemLabel = mistakes.length === 1 ? 'item' : 'items';
        alert(`Review completed! You reviewed ${mistakes.length} ${itemLabel}.`);
        router.push('/');
      }
    } catch (error) {
      console.error('Error retiring item:', error);
      alert('Error retiring item. Please try again.');
    }
  };

  const startReview = () => {
    if (mistakes.length === 0) {
      alert('No items to review today!');
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
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Review Session</h1>
            <Link href="/" className="text-blue-600 hover:text-blue-800">
              ← Back to Dashboard
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            {errorMessage && (
              <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded mb-6">
                {errorMessage}
              </div>
            )}
            <div className="mb-6">
              <div className="text-6xl mb-4">📚</div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">
                Ready to Review?
              </h2>
              <p className="text-gray-600 text-lg">
                You have {mistakes.length} {mistakes.length === 1 ? 'item' : 'items'} to review today.
              </p>
            </div>

            <div className="space-y-4">
              <button
                onClick={startReview}
                disabled={mistakes.length === 0}
                className="bg-blue-600 text-white px-8 py-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-lg"
              >
                {mistakes.length === 0 ? 'Nothing to Review Today' : 'Start Review'}
              </button>

              {mistakes.length === 0 && (
                <Link
                  href="/add"
                  className="block text-blue-600 hover:text-blue-800"
                >
                  Add some items to get started
                </Link>
              )}

              <button
                onClick={fetchTodayMistakes}
                className="block w-full mt-4 text-blue-600 hover:text-blue-800"
              >
                Refresh list
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
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md text-center space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">No items to review</h2>
          <p className="text-gray-600">
            Try refreshing the list or adding new items before starting a session.
          </p>
          <div className="space-x-2">
            <button
              onClick={fetchTodayMistakes}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Refresh
            </button>
            <Link
              href="/add"
              className="inline-block bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Add Item
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const progress = mistakes.length > 0 ? ((currentIndex + 1) / mistakes.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Review Session</h1>
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            ← Exit
          </Link>
        </div>

        {/* Progress Bar */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-600">
              Progress: {currentIndex + 1} / {mistakes.length}
            </span>
            <span className="text-sm font-medium text-gray-600">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Flashcard - render different components based on content type */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6 min-h-[300px] flex flex-col justify-center">
          {config.label === 'Expression' ? (
            <ExpressionCard
              originalExpression={currentMistake.error_sentence}
              improvedExpression={currentMistake.correct_sentence}
              explanation={currentMistake.explanation}
              showAnswer={showAnswer}
              onShowAnswer={() => setShowAnswer(true)}
              onScore={handleReviewResponse}
              onRetire={handleRetire}
            />
          ) : (
            <MistakeCard
              errorSentence={currentMistake.error_sentence}
              correctSentence={currentMistake.correct_sentence}
              explanation={currentMistake.explanation}
              showAnswer={showAnswer}
              onShowAnswer={() => setShowAnswer(true)}
              onScore={handleReviewResponse}
              onRetire={handleRetire}
            />
          )}
        </div>
      </div>
    </div>
  );
}
