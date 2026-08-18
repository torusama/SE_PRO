import { describe, expect, it } from "vitest";
import { getContextualPrompts } from "./AgentPage";
import type { ChatMessage } from "./agent.types";

const assistantMessage = (
  suggestedFollowUps?: Array<{ category: string; text: string }>,
) =>
  ({
    localId: "assistant-1",
    role: "assistant",
    content: "Mình đã tìm được các lô phù hợp trong Khu A.",
    createdAt: new Date(),
    response: {
      sessionId: "test-session",
      messageId: 1,
      assistantMessage: "Mình đã tìm được các lô phù hợp trong Khu A.",
      intent: "recommend_plots",
      requirements: {},
      recommendations: [],
      suggestedServices: [],
      suggestedFollowUps,
      actions: [],
      metadata: {
        llmModel: "test-model",
        rankerVersion: "rule-based-v1",
        knowledgeVersion: "kb-test",
        fallbackUsed: false,
        traceId: "trace-test",
      },
    },
  }) satisfies ChatMessage;

describe("getContextualPrompts", () => {
  it("prioritizes three valid backend suggestions", () => {
    const result = getContextualPrompts(
      assistantMessage([
        { category: "Một", text: "Câu hỏi AI thứ nhất?" },
        { category: "Hai", text: "Câu hỏi AI thứ hai?" },
        { category: "Ba", text: "Câu hỏi AI thứ ba?" },
      ]),
    );

    expect(result.map((item) => item.text)).toEqual([
      "Câu hỏi AI thứ nhất?",
      "Câu hỏi AI thứ hai?",
      "Câu hỏi AI thứ ba?",
    ]);
  });

  it("fills an incomplete or duplicated backend result with contextual rules", () => {
    const result = getContextualPrompts(
      assistantMessage([
        { category: "AI", text: "Xem thêm lô khác?" },
        { category: "AI trùng", text: "Xem thêm lô khác?" },
        { category: "", text: "Dữ liệu lỗi" },
      ]),
    );

    expect(result).toHaveLength(3);
    expect(result[0].text).toBe("Xem thêm lô khác?");
    expect(new Set(result.map((item) => item.text)).size).toBe(3);
  });

  it("removes obsolete visit suggestions from both AI and local prompts", () => {
    const result = getContextualPrompts(
      assistantMessage([
        {
          category: "Tham quan thực tế",
          text: "Mình muốn đến tham quan thực tế hoa viên.",
        },
      ]),
    );

    expect(result).toHaveLength(3);
    expect(result).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: expect.stringMatching(/tham quan|xem thực tế/i),
        }),
      ]),
    );
  });
});
