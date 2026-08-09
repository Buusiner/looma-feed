import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type LoomaDropdownOption<T extends string | number> = {
  value: T;
  label: string;
};

type LoomaDropdownProps<T extends string | number> = {
  value: T;
  options: readonly LoomaDropdownOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
};

export function LoomaDropdown<T extends string | number>({ value, options, onChange, ariaLabel }: LoomaDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    function closeFromOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    function closeFromEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", closeFromOutside);
    document.addEventListener("keydown", closeFromEscape);
    return () => {
      document.removeEventListener("mousedown", closeFromOutside);
      document.removeEventListener("keydown", closeFromEscape);
    };
  }, []);

  return <div className="looma-dropdown" ref={containerRef}>
    <button type="button" className="looma-dropdown-trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={isOpen} aria-controls={menuId} onClick={() => setIsOpen((open) => !open)}>
      <span>{selected?.label}</span><ChevronDown size={16} aria-hidden="true" />
    </button>
    {isOpen ? <div id={menuId} className="looma-dropdown-menu" role="listbox" aria-label={ariaLabel}>
      {options.map((option) => <button key={String(option.value)} type="button" role="option" aria-selected={option.value === value} className={option.value === value ? "active" : ""} onClick={() => { onChange(option.value); setIsOpen(false); }}>
        <span>{option.label}</span>{option.value === value ? <Check size={15} aria-hidden="true" /> : null}
      </button>)}
    </div> : null}
  </div>;
}
