import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ComparisonAssessmentMessage from "./ComparisonAssessmentMessage";

describe("ComparisonAssessmentMessage", () => {
  afterEach(cleanup);

  it("renders clickable AI follow-ups and sends the generated message", () => {
    const onAction = vi.fn();
    render(
      <ComparisonAssessmentMessage
        assessment="Lô A-02-001 phù hợp hơn với ưu tiên hiện tại của bạn."
        followUpPrompt="Bạn muốn mình phân tích sâu hơn hay tìm phương án khác?"
        actions={[
          {
            id: "analyze_selected_plots",
            label: "Phân tích kỹ hai lô",
            message: "Hãy phân tích kỹ hơn hai lô này cho mình.",
          },
          {
            id: "find_other_plots",
            label: "Gợi ý lô khác",
            message: "Hãy gợi ý thêm lô khác theo tiêu chí hiện tại.",
          },
        ]}
        loading={false}
        onAction={onAction}
      />,
    );

    const article = screen.getByRole("article");
    expect(article).toHaveClass("agent-message", "assistant");
    expect(
      screen.getByText("Lô A-02-001 phù hợp hơn với ưu tiên hiện tại của bạn."),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "“Phân tích kỹ hai lô”" }),
    );
    expect(onAction).toHaveBeenCalledWith(
      "Hãy phân tích kỹ hơn hai lô này cho mình.",
    );
  });

  it("never renders an English internal reasoning trace", () => {
    render(
      <ComparisonAssessmentMessage
        assessment="We need to produce a decision brief. Must mention every plot."
        followUpPrompt="Bạn muốn xem thêm thông tin không?"
        actions={[]}
        loading={false}
        onAction={vi.fn()}
      />,
    );

    expect(screen.queryByText(/We need to produce/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Mình chưa tạo được nhận xét/)).toBeInTheDocument();
  });
});
