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
    <div className="min-h-screen bg-slate-50 px-4 py-5 md:px-6 md:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 md:mb-8">
          <p className="mb-2 text-sm font-medium text-blue-600">今日学习</p>
          <h1 className="text-2xl font-bold text-slate-900 md:text-4xl">
            先把今天该复习的内容清掉
          </h1>
          <p className="mt-2 text-sm text-slate-600 md:text-base">
            首页只保留最重要的信息，打开后能直接开始复习。
          </p>
        </div>

        <div className="mb-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 md:p-6">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <h2 className="mb-2 text-xl font-semibold text-slate-900 md:text-2xl">
                今日复习
              </h2>
              <div className="mb-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">
                    已完成 {dashboardData.todayCompletedCount} / {dashboardData.dailyTarget}
                  </span>
                  <span className="text-sm text-slate-500">
                    {Math.round((dashboardData.todayCompletedCount / dashboardData.dailyTarget) * 100)}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${Math.min((dashboardData.todayCompletedCount / dashboardData.dailyTarget) * 100, 100)}%` }}
                  />
                </div>
              </div>
              <p className="text-sm text-slate-600 md:text-base">
                今天还有 <span className="font-semibold text-blue-600">{dashboardData.todayReviewCount}</span> 条需要复习
              </p>
              {dashboardData.totalNeedsReview !== undefined && dashboardData.totalNeedsReview > dashboardData.dailyTarget && (
                <div className="mt-3 rounded-2xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm">
                  <p className="font-medium text-orange-700">
                    当前累计待复习 {dashboardData.totalNeedsReview} 条
                  </p>
                  <p className="mt-1 text-xs text-orange-600">
                    其中有 {dashboardData.totalNeedsReview - dashboardData.dailyTarget} 条超出今日目标，按天清理就行。
                  </p>
                </div>
              )}
            </div>
            <div className="w-full sm:ml-4 sm:w-auto">
              {dashboardData.todayReviewCount > 0 ? (
                <Link
                  href="/review"
                  className="block rounded-2xl bg-blue-600 px-6 py-4 text-center text-base font-medium text-white transition-colors hover:bg-blue-700"
                >
                  开始复习
                </Link>
              ) : (
                <div className="rounded-2xl bg-emerald-100 px-6 py-4 text-center font-medium text-emerald-700">
                  今日已完成
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6">
          <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 md:p-6">
            <h3 className="mb-2 text-sm font-semibold text-slate-600 md:text-base">总条目</h3>
            <p className="text-2xl font-bold text-blue-600 md:text-3xl">{dashboardData.totalMistakes}</p>
          </div>
          <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 md:p-6">
            <h3 className="mb-2 text-sm font-semibold text-slate-600 md:text-base">已掌握</h3>
            <p className="text-2xl font-bold text-emerald-600 md:text-3xl">{dashboardData.learnedMistakes}</p>
          </div>
          <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 md:p-6">
            <h3 className="mb-2 text-sm font-semibold text-slate-600 md:text-base">进行中</h3>
            <p className="text-2xl font-bold text-orange-600 md:text-3xl">{dashboardData.unlearnedMistakes}</p>
          </div>
          <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 md:p-6">
            <h3 className="mb-2 text-sm font-semibold text-slate-600 md:text-base">连续天数</h3>
            <p className="text-2xl font-bold text-violet-600 md:text-3xl">{dashboardData.streak} 天</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6">
          <Link
            href="/add?type=mistake"
            className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition-shadow hover:shadow-md"
          >
            <div className="text-center">
              <div className="mb-3 text-3xl md:text-4xl">❌</div>
              <h3 className="mb-1 text-base font-semibold text-slate-800 md:text-lg">添加错误</h3>
              <p className="text-xs text-slate-600 md:text-sm">记录需要纠正的句子</p>
            </div>
          </Link>

          <Link
            href="/add?type=expression"
            className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition-shadow hover:shadow-md"
          >
            <div className="text-center">
              <div className="mb-3 text-3xl md:text-4xl">💡</div>
              <h3 className="mb-1 text-base font-semibold text-slate-800 md:text-lg">添加表达</h3>
              <p className="text-xs text-slate-600 md:text-sm">记录更自然的表达方式</p>
            </div>
          </Link>

          <Link
            href="/library"
            className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition-shadow hover:shadow-md"
          >
            <div className="text-center">
              <div className="mb-3 text-3xl md:text-4xl">📚</div>
              <h3 className="mb-1 text-base font-semibold text-slate-800 md:text-lg">题库</h3>
              <p className="text-xs text-slate-600 md:text-sm">浏览并管理全部内容</p>
            </div>
          </Link>

          <Link
            href="/settings"
            className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition-shadow hover:shadow-md"
          >
            <div className="text-center">
              <div className="mb-3 text-3xl md:text-4xl">⚙️</div>
              <h3 className="mb-1 text-base font-semibold text-slate-800 md:text-lg">设置</h3>
              <p className="text-xs text-slate-600 md:text-sm">调整每日复习目标</p>
            </div>
          </Link>

          <Link
            href="/calendar"
            className="col-span-2 rounded-3xl bg-slate-900 p-5 text-white shadow-sm md:col-span-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-300">次级入口</p>
                <h3 className="mt-1 text-lg font-semibold">查看复习日历</h3>
                <p className="mt-1 text-sm text-slate-300">按日期看未来复习分布和当天安排。</p>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-sm">打开</span>
            </div>
          </Link>
        </div>

      </div>
    </div>
  );
}
