import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import AdminHeader from "./AdminHeader";

describe("Admin Header", () => {
  afterEach(() => {
    cleanup();
    useAuthStore.setState({ user: null, role: null });
  });

  it("renders brand wordmark", () => {
    render(
      <MemoryRouter initialEntries={["/admin/dich-vu"]}>
        <AdminHeader />
      </MemoryRouter>,
    );

    expect(screen.getByText("Vĩnh Phúc Viên")).toBeInTheDocument();
  });

  it("renders the shared account controls without notification icon", () => {
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

    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "Thông báo" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Mở menu tài khoản của Nguyễn An",
      }),
    ).toHaveTextContent("Nguyễn An");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Mở menu tài khoản của Nguyễn An",
      }),
    );
    expect(screen.getByRole("menuitem", { name: "Đăng xuất" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Hồ sơ cá nhân" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Lô của tôi" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Lịch hẹn tư vấn" })).not.toBeInTheDocument();
  });
});
