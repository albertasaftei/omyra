import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

type Option = { value: string; label: string; group?: string };
export function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const search = useRef({ text: "", time: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });
  const selected = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  function show() {
    setActive(selected);
    setOpen(true);
  }
  function choose(index: number) {
    onChange(options[index].value);
    setOpen(false);
    trigger.current?.focus();
  }
  useEffect(() => {
    if (!open) return;
    function place() {
      const rect = trigger.current!.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - 16;
      const above = rect.top - 16;
      const height = Math.min(
        320,
        (menu.current?.scrollHeight ?? 318) + 2,
        Math.max(below, above),
      );
      const width = Math.min(Math.max(rect.width, 224), window.innerWidth - 24);
      setPosition({
        width,
        height,
        left: Math.max(
          12,
          Math.min(rect.right - width, window.innerWidth - width - 12),
        ),
        top:
          below >= height
            ? rect.bottom + 6
            : Math.max(12, rect.top - height - 6),
      });
    }
    function outside(event: PointerEvent) {
      if (
        !trigger.current?.contains(event.target as Node) &&
        !menu.current?.contains(event.target as Node)
      )
        setOpen(false);
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open]);
  useEffect(() => {
    if (open)
      menu.current
        ?.querySelector(`[data-index="${active}"]`)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="custom-select"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onBlur={(event) => {
          if (!menu.current?.contains(event.relatedTarget)) setOpen(false);
        }}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(event) => {
          if (
            [
              "ArrowDown",
              "ArrowUp",
              "Home",
              "End",
              "Enter",
              " ",
              "Escape",
            ].includes(event.key)
          ) {
            event.preventDefault();
            if (event.key === "Escape") {
              setOpen(false);
              return;
            }
            if (event.key === "Enter" || event.key === " ") {
              if (open) choose(active);
              else show();
              return;
            }
            if (!open) {
              show();
              return;
            }
            setActive(
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? options.length - 1
                  : (active +
                      (event.key === "ArrowDown" ? 1 : -1) +
                      options.length) %
                    options.length,
            );
          } else if (event.key === "Tab") setOpen(false);
          else if (
            event.key.length === 1 &&
            !event.metaKey &&
            !event.ctrlKey &&
            !event.altKey
          ) {
            const now = Date.now();
            const text =
              (now - search.current.time < 700 ? search.current.text : "") +
              event.key.toLowerCase();
            search.current = { text, time: now };
            const match = options.findIndex((option) =>
              option.label.toLowerCase().startsWith(text),
            );
            if (match >= 0) {
              setActive(match);
              setOpen(true);
            }
          }
        }}
      >
        <span>{options[selected]?.label}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={id}
            role="listbox"
            aria-label={label}
            className="select-menu"
            style={{
              left: position.left,
              top: position.top,
              width: position.width,
              maxHeight: position.height,
            }}
          >
            {options.map((option, index) => (
              <div key={option.value}>
                {option.group && option.group !== options[index - 1]?.group && (
                  <div className="select-group" role="presentation">
                    {option.group}
                  </div>
                )}
                <div
                  id={`${id}-${index}`}
                  role="option"
                  aria-selected={option.value === value}
                  data-index={index}
                  className={`select-option ${index === active ? "is-active" : ""}`}
                  onPointerDown={(event) => event.preventDefault()}
                  onPointerMove={() => setActive(index)}
                  onClick={() => choose(index)}
                >
                  <span>{option.label}</span>
                  {option.value === value && (
                    <Check size={14} aria-hidden="true" />
                  )}
                </div>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
