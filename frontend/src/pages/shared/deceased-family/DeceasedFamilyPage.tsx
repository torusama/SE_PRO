import { useCallback, useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { nextLunarOccurrence } from "@/lib/lunarCalendar";
import NavyStarfield from "@/components/decor/NavyStarfield";
import GuidePopup, { type GuideStep } from "@/components/guide/GuidePopup";
import "./DeceasedFamilyPage.css";

const FAMILY_GUIDE_STORAGE_KEY = "hideGuide_deceasedFamilyPage";
const FAMILY_GUIDE_STEPS: GuideStep[] = [
  {
    title: "Bước 1: Xem hồ sơ người thân",
    desc: "Truy cập mục Gia đình tưởng niệm để xem danh sách hồ sơ người đã khuất đang được gia đình lưu giữ.",
  },
  {
    title: "Bước 2: Tham gia hoặc tạo nhóm gia đình",
    desc: "Tạo một nhóm gia đình mới hoặc tham gia nhóm sẵn có để cùng quản lý và chăm sóc hồ sơ tưởng niệm.",
  },
  {
    title: "Bước 3: Mời thành viên",
    desc: "Gửi lời mời đến người thân bằng địa chỉ email đã đăng ký để họ cùng tham gia không gian chung.",
  },
  {
    title: "Bước 4: Cấp quyền truy cập",
    desc: "Chỉ định chính xác nội dung (hồ sơ, lô đất, đơn dịch vụ) mà từng thành viên được phép xem hoặc thao tác.",
  },
  {
    title: "Bước 5: Theo dõi lời mời",
    desc: "Phản hồi các lời mời tham gia nhóm gia đình khác và theo dõi trạng thái quyền truy cập bất cứ lúc nào.",
  },
];

type Profile = {
  id: number;
  plotId: number;
  plotCode?: string;
  fullName: string;
  // Trường cũ — vẫn có thể tồn tại trên hồ sơ tạo trước đây, hiển thị nếu có
  // nhưng form tạo hồ sơ mới không còn dùng nữa (đã thay bằng Ngày sinh +
  // Ngày giỗ theo ngày/tháng/năm bên dưới).
  dateOfBirth?: string;
  dateOfDeath?: string;
  burialDate?: string;
  // Chế độ lịch áp dụng chung cho "Ngày sinh" và "Ngày giỗ" của hồ sơ này.
  dateCalendarType?: "solar" | "lunar";
  birthDay?: number;
  birthMonth?: number;
  birthYear?: number;
  // "Ngày giỗ" — thay thế "Ngày mất"/"Ngày an táng", lặp lại hàng năm theo
  // đúng ngày/tháng đã nhập (Dương hoặc Âm tuỳ dateCalendarType).
  anniversaryMonth?: number;
  anniversaryDay?: number;
  anniversaryYear?: number;
  hometown?: string;
  biography?: string;
  verificationStatus: string;
  rejectionReason?: string;
  deletionRequestedAt?: string;
  deletionReason?: string;
  deletionDeniedReason?: string;
};

type Family = { id: number; name: string; status: string; role?: string };
type Invitation = { id: number; familyName: string; status: string };
type Permission = {
  id: number;
  userId: number;
  resourceType: string;
  resourceId: number;
  action: string;
};
type OwnedPlot = { plotId: number; plotCode: string; zoneName?: string };
type Contract = {
  status: string;
  plotId: number;
  plotCode: string;
  zoneName?: string;
  plots?: Array<{ id: number; code: string; zoneName?: string | null }>;
};

const unwrap = <T,>(response: { data: unknown }): T => {
  const body = response.data as { data?: T };
  return body?.data ?? (response.data as T);
};

const errorText = (error: unknown) => {
  const value = error as {
    response?: { data?: { message?: string | string[] } };
  };
  const message = value.response?.data?.message;
  return Array.isArray(message)
    ? message.join(", ")
    : (message ?? "Không thể thực hiện yêu cầu.");
};

const statusLabel = (value: string) =>
  ({
    pending: "Đang chờ",
    pending_verification: "Chờ xác minh",
    verified: "Đã xác minh",
    active: "Đang hoạt động",
    accepted: "Đã chấp nhận",
    rejected: "Đã từ chối",
    disabled: "Đã tạm dừng",
    owner: "Chủ nhóm",
    admin: "Quản trị nhóm",
    member: "Thành viên",
  })[value] ?? "Đang cập nhật";

const resourceLabel = (value: string) =>
  ({
    deceased_profile: "Hồ sơ tưởng niệm",
    plot: "Lô đất",
    service_order: "Đơn dịch vụ",
  })[value] ?? "Tài nguyên";

const actionLabel = (value: string) =>
  ({
    view_profile: "Xem hồ sơ",
    view_plot: "Xem thông tin lô",
    view_service_history: "Xem lịch sử dịch vụ",
    order_service: "Đặt dịch vụ",
  })[value] ?? "Quyền truy cập";

const formatDate = (value?: string) => {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("vi-VN", { dateStyle: "long" }).format(date);
};

/** "Ngày sinh" — ưu tiên đọc từ birthDay/birthMonth/birthYear (dữ liệu mới,
 * theo đúng chế độ lịch của hồ sơ); nếu hồ sơ cũ chưa có thì lùi về đọc
 * dateOfBirth dạng chuỗi Dương lịch cũ. */
function formatBirth(profile: Profile): string {
  if (profile.birthDay && profile.birthMonth) {
    const dmy = [profile.birthDay, profile.birthMonth, profile.birthYear]
      .filter(Boolean)
      .join("/");
    return profile.dateCalendarType === "lunar"
      ? `${dmy} (Âm lịch)`
      : `${dmy} (Dương lịch)`;
  }
  return formatDate(profile.dateOfBirth);
}

/** "Ngày giỗ" — thay thế "Ngày mất"/"Ngày an táng" cũ. Ưu tiên đọc từ
 * anniversaryDay/anniversaryMonth/anniversaryYear; nếu hồ sơ cũ chưa có thì
 * lùi về hiển thị dateOfDeath (ngày mất) như trước đây. */
function formatAnniversary(profile: Profile): string {
  if (profile.anniversaryDay && profile.anniversaryMonth) {
    const dmy = [
      profile.anniversaryDay,
      profile.anniversaryMonth,
      profile.anniversaryYear,
    ]
      .filter(Boolean)
      .join("/");
    return profile.dateCalendarType === "lunar"
      ? `${dmy} (Âm lịch)`
      : `${dmy} (Dương lịch)`;
  }
  return formatDate(profile.dateOfDeath);
}

export default function DeceasedFamilyPage() {
  const role = useAuthStore((state) => state.role);
  const admin = role === "admin";
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [ownedPlots, setOwnedPlots] = useState<OwnedPlot[]>([]);
  const [familyId, setFamilyId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);

  const run = async (
    operation: () => Promise<void>,
    successMessage: string,
  ) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await operation();
      setMessage(successMessage);
    } catch (operationError) {
      setError(errorText(operationError));
    } finally {
      setBusy(false);
    }
  };

  const load = useCallback(async () => {
    setError("");
    try {
      const [response, contractsResponse] = await Promise.all([
        api.get(admin ? "/admin/deceased" : "/deceased"),
        admin ? Promise.resolve(null) : api.get("/my/contracts"),
      ]);
      const data = unwrap<{ items?: Profile[] } | Profile[]>(response);
      setProfiles(Array.isArray(data) ? data : (data.items ?? []));
      if (!admin) {
        const contracts = contractsResponse
          ? unwrap<Contract[]>(contractsResponse)
          : [];
        const plots = contracts
          .filter((contract) =>
            ["active", "completed"].includes(contract.status),
          )
          .flatMap((contract) =>
            contract.plots?.length
              ? contract.plots.map((plot) => ({
                  plotId: plot.id,
                  plotCode: plot.code,
                  zoneName: plot.zoneName ?? undefined,
                }))
              : [
                  {
                    plotId: contract.plotId,
                    plotCode: contract.plotCode,
                    zoneName: contract.zoneName,
                  },
                ],
          )
          .filter((plot) => plot.plotId && plot.plotCode);
        setOwnedPlots(
          plots.filter(
            (plot, index) =>
              plots.findIndex(
                (candidate) => candidate.plotId === plot.plotId,
              ) === index,
          ),
        );
        const [familyResponse, inviteResponse] = await Promise.all([
          api.get("/families"),
          api.get("/my/family-invitations"),
        ]);
        setFamilies(unwrap<Family[]>(familyResponse));
        setInvites(unwrap<Invitation[]>(inviteResponse));
      }
    } catch (loadError) {
      setError(errorText(loadError));
    }
  }, [admin]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  useEffect(() => {
    // Chỉ tự động hiện hướng dẫn cho khách hàng, và nếu chưa tick "Không hiển thị lại".
    if (!admin && localStorage.getItem(FAMILY_GUIDE_STORAGE_KEY) !== "true") {
      setGuideOpen(true);
    }
  }, [admin]);

  const selectFamily = async (id: number) => {
    setFamilyId(id);
    try {
      setPermissions(
        unwrap<Permission[]>(await api.get(`/families/${id}/permissions`)),
      );
    } catch (selectError) {
      setError(errorText(selectError));
      setPermissions([]);
    }
  };

  useRealtimeRefresh(["deceased", "families", "plots"], async () => {
    await load();
    if (familyId) await selectFamily(familyId);
  });

  const pendingProfiles = profiles.filter(
    (profile) => profile.verificationStatus === "pending_verification",
  ).length;
  const pendingInvites = invites.filter(
    (invitation) => invitation.status === "pending",
  ).length;

  return (
    <main className="df-page">
      <NavyStarfield />

      {!admin && (
        <GuidePopup
          open={guideOpen}
          onClose={() => setGuideOpen(false)}
          title="Gia đình tưởng niệm"
          steps={FAMILY_GUIDE_STEPS}
          storageKey={FAMILY_GUIDE_STORAGE_KEY}
          finishLabel="Bắt đầu"
        />
      )}

      <div className="df-shell">
        {!admin && (
          <div className="df-toolbar">
            <button
              type="button"
              className="df-help-btn"
              aria-label="Xem hướng dẫn gia đình tưởng niệm"
              onClick={() => setGuideOpen(true)}
            >
              <HelpCircle size={18} strokeWidth={1.8} />
            </button>
          </div>
        )}

        <header className="df-hero">
          <div className="df-hero-copy">
            <span className="df-eyebrow">
              {admin ? "Quản trị hồ sơ" : "Gia đình tưởng niệm"}
            </span>
            <h1>
              {admin
                ? "Hồ sơ người đã khuất"
                : "Gìn giữ ký ức, kết nối gia đình"}
            </h1>
            <p>
              {admin
                ? "Xác minh hồ sơ và quản lý sức chứa của từng lô trong một khu vực tập trung."
                : "Lưu thông tin người thân, cùng gia đình chăm sóc hồ sơ và chia sẻ quyền truy cập an toàn."}
            </p>
          </div>
        </header>

        <section
          className={`df-summary ${admin ? "is-admin" : ""}`}
          aria-label="Tổng quan không gian tưởng niệm"
        >
          <SummaryItem
            label={admin ? "Tổng hồ sơ" : "Hồ sơ người thân"}
            value={profiles.length}
            note={admin ? "Trong toàn hệ thống" : "Đang được gia đình lưu giữ"}
          />
          <SummaryItem
            label={admin ? "Chờ xác minh" : "Nhóm gia đình"}
            value={admin ? pendingProfiles : families.length}
            note={
              admin ? "Cần quản trị viên xử lý" : "Không gian đang tham gia"
            }
          />
          {!admin && (
            <SummaryItem
              label="Lời mời mới"
              value={pendingInvites}
              note="Đang chờ bạn phản hồi"
            />
          )}
        </section>

        {error && <div className="df-alert error">{error}</div>}
        {message && <div className="df-alert ok">{message}</div>}

        {admin ? (
          <section className="df-admin-layout">
            <SimpleForm
              title="Cập nhật sức chứa lô"
              description="Thiết lập số hồ sơ tối đa có thể liên kết với một lô."
              fields={[
                ["plotId", "Mã số lô", "number"],
                ["capacity", "Sức chứa tối đa", "number"],
              ]}
              onSubmit={(data, form) =>
                run(async () => {
                  await api.patch(
                    `/admin/plots/${Number(data.get("plotId"))}/deceased-capacity`,
                    { capacity: Number(data.get("capacity")) },
                  );
                  form.reset();
                }, "Đã cập nhật sức chứa của lô.")
              }
            />
            <ProfileList
              profiles={profiles}
              admin
              busy={busy}
              onVerify={(id) =>
                void run(async () => {
                  await api.patch(`/admin/deceased/${id}/verify`);
                  await load();
                }, "Đã xác minh hồ sơ.")
              }
              onReject={(id) => {
                const reason = window.prompt("Nhập lý do từ chối hồ sơ:");
                if (!reason?.trim()) return;
                void run(async () => {
                  await api.patch(`/admin/deceased/${id}/reject`, {
                    reason: reason.trim(),
                  });
                  await load();
                }, "Đã từ chối hồ sơ.");
              }}
            />
          </section>
        ) : (
          <>
            <section className="df-section">
              <SectionHeading
                eyebrow="Hồ sơ tưởng niệm"
                title="Người thân trong gia đình"
                description="Mỗi hồ sơ là một nơi lưu giữ thông tin nền tảng trước khi gia đình cùng chia sẻ và chăm sóc."
              />
              <div className="df-profile-layout">
                <ProfileList
                  profiles={profiles}
                  busy={busy}
                  run={run}
                  reload={load}
                  onRequestDeletion={(id) => {
                    const reason = window.prompt(
                      "Lý do muốn xoá hồ sơ này? (không bắt buộc, admin sẽ xem để xét duyệt)",
                    );
                    if (reason === null) return; // người dùng bấm Hủy
                    void run(async () => {
                      await api.post(`/deceased/${id}/request-deletion`, {
                        reason: reason.trim() || undefined,
                      });
                      await load();
                    }, "Đã gửi yêu cầu xoá hồ sơ tới admin, vui lòng chờ duyệt.");
                  }}
                  onCancelDeletionRequest={(id) =>
                    void run(async () => {
                      await api.delete(`/deceased/${id}/request-deletion`);
                      await load();
                    }, "Đã huỷ yêu cầu xoá hồ sơ.")
                  }
                />
                <CreateProfileForm
                  busy={busy}
                  ownedPlots={ownedPlots}
                  run={run}
                  reload={load}
                />
              </div>
            </section>

            <section className="df-section df-family-section">
              <SectionHeading
                eyebrow="Cùng nhau gìn giữ"
                title="Chia sẻ với gia đình"
                description="Tạo nhóm, mời người thân và chỉ cấp đúng quyền cần thiết cho từng hồ sơ hoặc dịch vụ."
              />
              <div className="df-family-layout">
                <FamilyList
                  families={families}
                  selectedId={familyId}
                  busy={busy}
                  onSelect={(id) => void selectFamily(id)}
                  onCreate={(name, form) =>
                    run(async () => {
                      await api.post("/families", { name });
                      form.reset();
                      await load();
                    }, "Đã tạo nhóm gia đình.")
                  }
                />
                <FamilyPanel
                  familyId={familyId}
                  ownedPlots={ownedPlots}
                  permissions={permissions}
                  busy={busy}
                  run={run}
                  reload={async () => {
                    await load();
                    if (familyId) await selectFamily(familyId);
                  }}
                />
                <InvitationList
                  invites={invites}
                  busy={busy}
                  run={run}
                  reload={load}
                />
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function SummaryItem({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note: string;
}) {
  return (
    <article className="df-summary-item">
      <span>{label}</span>
      <strong>{value.toLocaleString("vi-VN")}</strong>
      <small>{note}</small>
    </article>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="df-section-heading">
      <span>{eyebrow}</span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </header>
  );
}

function Field({
  name,
  label,
  type = "text",
  optional = false,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  optional?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="df-field">
      <span>
        {label}
        {optional && <small>Không bắt buộc</small>}
      </span>
      <input
        name={name}
        type={type}
        min={type === "number" ? 1 : undefined}
        required={!optional}
        defaultValue={defaultValue}
      />
    </label>
  );
}

function SimpleForm({
  title,
  description,
  fields,
  onSubmit,
}: {
  title: string;
  description?: string;
  fields: string[][];
  onSubmit: (data: FormData, form: HTMLFormElement) => Promise<void>;
}) {
  return (
    <form
      className="df-panel df-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(new FormData(event.currentTarget), event.currentTarget);
      }}
    >
      <div className="df-panel-heading">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {fields.map(([name, label, type]) => (
        <Field key={name} name={name} label={label} type={type} />
      ))}
      <button className="df-primary-button" type="submit">
        Lưu thay đổi
      </button>
    </form>
  );
}

function CreateProfileForm({
  busy,
  ownedPlots,
  run,
  reload,
}: {
  busy: boolean;
  ownedPlots: OwnedPlot[];
  run: (operation: () => Promise<void>, message: string) => Promise<void>;
  reload: () => Promise<void>;
}) {
  // Chế độ lịch áp dụng CHUNG cho toàn bộ khu vực chọn ngày trong form này
  // (cả "Ngày sinh" lẫn "Ngày giỗ") — không chọn riêng từng ô nữa.
  // - Dương lịch: lưu nguyên ngày/tháng/năm đã nhập, dùng làm mốc Dương lịch
  //   thật (dựng nhắc lịch "solar" — lặp lại đúng ngày Dương mỗi năm).
  // - Âm lịch: cũng lưu nguyên ngày/tháng/năm đã nhập, KHÔNG quy đổi lúc lưu.
  //   Chỉ khi tạo nhắc lịch ("Ngày giỗ") mới lấy ngày/tháng Âm đó quy đổi ra
  //   đúng ngày Dương lịch của năm cần nhắc, và nhắc lịch được đánh dấu rõ
  //   là theo Âm lịch để gia đình biết.
  const [calendarMode, setCalendarMode] = useState<"solar" | "lunar">("solar");
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [anniversaryDay, setAnniversaryDay] = useState("");
  const [anniversaryMonth, setAnniversaryMonth] = useState("");
  const [anniversaryYear, setAnniversaryYear] = useState("");

  function resetDateFields() {
    setBirthDay("");
    setBirthMonth("");
    setBirthYear("");
    setAnniversaryDay("");
    setAnniversaryMonth("");
    setAnniversaryYear("");
  }

  return (
    <form
      className="df-panel df-form df-create-profile"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const form = event.currentTarget;
        const fullName = String(data.get("fullName") || "").trim();
        const plotId = Number(data.get("plotId"));
        const bDay = birthDay ? Number(birthDay) : null;
        const bMonth = birthMonth ? Number(birthMonth) : null;
        const bYear = birthYear ? Number(birthYear) : null;
        const aDay = anniversaryDay ? Number(anniversaryDay) : null;
        const aMonth = anniversaryMonth ? Number(anniversaryMonth) : null;
        const aYear = anniversaryYear ? Number(anniversaryYear) : null;
        void run(async () => {
          const created = unwrap<{ id: number }>(
            await api.post("/deceased", {
              plotId,
              fullName,
              hometown: data.get("hometown") || undefined,
              biography: data.get("biography") || undefined,
              dateCalendarType: calendarMode,
              birthDay: bDay ?? undefined,
              birthMonth: bMonth ?? undefined,
              birthYear: bYear ?? undefined,
              anniversaryDay: aDay ?? undefined,
              anniversaryMonth: aMonth ?? undefined,
              anniversaryYear: aYear ?? undefined,
            }),
          );
          form.reset();
          resetDateFields();
          setCalendarMode("solar");
          await reload();

          if (aDay && aMonth && created?.id) {
            try {
              await api.post("/my/reminders", {
                title: `Ngày giỗ ${fullName}`,
                description: `Tự động tạo từ hồ sơ tưởng niệm "${fullName}".`,
                plotId,
                deceasedProfileId: created.id,
                reminderType: "death_anniversary",
                isRecurring: true,
                // Dương lịch: nhắc đúng ngày Dương mỗi năm. Âm lịch: nhắc
                // lịch tự quy đổi sang đúng ngày Dương của năm cần nhắc và
                // ghi chú rõ đây là Âm lịch (xử lý sẵn ở trang Nhắc lịch).
                calendarType: calendarMode,
                remindMonth: aMonth,
                remindDay: aDay,
                notifyDaysBefore: 7,
              });
            } catch {
              // Hồ sơ đã tạo thành công; nếu tạo nhắc lịch tự động thất bại
              // (vd trùng lịch), gia đình vẫn có thể tự thêm thủ công ở
              // trang "Nhắc lịch" nên bỏ qua lỗi này, không chặn luồng chính.
            }
          }
        }, "Đã tạo hồ sơ và gửi chờ xác minh.");
      }}
    >
      <div className="df-panel-heading">
        <span className="df-panel-kicker">Hồ sơ mới</span>
        <h2>Thêm người thân</h2>
        <p>Điền thông tin nền tảng; bạn có thể bổ sung nội dung sau.</p>
      </div>
      <div className="df-form-grid">
        <label className="df-field">
          <span>Mã số lô đang sở hữu</span>
          <select name="plotId" required defaultValue="">
            <option value="" disabled>
              {ownedPlots.length
                ? "Chọn lô đang sở hữu"
                : "Bạn chưa có lô đủ điều kiện"}
            </option>
            {ownedPlots.map((plot) => (
              <option key={plot.plotId} value={plot.plotId}>
                {plot.plotCode}
                {plot.zoneName ? ` · ${plot.zoneName}` : ""}
              </option>
            ))}
          </select>
        </label>
        <Field name="fullName" label="Họ và tên" />
        <Field name="hometown" label="Quê quán" optional />
      </div>

      <CalendarModeToggle value={calendarMode} onChange={setCalendarMode} />

      <div className="df-form-grid">
        <DayMonthYearField
          label="Ngày sinh"
          calendarMode={calendarMode}
          day={birthDay}
          month={birthMonth}
          year={birthYear}
          onDayChange={setBirthDay}
          onMonthChange={setBirthMonth}
          onYearChange={setBirthYear}
        />
        <DayMonthYearField
          label="Ngày giỗ"
          calendarMode={calendarMode}
          day={anniversaryDay}
          month={anniversaryMonth}
          year={anniversaryYear}
          onDayChange={setAnniversaryDay}
          onMonthChange={setAnniversaryMonth}
          onYearChange={setAnniversaryYear}
          showLunarPreview
        />
      </div>

      <label className="df-field">
        <span>
          Tiểu sử <small>Không bắt buộc</small>
        </span>
        <textarea
          name="biography"
          rows={4}
          placeholder="Ghi lại đôi nét về cuộc đời và những điều gia đình muốn lưu giữ..."
        />
      </label>
      <button
        className="df-primary-button"
        disabled={busy || ownedPlots.length === 0}
        type="submit"
      >
        Tạo hồ sơ tưởng niệm
      </button>
    </form>
  );
}

