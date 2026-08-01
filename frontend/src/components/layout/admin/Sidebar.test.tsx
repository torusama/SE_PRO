import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import Sidebar from "./Sidebar";

describe("Admin Sidebar", () => {
  afterEach(() => {
    cleanup();
    useAuthStore.setState({ user: null });
  });

  it("places AI Agent at the bottom instead of above Dashboard", () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Sidebar />
      </MemoryRouter>,
    );

    const navigation = screen.getByRole("navigation");
    const links = within(navigation).getAllByRole("link");

    expect(links[0]).toHaveTextContent("Dashboard");
    expect(links.at(-1)).toHaveTextContent("Quản trị AI Agent");
  });

  it("uses the authenticated administrator identity", () => {
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
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.getByText("Nguyễn An")).toBeInTheDocument();
    expect(screen.getByText("NA")).toBeInTheDocument();
    expect(screen.queryByText("Võ Tấn An")).not.toBeInTheDocument();
  });
});
