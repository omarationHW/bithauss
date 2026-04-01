export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 rounded-xl bg-gray-200" />
        <div className="h-10 w-40 rounded-xl bg-gray-200" />
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 w-24 rounded-xl bg-gray-200" />
        ))}
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm">
            <div className="h-44 bg-gray-100" />
            <div className="p-4 space-y-2">
              <div className="h-5 w-3/4 rounded-lg bg-gray-200" />
              <div className="h-4 w-1/2 rounded-lg bg-gray-100" />
              <div className="h-6 w-1/3 rounded-lg bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