/** Công tắc chọn CHUNG chế độ lịch (Dương/Âm) cho toàn bộ khu vực ngày tháng
 * bên dưới trong form — thay vì chọn riêng cho từng ô như trước. */
function CalendarModeToggle({
  value,
  onChange,
}: {
  value: "solar" | "lunar";
  onChange: (value: "solar" | "lunar") => void;
}) {
  return (
    <div className="df-field df-calendar-mode">
      <span>Chế độ lịch cho Ngày sinh &amp; Ngày giỗ</span>
      <div className="df-calendar-mode-options" role="radiogroup">
        {(
          [
            { key: "solar", label: "Dương lịch" },
            { key: "lunar", label: "Âm lịch" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.key}
            type="button"
            role="radio"
            aria-checked={value === opt.key}
            className={
              value === opt.key
                ? "df-calendar-mode-btn active"
                : "df-calendar-mode-btn"
            }
            onClick={() => onChange(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <small className="df-lunar-hint">
        {value === "lunar"
          ? "Ngày/tháng/năm nhập bên dưới được hiểu theo Âm lịch."
          : "Ngày/tháng/năm nhập bên dưới được hiểu theo Dương lịch."}
      </small>
    </div>
  );
}

/** Ô nhập ngày/tháng/năm dùng chung cho cả Ngày sinh và Ngày giỗ, KHÔNG dùng
 * <input type="date"> vì nó ép kiểm tra hợp lệ theo Dương lịch — sẽ chặn
 * nhầm các giá trị Âm lịch hợp lệ (vd ngày 30 của một số tháng). Giá trị
 * luôn được lưu nguyên như người dùng nhập, diễn giải theo calendarMode. */
function DayMonthYearField({
  label,
  calendarMode,
  day,
  month,
  year,
  onDayChange,
  onMonthChange,
  onYearChange,
  showLunarPreview = false,
}: {
  label: string;
  calendarMode: "solar" | "lunar";
  day: string;
  month: string;
  year: string;
  onDayChange: (value: string) => void;
  onMonthChange: (value: string) => void;
  onYearChange: (value: string) => void;
  showLunarPreview?: boolean;
}) {
  const preview =
    showLunarPreview && calendarMode === "lunar" && day && month
      ? nextLunarOccurrence(Number(day), Number(month))
      : null;
  return (
    <div className="df-field df-dmy-field">
      <span>
        {label} <small>Không bắt buộc</small>
      </span>
      <div className="df-dmy-inputs">
        <select
          aria-label={`Ngày (${label})`}
          value={day}
          onChange={(event) => onDayChange(event.target.value)}
        >
          <option value="">Ngày</option>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          aria-label={`Tháng (${label})`}
          value={month}
          onChange={(event) => onMonthChange(event.target.value)}
        >
          <option value="">Tháng</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          aria-label={`Năm (${label})`}
          type="number"
          inputMode="numeric"
          placeholder="Năm"
          min={1}
          max={9999}
          value={year}
          onChange={(event) => onYearChange(event.target.value)}
        />
      </div>
      {preview && (
        <small className="df-lunar-hint">
          Âm lịch {day}/{month} — hệ thống sẽ tự nhắc vào ngày Dương lịch gần
          nhất tương ứng: {preview.toLocaleDateString("vi-VN")}.
        </small>
      )}
    </div>
  );
}

function ProfileList({
  profiles,
  admin = false,
  busy,
  onVerify,
  onReject,
  run,
  reload,
  onRequestDeletion,
  onCancelDeletionRequest,
}: {
  profiles: Profile[];
  admin?: boolean;
  busy: boolean;
  onVerify?: (id: number) => void;
  onReject?: (id: number) => void;
  run?: (operation: () => Promise<void>, message: string) => Promise<void>;
  reload?: () => Promise<void>;
  onRequestDeletion?: (id: number) => void;
  onCancelDeletionRequest?: (id: number) => void;
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const toggleProfile = (id: number) =>
    setExpandedId((current) => (current === id ? null : id));

  return (
    <section className="df-panel df-profile-panel">
      <div className="df-panel-heading df-panel-heading-row">
        <div>
          <span className="df-panel-kicker">
            {admin ? "Hàng chờ xác minh" : "Không gian của bạn"}
          </span>
          <h2>{admin ? "Danh sách hồ sơ" : "Hồ sơ đã lưu"}</h2>
        </div>
        <span className="df-count">{profiles.length}</span>
      </div>

      {profiles.length === 0 ? (
        <div className="df-empty-state">
          <span className="df-empty-mark" aria-hidden="true" />
          <h3>Chưa có hồ sơ tưởng niệm</h3>
          <p>
            {admin
              ? "Các hồ sơ mới cần xác minh sẽ xuất hiện tại đây."
              : "Bắt đầu bằng việc thêm thông tin của một người thân ở biểu mẫu bên cạnh."}
          </p>
        </div>
      ) : (
        <div className="df-profile-list">
          {profiles.map((profile) => (
            <article
              aria-expanded={expandedId === profile.id}
              className={`df-profile-item ${expandedId === profile.id ? "expanded" : ""}`}
              key={profile.id}
              onClick={() => toggleProfile(profile.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggleProfile(profile.id);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="df-profile-monogram" aria-hidden="true">
                {profile.fullName.trim().charAt(0).toLocaleUpperCase("vi")}
              </div>
              <div className="df-profile-copy">
                <div className="df-profile-title-row">
                  <h3>{profile.fullName}</h3>
                  <span
                    className={`df-status status-${profile.verificationStatus}`}
                  >
                    {statusLabel(profile.verificationStatus)}
                  </span>
                </div>
                <p>
                  Lô {profile.plotCode ?? `#${profile.plotId}`}
                  <span aria-hidden="true"> · </span>
                  Ngày giỗ: {formatAnniversary(profile)}
                </p>
                {profile.rejectionReason && (
                  <small className="df-rejection-reason">
                    Lý do từ chối: {profile.rejectionReason}
                  </small>
                )}
                {!admin && profile.deletionRequestedAt && (
                  <small className="df-deletion-pending">
                    Đã gửi yêu cầu xoá hồ sơ, đang chờ admin duyệt.
                  </small>
                )}
                {!admin &&
                  !profile.deletionRequestedAt &&
                  profile.deletionDeniedReason && (
                    <small className="df-rejection-reason">
                      Yêu cầu xoá trước đó bị từ chối:{" "}
                      {profile.deletionDeniedReason}
                    </small>
                  )}
              </div>
              <div className="df-profile-actions">
                {admin &&
                  profile.verificationStatus === "pending_verification" && (
                    <>
                      <button
                        disabled={busy}
                        onClick={() => onVerify?.(profile.id)}
                        type="button"
                      >
                        Xác minh
                      </button>
                      <button
                        className="df-secondary-button"
                        disabled={busy}
                        onClick={() => onReject?.(profile.id)}
                        type="button"
                      >
                        Từ chối
                      </button>
                    </>
                  )}
                {!admin && (
                  <>
                    <button
                      className="df-secondary-button"
                      disabled={busy}
                      onClick={(event) => {
                        event.stopPropagation();
                        setExpandedId(profile.id);
                        setEditingId((current) =>
                          current === profile.id ? null : profile.id,
                        );
                      }}
                      type="button"
                    >
                      {editingId === profile.id
                        ? "Đóng chỉnh sửa"
                        : "Chỉnh sửa hồ sơ"}
                    </button>
                    {profile.deletionRequestedAt ? (
                      <button
                        className="df-secondary-button"
                        disabled={busy}
                        onClick={(event) => {
                          event.stopPropagation();
                          onCancelDeletionRequest?.(profile.id);
                        }}
                        type="button"
                      >
                        Huỷ yêu cầu xoá
                      </button>
                    ) : (
                      <button
                        className="df-text-danger"
                        disabled={busy}
                        onClick={(event) => {
                          event.stopPropagation();
                          onRequestDeletion?.(profile.id);
                        }}
                        type="button"
                      >
                        Yêu cầu xoá hồ sơ
                      </button>
                    )}
                  </>
                )}
              </div>
              {expandedId === profile.id && (
                <div onClick={(event) => event.stopPropagation()}>
                  {editingId === profile.id && run && reload ? (
                    <EditProfileForm
                      profile={profile}
                      busy={busy}
                      run={run}
                      reload={reload}
                      onDone={() => setEditingId(null)}
                    />
                  ) : (
                    <div className="df-profile-detail">
                      <div>
                        <span>Ngày sinh</span>
                        <strong>{formatBirth(profile)}</strong>
                      </div>
                      <div>
                        <span>Ngày giỗ</span>
                        <strong>{formatAnniversary(profile)}</strong>
                      </div>
                      <div>
                        <span>Quê quán</span>
                        <strong>{profile.hometown || "Chưa cập nhật"}</strong>
                      </div>
                      <div className="df-profile-biography">
                        <span>Tiểu sử</span>
                        <p>{profile.biography || "Chưa có tiểu sử."}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

/** Cho phép gia đình tự chỉnh sửa hồ sơ đã tạo. Vì backend (`PATCH
 * /deceased/:id`) tự động chuyển hồ sơ đã "Đã xác minh" về lại "Chờ xác
 * minh" khi có thay đổi nội dung quan trọng, đây chính là cơ chế "gửi yêu
 * cầu chỉnh sửa tới admin" — admin sẽ thấy và xác minh lại thay đổi trước
 * khi hồ sơ được công khai là đã xác minh trở lại. */
function EditProfileForm({
  profile,
  busy,
  run,
  reload,
  onDone,
}: {
  profile: Profile;
  busy: boolean;
  run: (operation: () => Promise<void>, message: string) => Promise<void>;
  reload: () => Promise<void>;
  onDone: () => void;
}) {
  const [calendarMode, setCalendarMode] = useState<"solar" | "lunar">(
    profile.dateCalendarType ?? "solar",
  );
  const [birthDay, setBirthDay] = useState(
    profile.birthDay ? String(profile.birthDay) : "",
  );
  const [birthMonth, setBirthMonth] = useState(
    profile.birthMonth ? String(profile.birthMonth) : "",
  );
  const [birthYear, setBirthYear] = useState(
    profile.birthYear ? String(profile.birthYear) : "",
  );
  const [anniversaryDay, setAnniversaryDay] = useState(
    profile.anniversaryDay ? String(profile.anniversaryDay) : "",
  );
  const [anniversaryMonth, setAnniversaryMonth] = useState(
    profile.anniversaryMonth ? String(profile.anniversaryMonth) : "",
  );
  const [anniversaryYear, setAnniversaryYear] = useState(
    profile.anniversaryYear ? String(profile.anniversaryYear) : "",
  );

  return (
    <form
      className="df-panel df-form df-edit-profile"
      onClick={(event) => event.stopPropagation()}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void run(async () => {
          await api.patch(`/deceased/${profile.id}`, {
            fullName: data.get("fullName") || undefined,
            hometown: data.get("hometown") || undefined,
            biography: data.get("biography") || undefined,
            dateCalendarType: calendarMode,
            birthDay: birthDay ? Number(birthDay) : undefined,
            birthMonth: birthMonth ? Number(birthMonth) : undefined,
            birthYear: birthYear ? Number(birthYear) : undefined,
            anniversaryDay: anniversaryDay ? Number(anniversaryDay) : undefined,
            anniversaryMonth: anniversaryMonth
              ? Number(anniversaryMonth)
              : undefined,
            anniversaryYear: anniversaryYear
              ? Number(anniversaryYear)
              : undefined,
          });
          await reload();
          onDone();
        }, "Đã lưu thay đổi. Nếu hồ sơ từng được xác minh, hồ sơ sẽ chờ admin xác minh lại.");
      }}
    >
      <div className="df-form-grid">
        <Field
          name="fullName"
          label="Họ và tên"
          defaultValue={profile.fullName}
        />
        <Field
          name="hometown"
          label="Quê quán"
          optional
          defaultValue={profile.hometown}
        />
      </div>
      <CalendarModeToggle value={calendarMode} onChange={setCalendarMode} />
      <div className="df-form-grid">
        <DayMonthYearField
          label="Ngày sinh"
          calendarMode={calendarMode}
          day={birthDay}
          month={birthMonth}
          year={birthYear}
          onDayChange={setBirthDay}
          onMonthChange={setBirthMonth}
          onYearChange={setBirthYear}
        />
        <DayMonthYearField
          label="Ngày giỗ"
          calendarMode={calendarMode}
          day={anniversaryDay}
          month={anniversaryMonth}
          year={anniversaryYear}
          onDayChange={setAnniversaryDay}
          onMonthChange={setAnniversaryMonth}
          onYearChange={setAnniversaryYear}
          showLunarPreview
        />
      </div>
      <label className="df-field">
        <span>
          Tiểu sử <small>Không bắt buộc</small>
        </span>
        <textarea name="biography" rows={4} defaultValue={profile.biography} />
      </label>
      <div className="df-profile-actions">
        <button className="df-primary-button" disabled={busy} type="submit">
          Lưu thay đổi
        </button>
        <button
          className="df-secondary-button"
          disabled={busy}
          onClick={onDone}
          type="button"
        >
          Huỷ
        </button>
      </div>
    </form>
  );
}

function FamilyList({
  families,
  selectedId,
  busy,
  onSelect,
  onCreate,
}: {
  families: Family[];
  selectedId: number | null;
  busy: boolean;
  onSelect: (id: number) => void;
  onCreate: (name: string, form: HTMLFormElement) => Promise<void>;
}) {
  return (
    <section className="df-panel df-family-list-panel">
      <div className="df-panel-heading">
        <span className="df-panel-kicker">Không gian chung</span>
        <h2>Nhóm của bạn</h2>
        <p>Chọn một nhóm để quản lý thành viên và quyền chia sẻ.</p>
      </div>
      <form
        className="df-inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          const name = String(
            new FormData(event.currentTarget).get("name") ?? "",
          ).trim();
          if (name) void onCreate(name, event.currentTarget);
        }}
      >
        <input
          aria-label="Tên nhóm gia đình"
          name="name"
          placeholder="Tên nhóm gia đình"
          required
        />
        <button disabled={busy} type="submit">
          Tạo nhóm
        </button>
      </form>
      <div className="df-family-list">
        {families.length === 0 && (
          <p className="df-quiet-empty">Bạn chưa tham gia nhóm gia đình nào.</p>
        )}
        {families.map((family) => (
          <button
            className={selectedId === family.id ? "selected" : ""}
            key={family.id}
            onClick={() => onSelect(family.id)}
            type="button"
          >
            <span>{family.name}</span>
            <small>
              {statusLabel(family.role ?? "member")} ·{" "}
              {statusLabel(family.status)}
            </small>
          </button>
        ))}
      </div>
    </section>
  );
}

function FamilyPanel({
  familyId,
  ownedPlots,
  permissions,
  busy,
  run,
  reload,
}: {
  familyId: number | null;
  ownedPlots: OwnedPlot[];
  permissions: Permission[];
  busy: boolean;
  run: (operation: () => Promise<void>, message: string) => Promise<void>;
  reload: () => Promise<void>;
}) {
  if (!familyId) {
    return (
      <section className="df-panel df-family-placeholder">
        <span className="df-empty-mark" aria-hidden="true" />
        <h2>Chọn một nhóm gia đình</h2>
        <p>
          Thông tin chia sẻ, thành viên và quyền truy cập của nhóm sẽ hiển thị
          tại đây.
        </p>
      </section>
    );
  }

  const post = (path: string, data: object, successMessage: string) =>
    run(async () => {
      await api.post(path, data);
      await reload();
    }, successMessage);

  return (
    <section className="df-panel df-family-manage">
      <div className="df-panel-heading df-panel-heading-row">
        <div>
          <span className="df-panel-kicker">Nhóm đang chọn</span>
          <h2>Quản lý chia sẻ</h2>
        </div>
        <span className="df-id-badge">Mã nhóm {familyId}</span>
      </div>

      <div className="df-tool-grid">
        <details className="df-tool" open>
          <summary>Liên kết lô đất</summary>
          <p>Đưa một lô thuộc sở hữu hợp lệ vào không gian chung.</p>
          <form
            className="df-compact-form"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void post(
                `/families/${familyId}/plots`,
                { plotId: Number(data.get("plotId")) },
                "Đã thêm lô vào nhóm.",
              );
            }}
          >
            <label className="df-field">
              <span>Mã số lô</span>
              <select name="plotId" required defaultValue="">
                <option value="" disabled>
                  Chọn lô đang sở hữu
                </option>
                {ownedPlots.map((plot) => (
                  <option key={plot.plotId} value={plot.plotId}>
                    {plot.plotCode}
                    {plot.zoneName ? ` · ${plot.zoneName}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <button disabled={busy || ownedPlots.length === 0} type="submit">
              Thêm lô
            </button>
          </form>
        </details>
        <details className="df-tool">
          <summary>Mời thành viên</summary>
          <p>
            Gửi lời mời đến tài khoản người thân bằng địa chỉ email đã đăng ký.
          </p>
          <CompactForm
            button="Gửi lời mời"
            fields={[["email", "Email người dùng", "email"]]}
            onSubmit={(data) =>
              post(
                `/families/${familyId}/invitations`,
                { inviteeEmail: String(data.get("email") ?? "").trim() },
                "Đã gửi lời mời.",
              )
            }
          />
        </details>
        <details className="df-tool">
          <summary>Cấp quyền truy cập</summary>
          <p>
            Chỉ định chính xác nội dung một thành viên được phép xem hoặc thao
            tác.
          </p>
          <form
            className="df-compact-form"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void post(
                `/families/${familyId}/permissions`,
                {
                  memberUserId: Number(data.get("userId")),
                  resourceType: data.get("resourceType"),
                  resourceId: Number(data.get("resourceId")),
                  action: data.get("action"),
                },
                "Đã cấp quyền cho thành viên.",
              );
            }}
          >
            <Field name="userId" label="Mã người dùng" type="number" />
            <label className="df-field">
              <span>Loại nội dung</span>
              <select name="resourceType">
                <option value="deceased_profile">Hồ sơ tưởng niệm</option>
                <option value="plot">Lô đất</option>
                <option value="service_order">Đơn dịch vụ</option>
              </select>
            </label>
            <Field name="resourceId" label="Mã nội dung" type="number" />
            <label className="df-field">
              <span>Quyền được cấp</span>
              <select name="action">
                <option value="view_profile">Xem hồ sơ</option>
                <option value="view_plot">Xem thông tin lô</option>
                <option value="view_service_history">
                  Xem lịch sử dịch vụ
                </option>
                <option value="order_service">Đặt dịch vụ</option>
              </select>
            </label>
            <button disabled={busy} type="submit">
              Cấp quyền
            </button>
          </form>
        </details>
      </div>

      <div className="df-permission-section">
        <div className="df-subheading">
          <h3>Quyền đang có hiệu lực</h3>
          <span>{permissions.length}</span>
        </div>
        {permissions.length === 0 ? (
          <p className="df-quiet-empty">
            Nhóm chưa cấp quyền riêng cho thành viên.
          </p>
        ) : (
          <div className="df-permission-list">
            {permissions.map((permission) => (
              <article key={permission.id}>
                <div>
                  <strong>Thành viên {permission.userId}</strong>
                  <span>
                    {actionLabel(permission.action)} ·{" "}
                    {resourceLabel(permission.resourceType)}{" "}
                    {permission.resourceId}
                  </span>
                </div>
                <button
                  className="df-text-danger"
                  onClick={() =>
                    void run(async () => {
                      await api.delete(
                        `/families/${familyId}/permissions/${permission.id}`,
                      );
                      await reload();
                    }, "Đã thu hồi quyền truy cập.")
                  }
                  type="button"
                >
                  Thu hồi
                </button>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="df-family-state-actions">
        <button
          className="df-secondary-button"
          disabled={busy}
          onClick={() =>
            void post(
              `/families/${familyId}/disable`,
              {},
              "Đã tạm dừng nhóm và thu hồi các quyền đang có.",
            )
          }
          type="button"
        >
          Tạm dừng nhóm
        </button>
        <button
          disabled={busy}
          onClick={() =>
            void post(
              `/families/${familyId}/enable`,
              {},
              "Đã kích hoạt lại nhóm; các quyền cũ không tự khôi phục.",
            )
          }
          type="button"
        >
          Kích hoạt nhóm
        </button>
      </div>
    </section>
  );
}

function CompactForm({
  fields,
  button,
  onSubmit,
}: {
  fields: string[][];
  button: string;
  onSubmit: (data: FormData) => Promise<void>;
}) {
  return (
    <form
      className="df-compact-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(new FormData(event.currentTarget));
      }}
    >
      {fields.map(([name, label, type]) => (
        <Field key={name} name={name} label={label} type={type} />
      ))}
      <button type="submit">{button}</button>
    </form>
  );
}

function InvitationList({
  invites,
  busy,
  run,
  reload,
}: {
  invites: Invitation[];
  busy: boolean;
  run: (operation: () => Promise<void>, message: string) => Promise<void>;
  reload: () => Promise<void>;
}) {
  return (
    <section className="df-panel df-invitation-panel">
      <div className="df-panel-heading">
        <span className="df-panel-kicker">Kết nối gia đình</span>
        <h2>Lời mời của bạn</h2>
        <p>Phản hồi các lời mời tham gia không gian chung.</p>
      </div>
      <div className="df-invitation-list">
        {invites.length === 0 && (
          <p className="df-quiet-empty">Hiện chưa có lời mời nào.</p>
        )}
        {invites.map((invitation) => (
          <article key={invitation.id}>
            <div>
              <strong>{invitation.familyName}</strong>
              <span>{statusLabel(invitation.status)}</span>
            </div>
            {invitation.status === "pending" && (
              <div className="df-invitation-actions">
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await api.patch(
                        `/family-invitations/${invitation.id}/accept`,
                      );
                      await reload();
                    }, "Đã chấp nhận lời mời.")
                  }
                  type="button"
                >
                  Chấp nhận
                </button>
                <button
                  className="df-secondary-button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await api.patch(
                        `/family-invitations/${invitation.id}/reject`,
                      );
                      await reload();
                    }, "Đã từ chối lời mời.")
                  }
                  type="button"
                >
                  Từ chối
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
