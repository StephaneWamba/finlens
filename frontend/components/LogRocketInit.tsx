'use client';

/**
 * LogRocket Initialization Component
 * 
 * Initializes LogRocket when the app loads.
 * This component should be included in the app layout.
 */

import { useEffect } from 'react';
import { initLogRocket } from '@/lib/utils/logrocket';
import { setErrorLogger } from '@/lib/utils/errorHandler';
import { LogRocketErrorLogger } from '@/lib/utils/logrocketErrorLogger';

export function LogRocketInit() {
  useEffect(() => {
    // LogRocket project: 5gs19i/finlens
    // App ID for init: Use full project identifier 5gs19i/finlens
    const envAppId = process.env.NEXT_PUBLIC_LOGROCKET_APP_ID;
    const appId = (envAppId?.trim() || '5gs19i/finlens').trim();
    
    // Enable in all environments (can be restricted to production if needed)
    const shouldInit = 
      process.env.NEXT_PUBLIC_LOGROCKET_ENABLED !== 'false';

    if (!shouldInit) {
      return;
    }

    // Validate appId format
    if (!appId || typeof appId !== 'string' || appId.length === 0) {
      return;
    }

    // Allow alphanumeric with forward slash (for project format like "5gs19i/finlens")
    if (!/^[a-z0-9\/]+$/i.test(appId)) {
      return;
    }

    // Ensure valid length (allow project format like "5gs19i/finlens" up to 50 chars)
    if (appId.length < 3 || appId.length > 50) {
      return;
    }

    // Initialize LogRocket with error handling
    try {
      initLogRocket({
        appId,
      });
      
      // Set LogRocket as the error logger only if initialization succeeded
      setErrorLogger(new LogRocketErrorLogger());
    } catch (_error) {
      // Error handled silently - LogRocket initialization failure shouldn't break the app
    }
  }, []);

  return null;
}

