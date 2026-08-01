import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AccountMenu from "./AccountMenu";

describe("AccountMenu", () => {
  it("opens the shared menu and runs the selected action", () => {
    const onSelect = vi.fn();

    render(
      <AccountMenu
        name="Nguyễn An"
        items={[{ label: "Hồ sơ cá nhân", onSelect }]}
      />,
    );

    const trigger = screen.getByRole("button", {
      name: "Mở menu tài khoản của Nguyễn An",
    });
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("menuitem", { name: "Hồ sơ cá nhân" }));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes with Escape and outside interaction", () => {
    render(
      <AccountMenu
        name="Quản trị viên"
        items={[{ label: "Đăng xuất", onSelect: vi.fn(), tone: "danger" }]}
        variant="light"
      />,
    );

    const trigger = screen.getByRole("button", {
      name: "Mở menu tài khoản của Quản trị viên",
    });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
