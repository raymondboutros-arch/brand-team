"use client";

import { useFormStatus } from "react-dom";

/** A submit button that shows it's working while its form's server action runs. */
export function SubmitButton({
  children,
  pendingText,
  className,
  name,
  value,
}: {
  children: React.ReactNode;
  pendingText: string;
  className: string;
  name?: string;
  value?: string;
}) {
  const { pending, data } = useFormStatus();
  const mine = pending && (!name || data?.get(name) === value);
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={className}>
      {mine ? pendingText : children}
    </button>
  );
}
