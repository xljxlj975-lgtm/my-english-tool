'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ToastProvider';

export default function SettingsPage() {
  const { showToast } = useToast();
  const [dailyTarget, setDailyTarget] = useState(50);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/settings');
      const data = await response.json();

      if (response.ok) {
        setDailyTarget(data.daily_target);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccessMessage('');

      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ daily_target: dailyTarget }),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      setSuccessMessage('Settings saved successfully!');
      showToast('设置已保存。', 'success');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">设置</h1>
          <Link href="/" className="text-sm font-medium text-blue-600 hover:text-blue-800">
            返回首页
          </Link>
        </div>

        <div className="mb-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 md:p-6">
          <div className="mb-6">
            <h2 className="mb-2 text-xl font-semibold text-slate-800">每日复习目标</h2>
            <p className="text-sm text-slate-600">
              超过这个数量的内容会进入积压，留到之后继续处理。
            </p>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
              {successMessage}
            </div>
          )}

          {/* Daily Target Options */}
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {[30, 50, 70, 100, 150, 200].map((target) => (
              <button
                key={target}
                onClick={() => setDailyTarget(target)}
                className={`rounded-2xl border-2 p-4 transition-all ${
                  dailyTarget === target
                    ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-md'
                    : 'border-gray-300 hover:border-blue-400 hover:shadow'
                }`}
              >
                <div className="text-3xl font-bold mb-1">{target}</div>
                <div className="text-xs text-gray-600">per day</div>
              </button>
            ))}
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-2xl bg-blue-600 px-6 py-4 font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-blue-400"
          >
            {saving ? '保存中...' : '保存设置'}
          </button>
        </div>

        <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4">
          <h3 className="mb-2 font-semibold text-blue-800">说明</h3>
          <ul className="space-y-1 text-sm text-blue-700">
            <li>• 每天最多安排 {dailyTarget} 条进入复习</li>
            <li>• 超出的内容会留在积压里</li>
            <li>• 目标小一点更容易长期坚持</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
