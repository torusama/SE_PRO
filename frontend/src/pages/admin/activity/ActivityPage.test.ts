import { describe, expect, it } from "vitest";
import { actionLabel, entityLabel } from "./ActivityPage";

describe("nhãn nhật ký hoạt động quản trị", () => {
  it("hiển thị thao tác tạo hồ sơ người đã khuất bằng tiếng Việt", () => {
    expect(actionLabel("deceased_profile.create")).toBe(
      "Tạo hồ sơ người đã khuất",
    );
    expect(entityLabel("deceased_profile")).toBe("Hồ sơ người đã khuất");
  });

  it("không để lộ mã kỹ thuật tiếng Anh khi chưa có bản dịch", () => {
    expect(actionLabel("unknown_entity.unknown_action")).toBe(
      "Thực hiện thao tác quản trị hệ thống",
    );
    expect(entityLabel("unknown_entity")).toBe("Dữ liệu hệ thống");
  });
});
