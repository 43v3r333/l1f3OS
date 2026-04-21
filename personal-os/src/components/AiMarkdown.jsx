import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { cn } from "@/lib/utils"

/**
 * Renders AI / assistant text as Markdown (GFM): lists, **bold**, `code`, tables, etc.
 * Plain text still looks fine (becomes a paragraph).
 */
export default function AiMarkdown({ children, className, compact, emptyFallback = null }) {
  const text = typeof children === "string" ? children : String(children ?? "")
  if (!text.trim()) {
    return emptyFallback
  }

  return (
    <div
      className={cn(
        "ai-markdown max-w-none text-foreground [&_a]:break-words",
        compact ? "text-xs leading-relaxed" : "text-sm leading-relaxed",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {text}
      </ReactMarkdown>
    </div>
  )
}

const markdownComponents = {
  p: ({ children }) => <p className="mb-2.5 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }) => (
    <h3 className="mb-2 mt-4 border-b border-border/40 pb-1 text-base font-semibold tracking-tight first:mt-0">
      {children}
    </h3>
  ),
  h2: ({ children }) => (
    <h3 className="mb-2 mt-4 text-[15px] font-semibold tracking-tight first:mt-0">{children}</h3>
  ),
  h3: ({ children }) => <h4 className="mb-1.5 mt-3 text-sm font-semibold first:mt-0">{children}</h4>,
  h4: ({ children }) => <h5 className="mb-1 mt-2 text-sm font-medium text-muted-foreground">{children}</h5>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
  code: ({ className, children, ...props }) => {
    const isInline = !className
    if (isInline) {
      return (
        <code
          className="rounded-md bg-muted/80 px-1.5 py-0.5 font-mono text-[0.92em] text-primary"
          {...props}
        >
          {children}
        </code>
      )
    }
    return (
      <code className={cn("block font-mono text-[0.9em] leading-relaxed text-foreground", className)} {...props}>
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-xl border border-border/60 bg-muted/40 p-3 text-[0.9em] shadow-inner">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-[3px] border-primary/50 bg-muted/20 py-1 pl-3 text-muted-foreground">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="font-medium text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:text-primary/90"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-4 border-border/50" />,
  table: ({ children }) => (
    <div className="my-2 w-full overflow-x-auto rounded-lg border border-border/50">
      <table className="w-full min-w-[12rem] border-collapse text-left text-[0.92em]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-border/60 px-2.5 py-2 font-semibold text-foreground">{children}</th>
  ),
  td: ({ children }) => <td className="border-b border-border/40 px-2.5 py-1.5 align-top">{children}</td>,
  tr: ({ children }) => <tr className="border-border/30">{children}</tr>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
}
