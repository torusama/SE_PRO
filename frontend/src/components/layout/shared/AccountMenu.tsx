import { useEffect, useRef, useState } from "react";
import { UserRound } from "lucide-react";
import "./account-menu.css";

export type AccountMenuItem = {
  label: string;
  onSelect: () => void;
  tone?: "default" | "danger";
};

type AccountMenuProps = {
  name: string;
  items: AccountMenuItem[];
  variant?: "dark" | "light";
  className?: string;
};

export default function AccountMenu({
  name,
  items,
  variant = "dark",
  className = "",
}: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`account-menu account-menu--${variant}${
        className ? ` ${className}` : ""
      }`}
    >
      <button
        type="button"
        className="account-menu__trigger"
        aria-label={`Mở menu tài khoản của ${name}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="account-menu__avatar" aria-hidden="true">
          <UserRound size={18} strokeWidth={1.8} />
        </span>
        <span className="account-menu__name">{name}</span>
      </button>

      {open && (
        <div className="account-menu__panel" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={
                item.tone === "danger" ? "account-menu__danger" : undefined
              }
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
