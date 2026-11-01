import type { PipelineCategoryId } from "../pipeline/types";

type Props = {
  category: PipelineCategoryId;
  className?: string;
};

/** Small inline SVG marks for pipeline categories. */
export function CategoryIcon({ category, className }: Props) {
  const cls = `category-icon category-icon-${category}${className ? ` ${className}` : ""}`;

  if (category === "seed") {
    // Upright diamond
    return (
      <svg className={cls} viewBox="0 0 16 16" width={14} height={14} aria-hidden focusable="false">
        <path
          fill="currentColor"
          d="M8 1.25 14 8 8 14.75 2 8 8 1.25Zm0 2.2L4.35 8 8 12.55 11.65 8 8 3.45Z"
        />
      </svg>
    );
  }

  if (category === "transform") {
    // Swap / circulate arrows
    return (
      <svg className={cls} viewBox="0 0 16 16" width={14} height={14} aria-hidden focusable="false">
        <path
          fill="currentColor"
          d="M11.2 2.4 14 5.2l-2.8 2.8V6.4H6.8V4h4.4V2.4ZM4.8 13.6 2 10.8l2.8-2.8v1.6h4.4V12H4.8v1.6Z"
        />
      </svg>
    );
  }

  if (category === "refine") {
    // Sparkle
    return (
      <svg className={cls} viewBox="0 0 16 16" width={14} height={14} aria-hidden focusable="false">
        <path
          fill="currentColor"
          d="M8 1 9.2 5.6 14 6.8 9.2 8 8 12.6 6.8 8 2 6.8 6.8 5.6 8 1Zm4.6 7.2.8 2.6 2.6.8-2.6.8-.8 2.6-.8-2.6-2.6-.8 2.6-.8.8-2.6Z"
        />
      </svg>
    );
  }

  // Utility: wrench
  return (
    <svg className={cls} viewBox="0 0 16 16" width={14} height={14} aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M12.9 2.2a3.1 3.1 0 0 0-4.2.3L8.3 3l1.5 1.5-.8.8L7.5 3.8l-.4.4a3.1 3.1 0 0 0-.2 4.2L3 12.3l1.1 1.1 3.9-3.9a3.1 3.1 0 0 0 4.2-.2l.4-.4-1.5-1.5.8-.8 1.5 1.5.4-.4a3.1 3.1 0 0 0-.3-4.2l-.6-.5Z"
      />
    </svg>
  );
}
