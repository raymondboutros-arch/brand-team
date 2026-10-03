/** Each page settles in once when you arrive (see .page-in in globals.css). */
export default function WorkspaceTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
