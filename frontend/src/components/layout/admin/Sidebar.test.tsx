import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Sidebar from "./Sidebar";

describe("Admin Sidebar", () => {
  afterEach(() => {
    cleanup();
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

  it("does not duplicate the account identity shown in the header", () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Quản trị viên")).not.toBeInTheDocument();
  });

  it("hides reminders and care from the admin navigation", () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Nhắc lịch & chăm sóc")).not.toBeInTheDocument();
  });
});
