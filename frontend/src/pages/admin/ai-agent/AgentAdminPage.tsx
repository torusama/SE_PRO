import { useCallback, useEffect, useState } from "react";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "../../../lib/api";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import LearningAnalyticsPanel, {
  type LearningAnalytics,
} from "./LearningAnalyticsPanel";
import LearningJournalPanel, {
  type LearningJournalDraft,
  type LearningJournalItem,
} from "./LearningJournalPanel";
import "./AgentAdminPage.css";

type Feedback = {
  feedbackId: number;
  rating?: number;
  feedbackType: string;
  reason?: string;
  correctedContent?: string;
  status: string;
  createdAt: string;
};

type CustomerProposal = {
  proposalId: number;
  userId?: number | null;
  proposalType:
    | "price_negotiation"
    | "website_suggestion"
    | "service_suggestion"
    | "plot_feedback"
    | "policy_suggestion"
    | "complaint"
    | "other";
  subject: string;
  content: string;
  selectedPlotCode?: string | null;
  serviceName?: string | null;
  proposedAmountVnd?: number | null;
  status: "pending" | "accepted" | "rejected";
  reviewNote?: string | null;
  sourceMessage?: string | null;
  createdAt: string;
  updatedAt?: string;
};

type KnowledgeProposal = {
  knowledgeEntryId: number;
  category: string;
  title: string;
  content: string;
  knowledgeType: string;
  status: string;
  validationReason?: string;
  validationEvidence?: Record<string, unknown>;
  sourceType?: string;
  sourceRole?: string;
  createdAt: string;
  updatedAt?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
};

type KnowledgeForm = {
  title: string;
  category: string;
  knowledgeType: "faq" | "business_rule" | "information_correction";
  content: string;
  reviewNote: string;
};

type KnowledgeDialogState =
  | { mode: "create"; item?: undefined }
  | { mode: "view" | "edit"; item: KnowledgeProposal };

const emptyKnowledgeForm: KnowledgeForm = {
  title: "",
  category: "general",
  knowledgeType: "faq",
  content: "",
  reviewNote: "",
};

type Tab = "overview" | "journal" | "review" | "knowledge";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Tổng quan" },
  { id: "journal", label: "Nhật ký AI" },
  { id: "review", label: "Đề xuất người dùng" },
  { id: "knowledge", label: "Kho tri thức" },
];

const formatDate = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(date);
};

const newestFirst = <T extends { createdAt: string }>(items: T[]) =>
  [...items].sort((a, b) => {
    const aTime = Date.parse(a.createdAt);
    const bTime = Date.parse(b.createdAt);
    if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
    if (Number.isNaN(aTime)) return 1;
    if (Number.isNaN(bTime)) return -1;
    return bTime - aTime;
  });

const knowledgeTypeLabel = (value: string) =>
  ({
    faq: "Thông tin / câu hỏi thường gặp",
    business_rule: "Quy định nghiệp vụ",
    information_correction: "Nội dung hiệu chỉnh",
  })[value] ?? "Loại tri thức khác";

const capitalizeFirstLetter = (value: string) => {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return "Nội dung tri thức";
  return `${normalized.charAt(0).toLocaleUpperCase("vi")}${normalized.slice(1)}`;
};

const englishKnowledgeTitles: Record<string, string> = {
  "vip customer priority for best plot without prepayment":
    "Ưu tiên khách VIP chọn lô đẹp nhất mà không cần thanh toán trước",
  "vip priority without prepayment":
    "Ưu tiên khách VIP mà không cần thanh toán trước",
  "purchase process": "Quy trình mua lô",
  "can customers request remote grave care?":
    "Khách hàng có thể yêu cầu chăm sóc mộ từ xa không?",
};

const looksLikeEnglishTitle = (value: string) => {
  const words = value.toLocaleLowerCase().match(/[a-z]+/g) ?? [];
  const englishMarkers = new Set([
    "best",
    "care",
    "customer",
    "for",
    "grave",
    "location",
    "near",
    "option",
    "plot",
    "prepayment",
    "priority",
    "process",
    "purchase",
    "request",
    "service",
    "status",
    "without",
  ]);
  return words.filter((word) => englishMarkers.has(word)).length >= 2;
};

const knowledgeTitleLabel = (item: KnowledgeProposal) => {
  const normalized = item.title.trim().replace(/\s+/g, " ");
  const translated = englishKnowledgeTitles[normalized.toLocaleLowerCase()];
  if (translated) return capitalizeFirstLetter(translated);
  if (looksLikeEnglishTitle(normalized)) {
    return capitalizeFirstLetter(
      {
        faq: "Câu hỏi thường gặp",
        business_rule: "Quy định nghiệp vụ",
        information_correction: "Hiệu chỉnh thông tin",
      }[item.knowledgeType] ?? "Nội dung tri thức",
    );
  }
  return capitalizeFirstLetter(normalized);
};

const sourceRoleLabel = (value?: string) =>
  ({ customer: "Khách hàng", admin: "Quản trị viên", system: "Hệ thống" })[
    value ?? ""
  ] ?? "Nguồn hệ thống";

const knowledgeStatusLabel = (value: string) =>
  ({
    quarantined: "Chờ xác minh",
    active: "Đang được trợ lý sử dụng",
    rejected: "Đã từ chối",
    proposed: "Mới được đề xuất",
    validating: "Đang xác minh",
    superseded: "Đã được thay thế",
    deleted: "Đã xóa khỏi kho",
  })[value] ?? "Trạng thái khác";

const feedbackTypeLabel = (value: string) =>
  ({
    helpful: "Phản hồi hữu ích",
    bad_recommendation: "Đề xuất lô chưa phù hợp",
    wrong_information: "Báo thông tin chưa chính xác",
    irrelevant_answer: "Câu trả lời chưa đúng trọng tâm",
    other: "Phản hồi khác",
    // Legacy values kept so older rows still render cleanly.
    correction: "Đề nghị sửa câu trả lời",
    positive: "Phản hồi tích cực",
    negative: "Phản hồi chưa hài lòng",
    report: "Báo cáo nội dung",
  })[value] ?? "Phản hồi khác";

