'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';

const DEMO_ACCOUNTS = [
  { label: 'Demo Admin', email: 'admin@demo.com', password: 'demo1234', role: 'admin', color: 'bg-navy hover:bg-navy-light' },
  { label: 'Demo User', email: 'user@demo.com', password: 'demo1234', role: 'user', color: 'bg-gray-600 hover:bg-gray-700' },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  async function login(loginEmail: string, loginPassword: string) {
    setError('');
    setLoading(true);
    try {
      const { data } = await axios.post('/api/auth/login', { email: loginEmail, password: loginPassword });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      router.push('/dashboard');
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err) ? err.response?.data?.error || 'Login failed' : 'Login failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await login(email, password);
  }

  async function handleDemoLogin(demoEmail: string, demoPassword: string) {
    setSeeding(true);
    setError('');
    try {
      // Ensure demo accounts exist before logging in
      await axios.post('/api/auth/seed-demo');
    } catch {
      // seed may fail if already seeded — that's fine
    } finally {
      setSeeding(false);
    }
    await login(demoEmail, demoPassword);
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-navy rounded-xl mb-4">
            <span className="text-white font-bold text-lg">IP</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">IP Law Firm</h1>
          <p className="text-sm text-gray-500 mt-1">Quotation Management System</p>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Sign in to your account</h2>

          {/* Demo access buttons */}
          <div className="mb-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Quick Demo Access
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleDemoLogin(acc.email, acc.password)}
                  disabled={loading || seeding}
                  className={`${acc.color} text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {seeding || loading ? '...' : acc.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              password: <span className="font-mono">demo1234</span>
            </p>
          </div>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs text-gray-400 bg-white px-2">
              or sign in with your account
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="label">Password</label>
                <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="btn-primary w-full justify-center" disabled={loading || seeding}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-primary font-medium hover:underline">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
