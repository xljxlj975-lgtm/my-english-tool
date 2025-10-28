'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Mistake {
  id: string;
  error_sentence: string;
  correct_sentence: string;
  explanation?: string;
  type: string;
  status: string;
}

export default function ReviewPage() {
  const router = useRouter();
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    fetchTodayMistakes();
  }, []);

  const fetchTodayMistakes = async () => {
    try {
      const response = await fetch('/api/mistakes?todayReview=true');
      const data = await response.json();
      setMistakes(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching today\'s mistakes:', error);
      setLoading(false);
    }
  };

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

      setCompletedCount(prev => prev + 1);

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
      alert('No mistakes to review today!');
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
            <div className="mb-6">
              <div className="text-6xl mb-4">📚</div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">
                Ready to Review?
              </h2>
              <p className="text-gray-600 text-lg">
                You have {mistakes.length} mistakes to review today.
              </p>            </div>

            <div className="space-y-4">
              <button
                onClick={startReview}
                disabled={mistakes.length === 0}
                className="bg-blue-600 text-white px-8 py-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-lg"
              >
                {mistakes.length === 0 ? 'No Mistakes Today' : 'Start Review'}
              </button>

              {mistakes.length === 0 && (
                <Link
                  href="/add"
                  className="block text-blue-600 hover:text-blue-800"
                >
                  Add some mistakes to get started
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentMistake = mistakes[currentIndex];
  const progress = ((currentIndex + 1) / mistakes.length) * 100;

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

        {/* Flashcard */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6 min-h-[300px] flex flex-col justify-center">
          {!showAnswer ? (
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-600 mb-4">What's wrong with this sentence?</h2>
              <p className="text-2xl text-gray-800 leading-relaxed">
                {currentMistake.error_sentence}
              </p>
              <div className="mt-8">
                <button
                  onClick={() => setShowAnswer(true)}
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Show Answer
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <h2 className="text-lg font-semibold text-green-600 mb-4">Correct Answer:</h2>
              <p className="text-2xl text-gray-800 leading-relaxed mb-6">
                {currentMistake.correct_sentence}
              </p>

              {currentMistake.explanation && (
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6 text-left">
                  <p className="text-gray-700">
                    <strong className="text-blue-800">Explanation:</strong> {currentMistake.explanation}
                  </p>
                </div>
              )}

              <div className="text-sm text-gray-500 mb-6">
                <span className="bg-gray-100 px-3 py-1 rounded-full mr-2">
                  Type: {currentMistake.type}
                </span>
              </div>

              <div className="flex justify-center space-x-4">
                <button
                  onClick={() => handleReviewResponse(false)}
                  className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  🔄 Need More Practice
                </button>
                <button
                  onClick={() => handleReviewResponse(true)}
                  className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  ✅ Got It!
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}