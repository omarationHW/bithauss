export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Back link skeleton */}
      <div className="h-4 w-36 rounded-lg bg-gray-100" />

      {/* Title skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-64 rounded-xl bg-gray-200" />
        <div className="h-4 w-96 rounded-lg bg-gray-100" />
      </div>

      {/* Status cards skeleton */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gray-100" />
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-xl bg-gray-100" />
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-8 w-16 rounded-lg bg-gray-200" />
              <div className="h-4 w-28 rounded-lg bg-gray-100" />
            </div>
          </div>
        ))}
      </div>

      {/* Detail card skeleton */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gray-100" />
          <div className="space-y-2 flex-1">
            <div className="h-5 w-48 rounded-lg bg-gray-200" />
            <div className="h-4 w-32 rounded-lg bg-gray-100" />
          </div>
        </div>
        <div className="h-px bg-gray-100" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-20 rounded-xl bg-gray-50" />
          <div className="h-20 rounded-xl bg-gray-50" />
        </div>
      </div>

      {/* Documents skeleton */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-3">
        <div className="h-5 w-40 rounded-lg bg-gray-200" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-gray-50" />
        ))}
      </div>
    </div>
  );
}
