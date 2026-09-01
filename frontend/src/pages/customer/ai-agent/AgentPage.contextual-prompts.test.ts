import { describe, expect, it } from "vitest";
import { getContextualPrompts } from "./AgentPage";
import type { ChatMessage } from "./agent.types";

const assistantMessage = (
  suggestedFollowUps?: Array<{ category: string; text: string }>,
  quickReplies?: Array<{ id: string; label: string; message: string }>,
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
      quickReplies,
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

  it("prioritizes authoritative quick replies tied to the current turn", () => {
    const result = getContextualPrompts(
      assistantMessage(
        [{ category: "Chung chung", text: "Cho mình hỏi thêm thông tin?" }],
        [
          {
            id: "analyze-current",
            label: "Phân tích D-02-002",
            message:
              "Phân tích kỹ lô D-02-002 theo ngân sách và ưu tiên hiện tại của mình.",
          },
          {
            id: "other-current",
            label: "Tìm lô khác",
            message:
              "Tìm lô khác theo tiêu chí hiện tại và không lặp D-02-002.",
          },
        ],
      ),
    );

    expect(result[0]).toEqual({
      category: "Phân tích D-02-002",
      text: "Phân tích kỹ lô D-02-002 theo ngân sách và ưu tiên hiện tại của mình.",
    });
    expect(result[1].text).toContain("không lặp D-02-002");
  });

  it("does not let generic help chips replace contextual AI follow-ups", () => {
    const result = getContextualPrompts(
      assistantMessage(
        [
          {
            category: "Đúng ngữ cảnh",
            text: "Mình muốn làm rõ tiêu chí hướng vừa trao đổi.",
          },
        ],
        [
          {
            id: "help-services",
            label: "Xem dịch vụ",
            message: "Cho mình xem các dịch vụ chăm sóc hiện có.",
          },
        ],
      ),
    );

    expect(result[0].text).toContain("tiêu chí hướng vừa trao đổi");
  });

  it("uses the latest assistant turn when given the full conversation", () => {
    const older = assistantMessage(undefined, [
      {
        id: "old",
        label: "Câu cũ",
        message: "Hỏi tiếp về câu chuyện cũ.",
      },
    ]);
    const latest = {
      ...assistantMessage(undefined, [
        {
          id: "new",
          label: "Bổ sung nhu cầu",
          message: "Mình cần 1 lô, ưu tiên gần cổng và ngân sách 100 triệu.",
        },
      ]),
      localId: "assistant-2",
    } satisfies ChatMessage;

    const result = getContextualPrompts([older, latest]);

    expect(result[0].text).toContain("ưu tiên gần cổng");
    expect(result.map((item) => item.text)).not.toContain(
      "Hỏi tiếp về câu chuyện cũ.",
    );
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
