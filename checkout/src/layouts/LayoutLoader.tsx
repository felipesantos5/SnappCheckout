// src/layouts/LayoutLoader.tsx
import React, { lazy, Suspense } from 'react';
import type { OfferData, LayoutType } from '../pages/CheckoutSlugPage';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';

// Lazy load dos layouts para code splitting
const layouts: Record<LayoutType, React.LazyExoticComponent<React.FC<LayoutProps>>> = {
  classic: lazy(() => import('./classic/ClassicLayout')),
  modern: lazy(() => import('./modern/ModernLayout')),
  minimal: lazy(() => import('./minimal/MinimalLayout')),
};

export interface LayoutProps {
  offerData: OfferData;
  checkoutSessionId: string;
  generateEventId: () => string;
  abTestId: string | null;
}

interface LayoutLoaderProps extends LayoutProps {
  layoutType?: LayoutType;
}

export const LayoutLoader: React.FC<LayoutLoaderProps> = ({
  layoutType = 'classic',
  offerData,
  checkoutSessionId,
  generateEventId,
  abTestId,
}) => {
  // Fallback para 'classic' se o layout não existir
  const Layout = layouts[layoutType] || layouts.classic;

  return (
    <Suspense fallback={<SkeletonLoader />}>
      <Layout
        offerData={offerData}
        checkoutSessionId={checkoutSessionId}
        generateEventId={generateEventId}
        abTestId={abTestId}
      />
    </Suspense>
  );
};
