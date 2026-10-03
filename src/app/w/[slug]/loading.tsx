/** While a page loads: its outline, appearing only if the wait is long enough to notice. */
export default function Loading() {
  return (
    <div aria-busy="true" className="loading-shell max-w-[1040px]">
      <span className="sr-only" role="status">
        Loading
      </span>
      <div className="skeleton h-11 w-[40%] rounded-xl" />
      <div className="skeleton mt-5 h-4 w-[62%] rounded-md" />
      <div className="skeleton mt-2.5 h-4 w-[48%] rounded-md" />
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-36 rounded-[20px]" />
        ))}
      </div>
      <div className="skeleton mt-8 h-64 rounded-[20px]" />
    </div>
  );
}
