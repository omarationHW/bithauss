export default function Loading() {
  return (
    <div className="animate-pulse rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden h-[calc(100vh-8rem)]">
      <div className="grid h-full grid-cols-3">
        <div className="border-r border-gray-100 p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl">
              <div className="h-10 w-10 rounded-full bg-gray-200 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-24 rounded bg-gray-200" />
                <div className="h-3 w-36 rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
        <div className="col-span-2 p-6">
          <div className="h-6 w-32 rounded-lg bg-gray-200 mb-8" />
          <div className="space-y-4">
            <div className="h-12 w-2/3 rounded-2xl bg-gray-100 ml-auto" />
            <div className="h-12 w-1/2 rounded-2xl bg-gray-100" />
            <div className="h-12 w-2/3 rounded-2xl bg-gray-100 ml-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}
