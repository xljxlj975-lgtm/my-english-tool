'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const MISTAKE_TYPES = [
  { value: 'uncategorized', label: '未分类' },
  { value: 'grammar', label: '语法' },
  { value: 'vocabulary', label: '词汇' },
  { value: 'collocation', label: '搭配' },
  { value: 'tense', label: '时态' },
  { value: 'pronunciation', label: '发音' }
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
      console.log('[单个添加] 开始提交...');
      
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

      console.log('[单个添加] 响应状态:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[单个添加] 错误详情:', errorData);
        throw new Error(errorData.error || '添加失败');
      }

      router.push('/');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '添加错误失败，请重试。';
      setError(errorMessage);
      console.error('[单个添加] 捕获错误:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('[批量添加] 开始提交...', { batchText, type });
      
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

      console.log('[批量添加] 响应状态:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[批量添加] 错误详情:', errorData);
        throw new Error(errorData.error || errorData.details || '批量添加失败');
      }

      const result = await response.json();
      console.log('[批量添加] 成功:', result);
      alert(`成功添加 ${result.count} 个错误记录！`);
      router.push('/');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '批量添加错误失败，请重试。';
      setError(errorMessage);
      console.error('[批量添加] 捕获错误:', error);
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
            <h1 className="text-3xl font-bold text-gray-900">添加错误</h1>
            <Link href="/" className="text-blue-600 hover:text-blue-800">
              ← 返回首页
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
              单个添加
            </button>
            <button
              onClick={() => setMode('batch')}
              className={`px-4 py-2 rounded-lg font-medium ${
                mode === 'batch'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              批量添加
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
                  错误句子 *
                </label>
                <textarea
                  value={errorSentence}
                  onChange={(e) => setErrorSentence(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  required
                  placeholder="输入错误的句子..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  正确句子 *
                </label>
                <textarea
                  value={correctSentence}
                  onChange={(e) => setCorrectSentence(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  required
                  placeholder="输入正确的句子..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  说明
                </label>
                <textarea
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="可选：对错误的说明..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  类型
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
                  {loading ? '添加中...' : '添加错误'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleBatchSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  批量输入
                </label>
                <p className="text-sm text-gray-600 mb-2">
                  每行输入一个错误，格式：错误句子 | 正确句子 | 说明（可选）
                </p>
                <textarea
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  rows={10}
                  required
                  placeholder="I have went to school | I have gone to school | 使用have时应该用过去分词&#10;He don't like it | He doesn't like it | 第三人称单数用doesn't"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  默认类型
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
                  {loading ? '添加中...' : '批量添加'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}