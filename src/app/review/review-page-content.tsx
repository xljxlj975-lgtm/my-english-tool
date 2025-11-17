'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getContentTypeConfig, type ContentType } from '@/lib/content-type';

interface Mistake {
  id: string;
  error_sentence: string;
  correct_sentence: string;
  explanation?: string;
  type: string;
  status: string;
  content_type?: ContentType; // v2.0: 内容类型
}

export default function ReviewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams?.get('mode') || 'today';
  const modeLabel = useMemo(() => {
    switch (mode) {
      case 'backlog':
        return 'backlog items';
      case 'continue':
        return 'extra backlog items';
      default:
        return "today's mistakes";
    }
  }, [mode]);
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchReviewItems = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const params = new URLSearchParams();
      if (mode) {
        params.set('mode', mode);
      }
      const response = await fetch(`/api/review-queue?${params.toString()}`);
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
            ? payload.error
            : "Failed to fetch today's mistakes";
        throw new Error(message);
      }

      if (!Array.isArray(payload)) {
        throw new Error('Unexpected response format from /api/review-queue');
      }

      setMistakes(payload);
      setReviewing(false);
      setCurrentIndex(0);
      setShowAnswer(false);
    } catch (error) {
      console.error('Error fetching review items:', error);
      setMistakes([]);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to fetch review queue');
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    fetchReviewItems();
  }, [fetchReviewItems]);

  const handleReviewResponse = async (isCorrect: boolean) => {
    if (currentIndex >= mistakes.length) return;

    const currentMistake = mistakes[currentIndex];

    try {
      const response = await fetch(`/api/mistakes/${currentMistake.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isCorrect }),
      });

      if (!response.ok) {
        throw new Error('Failed to update mistake');
      }

      // Move to next card
      if (currentIndex < mistakes.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setShowAnswer(false);
      } else {
        // Review completed
        alert(`Review completed! You reviewed ${mistakes.length} mistakes.`);
        router.push('/');
      }
    } catch (error) {
      console.error('Error updating mistake:', error);
      alert('Error updating mistake. Please try again.');
    }
  };

  const startReview = () => {
    if (mistakes.length === 0) {
      alert('No mistakes to review in this mode!');
      return;
    }
    setReviewing(true);
    setCurrentIndex(0);
    setShowAnswer(false);
  };

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
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">Ready to Review?</h2>
              <p className="text-gray-600 text-lg">
                You have {mistakes.length} {modeLabel} to review.
              </p>
            </div>

            <div className="space-y-4">
              <button
                onClick={startReview}
                disabled={mistakes.length === 0}
                className="bg-blue-600 text-white px-8 py-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-lg"
              >
                {mistakes.length === 0 ? 'No Mistakes Today' : 'Start Review'}
              </button>

              {mistakes.length === 0 && (mode === 'backlog' ? (
                <Link href="/review" className="block text-blue-600 hover:text-blue-800">
                  Switch to today&apos;s queue
                </Link>
              ) : (
                <Link href="/add" className="block text-blue-600 hover:text-blue-800">
                  Add some mistakes to get started
                </Link>
              ))}

              <button onClick={fetchReviewItems} className="block w-full mt-4 text-blue-600 hover:text-blue-800">
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
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">Great job!</h2>
          <p className="text-gray-600 text-lg">You&apos;ve completed all reviews.</p>
          <div className="mt-6">
            <button
              onClick={() => {
                setReviewing(false);
                fetchReviewItems();
              }}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              Start Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Review Session</h1>
            <p className="text-gray-600">Mistake {currentIndex + 1} of {mistakes.length}</p>
          </div>
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            ← Back to Dashboard
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="mb-6">
            <div className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium mb-4">
              {config.label}
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">{config.title}</h2>
            <p className="text-lg text-gray-800 whitespace-pre-wrap">{currentMistake.error_sentence}</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setShowAnswer(true)}
              className="w-full bg-gray-100 text-gray-800 px-6 py-4 rounded-lg hover:bg-gray-200 text-lg"
              disabled={showAnswer}
            >
              Reveal Answer
            </button>

            {showAnswer && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-left">
                <h3 className="text-xl font-semibold text-green-800 mb-4">Correct Answer</h3>
                <p className="text-lg text-gray-800 whitespace-pre-wrap mb-4">{currentMistake.correct_sentence}</p>
                {currentMistake.explanation && (
                  <div className="bg-white rounded-lg p-4 border border-gray-100">
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">Explanation</h4>
                    <p className="text-gray-700 whitespace-pre-wrap">{currentMistake.explanation}</p>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => handleReviewResponse(false)}
                className="bg-red-50 text-red-700 px-6 py-4 rounded-lg hover:bg-red-100 text-lg"
              >
                I still need practice
              </button>
              <button
                onClick={() => handleReviewResponse(true)}
                className="bg-green-600 text-white px-6 py-4 rounded-lg hover:bg-green-700 text-lg"
              >
                I got it right
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
