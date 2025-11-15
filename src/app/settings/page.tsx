'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SettingsPage() {
  const router = useRouter();
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
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            ← Back to Dashboard
          </Link>
        </div>

        {/* Settings Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Daily Review Target</h2>
            <p className="text-gray-600 text-sm">
              Set your daily review goal. Items beyond this limit will go to backlog.
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[30, 50, 70, 100].map((target) => (
              <button
                key={target}
                onClick={() => setDailyTarget(target)}
                className={`p-4 rounded-lg border-2 transition-all ${
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
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors font-medium"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
          <h3 className="font-semibold text-blue-800 mb-2">How Daily Target Works</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Each day, up to {dailyTarget} items will be scheduled for review</li>
            <li>• Items beyond your daily target go into the backlog</li>
            <li>• You can clear backlog items separately when you have time</li>
            <li>• This helps prevent review overload and maintains consistent learning</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
