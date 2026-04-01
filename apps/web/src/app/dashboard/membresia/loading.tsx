export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded-xl bg-gray-200" />
      <div className="h-4 w-72 rounded-lg bg-gray-100" />
      <div className="grid gap-5 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm h-40" />
        ))}
      </div>
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm h-64" />
    </div>
  );
}
