import { LoadingSkeleton } from "@/components/ui/states";

export default function StaffLoading() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-line bg-surface p-4 shadow-card"
          >
            <LoadingSkeleton lines={2} />
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-2xl border border-line bg-surface p-6 shadow-card">
        <LoadingSkeleton lines={6} />
      </div>
    </div>
  );
}
