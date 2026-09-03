const ACTION_LABELS: Record<string, string> = {
  "appointment.create": "Tạo lịch hẹn",
  "appointment.update": "Cập nhật lịch hẹn",
  "appointment.status.update": "Cập nhật trạng thái lịch hẹn",
  "contract.payment.record": "Ghi nhận thanh toán hợp đồng",
  "contract.sale.complete": "Xác nhận quyền sở hữu lô đất",
  "notification.broadcast": "Gửi thông báo hàng loạt",
  "deceased_profile.create": "Tạo hồ sơ người đã khuất",
  "deceased_profile.update": "Cập nhật hồ sơ người đã khuất",
  "deceased_profile.delete": "Xóa hồ sơ người đã khuất",
  "deceased_profile.restore": "Khôi phục hồ sơ người đã khuất",
  "deceased_profile.verified": "Xác minh hồ sơ người đã khuất",
  "deceased_profile.rejected": "Từ chối xác minh hồ sơ người đã khuất",
  "plot.create": "Tạo lô đất",
  "plot.update": "Cập nhật lô đất",
  "plot.status.update": "Cập nhật trạng thái lô đất",
  "plot.price.update": "Cập nhật giá lô đất",
  "plot.lock": "Khóa lô đất",
  "plot.unlock": "Mở khóa lô đất",
  "plot.delete": "Xóa lô đất",
  "plot.restore": "Khôi phục lô đất",
  "reservation.approve": "Duyệt yêu cầu mua lô",
  "reservation.reject": "Từ chối yêu cầu mua lô",
  "reservation.cancellation.approve": "Duyệt yêu cầu hủy mua lô",
  "reservation.cancellation.reject": "Từ chối yêu cầu hủy mua lô",
  "user.locked": "Khóa tài khoản",
  "user.unlocked": "Mở khóa tài khoản",
  "admin_plot_transfer_completed": "Hoàn tất chuyển nhượng lô đất",
  "ai_knowledge_correction_activated": "Áp dụng hiệu chỉnh tri thức AI",
  "reminder.create": "Tạo nhắc lịch",
  "reminder.update": "Cập nhật nhắc lịch",
  "reminder.delete": "Xóa nhắc lịch",
  "reminder.notify": "Gửi nhắc lịch cho khách hàng",
};

const ENTITY_LABELS: Record<string, string> = {
  deceased_profile: "Hồ sơ người đã khuất",
  admin_broadcast: "Thông báo hàng loạt",
  appointment: "Lịch hẹn",
  contract: "Hợp đồng",
  notification: "Thông báo",
  plot: "Lô đất",
  purchase_request: "Yêu cầu mua lô",
  purchase_request_cancellation: "Yêu cầu hủy mua lô",
  resource_permission: "Quyền truy cập",
  user: "Tài khoản",
  reminder: "Nhắc lịch",
  service_order: "Đơn dịch vụ",
};

export function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? "Thực hiện thao tác quản trị hệ thống";
}

export function entityLabel(entityType: string) {
  return ENTITY_LABELS[entityType] ?? "Dữ liệu hệ thống";
}
