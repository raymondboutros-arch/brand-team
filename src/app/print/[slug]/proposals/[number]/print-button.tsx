"use client";

/** Opens the browser's print window, where "Save as PDF" is the destination. */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn h-10 bg-ink text-paper hover:bg-ink/85">
      Save as PDF
    </button>
  );
}
