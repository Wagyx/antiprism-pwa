import { ArrowLeftRight, Diamond, Sparkles, Wrench } from "lucide-react";
import type { PipelineCategoryId } from "../pipeline/types";

type Props = {
  category: PipelineCategoryId;
  className?: string;
};

const CATEGORY_ICONS = {
  seed: Diamond,
  transform: ArrowLeftRight,
  refine: Sparkles,
  utility: Wrench,
} as const;

/** Small Lucide marks for pipeline categories. */
export function CategoryIcon({ category, className }: Props) {
  const Icon = CATEGORY_ICONS[category];
  const cls = `category-icon category-icon-${category}${className ? ` ${className}` : ""}`;
  return <Icon className={cls} size={14} strokeWidth={1.5} aria-hidden />;
}
