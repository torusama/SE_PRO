import { useMemo, useState } from "react";

export type UserMemoryItem = {
  memoryId: number;
  userId: number;
  fullName?: string | null;
  email?: string | null;
  category?: string;
  memoryKey?: string | null;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

type Draft = {
  title: string;
  content: string;
  reviewNote: string;
};

type Props = {
  items: UserMemoryItem[];
  busy?: string;
  onSave: (memoryId: number, payload: Draft) => Promise<void>;
  onDelete: (item: UserMemoryItem) => Promise<void>;
};

const formatDate = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
};

const memoryKeyLabel = (value?: string | null) =>
  ({
    preferred_plot_location: "Vị trí lô ưu tiên",
    minimum_budget: "Ngân sách tối thiểu",
    maximum_budget: "Ngân sách tối đa",
    adjacent_plot_count: "Số lô liền kề mong muốn",
    preferred_direction: "Hướng ưu tiên",
    preferred_plot_type: "Loại lô ưu tiên",
    preferred_service: "Dịch vụ ưu tiên",
    preferred_zone: "Khu vực ưu tiên",
    service_interest: "Dịch vụ quan tâm",
    consultation_topic_preference: "Chủ đề tư vấn ưu tiên",
    accessibility_priority: "Ưu tiên lối đi / tiếp cận",
    response_detail_preference: "Mức chi tiết câu trả lời",
  })[value ?? ""] ?? (value || "Ghi nhớ khác");

export default function MemoryManagementPanel({
  items,
  busy,
  onSave,
  onDelete,
}: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});

  const activeDraft = useMemo(
    () => (editingId ? drafts[editingId] : undefined),
    [drafts, editingId],
  );

  const startEdit = (item: UserMemoryItem) => {
    setEditingId(item.memoryId);
    setDrafts((current) => ({
      ...current,
      [item.memoryId]: current[item.memoryId] ?? {
        title: item.title,
        content: item.content,
        reviewNote: "",
      },
    }));
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const updateDraft = (memoryId: number, patch: Partial<Draft>) => {
    setDrafts((current) => ({
      ...current,
      [memoryId]: {
        title: current[memoryId]?.title ?? "",
        content: current[memoryId]?.content ?? "",
        reviewNote: current[memoryId]?.reviewNote ?? "",
        ...patch,
      },
    }));
  };

  return (
    <section className="agent-admin__subsection agent-admin__memory-panel">
      <header>
        <div>
          <h3>AI đang nhớ gì về người dùng?</h3>
          <p>
            Đây là phần ghi nhớ cá nhân mà AI dùng lại cho đúng khách hàng đó.
            Quản trị viên có thể rà soát, sửa hoặc xóa để tránh nhớ sai.
          </p>
        </div>
        <small>{items.length} mục ghi nhớ đang hoạt động</small>
      </header>

      <div className="agent-admin__memory-scroll" role="region" aria-label="Danh sách ghi nhớ cá nhân của AI">
        {items.map((item) => {
          const isEditing = editingId === item.memoryId;
          const draft = drafts[item.memoryId];
          return (
            <article className="agent-admin__memory-card" key={item.memoryId}>
              <div className="agent-admin__memory-head">
                <div>
                  <div className="agent-admin__memory-badges">
                    <span className="agent-admin__status status-active">Đang dùng</span>
                    <span>{memoryKeyLabel(item.memoryKey)}</span>
                  </div>
                  <h4>{item.fullName || `Người dùng #${item.userId}`}</h4>
                  <p>
                    {item.email || "Không có email hiển thị"} · ID người dùng: {item.userId}
                  </p>
                </div>
                <div className="agent-admin__memory-meta">
                  <span>Cập nhật: {formatDate(item.updatedAt)}</span>
                  <span>Tạo: {formatDate(item.createdAt)}</span>
                </div>
              </div>

              {isEditing ? (
                <div className="agent-admin__memory-edit-grid">
                  <label className="agent-admin__review-field">
                    <span>Tên ghi nhớ</span>
                    <input
                      type="text"
                      maxLength={150}
                      value={draft?.title ?? ""}
                      onChange={(event) =>
                        updateDraft(item.memoryId, { title: event.target.value })
                      }
                    />
                  </label>
                  <label className="agent-admin__review-field agent-admin__review-field--full">
                    <span>Nội dung AI đang ghi nhớ</span>
                    <textarea
                      rows={3}
                      maxLength={5000}
                      value={draft?.content ?? ""}
                      onChange={(event) =>
                        updateDraft(item.memoryId, { content: event.target.value })
                      }
                    />
                  </label>
                  <label className="agent-admin__review-field agent-admin__review-field--full">
                    <span>Ghi chú quản trị</span>
                    <textarea
                      rows={2}
                      maxLength={1000}
                      placeholder="Ghi lý do sửa để lưu vào lịch sử quản trị"
                      value={draft?.reviewNote ?? ""}
                      onChange={(event) =>
                        updateDraft(item.memoryId, { reviewNote: event.target.value })
                      }
                    />
                  </label>
                </div>
              ) : (
                <div className="agent-admin__memory-body">
                  <strong>{item.title}</strong>
                  <p>{item.content}</p>
                </div>
              )}

              <div className="agent-admin__memory-actions">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      disabled={busy === `user-memory-save-${item.memoryId}` || !activeDraft}
                      onClick={() =>
                        onSave(item.memoryId, draft ?? { title: item.title, content: item.content, reviewNote: "" }).then(() => {
                          setEditingId(null);
                        })
                      }
                    >
                      Lưu ghi nhớ
                    </button>
                    <button type="button" onClick={cancelEdit}>
                      Hủy
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => startEdit(item)}>
                    Sửa
                  </button>
                )}
                <button
                  type="button"
                  className="danger"
                  disabled={busy === `user-memory-delete-${item.memoryId}`}
                  onClick={() => onDelete(item)}
                >
                  Xóa khỏi bộ nhớ
                </button>
              </div>
            </article>
          );
        })}

        {!items.length && (
          <div className="agent-admin__empty">
            Chưa có ghi nhớ cá nhân nào đang hoạt động để quản trị.
          </div>
        )}
      </div>
    </section>
  );
}