const customerProposalTypeLabel = (value: CustomerProposal["proposalType"]) =>
  ({
    price_negotiation: "Thương lượng giá",
    website_suggestion: "Góp ý website",
    service_suggestion: "Đề xuất dịch vụ",
    plot_feedback: "Góp ý về lô đất",
    policy_suggestion: "Đề xuất chính sách",
    complaint: "Khiếu nại cần quản trị xử lý",
    other: "Đề xuất khác",
  })[value];

const formatVnd = (value?: number | null) =>
  typeof value === "number"
    ? `${new Intl.NumberFormat("vi-VN").format(value)} VNĐ`
    : undefined;

const knowledgeCategoryLabel = (value: string) => {
  const normalized = value.trim();
  const known = (
    {
      faq: "Câu hỏi thường gặp",
      business_rule: "Quy định nghiệp vụ",
      information_correction: "Hiệu chỉnh thông tin",
      verified_correction: "Nội dung đã được hiệu chỉnh",
      service: "Dịch vụ nghĩa trang",
      maintenance: "Chăm sóc và bảo trì phần mộ",
      ritual: "Nghi lễ và tưởng niệm",
      plot: "Thông tin lô đất",
      plot_location: "Vị trí và khu vực lô đất",
      plot_status: "Trạng thái lô đất",
      plot_ranking: "Tiêu chí lựa chọn lô",
      process: "Quy trình nghiệp vụ",
      purchase_process: "Quy trình mua lô",
      spiritual_consultation: "Tư vấn phong thủy và âm trạch",
      conversation_preference: "Sở thích hội thoại",
      service_request_review: "Xử lý yêu cầu dịch vụ",
      general: "Tri thức chung",
    } as Record<string, string>
  )[normalized.toLowerCase()];
  if (known) return known;
  return /^[a-z0-9_-]+$/i.test(normalized)
    ? "Nhóm tri thức hệ thống"
    : capitalizeFirstLetter(normalized);
};

const knowledgeCategoryOptions = [
  { value: "general", label: "Tri thức chung" },
  { value: "faq", label: "Câu hỏi thường gặp" },
  { value: "process", label: "Quy trình nghiệp vụ" },
  { value: "service", label: "Dịch vụ nghĩa trang" },
  { value: "plot", label: "Thông tin lô đất" },
  { value: "spiritual_consultation", label: "Tư vấn phong thủy và âm trạch" },
  { value: "business_rule", label: "Quy định nghiệp vụ" },
];

const knowledgeTypeOptions = [
  { value: "faq", label: "Thông tin để AI tham khảo khi trả lời" },
  { value: "business_rule", label: "Quy định / giới hạn nghiệp vụ" },
  {
    value: "information_correction",
    label: "Nội dung dùng để sửa thông tin cũ",
  },
] as const;

const knowledgeSourceLabel = (item: KnowledgeProposal) => {
  const sourceType = item.sourceType?.toLowerCase();
  if (sourceType === "admin_manual") return "Quản trị viên thêm trực tiếp";
  if (sourceType === "admin_feedback")
    return "Hiệu chỉnh đã được quản trị viên duyệt";
  if (sourceType === "system_research")
    return "Tri thức tham khảo do hệ thống chuẩn bị";
  if (sourceType === "system") return "Tri thức nền của hệ thống";
  if (item.sourceRole === "customer") return "Nội dung do khách hàng đề xuất";
  if (item.sourceRole === "admin") return "Nội dung do quản trị viên xác nhận";
  return "Tri thức đã lưu trong hệ thống";
};

const reviewReasonLabel = (value?: string) => {
  if (!value) return "Cần kiểm tra trước khi sử dụng.";
  if (/customer-provided business knowledge is unverified/i.test(value)) {
    return "Nguồn khách hàng, cần quản trị viên xác minh trước khi sử dụng.";
  }
  if (/authenticated administrator proposal captured from chat/i.test(value)) {
    return "Nguồn quản trị viên đã xác thực, nhưng tri thức phát sinh từ hội thoại vẫn phải được duyệt rõ ràng tại trang quản trị trước khi trợ lý sử dụng.";
  }
  if (
    /authenticated administrator source and backend schema validation succeeded/i.test(
      value,
    )
  ) {
    return "Bản ghi cũ từ nguồn quản trị viên đã qua kiểm tra cấu trúc; hãy xác nhận lại trước khi kích hoạt nếu nội dung chưa được duyệt thủ công.";
  }
  if (
    /superseded by (?:knowledge entry|an administrator-approved knowledge proposal)/i.test(
      value,
    )
  ) {
    return "Nội dung này đã được thay thế bằng một bản tri thức mới hơn đã được duyệt.";
  }
  return !/[^\x20-\x7E\t\r\n]/.test(value)
    ? "Lý do kiểm duyệt được ghi nhận từ phiên bản hệ thống trước."
    : value;
};

