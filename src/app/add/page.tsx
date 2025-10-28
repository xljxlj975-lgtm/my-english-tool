'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const MISTAKE_TYPES = [
  { value: 'uncategorized', label: 'Uncategorized' },
  { value: 'grammar', label: 'Grammar' },
  { value: 'vocabulary', label: 'Vocabulary' },
  { value: 'collocation', label: 'Collocation' },
  { value: 'tense', label: 'Tense' },
  { value: 'pronunciation', label: 'Pronunciation' }
];

export default function AddMistake() {
  const router = useRouter();
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Single entry form
  const [errorSentence, setErrorSentence] = useState('');
  const [correctSentence, setCorrectSentence] = useState('');
  const [explanation, setExplanation] = useState('');
  const [type, setType] = useState('uncategorized');

  // Batch entry form
  const [batchText, setBatchText] = useState('');

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/mistakes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error_sentence: errorSentence,
          correct_sentence: correctSentence,
          explanation,
          type
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add mistake');
      }

      router.push('/');
    } catch (error) {
      setError('Failed to add mistake. Please try again.');
      console.error('Error adding mistake:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/mistakes/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batchText,
          type
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add batch mistakes');
      }

      const result = await response.json();
      alert(`Successfully added ${result.count} mistakes!`);
      router.push('/');
    } catch (error) {
      setError('Failed to add batch mistakes. Please try again.');
      console.error('Error adding batch mistakes:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">Add Mistake</h1>
            <Link href="/" className="text-blue-600 hover:text-blue-800">
              ← Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex space-x-4 mb-6">
            <button
              onClick={() => setMode('single')}
              className={`px-4 py-2 rounded-lg font-medium ${
                mode === 'single'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Single Entry
            </button>
            <button
              onClick={() => setMode('batch')}
              className={`px-4 py-2 rounded-lg font-medium ${
                mode === 'batch'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Batch Entry
            </button>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {mode === 'single' ? (
            <form onSubmit={handleSingleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Error Sentence *
                </label>
                <textarea
                  value={errorSentence}
                  onChange={(e) => setErrorSentence(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  required
                  placeholder="Enter the incorrect sentence..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Correct Sentence *
                </label>
                <textarea
                  value={correctSentence}
                  onChange={(e) => setCorrectSentence(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  required
                  placeholder="Enter the correct sentence..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Explanation
                </label>
                <textarea
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Optional explanation of the mistake..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {MISTAKE_TYPES.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors font-medium"
                >
                  {loading ? 'Adding...' : 'Add Mistake'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleBatchSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Batch Input
                </label>
                <p className="text-sm text-gray-600 mb-2">
                  Enter one mistake per line in format: error sentence | correct sentence | explanation (optional)
                </p>
                <textarea
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  rows={10}
                  required
                  placeholder="I have went to school | I have gone to school | Use past participle with have&#10;He don't like it | He doesn't like it | Use doesn't with third person singular"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {MISTAKE_TYPES.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors font-medium"
                >
                  {loading ? 'Adding...' : 'Add Batch'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}