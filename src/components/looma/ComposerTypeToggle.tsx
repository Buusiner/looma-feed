import { type KeyboardEvent, useRef } from "react";

type ComposerType = "post" | "work";

type ComposerTypeToggleProps = {
  disabled?: boolean;
  value: ComposerType;
  onChange: (value: ComposerType) => void;
};

const COMPOSER_TYPES = [
  { value: "post", label: "Publicação" },
  { value: "work", label: "Trabalho" },
] as const;

function PublicationIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false">
      <g
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke="#000"
        strokeOpacity=".9"
        strokeWidth="2.7"
      >
        <circle cx="12" cy="12" r="9.6" />
        <ellipse cx="12" cy="12" rx="4.3" ry="9.6" />
        <path d="M2.4 12h19.2" />
      </g>
      <g
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke="#F3F700"
        strokeWidth="1.7"
      >
        <circle cx="12" cy="12" r="9.6" />
        <ellipse cx="12" cy="12" rx="4.3" ry="9.6" />
        <path d="M2.4 12h19.2" />
      </g>
    </svg>
  );
}

function WorkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false">
      <g
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke="#000"
        strokeOpacity=".9"
        strokeWidth="2.7"
      >
        <rect x="2.8" y="7.5" width="18.4" height="12.7" rx="2.8" />
        <path d="M8.8 7.5V6.2a1.7 1.7 0 0 1 1.7-1.7h3a1.7 1.7 0 0 1 1.7 1.7v1.3" />
        <path d="M2.8 13.2h18.4" />
        <rect x="10.4" y="11.6" width="3.2" height="3.2" rx=".8" />
      </g>
      <g
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke="#F3F700"
        strokeWidth="1.7"
      >
        <rect x="2.8" y="7.5" width="18.4" height="12.7" rx="2.8" />
        <path d="M8.8 7.5V6.2a1.7 1.7 0 0 1 1.7-1.7h3a1.7 1.7 0 0 1 1.7 1.7v1.3" />
        <path d="M2.8 13.2h18.4" />
        <rect x="10.4" y="11.6" width="3.2" height="3.2" rx=".8" />
      </g>
    </svg>
  );
}

export function ComposerTypeToggle({ disabled = false, value, onChange }: ComposerTypeToggleProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = COMPOSER_TYPES.findIndex((option) => option.value === value);
  const safeSelectedIndex = selectedIndex === -1 ? 0 : selectedIndex;

  const selectOption = (index: number) => {
    const option = COMPOSER_TYPES[index];
    if (!option || disabled) return;
    onChange(option.value);
    window.requestAnimationFrame(() => buttonRefs.current[index]?.focus());
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      selectOption(safeSelectedIndex === 0 ? COMPOSER_TYPES.length - 1 : safeSelectedIndex - 1);
      return;
    }

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      selectOption((safeSelectedIndex + 1) % COMPOSER_TYPES.length);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      selectOption(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      selectOption(COMPOSER_TYPES.length - 1);
    }
  };

  return (
    <div
      className="composer-type-toggle"
      data-value={value}
      role="radiogroup"
      aria-label="Tipo de publicação"
      onKeyDown={handleKeyDown}
    >
      <span className="composer-type-indicator" aria-hidden="true" />
      {COMPOSER_TYPES.map((option, index) => {
        const isSelected = option.value === value;

        return (
          <button
            key={option.value}
            ref={(element) => {
              buttonRefs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-label={option.label}
            aria-checked={isSelected}
            disabled={disabled}
            tabIndex={isSelected ? 0 : -1}
            title={option.label}
            onClick={() => selectOption(index)}
          >
            {option.value === "post" ? <PublicationIcon /> : <WorkIcon />}
          </button>
        );
      })}
    </div>
  );
}
