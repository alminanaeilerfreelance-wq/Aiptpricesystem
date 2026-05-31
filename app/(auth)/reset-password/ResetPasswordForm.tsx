'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';

interface ResetPasswordFormProps {
  token: string;
}

export default function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post('/api/auth/reset-password', { token, password });
      setMessage(data.message || 'Password reset successfully.');
      setPassword('');
      setConfirm('');
    } catch (err: unknown) {
      const nextError =
        axios.isAxiosError(err) ? err.response?.data?.error || 'Failed to reset password' : 'Failed to reset password';
      setError(nextError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-navy rounded-xl mb-4">
            <span className="text-white font-bold text-lg">IP</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Reset password</h1>
          <p className="text-sm text-gray-500 mt-1">Create a new password for your account</p>
        </div>

        <div className="card p-6">
          {!token && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              Reset token is missing. Please request a new reset link.
            </div>
          )}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
          {message && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">New password</label>
              <input
                type="password"
                className="input"
                placeholder="Enter new password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                disabled={!token}
              />
            </div>
            <div>
              <label className="label">Confirm password</label>
              <input
                type="password"
                className="input"
                placeholder="Confirm new password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
                disabled={!token}
              />
            </div>
            <button type="submit" className="btn-primary w-full justify-center" disabled={loading || !token}>
              {loading ? 'Resetting...' : 'Reset password'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            Back to{' '}
            <Link href="/login" className="text-primary font-medium hover:underline">
              sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
