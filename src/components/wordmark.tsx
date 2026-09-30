export function Wordmark({ tone = "ink" }: { tone?: "ink" | "paper" }) {
  const color = tone === "paper" ? "text-paper" : "text-ink";
  return (
    <span className={`inline-flex items-baseline gap-1.5 ${color}`}>
      <span className="text-[17px] font-bold tracking-[0.04em]">LIVBRID</span>
      <span className="font-serif text-[21px] italic leading-none">HQ</span>
    </span>
  );
}
