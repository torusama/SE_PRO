import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import AdminHeader from "./AdminHeader";

describe("Admin Header", () => {
  afterEach(() => {
    cleanup();
    useAuthStore.setState({ user: null, role: null });
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

  it("renders the shared notification and account controls", () => {
    useAuthStore.setState({
      role: "admin",
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

    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Thông báo" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Mở menu tài khoản của Nguyễn An",
      }),
    ).toHaveTextContent("Nguyễn An");
    expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute(
      "href",
      "/admin",
    );
  });
});
