import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CopyButton } from "./copy-button";

type HastNode = {
  type?: string;
  value?: string;
  properties?: { className?: unknown };
  data?: { meta?: string | null };
  children?: HastNode[];
};

function textOf(node: HastNode | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(textOf).join("");
}

/**
 * A fenced block written as ```template Label renders as ready-to-use text
 * (emails, messages) with a copy button, instead of as code.
 */
function Template({ label, text }: { label: string; text: string }) {
  return (
    <div className="md-template">
      <div className="md-template-bar">
        <span>{label}</span>
        <CopyButton text={text} label={label} />
      </div>
      <div className="md-template-body">{text}</div>
    </div>
  );
}

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
          pre: ({ node, children }) => {
            const code = (node as HastNode | undefined)?.children?.[0];
            const classes = code?.properties?.className;
            const isTemplate = Array.isArray(classes) && classes.includes("language-template");
            if (!isTemplate) return <pre>{children}</pre>;
            const label = code?.data?.meta?.trim() || "Text";
            return <Template label={label} text={textOf(code).replace(/\n$/, "")} />;
          },
        }}
      >
        {children}
      </Markdown>
    </div>
  );
}
