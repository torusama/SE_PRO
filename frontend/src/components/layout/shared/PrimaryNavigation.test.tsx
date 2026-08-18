import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import PrimaryNavigation from "./PrimaryNavigation";

describe("PrimaryNavigation", () => {
  afterEach(() => {
    cleanup();
    useAuthStore.setState({ role: null });
  });

  it("keeps the admin card hidden from non-admin accounts", () => {
    useAuthStore.setState({ role: "customer" });

    render(
      <MemoryRouter>
        <PrimaryNavigation />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Bản đồ" })).toHaveAttribute(
      "href",
      "/ban-do",
    );
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
  });

  it("shows an active admin card for admin routes", () => {
    useAuthStore.setState({ role: "admin" });

    render(
      <MemoryRouter initialEntries={["/admin/dich-vu"]}>
        <PrimaryNavigation variant="light" />
      </MemoryRouter>,
    );

    const adminLink = screen.getByRole("link", { name: "Admin" });
    expect(adminLink).toHaveAttribute("href", "/admin");
    expect(adminLink).toHaveClass("is-active");
  });
});
