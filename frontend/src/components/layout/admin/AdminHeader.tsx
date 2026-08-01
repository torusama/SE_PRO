import { useLocation } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import PrimaryNavigation from "@/components/layout/shared/PrimaryNavigation";
import AccountActions from "@/components/layout/shared/AccountActions";

const PAGE_META: Record<string, { title: string; description: string }> = {
  [ROUTES.ADMIN_DASHBOARD]: {
    title: "Tổng quan",
    description: "Tình hình vận hành nghĩa trang",
  },
  [ROUTES.ADMIN_ACTIVITY]: {
    title: "Hoạt động",
    description: "Nhật ký cập nhật gần đây",
  },
  [ROUTES.ADMIN_MAP]: {
    title: "Bản đồ 2D",
    description: "Sơ đồ và trạng thái các lô đất",
  },
  [ROUTES.ADMIN_LOTS]: {
    title: "Quản lý lô đất",
    description: "Thông tin, trạng thái và vị trí lô",
  },
  [ROUTES.ADMIN_REQUESTS]: {
    title: "Xử lý yêu cầu",
    description: "Tiếp nhận và theo dõi yêu cầu",
  },
  [ROUTES.ADMIN_CONTRACTS]: {
    title: "Hợp đồng và sở hữu",
    description: "Hồ sơ hợp đồng trong hệ thống",
  },
  [ROUTES.ADMIN_SERVICES]: {
    title: "Quản lý dịch vụ",
    description: "Danh mục và đơn đăng ký dịch vụ",
  },
  [ROUTES.ADMIN_NOTIFY]: {
    title: "Thông báo",
    description: "Nội dung gửi đến người dùng",
  },
  [ROUTES.ADMIN_TRANSFER]: {
    title: "Chuyển nhượng",
    description: "Hồ sơ chuyển quyền sử dụng lô",
  },
  [ROUTES.ADMIN_APPOINTMENTS]: {
    title: "Lịch hẹn",
    description: "Phê duyệt và quản lý lịch hẹn",
  },
  [ROUTES.ADMIN_REMINDERS]: {
    title: "Nhắc lịch",
    description: "Ngày giỗ và sự kiện tưởng niệm",
  },
  [ROUTES.ADMIN_AI_AGENT]: {
    title: "AI Agent",
    description: "Theo dõi tri thức và quá trình học",
  },
};

export default function AdminHeader() {
  const location = useLocation();
  const page = PAGE_META[location.pathname] ?? PAGE_META[ROUTES.ADMIN_DASHBOARD];

  return (
    <header className="admin-header">
      <div className="admin-header__page">
        <p className="admin-header__title">{page.title}</p>
        <p className="admin-header__description">{page.description}</p>
      </div>

      <PrimaryNavigation
        className="admin-header__navigation"
        variant="light"
      />

      <AccountActions variant="light" className="admin-account" />
    </header>
  );
}
