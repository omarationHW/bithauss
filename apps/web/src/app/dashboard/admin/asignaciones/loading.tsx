export default function AsignacionesLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <div className="h-8 w-64 rounded-xl bg-gray-200" />
          <div className="h-4 w-48 rounded-lg bg-gray-200" />
        </div>
      </div>

      {/* Stats skeleton */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-xl bg-gray-100" />
              <div className="h-6 w-20 rounded-lg bg-gray-100" />
            </div>
            <div className="h-8 w-16 rounded-lg bg-gray-200 mb-2" />
            <div className="h-4 w-32 rounded-lg bg-gray-100" />
          </div>
        ))}
      </div>

      {/* Section skeleton */}
      <div className="space-y-4">
        <div className="h-6 w-40 rounded-lg bg-gray-200" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm h-52" />
          ))}
        </div>
      </div>
    </div>
  );
}
