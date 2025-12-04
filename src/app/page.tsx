'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface DashboardData {
  todayReviewCount: number;
  totalNeedsReview?: number; // v2.0修复: 所有需要复习的总数（包括积压）
  todayCompletedCount: number; // v2.0: 今日已完成
  backlogCount: number; // v2.0: 积压数量
  dailyTarget: number; // v2.0: Daily Target
  totalMistakes: number;
  learnedMistakes: number;
  unlearnedMistakes: number;
  recentMistakes: Array<{ date: string; count: number }>;
  streak: number;
  lastUpdated: string;
}

export default function Home() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const response = await fetch('/api/dashboard');
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload) {
        const message =
          (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string')
            ? payload.error
            : 'Failed to fetch dashboard data';
        throw new Error(message);
      }

      const safeData: DashboardData = {
        todayReviewCount: Number(payload.todayReviewCount) || 0,
        totalNeedsReview: Number(payload.totalNeedsReview) || 0, // v2.0修复: 总需要复习数
        todayCompletedCount: Number(payload.todayCompletedCount) || 0, // v2.0
        backlogCount: Number(payload.backlogCount) || 0, // v2.0
        dailyTarget: Number(payload.dailyTarget) || 50, // v2.0
        totalMistakes: Number(payload.totalMistakes) || 0,
        learnedMistakes: Number(payload.learnedMistakes) || 0,
        unlearnedMistakes: Number(payload.unlearnedMistakes) || 0,
        recentMistakes: Array.isArray(payload.recentMistakes) ? payload.recentMistakes : [],
        streak: Number(payload.streak) || 0,
        lastUpdated: typeof payload.lastUpdated === 'string' ? payload.lastUpdated : new Date().toISOString()
      };

      setDashboardData(safeData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setDashboardData(null);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md text-center space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">无法加载仪表盘</h2>
          <p className="text-gray-600">{errorMessage}</p>
          <button
            onClick={fetchDashboardData}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            重试
          </button>
        </div>
      </div>
    );
  }
  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-red-600">Error loading dashboard</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            English Mistake Review Tool
          </h1>
          <p className="text-gray-600">
            Master your English mistakes with spaced repetition
          </p>
        </div>

        {/* Today's Review Card - v2.0: 显示Daily Target进度 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex-1">
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">
                Today&apos;s Review
              </h2>
              {/* v2.0: Daily Target进度 */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-600">
                    Progress: {dashboardData.todayCompletedCount} / {dashboardData.dailyTarget}
                  </span>
                  <span className="text-sm text-gray-500">
                    {Math.round((dashboardData.todayCompletedCount / dashboardData.dailyTarget) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min((dashboardData.todayCompletedCount / dashboardData.dailyTarget) * 100, 100)}%` }}
                  />
                </div>
              </div>
              {/* v2.0修复: 显示待复习数量，区分今日目标和总积压 */}
              <p className="text-gray-600">
                <span className="font-semibold text-blue-600">{dashboardData.todayReviewCount}</span> items to review today
              </p>
              {/* v2.0修复: 更清晰的积压提示 */}
              {dashboardData.totalNeedsReview !== undefined && dashboardData.totalNeedsReview > dashboardData.dailyTarget && (
                <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-sm">
                  <p className="text-orange-700 font-medium">
                    📊 Total pending: {dashboardData.totalNeedsReview} items
                  </p>
                  <p className="text-orange-600 text-xs mt-1">
                    You have {dashboardData.totalNeedsReview - dashboardData.dailyTarget} items beyond today&apos;s target.
                    Keep reviewing daily to clear the backlog!
                  </p>
                </div>
              )}
            </div>
            <div className="flex flex-col space-y-2 ml-4">
              {dashboardData.todayReviewCount > 0 ? (
                <Link
                  href="/review"
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium text-center whitespace-nowrap"
                >
                  Start Review ▶
                </Link>
              ) : (
                <div className="bg-green-100 text-green-700 px-6 py-3 rounded-lg font-medium text-center whitespace-nowrap">
                  ✓ All Done!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Mistakes</h3>
            <p className="text-3xl font-bold text-blue-600">{dashboardData.totalMistakes}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Learned</h3>
            <p className="text-3xl font-bold text-green-600">{dashboardData.learnedMistakes}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">In Progress</h3>
            <p className="text-3xl font-bold text-orange-600">{dashboardData.unlearnedMistakes}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Streak</h3>
            <p className="text-3xl font-bold text-purple-600">{dashboardData.streak} days</p>
          </div>
        </div>

        {/* Quick Actions - v2.0: 分离Mistake和Expression入口 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link
            href="/add?type=mistake"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <div className="text-center">
              <div className="text-4xl mb-4">❌</div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Add Mistake</h3>
              <p className="text-gray-600 text-sm">Add error corrections</p>
            </div>
          </Link>

          <Link
            href="/add?type=expression"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <div className="text-center">
              <div className="text-4xl mb-4">💡</div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Add Expression</h3>
              <p className="text-gray-600 text-sm">Add better expressions</p>
            </div>
          </Link>

          <Link
            href="/library"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <div className="text-center">
              <div className="text-4xl mb-4">📚</div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Library</h3>
              <p className="text-gray-600 text-sm">Browse and manage</p>
            </div>
          </Link>

          <Link
            href="/settings"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <div className="text-center">
              <div className="text-4xl mb-4">⚙️</div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Settings</h3>
              <p className="text-gray-600 text-sm">Daily target config</p>
            </div>
          </Link>
        </div>

      </div>
    </div>
  );
}
