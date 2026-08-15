import { useCallback, useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
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
  dateOfBirth?: string;
  dateOfDeath?: string;
  burialDate?: string;
  hometown?: string;
  biography?: string;
  verificationStatus: string;
  rejectionReason?: string;
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
                  onDelete={(id) =>
                    void run(async () => {
                      await api.delete(`/deceased/${id}`);
                      await load();
                    }, "Đã xóa hồ sơ.")
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
}: {
  name: string;
  label: string;
  type?: string;
  optional?: boolean;
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
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [dateOfDeath, setDateOfDeath] = useState("");
  const [burialDate, setBurialDate] = useState("");

  return (
    <form
      className="df-panel df-form df-create-profile"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const form = event.currentTarget;
        void run(async () => {
          await api.post("/deceased", {
            plotId: Number(data.get("plotId")),
            fullName: data.get("fullName"),
            dateOfBirth: data.get("dateOfBirth") || undefined,
            dateOfDeath: data.get("dateOfDeath") || undefined,
            burialDate: data.get("burialDate") || undefined,
            hometown: data.get("hometown") || undefined,
            biography: data.get("biography") || undefined,
          });
          form.reset();
          setDateOfBirth("");
          setDateOfDeath("");
          setBurialDate("");
          await reload();
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
        <DateField
          name="dateOfBirth"
          label="Ngày sinh"
          value={dateOfBirth}
          max={dateOfDeath || burialDate || today}
          onChange={setDateOfBirth}
        />
        <DateField
          name="dateOfDeath"
          label="Ngày mất"
          value={dateOfDeath}
          min={dateOfBirth || undefined}
          max={burialDate || today}
          onChange={setDateOfDeath}
        />
        <DateField
          name="burialDate"
          label="Ngày an táng"
          value={burialDate}
          min={dateOfDeath || dateOfBirth || undefined}
          max={today}
          onChange={setBurialDate}
        />
        <Field name="hometown" label="Quê quán" optional />
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

function DateField({
  name,
  label,
  value,
  min,
  max,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  min?: string;
  max: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="df-field">
      <span>
        {label}
        <small>Không bắt buộc</small>
      </span>
      <input
        name={name}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ProfileList({
  profiles,
  admin = false,
  busy,
  onVerify,
  onReject,
  onDelete,
}: {
  profiles: Profile[];
  admin?: boolean;
  busy: boolean;
  onVerify?: (id: number) => void;
  onReject?: (id: number) => void;
  onDelete?: (id: number) => void;
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
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
                  Ngày mất: {formatDate(profile.dateOfDeath)}
                </p>
                {profile.rejectionReason && (
                  <small className="df-rejection-reason">
                    Lý do từ chối: {profile.rejectionReason}
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
                  <button
                    className="df-text-danger"
                    disabled={busy}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete?.(profile.id);
                    }}
                    type="button"
                  >
                    Xóa hồ sơ
                  </button>
                )}
              </div>
              {expandedId === profile.id && (
                <div className="df-profile-detail">
                  <div>
                    <span>Ngày sinh</span>
                    <strong>{formatDate(profile.dateOfBirth)}</strong>
                  </div>
                  <div>
                    <span>Ngày mất</span>
                    <strong>{formatDate(profile.dateOfDeath)}</strong>
                  </div>
                  <div>
                    <span>Ngày an táng</span>
                    <strong>{formatDate(profile.burialDate)}</strong>
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
            </article>
          ))}
        </div>
      )}
    </section>
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
