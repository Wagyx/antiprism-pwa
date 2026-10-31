export type MenuSelectOption = {
  value: string;
  label: string;
};

type Props = {
  value: string;
  options: readonly MenuSelectOption[];
  onChange: (value: string) => void;
  /** Shown when value is not in options. */
  fallbackLabel?: string;
  className?: string;
  "aria-label"?: string;
};

export function MenuSelect({
  value,
  options,
  onChange,
  fallbackLabel = "custom…",
  className,
  "aria-label": ariaLabel,
}: Props) {
  const matched = options.find((o) => o.value === value);
  const summary = matched?.label ?? fallbackLabel;
  const showCustom = !matched;

  return (
    <details className={`add-op menu-select${className ? ` ${className}` : ""}`}>
      <summary className="add-op-btn" aria-label={ariaLabel}>
        {summary}
      </summary>
      <div className="add-op-menu" role="listbox">
        {showCustom ? (
          <button
            type="button"
            role="option"
            aria-selected
            className="is-active"
            onClick={(e) => {
              e.currentTarget.closest("details")?.removeAttribute("open");
            }}
          >
            {fallbackLabel}
          </button>
        ) : null}
        {options.map((o) => (
          <button
            key={o.value || "__empty__"}
            type="button"
            role="option"
            aria-selected={o.value === value}
            className={o.value === value ? "is-active" : undefined}
            onClick={(e) => {
              e.currentTarget.closest("details")?.removeAttribute("open");
              if (o.value !== value) onChange(o.value);
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </details>
  );
}
