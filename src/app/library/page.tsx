'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ToastProvider';

interface Mistake {
  id: string;
  created_at: string;
  error_sentence: string;
  correct_sentence: string;
  explanation?: string;
  status: string;
  next_review_at: string;
  review_stage: number;
  review_count: number;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'unlearned', label: 'In Progress' },
  { value: 'learned', label: 'Learned' }
];

export default function LibraryPage() {
  const { showToast } = useToast();
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  const fetchMistakes = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const params = new URLSearchParams();

      if (debouncedSearch) params.append('search', debouncedSearch);
      if (statusFilter) params.append('status', statusFilter);

      const queryString = params.toString();
      const url = queryString ? `/api/mistakes?${queryString}` : '/api/mistakes';
      const response = await fetch(url);
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
            ? payload.error
            : 'Failed to fetch mistakes';
        throw new Error(message);
      }

      if (!Array.isArray(payload)) {
        throw new Error('Unexpected response format from /api/mistakes');
      }

      setMistakes(payload);
    } catch (error) {
      console.error('Error fetching mistakes:', error);
      setMistakes([]);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to fetch mistakes');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchMistakes();
  }, [fetchMistakes]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this mistake?')) {
      return;
    }

    try {
      const response = await fetch(`/api/mistakes/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMistakes(mistakes.filter(mistake => mistake.id !== id));
        showToast('已删除该条内容。', 'success');
      } else {
        showToast('删除失败，请重试。', 'error');
      }
    } catch (error) {
      console.error('Error deleting mistake:', error);
      showToast('删除失败，请重试。', 'error');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">题库</h1>
          <Link href="/" className="text-sm font-medium text-blue-600 hover:text-blue-800">
            返回首页
          </Link>
        </div>

        <div className="mb-6 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 md:p-6">
          {errorMessage && (
            <div className="mb-4 rounded-2xl border border-red-300 bg-red-100 px-4 py-3 text-red-700">
              {errorMessage}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">搜索</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索错误或正确表达..."
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">状态</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUS_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 text-sm text-slate-600">
            共显示 {mistakes.length} 条内容
          </div>
        </div>

        {mistakes.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 text-4xl">📚</div>
            <h2 className="mb-2 text-xl font-semibold text-slate-800">没有找到内容</h2>
            <p className="text-slate-600">
              {search || statusFilter
                ? '可以调整搜索词或筛选条件。'
                : '先添加一些内容再开始复习。'}
            </p>
            {!search && !statusFilter && (
              <Link
                href="/add"
                className="mt-4 inline-block rounded-2xl bg-blue-600 px-6 py-3 text-white transition-colors hover:bg-blue-700"
              >
                去添加
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {mistakes.map((mistake) => (
              <div key={mistake.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                    mistake.status === 'learned'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                    {mistake.status === 'learned' ? '已掌握' : '进行中'}
                  </span>
                  <button
                    onClick={() => handleDelete(mistake.id)}
                    className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
                  >
                    删除
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-500">Error</div>
                    <p className="text-sm leading-6 text-slate-800 md:text-base">{mistake.error_sentence}</p>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-600">Correct</div>
                    <p className="text-sm leading-6 text-slate-900 md:text-base">{mistake.correct_sentence}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm text-slate-600">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs text-slate-500">阶段</div>
                      <div className="mt-1 font-medium text-slate-900">{mistake.review_stage + 1}/5</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs text-slate-500">复习次数</div>
                      <div className="mt-1 font-medium text-slate-900">{mistake.review_count}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs text-slate-500">添加时间</div>
                      <div className="mt-1 font-medium text-slate-900">{formatDate(mistake.created_at)}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs text-slate-500">下次复习</div>
                      <div className="mt-1 font-medium text-slate-900">{formatDate(mistake.next_review_at)}</div>
                    </div>
                  </div>
                  {mistake.explanation && (
                    <details className="rounded-2xl bg-slate-50 px-4 py-3">
                      <summary className="cursor-pointer text-sm font-medium text-slate-700">查看说明</summary>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{mistake.explanation}</p>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
