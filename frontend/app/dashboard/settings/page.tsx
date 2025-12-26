'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userService } from '@/lib/api/user';
import { queryKeys } from '@/lib/api/queryKeys';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingCard, LoadingPage } from '@/components/ui/loading';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Mail, Calendar, Save } from 'lucide-react';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useErrorHandler } from '@/lib/utils/errorHandlerHelpers';

const profileSchema = z.object({
  full_name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { handleError } = useErrorHandler();
  const [isEditing, setIsEditing] = useState(false);

  // User profile changes infrequently, use longer cache
  // Don't refetch on mount - use cached data for instant navigation
  const { data: user, isLoading, isError } = useQuery({
    queryKey: queryKeys.user.profile(),
    queryFn: () => userService.getProfile(),
    staleTime: 5 * 60 * 1000, // 5 minutes for user profile
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnMount: false, // Use cached data on navigation - instant page loads
    retry: (failureCount, error) => {
      // Don't retry on 444 (connection closed) - fail fast
      const statusCode = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { status?: number } }).response?.status
        : undefined;
      if (statusCode === 444) {
        return false;
      }
      // Retry up to 1 time for other errors
      return failureCount < 1;
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: user?.full_name || '',
    },
  });

  // Update form when user data loads
  useEffect(() => {
    if (user && !isEditing) {
      reset({ full_name: user.full_name || '' });
    }
  }, [user, isEditing, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: { full_name?: string }) => userService.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.all });
      setIsEditing(false);
    },
    onError: (error: unknown) => {
      handleError(error, {
        showToast: true,
        logContext: { action: 'update_profile' },
      });
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    try {
      await updateMutation.mutateAsync(data);
    } catch {
      // Error is handled by mutation's onError if needed
      // For now, react-query will handle it
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <LoadingCard lines={3} showHeader={true} />
        <LoadingCard lines={4} showHeader={true} />
        <LoadingCard lines={1} showHeader={true} className="border-red-200" />
      </div>
    );
  }

  if (isError) {
    return (
      <LoadingPage 
        message="Failed to load settings. Please try refreshing the page."
        showSpinner={false}
        action={{
          label: 'Refresh Page',
          onClick: () => globalThis.location.reload(),
        }}
      />
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your account settings and preferences</p>
      </div>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-500" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="mt-1 bg-gray-50"
                />
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              </div>

              <div>
                <Label htmlFor="full_name" className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-500" />
                  Full Name
                </Label>
                <Input
                  id="full_name"
                  {...register('full_name')}
                  disabled={!isEditing}
                  className="mt-1"
                />
                {errors.full_name && (
                  <p className="text-xs text-red-500 mt-1">{errors.full_name.message}</p>
                )}
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  Member Since
                </Label>
                <Input
                  value={user?.created_at ? format(new Date(user.created_at), 'MMMM dd, yyyy') : ''}
                  disabled
                  className="mt-1 bg-gray-50"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t">
              {isEditing ? (
                <>
                  <Button type="submit" disabled={isSubmitting || updateMutation.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSubmitting || updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      reset({ full_name: user?.full_name || '' });
                    }}
                    disabled={isSubmitting || updateMutation.isPending}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button type="button" variant="outline" onClick={() => setIsEditing(true)}>
                  Edit Profile
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your account details and subscription</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-gray-700">Subscription Tier</span>
              <span className="text-sm text-gray-900 capitalize">{user?.subscription_tier || 'Free'}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-gray-700">Subscription Status</span>
              <span className="text-sm text-gray-900 capitalize">
                {user?.subscription_status?.replace('_', ' ') || 'Active'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-gray-700">Monthly Query Limit</span>
              <span className="text-sm text-gray-900">{user?.monthly_query_limit || 0}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-medium text-gray-700">Queries Used This Month</span>
              <span className="text-sm text-gray-900">{user?.queries_used_this_month || 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
          <CardDescription>Irreversible and destructive actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50/50">
              <div>
                <h4 className="font-semibold text-gray-900">Delete Account</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Permanently delete your account and all associated data
                </p>
              </div>
              <Button variant="destructive" size="sm">
                Delete Account
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

