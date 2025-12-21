'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionService } from '@/lib/api/subscriptions';
import { userService } from '@/lib/api/user';
import { queryKeys } from '@/lib/api/queryKeys';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingCard, LoadingPage } from '@/components/ui/loading';
import { Badge } from '@/components/ui/badge';
import { Check, CreditCard, Zap, Building2 } from 'lucide-react';
import { useState } from 'react';
import { useErrorHandler } from '@/lib/utils/errorHandlerHelpers';
import { useToast } from '@/lib/utils/toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TIER_FEATURES, getTierFeatures, calculateUsagePercentage } from '@/lib/services/tierService';

export default function BillingPage() {
  const queryClient = useQueryClient();
  const { handleError } = useErrorHandler();
  const toast = useToast();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Subscription data changes infrequently
  const { data: subscription, isLoading: isLoadingSubscription, isError: isErrorSubscription } = useQuery({
    queryKey: queryKeys.subscription.current(),
    queryFn: () => subscriptionService.getSubscription(),
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnMount: false, // Use cached data on navigation - instant page loads
  });

  // User profile changes infrequently, use longer cache
  // Don't refetch on mount - use cached data for instant navigation
  const { data: user, isLoading: isLoadingUser, isError: isErrorUser } = useQuery({
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

  const cancelMutation = useMutation({
    mutationFn: () => subscriptionService.cancelSubscription(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscription.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.all });
    },
    onError: (error: unknown) => {
      handleError(error, {
        showToast: true,
        logContext: { action: 'cancel_subscription' },
      });
    },
  });

  const handleUpgrade = async (tier: 'pro' | 'enterprise') => {
    setIsUpgrading(true);
    try {
      // In a real implementation, you would:
      // 1. Get the Stripe price ID for the tier
      // 2. Call createSubscription with the price ID
      // 3. Redirect to Stripe Checkout
      toast.info(`Upgrade to ${tier} - This would redirect to Stripe Checkout in production`);
    } catch (error) {
      handleError(error, {
        showToast: true,
        logContext: { action: 'upgrade_subscription', tier },
      });
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleCancel = () => {
    setShowCancelDialog(true);
  };

  const confirmCancel = () => {
    cancelMutation.mutate();
    setShowCancelDialog(false);
  };

  if (isLoadingSubscription || isLoadingUser) {
    return (
      <div className="space-y-6 p-6">
        {/* Current Plan Skeleton */}
        <LoadingCard lines={4} showHeader={true} />

        {/* Upgrade Options Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <LoadingCard key={i} lines={3} showHeader={true} />
          ))}
        </div>
      </div>
    );
  }

  if (isErrorSubscription || isErrorUser) {
    return (
      <LoadingPage 
        message="Failed to load billing information. Please try refreshing the page."
        showSpinner={false}
        action={{
          label: 'Refresh Page',
          onClick: () => window.location.reload(),
        }}
      />
    );
  }

  const currentTier = (subscription?.tier || user?.subscription_tier || 'free') as 'free' | 'pro' | 'enterprise';
  const tierInfo = getTierFeatures(currentTier);
  const usagePercentage = user
    ? calculateUsagePercentage(user.queries_used_this_month, user.monthly_query_limit)
    : 0;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Billing & Subscription</h1>
        <p className="text-gray-600 mt-1">Manage your subscription and billing</p>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>Your active subscription tier</CardDescription>
            </div>
            <Badge
              variant={subscription?.status === 'active' ? 'default' : 'secondary'}
              className="text-sm"
            >
              {subscription?.status === 'active' ? 'Active' : subscription?.status || 'Free'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-bold">{tierInfo.name}</span>
                <span className="text-2xl font-bold">
                  ${tierInfo.price}
                  <span className="text-sm font-normal text-gray-500">/month</span>
                </span>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-600">Monthly Usage</span>
                  <span className="font-medium">
                    {user?.queries_used_this_month || 0} / {user?.monthly_query_limit || tierInfo.queries} queries
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all ${
                      usagePercentage >= 90
                        ? 'bg-red-500'
                        : usagePercentage >= 70
                        ? 'bg-yellow-500'
                        : 'bg-blue-600'
                    }`}
                    style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h4 className="font-semibold mb-3">Plan Features</h4>
              <ul className="space-y-2">
                {tierInfo.features.map((feature, index) => (
                  <li key={index} className="flex items-center text-sm text-gray-600">
                    <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {currentTier !== 'free' && subscription?.status === 'active' && (
              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={cancelMutation.isPending}
                  className="w-full"
                >
                  {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Subscription'}
                </Button>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Your subscription will remain active until the end of the billing period
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upgrade Options */}
      {currentTier !== 'enterprise' && (
        <Card>
          <CardHeader>
            <CardTitle>Upgrade Plan</CardTitle>
            <CardDescription>Choose a plan that fits your needs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentTier === 'free' && (
                <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50/50">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-lg">Pro</h3>
                      <p className="text-2xl font-bold mt-1">
                        $29<span className="text-sm font-normal text-gray-600">/month</span>
                      </p>
                    </div>
                    <Zap className="h-8 w-8 text-blue-600" />
                  </div>
                  <ul className="space-y-2 mb-4 text-sm">
                    {TIER_FEATURES.pro.features.map((feature, index) => (
                      <li key={index} className="flex items-center">
                        <Check className="h-4 w-4 text-green-500 mr-2" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    onClick={() => handleUpgrade('pro')}
                    disabled={isUpgrading}
                  >
                    {isUpgrading ? 'Processing...' : 'Upgrade to Pro'}
                  </Button>
                </div>
              )}

              <div className={`border-2 rounded-lg p-4 ${currentTier === 'pro' ? 'border-blue-200 bg-blue-50/50' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-lg">Enterprise</h3>
                    <p className="text-2xl font-bold mt-1">
                      $99<span className="text-sm font-normal text-gray-600">/month</span>
                    </p>
                  </div>
                  <Building2 className="h-8 w-8 text-blue-600" />
                </div>
                <ul className="space-y-2 mb-4 text-sm">
                  {TIER_FEATURES.enterprise.features.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <Check className="h-4 w-4 text-green-500 mr-2" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={currentTier === 'pro' ? 'default' : 'outline'}
                  onClick={() => handleUpgrade('enterprise')}
                  disabled={isUpgrading}
                >
                  {isUpgrading ? 'Processing...' : currentTier === 'pro' ? 'Upgrade to Enterprise' : 'Get Enterprise'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Method */}
      {currentTier !== 'free' && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Method</CardTitle>
            <CardDescription>Manage your payment information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <CreditCard className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="font-medium">Card ending in ••••</p>
                  <p className="text-sm text-gray-500">Update your payment method in Stripe</p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Update
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cancel Subscription Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing period.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              disabled={cancelMutation.isPending}
            >
              Keep Subscription
            </Button>
            <Button
              variant="destructive"
              onClick={confirmCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Subscription'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

