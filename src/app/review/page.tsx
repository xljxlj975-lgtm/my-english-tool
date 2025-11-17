import { Suspense } from 'react';
import ReviewPageContent from './review-page-content';

export default function ReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-xl">Loading...</div>
        </div>
      }
    >
      <ReviewPageContent />
    </Suspense>
  );
}