export default function AgentAdminPage() {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [tab, setTab] = useState<Tab>("overview");
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [knowledgeProposals, setKnowledgeProposals] = useState<
    KnowledgeProposal[]
  >([]);
  const [customerProposals, setCustomerProposals] = useState<
    CustomerProposal[]
  >([]);
  const [customerProposalReviewNotes, setCustomerProposalReviewNotes] =
    useState<Record<number, string>>({});
  const [knowledgeInventory, setKnowledgeInventory] = useState<
    KnowledgeProposal[]
  >([]);
  const [learningJournal, setLearningJournal] = useState<LearningJournalItem[]>(
    [],
  );
  const [knowledgeStatus, setKnowledgeStatus] = useState("all");
  const [knowledgeSearch, setKnowledgeSearch] = useState("");
  const [knowledgeReviewNotes, setKnowledgeReviewNotes] = useState<
    Record<number, string>
  >({});
  const [feedbackReviewNotes, setFeedbackReviewNotes] = useState<
    Record<number, string>
  >({});
  const [analytics, setAnalytics] = useState<LearningAnalytics>();
  const [analyticsDays, setAnalyticsDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [knowledgeDialog, setKnowledgeDialog] =
    useState<KnowledgeDialogState | null>(null);
  const [knowledgeForm, setKnowledgeForm] =
    useState<KnowledgeForm>(emptyKnowledgeForm);

  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(undefined);
      const results = await Promise.allSettled([
        api.get("/admin/ai-agent/feedback", { params: { status: "pending" } }),
        api.get("/admin/ai-agent/learning-analytics", {
          params: { days: analyticsDays },
        }),
        api.get("/admin/ai-agent/customer-proposals", {
          params: { status: "pending" },
        }),
        api.get("/admin/ai-agent/knowledge", {
          params: { status: "quarantined" },
        }),
        api.get("/admin/ai-agent/knowledge", {
          params: { status: "all" },
        }),
        api.get("/admin/ai-agent/learning-journal", {
          params: { limit: 100 },
        }),
      ]);

      const labels = [
        "phản hồi",
        "thống kê học tập",
        "đề xuất khách hàng",
        "tri thức chờ duyệt",
        "kho tri thức",
        "nhật ký AI tự học",
      ];
      const failed = results.flatMap((result, index) =>
        result.status === "rejected" ? [labels[index]] : [],
      );
      const payload = <T,>(result: PromiseSettledResult<{ data: unknown }>) =>
        result.status === "fulfilled"
          ? (((result.value.data as { data?: T }).data ??
              result.value.data) as T)
          : undefined;

      const feedbackData = payload<Feedback[]>(results[0]);
      const analyticsData = payload<LearningAnalytics>(results[1]);
      const customerProposalData = payload<CustomerProposal[]>(results[2]);
      const knowledgeData = payload<KnowledgeProposal[]>(results[3]);
      const inventoryData = payload<KnowledgeProposal[]>(results[4]);
      const journalData = payload<LearningJournalItem[]>(results[5]);
      setFeedback(newestFirst(feedbackData ?? []));
      setAnalytics(analyticsData);
      setCustomerProposals(newestFirst(customerProposalData ?? []));
      setKnowledgeProposals(newestFirst(knowledgeData ?? []));
      setKnowledgeInventory(inventoryData ?? []);
      setLearningJournal(journalData ?? []);

      if (failed.length) {
        setError(
          `Không tải được: ${failed.join(", ")}. Các phần còn lại vẫn sử dụng bình thường.`,
        );
      }
      if (!silent) setLoading(false);
    },
    [analyticsDays],
  );

  useEffect(() => {
    queueMicrotask(() => void loadData());
  }, [loadData]);

  useRealtimeRefresh(["ai"], () => loadData(true));

  const openCreateKnowledge = () => {
    setError(undefined);
    setKnowledgeForm(emptyKnowledgeForm);
    setKnowledgeDialog({ mode: "create" });
  };

  const openKnowledge = (
    item: KnowledgeProposal,
    mode: "view" | "edit" = "view",
  ) => {
    setError(undefined);
    setKnowledgeForm({
      title: item.title,
      category: item.category,
      knowledgeType:
        item.knowledgeType === "business_rule" ||
        item.knowledgeType === "information_correction"
          ? item.knowledgeType
          : "faq",
      content: item.content,
      reviewNote: "",
    });
    setKnowledgeDialog({ mode, item });
  };

  const closeKnowledgeDialog = () => {
    if (busy === "knowledge-save" || busy === "knowledge-delete") return;
    setKnowledgeDialog(null);
    setKnowledgeForm(emptyKnowledgeForm);
  };

  const saveKnowledge = async () => {
    const title = knowledgeForm.title.trim();
    const content = knowledgeForm.content.trim();
    if (title.length < 3) {
      setError("Tên tri thức cần ít nhất 3 ký tự.");
      return;
    }
    if (content.length < 10) {
      setError("Nội dung tri thức cần ít nhất 10 ký tự.");
      return;
    }
    if (!knowledgeDialog) return;

    const isCreate = knowledgeDialog.mode === "create";
    if (
      !(await confirm({
        title: isCreate ? "Thêm tri thức mới" : "Lưu thay đổi tri thức",
        message: isCreate
          ? "Tri thức do quản trị viên thêm trực tiếp sẽ được kích hoạt cho AI sử dụng ngay sau khi lưu. Tiếp tục?"
          : "Bản sửa này sẽ thay nội dung hiện tại và được kích hoạt cho AI sử dụng ngay. Tiếp tục?",
        confirmLabel: isCreate ? "Thêm và kích hoạt" : "Lưu và kích hoạt",
      }))
    )
      return;

    setBusy("knowledge-save");
    setError(undefined);
    try {
      const payload = {
        title,
        category: knowledgeForm.category,
        knowledgeType: knowledgeForm.knowledgeType,
        content,
        reviewNote: knowledgeForm.reviewNote.trim() || undefined,
      };
      if (isCreate) {
        await api.post("/admin/ai-agent/knowledge", payload);
      } else {
        await api.patch(
          `/admin/ai-agent/knowledge/${knowledgeDialog.item.knowledgeEntryId}`,
          payload,
        );
      }
      setKnowledgeDialog(null);
      setKnowledgeForm(emptyKnowledgeForm);
      await loadData();
    } catch (error) {
      const responseMessage =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: unknown } } })
          .response?.data?.message === "string"
          ? (error as { response: { data: { message: string } } }).response.data
              .message
          : undefined;
      setError(
        responseMessage ||
          "Không thể lưu tri thức. Dữ liệu hiện tại chưa bị thay đổi.",
      );
    } finally {
      setBusy(undefined);
    }
  };

  const deleteKnowledge = async (item: KnowledgeProposal) => {
    if (
      !(await confirm({
        title: "Xóa tri thức khỏi kho",
        message: `Xóa “${knowledgeTitleLabel(item)}” khỏi kho tri thức? AI sẽ không thể truy xuất nội dung này nữa. Lịch sử thao tác quản trị vẫn được giữ để kiểm tra.`,
        confirmLabel: "Xóa tri thức",
      }))
    )
      return;

    setBusy("knowledge-delete");
    setError(undefined);
    try {
      await api.delete(`/admin/ai-agent/knowledge/${item.knowledgeEntryId}`);
      setKnowledgeDialog(null);
      setKnowledgeForm(emptyKnowledgeForm);
      await loadData();
    } catch (error) {
      const responseMessage =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: unknown } } })
          .response?.data?.message === "string"
          ? (error as { response: { data: { message: string } } }).response.data
              .message
          : undefined;
      setError(
        responseMessage ||
          "Không thể xóa tri thức. Nội dung vẫn được giữ nguyên trong kho.",
      );
    } finally {
      setBusy(undefined);
    }
  };

  const reviewFeedback = async (
    item: Feedback,
    action: "approve" | "reject",
  ) => {
    const reviewNote = feedbackReviewNotes[item.feedbackId]?.trim();
    if (!reviewNote || reviewNote.length < 5) {
      setError("Vui lòng ghi lý do kiểm duyệt phản hồi, tối thiểu 5 ký tự.");
      return;
    }
    const applyCorrection =
      action === "approve" && Boolean(item.correctedContent);
    const message = applyCorrection
      ? "Duyệt và đưa nội dung sửa này vào kho tri thức?"
      : `${action === "approve" ? "Duyệt" : "Từ chối"} phản hồi này?`;
    if (!(await confirm({ message }))) return;

    setBusy(`feedback-${item.feedbackId}`);
    try {
      await api.patch(`/admin/ai-agent/feedback/${item.feedbackId}/${action}`, {
        reviewNote,
        applyCorrection,
      });
      setFeedbackReviewNotes((current) => {
        const next = { ...current };
        delete next[item.feedbackId];
        return next;
      });
      await loadData();
    } catch {
      setError(
        "Không thể cập nhật phản hồi. Dữ liệu chưa bị thay đổi, vui lòng thử lại.",
      );
    } finally {
      setBusy(undefined);
    }
  };

  const reviewKnowledge = async (
    item: KnowledgeProposal,
    action: "approve" | "reject",
  ) => {
    const reviewNote = knowledgeReviewNotes[item.knowledgeEntryId]?.trim();
    if (action === "approve" && (!reviewNote || reviewNote.length < 5)) {
      setError(
        "Vui lòng ghi căn cứ trước khi kích hoạt tri thức, tối thiểu 5 ký tự.",
      );
      return;
    }
    if (action === "reject" && reviewNote && reviewNote.length < 5) {
      setError(
        "Nếu ghi lý do từ chối, vui lòng nhập tối thiểu 5 ký tự hoặc để trống.",
      );
      return;
    }
    const label = action === "approve" ? "Duyệt và kích hoạt" : "Từ chối";
    if (!(await confirm({ message: `${label} đề xuất tri thức này?` }))) return;

    setBusy(`knowledge-${item.knowledgeEntryId}`);
    setError(undefined);
    try {
      await api.patch(
        `/admin/ai-agent/knowledge/${item.knowledgeEntryId}/${action}`,
        reviewNote ? { reviewNote } : {},
      );
      setKnowledgeReviewNotes((current) => {
        const next = { ...current };
        delete next[item.knowledgeEntryId];
        return next;
      });
      await loadData();
    } catch (error) {
      const responseMessage =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: unknown } } })
          .response?.data?.message === "string"
          ? (error as { response: { data: { message: string } } }).response.data
              .message
          : undefined;
      setError(
        responseMessage ||
          "Không thể cập nhật trạng thái tri thức. Vui lòng thử lại hoặc kiểm tra log backend.",
      );
    } finally {
      setBusy(undefined);
    }
  };

  const reviewCustomerProposal = async (
    item: CustomerProposal,
    action: "accept" | "reject",
  ) => {
    const reviewNote = customerProposalReviewNotes[item.proposalId]?.trim();
    if (!reviewNote || reviewNote.length < 5) {
      setError(
        "Vui lòng ghi kết quả xử lý đề xuất, tối thiểu 5 ký tự để giữ lịch sử kiểm duyệt.",
      );
      return;
    }
    const actionLabel = action === "accept" ? "Tiếp nhận" : "Từ chối";
    if (
      !(await confirm({
        title: `${actionLabel} đề xuất khách hàng`,
        message:
          action === "accept"
            ? "Đánh dấu đề xuất này là đã tiếp nhận để quản trị xử lý? Thao tác này không tự đổi giá, chính sách, website hay kho tri thức."
            : "Từ chối đề xuất này? Nội dung vẫn được giữ trong lịch sử quản trị.",
        confirmLabel: actionLabel,
      }))
    )
      return;

    setBusy(`customer-proposal-${item.proposalId}`);
    setError(undefined);
    try {
      await api.patch(
        `/admin/ai-agent/customer-proposals/${item.proposalId}/${action}`,
        { reviewNote },
      );
      setCustomerProposalReviewNotes((current) => {
        const next = { ...current };
        delete next[item.proposalId];
        return next;
      });
      await loadData();
    } catch {
      setError(
        "Không thể cập nhật đề xuất khách hàng. Không có thay đổi nghiệp vụ nào được áp dụng.",
      );
    } finally {
      setBusy(undefined);
    }
  };

  const saveLearningJournal = async (
    learningJournalId: number,
    payload: LearningJournalDraft,
  ) => {
    const currentLesson = learningJournal.find(
      (item) => item.learningJournalId === learningJournalId,
    );
    if (payload.title.trim().length < 3) {
      setError("Tên bài học cần ít nhất 3 ký tự.");
      return;
    }
    if (
      payload.summary.trim().length < 10 ||
      payload.preventionRule.trim().length < 10
    ) {
      setError("Phần bài học và quy tắc tránh lặp lại cần ít nhất 10 ký tự.");
      return;
    }
    if (
      !(await confirm({
        title: currentLesson?.autoGenerated
          ? "Duyệt bài học của AI"
          : "Cập nhật bài học của AI",
        message: currentLesson?.autoGenerated
          ? "Duyệt và áp dụng bài học này? Sau khi lưu, quy tắc hành vi đã được quản trị viên kiểm tra sẽ được đưa vào ngữ cảnh AI. Nó không trở thành sự thật nghiệp vụ và không được thay đổi giá, trạng thái hay quyền hạn."
          : "Lưu thay đổi này? Bài học đã duyệt sẽ tiếp tục được đưa vào ngữ cảnh AI như một quy tắc hành vi, nhưng không trở thành sự thật nghiệp vụ trong kho tri thức.",
        confirmLabel: currentLesson?.autoGenerated
          ? "Duyệt và áp dụng"
          : "Lưu bài học",
      }))
    )
      return;
    setBusy(`learning-journal-save-${learningJournalId}`);
    setError(undefined);
    try {
      await api.patch(`/admin/ai-agent/learning-journal/${learningJournalId}`, {
        title: payload.title.trim(),
        summary: payload.summary.trim(),
        preventionRule: payload.preventionRule.trim(),
        category: payload.category,
      });
      await loadData();
    } catch (error) {
      const responseMessage =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: unknown } } })
          .response?.data?.message === "string"
          ? (error as { response: { data: { message: string } } }).response.data
              .message
          : undefined;
      setError(
        responseMessage ||
          "Không thể cập nhật bài học. Bản đang áp dụng vẫn được giữ nguyên.",
      );
    } finally {
      setBusy(undefined);
    }
  };

  const deleteLearningJournal = async (item: LearningJournalItem) => {
    if (
      !(await confirm({
        title: "Xóa bài học khỏi nhật ký AI",
        message: `Xóa “${item.title}”? AI sẽ ngừng nhận quy tắc này ở các lượt tư vấn mới. Lịch sử thao tác quản trị vẫn được giữ trong audit log.`,
        confirmLabel: "Xóa bài học",
      }))
    )
      return;
    setBusy(`learning-journal-delete-${item.learningJournalId}`);
    setError(undefined);
    try {
      await api.delete(
        `/admin/ai-agent/learning-journal/${item.learningJournalId}`,
      );
      await loadData();
    } catch (error) {
      const responseMessage =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: unknown } } })
          .response?.data?.message === "string"
          ? (error as { response: { data: { message: string } } }).response.data
              .message
          : undefined;
      setError(
        responseMessage ||
          "Không thể xóa bài học. Nhật ký AI hiện tại chưa bị thay đổi.",
      );
    } finally {
      setBusy(undefined);
    }
  };

  const pendingCount = feedback.filter(
    (item) => item.status === "pending",
  ).length;
  const pendingKnowledgeCount = knowledgeProposals.length;
  const pendingCustomerProposalCount = customerProposals.length;
  const filteredKnowledge = knowledgeInventory.filter((item) => {
    const matchesStatus =
      knowledgeStatus === "all" || item.status === knowledgeStatus;
    const query = knowledgeSearch.trim().toLocaleLowerCase("vi");
    return (
      matchesStatus &&
      (!query ||
        item.title.toLocaleLowerCase("vi").includes(query) ||
        knowledgeTitleLabel(item).toLocaleLowerCase("vi").includes(query) ||
        item.category.toLocaleLowerCase("vi").includes(query) ||
        item.content.toLocaleLowerCase("vi").includes(query))
    );
  });

  return (
    <div className="agent-admin">
      {confirmDialog}
      <header className="agent-admin__page-header">
        <div className="agent-admin__page-copy">
          <span className="agent-admin__page-kicker">Quản trị trợ lý AI</span>
          <h1>Học tập và tri thức</h1>
          <p>
            Một nơi để xem nhật ký AI tự học, tri thức nào đã được xác minh, đề
            xuất nào cần quản trị xử lý và hệ thống AI đang hoạt động ra sao.
          </p>
        </div>
        <aside className="agent-admin__guardrail">
          <strong>Phạm vi quản trị</strong>
          <p>
            Bộ nhớ cá nhân của khách hàng chỉ được dùng nội bộ để cá nhân hóa
            đúng tài khoản và không hiển thị trên trang quản trị này. Tri thức
            dùng chung và thay đổi nghiệp vụ vẫn theo luồng kiểm soát riêng.
          </p>
        </aside>
      </header>

      <nav className="agent-admin__tabs" aria-label="Quản trị AI">
        {tabs.map((item) => (
          <button
            aria-current={tab === item.id ? "page" : undefined}
            className={tab === item.id ? "is-active" : ""}
            key={item.id}
            onClick={() => setTab(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </nav>

      {error && <div className="agent-admin__error">{error}</div>}
      {loading ? (
        <div className="agent-admin__empty">
          Đang tổng hợp dữ liệu trợ lý AI…
        </div>
      ) : (
        <section className="agent-admin__panel">
          {tab === "overview" && (
            <LearningAnalyticsPanel
              analytics={analytics}
              days={analyticsDays}
              loading={loading}
              onDaysChange={setAnalyticsDays}
            />
          )}

          {tab === "journal" && (
            <div className="agent-admin__section">
              <LearningJournalPanel
                items={learningJournal}
                busy={busy}
                onDelete={deleteLearningJournal}
                onSave={saveLearningJournal}
              />
            </div>
          )}

          {tab === "review" && (
            <div className="agent-admin__section">
              <header className="agent-admin__section-header">
                <div>
                  <h2>Đề xuất người dùng</h2>
                  <p>
                    Kiểm duyệt câu hỏi đóng góp, hiệu chỉnh câu trả lời và xem
                    xét các đề xuất nghiệp vụ do khách hàng gửi đến trợ lý AI.
                  </p>
                </div>
                <div className="agent-admin__section-count">
                  <strong>
                    {pendingKnowledgeCount +
                      pendingCount +
                      pendingCustomerProposalCount}
                  </strong>
                  <span>mục chờ xử lý</span>
                </div>
              </header>

              <section className="agent-admin__subsection">
                <header>
                  <div>
                    <h3>Câu hỏi thường gặp & tri thức chờ xác minh</h3>
                    <p>
                      Nội dung do người dùng gửi không tự động trở thành tri
                      thức chính thức. Chỉ nội dung được duyệt mới được trợ lý
                      dùng để trả lời những người dùng khác.
                    </p>
                  </div>
                </header>

                <div className="agent-admin__review-queue">
                  {knowledgeProposals.map((item) => (
                    <article
                      className="agent-admin__knowledge-review"
                      key={item.knowledgeEntryId}
                    >
                      <div className="agent-admin__knowledge-main">
                        <div className="agent-admin__knowledge-meta">
                          <span className="agent-admin__status status-quarantined">
                            Chờ xác minh
                          </span>
                          <span>{knowledgeTypeLabel(item.knowledgeType)}</span>
                          <span>{sourceRoleLabel(item.sourceRole)}</span>
                        </div>
                        <h3>{knowledgeTitleLabel(item)}</h3>
                        <p className="agent-admin__knowledge-category">
                          {knowledgeCategoryLabel(item.category)}
                        </p>
                        <details className="agent-admin__knowledge-content">
                          <summary>Xem nội dung khách gửi</summary>
                          <p>{item.content}</p>
                        </details>
                        <p className="agent-admin__review-note">
                          {reviewReasonLabel(item.validationReason)}
                        </p>
                        <label className="agent-admin__review-field">
                          <span>Căn cứ kiểm duyệt</span>
                          <textarea
                            maxLength={1000}
                            onChange={(event) =>
                              setKnowledgeReviewNotes((current) => ({
                                ...current,
                                [item.knowledgeEntryId]: event.target.value,
                              }))
                            }
                            placeholder="Ghi nguồn hoặc lý do để người kiểm tra sau có thể đối chiếu"
                            rows={2}
                            value={
                              knowledgeReviewNotes[item.knowledgeEntryId] ?? ""
                            }
                          />
                        </label>
                      </div>
                      <div className="agent-admin__knowledge-actions">
                        <time>{formatDate(item.createdAt)}</time>
                        <div className="agent-admin__actions">
                          <button
                            disabled={
                              busy === `knowledge-${item.knowledgeEntryId}`
                            }
                            onClick={() => reviewKnowledge(item, "approve")}
                            type="button"
                          >
                            Duyệt
                          </button>
                          <button
                            className="danger"
                            disabled={
                              busy === `knowledge-${item.knowledgeEntryId}`
                            }
                            onClick={() => reviewKnowledge(item, "reject")}
                            type="button"
                          >
                            Từ chối
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                  {!knowledgeProposals.length && (
                    <div className="agent-admin__empty">
                      Chưa có câu hỏi thường gặp hoặc đề xuất tri thức nào chờ
                      kiểm duyệt.
                    </div>
                  )}
                </div>
              </section>

              <section className="agent-admin__subsection">
                <header>
                  <h3>Hiệu chỉnh câu trả lời cần xử lý</h3>
                  <p>
                    Các phản hồi cần được đối chiếu trước khi duyệt. Chỉ bật “áp
                    dụng hiệu chỉnh” khi nội dung sửa đã được xác minh.
                  </p>
                </header>
                <div className="agent-admin__list">
                  {feedback.map((item) => (
                    <article
                      className="agent-admin__feedback"
                      key={item.feedbackId}
                    >
                      <div className="agent-admin__row">
                        <span
                          className={`agent-admin__status status-${item.status}`}
                        >
                          Chờ xử lý
                        </span>
                        <span>
                          {item.rating
                            ? `${item.rating}/5 điểm`
                            : "Chưa chấm điểm"}
                        </span>
                        <time>{formatDate(item.createdAt)}</time>
                      </div>
                      <h3>{feedbackTypeLabel(item.feedbackType)}</h3>
                      <p>{item.reason || "Không có bình luận."}</p>
                      {item.correctedContent && (
                        <blockquote>
                          <strong>Nội dung đề xuất</strong>
                          <span>{item.correctedContent}</span>
                        </blockquote>
                      )}
                      <label className="agent-admin__review-field">
                        <span>Căn cứ xử lý</span>
                        <textarea
                          maxLength={1000}
                          onChange={(event) =>
                            setFeedbackReviewNotes((current) => ({
                              ...current,
                              [item.feedbackId]: event.target.value,
                            }))
                          }
                          placeholder="Ghi kết quả đối chiếu trước khi duyệt hoặc từ chối"
                          rows={2}
                          value={feedbackReviewNotes[item.feedbackId] ?? ""}
                        />
                      </label>
                      {item.status === "pending" && (
                        <div className="agent-admin__actions">
                          <button
                            disabled={busy === `feedback-${item.feedbackId}`}
                            onClick={() => reviewFeedback(item, "approve")}
                            type="button"
                          >
                            Duyệt và xác minh
                          </button>
                          <button
                            className="danger"
                            disabled={busy === `feedback-${item.feedbackId}`}
                            onClick={() => reviewFeedback(item, "reject")}
                            type="button"
                          >
                            Từ chối
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                  {!feedback.length && (
                    <div className="agent-admin__empty">
                      Chưa có phản hồi nào cần kiểm duyệt.
                    </div>
                  )}
                </div>
              </section>

              <section className="agent-admin__subsection">
                <header>
                  <div>
                    <h3>Đề xuất cần quản trị xử lý</h3>
                    <p>
                      Thương lượng giá, góp ý website, dịch vụ, lô đất, chính
                      sách và khiếu nại được tách khỏi kho tri thức. Trợ lý chỉ
                      ghi nhận và chuyển tiếp; quyền quyết định vẫn thuộc quản
                      trị viên.
                    </p>
                  </div>
                </header>
                <div className="agent-admin__review-queue">
                  {customerProposals.map((item) => (
                    <article
                      className="agent-admin__knowledge-review"
                      key={item.proposalId}
                    >
                      <div className="agent-admin__knowledge-main">
                        <div className="agent-admin__knowledge-meta">
                          <span className="agent-admin__status status-quarantined">
                            Chờ quản trị xử lý
                          </span>
                          <span>
                            {customerProposalTypeLabel(item.proposalType)}
                          </span>
                          {item.userId ? (
                            <span>Khách hàng #{item.userId}</span>
                          ) : null}
                        </div>
                        <h3>{item.subject}</h3>
                        <p className="agent-admin__knowledge-category">
                          {item.selectedPlotCode
                            ? `Lô ${item.selectedPlotCode}`
                            : item.serviceName || "Đề xuất nghiệp vụ"}
                          {formatVnd(item.proposedAmountVnd)
                            ? ` · Mức khách đề xuất ${formatVnd(item.proposedAmountVnd)}`
                            : ""}
                        </p>
                        <p className="agent-admin__proposal-content">
                          {item.content}
                        </p>
                        {item.sourceMessage && (
                          <details className="agent-admin__knowledge-content">
                            <summary>Xem câu chat nguồn</summary>
                            <p>{item.sourceMessage}</p>
                          </details>
                        )}
                        <p className="agent-admin__review-note">
                          Tiếp nhận tại đây chỉ xác nhận quản trị viên đã nhận
                          đề xuất. Hệ thống không tự thay giá, quy định, website
                          hoặc cho phép AI sử dụng nội dung này trong kho tri
                          thức.
                        </p>
                        <label className="agent-admin__review-field">
                          <span>Kết quả xử lý / ghi chú quản trị</span>
                          <textarea
                            maxLength={2000}
                            onChange={(event) =>
                              setCustomerProposalReviewNotes((current) => ({
                                ...current,
                                [item.proposalId]: event.target.value,
                              }))
                            }
                            placeholder="Ví dụ: chuyển bộ phận kinh doanh xem xét mức giá; ghi nhận cho backlog UI"
                            rows={2}
                            value={
                              customerProposalReviewNotes[item.proposalId] ?? ""
                            }
                          />
                        </label>
                      </div>
                      <div className="agent-admin__knowledge-actions">
                        <time>{formatDate(item.createdAt)}</time>
                        <div className="agent-admin__actions">
                          <button
                            disabled={
                              busy === `customer-proposal-${item.proposalId}`
                            }
                            onClick={() =>
                              reviewCustomerProposal(item, "accept")
                            }
                            type="button"
                          >
                            Tiếp nhận
                          </button>
                          <button
                            className="danger"
                            disabled={
                              busy === `customer-proposal-${item.proposalId}`
                            }
                            onClick={() =>
                              reviewCustomerProposal(item, "reject")
                            }
                            type="button"
                          >
                            Từ chối
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                  {!customerProposals.length && (
                    <div className="agent-admin__empty">
                      Chưa có đề xuất khách hàng nào chờ quản trị xử lý.
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {tab === "knowledge" && (
            <section className="agent-admin__section">
              <header className="agent-admin__section-header">
                <div>
                  <h2>Kho tri thức dùng chung</h2>
                  <p>
                    Chỉ các tri thức có trạng thái “Đang sử dụng” mới được trợ
                    lý AI dùng khi tạo câu trả lời. Tri thức bị cách ly hoặc
                    chưa duyệt sẽ không được đưa vào ngữ cảnh RAG.
                  </p>
                </div>
                <div className="agent-admin__header-actions">
                  <button
                    className="agent-admin__primary-button"
                    onClick={openCreateKnowledge}
                    type="button"
                  >
                    <Plus size={16} />
                    <span>Thêm tri thức</span>
                  </button>
                  <div className="agent-admin__section-count">
                    <strong>
                      {
                        knowledgeInventory.filter(
                          (item) => item.status === "active",
                        ).length
                      }
                    </strong>
                    <span>mục đang hoạt động</span>
                  </div>
                </div>
              </header>

              <div className="agent-admin__knowledge-toolbar">
                <label>
                  <span>Tìm tri thức</span>
                  <input
                    onChange={(event) => setKnowledgeSearch(event.target.value)}
                    placeholder="Tìm theo tiêu đề, nhóm hoặc nội dung"
                    type="search"
                    value={knowledgeSearch}
                  />
                </label>
                <label>
                  <span>Trạng thái sử dụng</span>
                  <select
                    onChange={(event) => setKnowledgeStatus(event.target.value)}
                    value={knowledgeStatus}
                  >
                    <option value="all">Tất cả</option>
                    <option value="active">Đang sử dụng</option>
                    <option value="quarantined">Chờ xác minh</option>
                    <option value="rejected">Bị từ chối</option>
                    <option value="superseded">Đã thay thế</option>
                  </select>
                </label>
              </div>

              <div className="agent-admin__table-wrap">
                <table aria-label="Kho tri thức dùng chung">
                  <thead>
                    <tr>
                      <th>Tri thức</th>
                      <th>Loại</th>
                      <th>Trạng thái sử dụng</th>
                      <th>Nguồn</th>
                      <th style={{ textAlign: "right" }}>Cập nhật</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredKnowledge.map((item) => (
                      <tr key={item.knowledgeEntryId}>
                        <td className="agent-admin__knowledge-cell">
                          <strong>{knowledgeTitleLabel(item)}</strong>
                          <span>{knowledgeCategoryLabel(item.category)}</span>
                          <details>
                            <summary>Xem nội dung và căn cứ</summary>
                            <p>{item.content}</p>
                            <small>
                              {reviewReasonLabel(item.validationReason)}
                            </small>
                          </details>
                        </td>
                        <td>{knowledgeTypeLabel(item.knowledgeType)}</td>
                        <td>
                          <span
                            className={`agent-admin__status status-${item.status}`}
                          >
                            {knowledgeStatusLabel(item.status)}
                          </span>
                        </td>
                        <td>{sourceRoleLabel(item.sourceRole)}</td>
                        <td className="agent-admin__knowledge-time-cell">
                          <time>
                            {formatDate(item.updatedAt ?? item.createdAt)}
                          </time>
                          <div className="agent-admin__table-actions">
                            <button
                              className="agent-admin__action-btn"
                              onClick={() => openKnowledge(item, "view")}
                              title="Xem chi tiết"
                              type="button"
                            >
                              <Eye size={10} />
                              <span>Xem</span>
                            </button>
                            <button
                              className="agent-admin__action-btn"
                              onClick={() => openKnowledge(item, "edit")}
                              title="Chỉnh sửa"
                              type="button"
                            >
                              <Pencil size={10} />
                              <span>Sửa</span>
                            </button>
                            <button
                              className="agent-admin__action-btn danger"
                              disabled={busy === "knowledge-delete"}
                              onClick={() => deleteKnowledge(item)}
                              title="Xóa tri thức"
                              type="button"
                            >
                              <Trash2 size={10} />
                              <span>Xóa</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filteredKnowledge.length && (
                  <div className="agent-admin__empty">
                    Không có tri thức phù hợp với bộ lọc hiện tại.
                  </div>
                )}
              </div>
            </section>
          )}
        </section>
      )}

      {knowledgeDialog && (
        <div
          aria-label={
            knowledgeDialog.mode === "create"
              ? "Thêm tri thức mới"
              : "Chi tiết tri thức"
          }
          aria-modal="true"
          className="agent-admin__dialog-backdrop"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) closeKnowledgeDialog();
          }}
          role="dialog"
        >
          <section className="agent-admin__knowledge-dialog">
            <header className="agent-admin__knowledge-dialog-header">
              <div>
                <span>
                  {knowledgeDialog.mode === "create"
                    ? "Thêm và cho AI sử dụng ngay"
                    : knowledgeDialog.mode === "edit"
                      ? "Chỉnh sửa tri thức"
                      : "Nội dung tri thức"}
                </span>
                <h2>
                  {knowledgeDialog.mode === "create"
                    ? "Thêm tri thức mới"
                    : knowledgeTitleLabel(knowledgeDialog.item)}
                </h2>
              </div>
              <button
                aria-label="Đóng"
                className="agent-admin__dialog-close"
                onClick={closeKnowledgeDialog}
                type="button"
              >
                Đóng
              </button>
            </header>

            {error && <div className="agent-admin__dialog-error">{error}</div>}

            {knowledgeDialog.mode === "view" ? (
              <div className="agent-admin__knowledge-dialog-body">
                <div className="agent-admin__knowledge-facts">
                  <article>
                    <span>Nhóm nội dung</span>
                    <strong>
                      {knowledgeCategoryLabel(knowledgeDialog.item.category)}
                    </strong>
                  </article>
                  <article>
                    <span>Mục đích</span>
                    <strong>
                      {knowledgeTypeLabel(knowledgeDialog.item.knowledgeType)}
                    </strong>
                  </article>
                  <article>
                    <span>AI hiện có được dùng?</span>
                    <strong>
                      {knowledgeStatusLabel(knowledgeDialog.item.status)}
                    </strong>
                  </article>
                  <article>
                    <span>Nguồn nội dung</span>
                    <strong>
                      {knowledgeSourceLabel(knowledgeDialog.item)}
                    </strong>
                  </article>
                </div>

                <section className="agent-admin__knowledge-full-content">
                  <h3>Nội dung AI nhận được khi truy xuất</h3>
                  <p>{knowledgeDialog.item.content}</p>
                </section>

                <section className="agent-admin__knowledge-audit-note">
                  <div>
                    <span>Căn cứ / trạng thái kiểm duyệt</span>
                    <p>
                      {reviewReasonLabel(knowledgeDialog.item.validationReason)}
                    </p>
                  </div>
                  <div>
                    <span>Cập nhật gần nhất</span>
                    <p>
                      {formatDate(
                        knowledgeDialog.item.updatedAt ??
                          knowledgeDialog.item.createdAt,
                      )}
                    </p>
                  </div>
                </section>

                <footer className="agent-admin__dialog-actions">
                  <button
                    onClick={() => openKnowledge(knowledgeDialog.item, "edit")}
                    type="button"
                  >
                    Chỉnh sửa
                  </button>
                  <button
                    className="danger"
                    disabled={busy === "knowledge-delete"}
                    onClick={() => deleteKnowledge(knowledgeDialog.item)}
                    type="button"
                  >
                    {busy === "knowledge-delete"
                      ? "Đang xóa…"
                      : "Xóa khỏi kho tri thức"}
                  </button>
                </footer>
              </div>
            ) : (
              <div className="agent-admin__knowledge-dialog-body">
                <p className="agent-admin__dialog-help">
                  Nội dung do quản trị viên lưu tại đây được xem là đã duyệt và
                  sẽ được AI dùng ngay khi hệ thống tìm thấy nội dung phù hợp
                  với câu hỏi. Những thay đổi giá, quyền hạn, thời hạn hoặc
                  logic giao dịch phải sửa ở backend, không được dùng kho tri
                  thức để ghi đè.
                </p>

                <div className="agent-admin__knowledge-form-grid">
                  <label className="wide">
                    <span>Tên tri thức</span>
                    <input
                      maxLength={200}
                      onChange={(event) =>
                        setKnowledgeForm((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      placeholder="Ví dụ: Quy trình đặt dịch vụ chăm sóc mộ"
                      value={knowledgeForm.title}
                    />
                  </label>
                  <label>
                    <span>Nhóm nội dung</span>
                    <select
                      onChange={(event) =>
                        setKnowledgeForm((current) => ({
                          ...current,
                          category: event.target.value,
                        }))
                      }
                      value={knowledgeForm.category}
                    >
                      {!knowledgeCategoryOptions.some(
                        (option) => option.value === knowledgeForm.category,
                      ) && (
                        <option value={knowledgeForm.category}>
                          {knowledgeCategoryLabel(knowledgeForm.category)}
                        </option>
                      )}
                      {knowledgeCategoryOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>AI dùng nội dung này để làm gì?</span>
                    <select
                      onChange={(event) =>
                        setKnowledgeForm((current) => ({
                          ...current,
                          knowledgeType: event.target
                            .value as KnowledgeForm["knowledgeType"],
                        }))
                      }
                      value={knowledgeForm.knowledgeType}
                    >
                      {knowledgeTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="wide">
                    <span>Nội dung đầy đủ</span>
                    <textarea
                      maxLength={12000}
                      onChange={(event) =>
                        setKnowledgeForm((current) => ({
                          ...current,
                          content: event.target.value,
                        }))
                      }
                      placeholder="Viết rõ thông tin mà AI cần biết. Không cần dùng từ khóa kỹ thuật."
                      rows={10}
                      value={knowledgeForm.content}
                    />
                    <small>
                      {knowledgeForm.content
                        .trim()
                        .length.toLocaleString("vi-VN")}{" "}
                      / 12.000 ký tự
                    </small>
                  </label>
                  <label className="wide">
                    <span>Ghi chú quản trị (không bắt buộc)</span>
                    <textarea
                      maxLength={1000}
                      onChange={(event) =>
                        setKnowledgeForm((current) => ({
                          ...current,
                          reviewNote: event.target.value,
                        }))
                      }
                      placeholder="Ví dụ: Đã đối chiếu với quy trình dịch vụ hiện tại"
                      rows={3}
                      value={knowledgeForm.reviewNote}
                    />
                  </label>
                </div>

                <footer className="agent-admin__dialog-actions">
                  <button
                    className="agent-admin__primary-button"
                    disabled={busy === "knowledge-save"}
                    onClick={saveKnowledge}
                    type="button"
                  >
                    {busy === "knowledge-save"
                      ? "Đang lưu…"
                      : knowledgeDialog.mode === "create"
                        ? "Thêm và cho AI sử dụng"
                        : "Lưu và cho AI sử dụng"}
                  </button>
                  {knowledgeDialog.mode === "edit" && (
                    <button
                      className="danger"
                      disabled={busy === "knowledge-delete"}
                      onClick={() => deleteKnowledge(knowledgeDialog.item)}
                      type="button"
                    >
                      {busy === "knowledge-delete"
                        ? "Đang xóa…"
                        : "Xóa tri thức"}
                    </button>
                  )}
                  <button onClick={closeKnowledgeDialog} type="button">
                    Hủy
                  </button>
                </footer>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
