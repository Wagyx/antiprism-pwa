import { useRef, type KeyboardEvent } from "react";

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

function optionIndex(
  options: readonly MenuSelectOption[],
  value: string,
): number {
  return options.findIndex((o) => o.value === value);
}

export function MenuSelect({
  value,
  options,
  onChange,
  fallbackLabel = "custom…",
  className,
  "aria-label": ariaLabel,
}: Props) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const matched = options.find((o) => o.value === value);
  const summary = matched?.label ?? fallbackLabel;
  const showCustom = !matched;

  const close = () => detailsRef.current?.removeAttribute("open");

  const stepValue = (dir: -1 | 1) => {
    if (options.length === 0) return;
    let i = optionIndex(options, value);
    if (i < 0) i = dir > 0 ? -1 : 0;
    const next = (i + dir + options.length) % options.length;
    const opt = options[next];
    if (opt && opt.value !== value) onChange(opt.value);
  };

  const focusOptionAt = (index: number) => {
    const menu = detailsRef.current?.querySelector(".add-op-menu");
    const buttons = menu?.querySelectorAll<HTMLButtonElement>(
      'button[role="option"]',
    );
    if (!buttons?.length) return;
    const btn = buttons[Math.max(0, Math.min(index, buttons.length - 1))];
    btn?.focus();
  };

  const onSummaryKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const open = detailsRef.current?.open;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      if (open) {
        // Move into the list
        const i = optionIndex(options, value);
        focusOptionAt(i >= 0 ? i : 0);
      } else {
        stepValue(e.key === "ArrowDown" ? 1 : -1);
      }
      return;
    }
    if (e.key === "Home" && !open) {
      e.preventDefault();
      if (options[0] && options[0].value !== value) onChange(options[0].value);
      return;
    }
    if (e.key === "End" && !open) {
      e.preventDefault();
      const last = options[options.length - 1];
      if (last && last.value !== value) onChange(last.value);
    }
  };

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const buttons = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>(
        'button[role="option"]',
      ),
    );
    if (!buttons.length) return;
    const active = document.activeElement;
    let i = buttons.findIndex((b) => b === active);
    if (i < 0) i = optionIndex(options, value);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      focusOptionAt((i + 1) % buttons.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      focusOptionAt((i - 1 + buttons.length) % buttons.length);
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      focusOptionAt(0);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      focusOptionAt(buttons.length - 1);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      detailsRef.current?.querySelector("summary")?.focus();
    }
  };

  return (
    <details
      ref={detailsRef}
      className={`add-op menu-select${className ? ` ${className}` : ""}`}
    >
      <summary
        className="add-op-btn"
        aria-label={ariaLabel}
        onKeyDown={onSummaryKeyDown}
      >
        {summary}
      </summary>
      <div
        className="add-op-menu"
        role="listbox"
        tabIndex={-1}
        onKeyDown={onMenuKeyDown}
      >
        {showCustom ? (
          <button
            type="button"
            role="option"
            aria-selected
            className="is-active"
            onClick={() => close()}
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
            onClick={() => {
              close();
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
