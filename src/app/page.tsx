'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface DashboardData {
  todayReviewCount: number;
  totalMistakes: number;
  learnedMistakes: number;
  unlearnedMistakes: number;
  mistakesByType: Array<{ type: string; count: number }>;
  recentMistakes: Array<{ date: string; count: number }>;
  streak: number;
  lastUpdated: string;
}

export default function Home() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/dashboard');
      const data = await response.json();
      setDashboardData(data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
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

        {/* Today's Review Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-2xl font-semibold text-gray-800">
                Today&apos;s Review
              </h2>
              <p className="text-gray-600">
                {dashboardData.todayReviewCount} mistakes to review
              </p>
            </div>
            <Link
              href="/review"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Start Review ▶
            </Link>
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

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            href="/add"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <div className="text-center">
              <div className="text-4xl mb-4">➕</div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Add Mistake</h3>
              <p className="text-gray-600">Add a new mistake to review</p>
            </div>
          </Link>

          <Link
            href="/library"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <div className="text-center">
              <div className="text-4xl mb-4">📚</div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Mistake Library</h3>
              <p className="text-gray-600">Browse and manage your mistakes</p>
            </div>
          </Link>

          <Link
            href="/calendar"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <div className="text-center">
              <div className="text-4xl mb-4">📅</div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Review Calendar</h3>
              <p className="text-gray-600">View your review schedule</p>
            </div>
          </Link>
        </div>

        {/* Mistakes by Type */}
        {dashboardData.mistakesByType.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mt-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Mistakes by Type</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {dashboardData.mistakesByType.map(({ type, count }) => (
                <div key={type} className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{count}</p>
                  <p className="text-sm text-gray-600 capitalize">{type}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
