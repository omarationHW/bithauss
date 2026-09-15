export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <div className="h-8 w-64 rounded-xl bg-gray-200" />
          <div className="h-4 w-48 rounded-lg bg-gray-200" />
        </div>
        <div className="h-11 w-44 rounded-xl bg-gray-200" />
      </div>

      {/* KPI cards skeleton */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between">
              <div className="h-11 w-11 rounded-xl bg-gray-100" />
              <div className="h-6 w-20 rounded-full bg-gray-100" />
            </div>
            <div className="mt-5 h-4 w-32 rounded-lg bg-gray-100" />
            <div className="mt-2 h-9 w-16 rounded-lg bg-gray-200" />
            <div className="mt-4 h-4 w-24 rounded-lg bg-gray-100" />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-72 rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.18)] lg:col-span-2" />
        <div className="h-72 rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.18)]" />
      </div>
    </div>
  );
}
