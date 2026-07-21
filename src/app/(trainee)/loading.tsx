import { LoadingSkeleton } from "@/components/ui/states";

export default function TraineeLoading() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6">
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-card">
        <LoadingSkeleton lines={4} />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-line bg-surface p-5 shadow-card"
          >
            <LoadingSkeleton lines={3} />
          </div>
        ))}
      </div>
    </div>
  );
}
