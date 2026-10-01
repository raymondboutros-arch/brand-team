import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders text written in Markdown (pages, notes, tables) in the HQ style. */
export function Md({ children, className = "" }: { children: string | null | undefined; className?: string }) {
  if (!children) return null;
  return (
    <div className={`md ${className}`}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div className="md-table">
              <table>{children}</table>
            </div>
          ),
          a: ({ href, children }) => {
            const external = href?.startsWith("http");
            return (
              <a href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
                {children}
              </a>
            );
          },
          input: ({ checked }) => (
            <span aria-hidden className={`md-check ${checked ? "md-check-on" : ""}`}>
              {checked ? "✓" : ""}
            </span>
          ),
        }}
      >
        {children}
      </Markdown>
    </div>
  );
}
