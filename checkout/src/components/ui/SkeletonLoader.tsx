export const SkeletonLoader = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-lg mx-auto bg-white rounded-xl shadow-xl overflow-hidden">
        {/* Banner Skeleton */}
        <div className="w-full h-48 bg-gray-200 animate-pulse" />

        <div className="p-6 space-y-6">
          {/* Product Summary Skeleton */}
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-24 h-24 bg-gray-200 rounded-lg animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="h-6 bg-gray-200 rounded animate-pulse w-3/4" />
                <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
                <div className="h-8 bg-gray-200 rounded animate-pulse w-2/3" />
              </div>
            </div>
          </div>

          {/* Contact Info Skeleton */}
          <div className="space-y-4">
            <div className="h-6 bg-gray-200 rounded animate-pulse w-1/3" />
            <div className="space-y-3">
              <div className="h-12 bg-gray-200 rounded-lg animate-pulse" />
              <div className="h-12 bg-gray-200 rounded-lg animate-pulse" />
            </div>
          </div>

          {/* Payment Method Skeleton */}
          <div className="space-y-4">
            <div className="h-6 bg-gray-200 rounded animate-pulse w-1/2" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-16 bg-gray-200 rounded-lg animate-pulse" />
              <div className="h-16 bg-gray-200 rounded-lg animate-pulse" />
            </div>
          </div>

          {/* Card Input Skeleton */}
          <div className="space-y-3">
            <div className="h-12 bg-gray-200 rounded-lg animate-pulse" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-12 bg-gray-200 rounded-lg animate-pulse" />
              <div className="h-12 bg-gray-200 rounded-lg animate-pulse" />
            </div>
          </div>

          {/* Button Skeleton */}
          <div className="h-14 bg-gray-200 rounded-lg animate-pulse mt-8" />
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
};
