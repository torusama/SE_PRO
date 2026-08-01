import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import AdminHeader from "./AdminHeader";

describe("Admin Header", () => {
  afterEach(() => {
    cleanup();
    useAuthStore.setState({ user: null });
  });

  it("shows metadata for the current admin route", () => {
    render(
      <MemoryRouter initialEntries={["/admin/dich-vu"]}>
        <AdminHeader />
      </MemoryRouter>,
    );

    expect(screen.getByText("Quản lý dịch vụ")).toBeInTheDocument();
    expect(
      screen.getByText("Danh mục và đơn đăng ký dịch vụ"),
    ).toBeInTheDocument();
  });

  it("does not render a decorative notification icon button", () => {
    useAuthStore.setState({
      user: {
        id: "admin-1",
        name: "Nguyễn An",
        initials: "NA",
        email: "admin@example.com",
      },
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AdminHeader />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button")).toHaveTextContent("Nguyễn An");
  });
});
