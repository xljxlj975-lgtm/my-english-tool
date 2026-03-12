'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getContentTypeConfig, type ContentType } from '@/lib/content-type';
import { useToast } from '@/components/ToastProvider';

function AddMistakeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // v2.0: 内容类型
  const [contentType, setContentType] = useState<ContentType>('mistake');

  // Batch entry form
  const [batchText, setBatchText] = useState('');

  // v2.0: 从URL参数读取内容类型
  useEffect(() => {
    const typeParam = searchParams.get('type');
    if (typeParam === 'expression') {
      setContentType('expression');
    }
  }, [searchParams]);

  // v2.0: 获取当前内容类型的配置
  const config = getContentTypeConfig(contentType);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('[批量添加] 开始提交...', { batchText });
      
      const response = await fetch('/api/mistakes/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batchText,
          content_type: contentType, // v2.0: 包含内容类型
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
      showToast(`成功添加 ${result.count} 条记录。`, 'success');
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
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">添加内容</h1>
          <Link href="/" className="text-sm font-medium text-blue-600 hover:text-blue-800">
            返回首页
          </Link>
        </div>
        <div className="mb-8">
          <p className="text-sm text-slate-600">
            统一在一个输入框里添加内容，支持 1 条或多条。
          </p>
        </div>

        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 md:p-6">
          {error && (
            <div className="mb-4 rounded-2xl border border-red-400 bg-red-100 px-4 py-3 text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                内容类型
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setContentType('mistake')}
                  className={`rounded-2xl border-2 px-4 py-3 transition-all ${
                    contentType === 'mistake'
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-slate-300 hover:border-red-300'
                  }`}
                >
                  <div className="mb-1 text-2xl">❌</div>
                  <div className="font-medium">Mistake</div>
                </button>
                <button
                  type="button"
                  onClick={() => setContentType('expression')}
                  className={`rounded-2xl border-2 px-4 py-3 transition-all ${
                    contentType === 'expression'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-300 hover:border-blue-300'
                  }`}
                >
                  <div className="mb-1 text-2xl">💡</div>
                  <div className="font-medium">Expression</div>
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                添加内容
              </label>
              <p className="mb-2 text-sm text-slate-600">
                每行一条：{config.errorLabel} | {config.correctLabel} | Explanation（可选）
              </p>
              <textarea
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 font-mono text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={10}
                required
                placeholder="I have went to school | I have gone to school | 使用have时应该用过去分词&#10;He don't like it | He doesn't like it | 第三人称单数用doesn't"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-blue-600 px-6 py-4 font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-blue-400"
            >
              {loading ? '添加中...' : '保存内容'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function AddMistakePage() {
  return (
    <Suspense fallback={<div className="p-4 text-gray-500">Loading...</div>}>
      <AddMistakeContent />
    </Suspense>
  );
}
