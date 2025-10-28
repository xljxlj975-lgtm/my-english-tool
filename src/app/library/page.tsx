'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Mistake {
  id: string;
  created_at: string;
  error_sentence: string;
  correct_sentence: string;
  explanation?: string;
  type: string;
  status: string;
  next_review_at: string;
  review_stage: number;
  review_count: number;
}

const MISTAKE_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'uncategorized', label: 'Uncategorized' },
  { value: 'grammar', label: 'Grammar' },
  { value: 'vocabulary', label: 'Vocabulary' },
  { value: 'collocation', label: 'Collocation' },
  { value: 'tense', label: 'Tense' },
  { value: 'pronunciation', label: 'Pronunciation' }
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'unlearned', label: 'In Progress' },
  { value: 'learned', label: 'Learned' }
];

export default function LibraryPage() {
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchMistakes();
  }, [search, typeFilter, statusFilter]);

  const fetchMistakes = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (search) params.append('search', search);
      if (typeFilter) params.append('type', typeFilter);
      if (statusFilter) params.append('status', statusFilter);

      const response = await fetch(`/api/mistakes?${params.toString()}`);
      const data = await response.json();
      setMistakes(data);
    } catch (error) {
      console.error('Error fetching mistakes:', error);
    } finally {
      setLoading(false);
    }
  };

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
      } else {
        alert('Failed to delete mistake');
      }
    } catch (error) {
      console.error('Error deleting mistake:', error);
      alert('Error deleting mistake');
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
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Mistake Library</h1>
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            ← Back to Dashboard
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search mistakes..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {MISTAKE_TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUS_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            Showing {mistakes.length} mistake{mistakes.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Mistakes List */}
        {mistakes.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="text-4xl mb-4">📚</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">No Mistakes Found</h2>
            <p className="text-gray-600">
              {search || typeFilter || statusFilter
                ? 'Try adjusting your filters or search terms.'
                : 'Add some mistakes to get started!'}
            </p>
            {!search && !typeFilter && !statusFilter && (
              <Link
                href="/add"
                className="inline-block mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Your First Mistake
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {mistakes.map((mistake) => (
              <div key={mistake.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                  <div className="lg:col-span-2">
                    <div className="mb-3">
                      <span className="text-sm font-medium text-red-600 block mb-1">Error:</span>
                      <p className="text-gray-800">{mistake.error_sentence}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-green-600 block mb-1">Correct:</span>
                      <p className="text-gray-800">{mistake.correct_sentence}</p>
                    </div>
                  </div>

                  <div className="lg:col-span-1">
                    <div className="mb-2">
                      <span className="text-sm text-gray-600">Type: </span>
                      <span className="text-sm font-medium capitalize">{mistake.type}</span>
                    </div>
                    <div className="mb-2">
                      <span className="text-sm text-gray-600">Status: </span>
                      <span className={`text-sm font-medium ${
                        mistake.status === 'learned' ? 'text-green-600' : 'text-orange-600'
                      }`}>
                        {mistake.status === 'learned' ? 'Learned' : 'In Progress'}
                      </span>
                    </div>
                    <div className="mb-2">
                      <span className="text-sm text-gray-600">Stage: </span>
                      <span className="text-sm font-medium">{mistake.review_stage + 1}/5</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Reviews: </span>
                      <span className="text-sm font-medium">{mistake.review_count}</span>
                    </div>
                  </div>

                  <div className="lg:col-span-1">
                    <div className="mb-2">
                      <span className="text-sm text-gray-600">Added: </span>
                      <span className="text-sm font-medium">{formatDate(mistake.created_at)}</span>
                    </div>
                    <div className="mb-2">
                      <span className="text-sm text-gray-600">Next Review: </span>
                      <span className="text-sm font-medium">{formatDate(mistake.next_review_at)}</span>
                    </div>
                    {mistake.explanation && (
                      <div className="mb-3">
                        <span className="text-sm text-gray-600 block">Explanation:</span>
                        <p className="text-sm text-gray-800">{mistake.explanation}</p>
                      </div>
                    )}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleDelete(mistake.id)}
                        className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}