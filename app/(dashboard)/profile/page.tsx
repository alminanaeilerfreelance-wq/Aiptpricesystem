'use client';

import React, { useState } from 'react';
import Topbar from '@/components/layout/Topbar';
import { Button } from '@/components/ui';
import { Input } from '@/components/ui';
import { Card } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { usersService } from '@/services/users.service';

const roleColorMap: Record<string, string> = {
  admin: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700',
  manager: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700',
  user: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700',
};

export default function ProfilePage() {
  const { user } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [nameLoading, setNameLoading] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  const handleUpdateName = async () => {
    if (!name.trim()) {
      setNameError('Name cannot be empty');
      return;
    }
    if (!user) return;
    setNameLoading(true);
    setNameError(null);
    setNameSuccess(false);
    try {
      await usersService.update(user._id, { name: name.trim() });
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 3000);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : 'Failed to update name');
    } finally {
      setNameLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      setPwError('Current password is required');
      return;
    }
    if (!newPassword) {
      setPwError('New password is required');
      return;
    }
    if (newPassword.length < 6) {
      setPwError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match');
      return;
    }
    if (!user) return;
    setPwLoading(true);
    setPwError(null);
    setPwSuccess(false);
    try {
      await usersService.update(user._id, {
        currentPassword,
        password: newPassword,
      });
      setPwSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Profile" />

      <div className="flex-1 p-6 space-y-6 overflow-auto max-w-2xl">
        {/* User Info Card */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Account Information</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-navy text-lg font-bold text-white shrink-0">
                {user?.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2) ?? '?'}
              </div>
              <div>
                <p className="text-base font-semibold text-gray-900">{user?.name ?? '—'}</p>
                <p className="text-sm text-gray-500">{user?.email ?? '—'}</p>
              </div>
            </div>
            <div className="pt-2 border-t border-border grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Role</span>
                <div className="mt-1">
                  {user?.role ? (
                    <span className={roleColorMap[user.role] ?? ''}>
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                  ) : '—'}
                </div>
              </div>
              <div>
                <span className="text-gray-500">Status</span>
                <div className="mt-1">
                  <span className={user?.isActive ? 'badge-approved' : 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600'}>
                    {user?.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Update Name Card */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Update Name</h2>
          {nameError && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {nameError}
            </div>
          )}
          {nameSuccess && (
            <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              Name updated successfully.
            </div>
          )}
          <div className="space-y-4">
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
            />
            <div className="flex justify-end">
              <Button variant="primary" onClick={handleUpdateName} loading={nameLoading}>
                Update Name
              </Button>
            </div>
          </div>
        </Card>

        {/* Change Password Card */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Change Password</h2>
          {pwError && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {pwError}
            </div>
          )}
          {pwSuccess && (
            <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              Password changed successfully.
            </div>
          )}
          <div className="space-y-4">
            <Input
              label="Current Password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
            <Input
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min 6 characters)"
            />
            <Input
              label="Confirm New Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
            />
            <div className="flex justify-end">
              <Button variant="primary" onClick={handleChangePassword} loading={pwLoading}>
                Change Password
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
