import React, { useEffect, useState } from "react";
import "./LotDetail.css";

type TransferType = "chuyen" | "thua" | "tang";

const LotDetailPage: React.FC = () => {
  const [transferType, setTransferType] = useState<TransferType>("chuyen");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    document.title = "Chuyển Nhượng / Thừa Kế — FR-05";
  }, []);

  const handleUpload = () => {
    setUploading(true);
  };

  return (
    <div className="lot-detail-page">
      <div className="bg-canvas">
        <div
          className="glow-orb glow-orb-gold"
          aria-hidden="true"
        />
        <div
          className="glow-orb glow-orb-teal"
          aria-hidden="true"
        />

        <svg
          className="mountain-layer"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M0,320 L0,200 Q180,120 360,170 Q540,220 720,130 Q900,40 1080,90 Q1200,125 1440,60 L1440,320 Z"
            fill="rgba(201,168,76,0.05)"
          />
          <path
            d="M0,320 L0,250 Q300,210 600,240 Q900,270 1200,210 Q1350,180 1440,190 L1440,320 Z"
            fill="rgba(0,229,196,0.04)"
          />
        </svg>

        <div className="stars" aria-hidden="true">
          {Array.from({ length: 80 }, (_, index) => {
            const size = Math.random() * 1.8 + 0.4;
            const gold = Math.random() < 0.08;
            const delay = -Math.random() * 6;
            const duration = 2 + Math.random() * 4;

            return (
              <div
                key={index}
                className="star"
                style={
                  {
                    width: `${size}px`,
                    height: `${size}px`,
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 65}%`,
                    "--d": `${duration}s`,
                    "--delay": `${delay}s`,
                    background: gold ? "#c9a84c" : "#fff",
                  } as React.CSSProperties
                }
              />
            );
          })}
        </div>
      </div>

      <nav className="transfer-nav">
        <div className="nav-logo">
          Vĩnh Hằng
          <span>CEMETERY MANAGEMENT</span>
        </div>

        <div className="nav-links">
          <a href="#">Bản đồ</a>
          <a href="#" className="active">Lô của tôi</a>
          <a href="#">Dịch vụ</a>
          <a href="#">Thông báo</a>
        </div>

        <div className="nav-user">
          <div className="nav-avatar">NT</div>
          Nguyễn Thành
        </div>
      </nav>

      <div className="breadcrumb">
        <a href="#">Trang chủ</a>
        <span className="sep">›</span>
        <a href="#">Lô của tôi</a>
        <span className="sep">›</span>
        <a href="#">A-12</a>
        <span className="sep">›</span>
        <span className="current">Chuyển nhượng / Thừa kế</span>
      </div>

      <div className="stepper">
        <div className="step-track">
          <div className="step done">
            <div className="step-circle">✓</div>
            <div className="step-label">Chọn loại</div>
          </div>

          <div className="step-line filled" />

          <div className="step active">
            <div className="step-circle">2</div>
            <div className="step-label">Thông tin bên nhận</div>
          </div>

          <div className="step-line" />

          <div className="step pending">
            <div className="step-circle">3</div>
            <div className="step-label">Hồ sơ giấy tờ</div>
          </div>

          <div className="step-line" />

          <div className="step pending">
            <div className="step-circle">4</div>
            <div className="step-label">Xác nhận & ký số</div>
          </div>

          <div className="step-line" />

          <div className="step pending">
            <div className="step-circle">5</div>
            <div className="step-label">Hoàn tất</div>
          </div>
        </div>
      </div>

      <main className="transfer-main">
        <div className="page-header">
          <div className="page-tag">FR-05 · Customer Portal</div>
          <h1 className="page-title">Chuyển Nhượng / Thừa Kế Lô</h1>
          <p className="page-desc">
            Thực hiện thủ tục chuyển quyền sử dụng lô phần mộ sang người khác
            theo quy định pháp luật.
          </p>
        </div>

        <div className="type-switch">
          <button
            type="button"
            className={`type-card ${transferType === "chuyen" ? "active" : ""}`}
            onClick={() => setTransferType("chuyen")}
          >
            <div className="type-icon-wrap">🤝</div>
            <div className="type-body">
              <h3>Chuyển nhượng</h3>
              <p>
                Sang tên cho người khác, có thể kèm giao dịch tài chính. Yêu cầu
                xác nhận 2 bên.
              </p>
            </div>
            <div className="type-radio" />
          </button>

          <button
            type="button"
            className={`type-card ${transferType === "thua" ? "active" : ""}`}
            onClick={() => setTransferType("thua")}
          >
            <div className="type-icon-wrap">📜</div>
            <div className="type-body">
              <h3>Thừa kế</h3>
              <p>
                Chuyển quyền sở hữu theo di chúc hoặc thừa kế hợp pháp. Cần
                giấy tờ pháp lý.
              </p>
            </div>
            <div className="type-radio" />
          </button>

          <button
            type="button"
            className={`type-card ${transferType === "tang" ? "active" : ""}`}
            onClick={() => setTransferType("tang")}
          >
            <div className="type-icon-wrap">🎁</div>
            <div className="type-body">
              <h3>Tặng / Cho tặng</h3>
              <p>
                Chuyển nhượng không thu phí, dành cho người thân trong gia đình.
              </p>
            </div>
            <div className="type-radio" />
          </button>
        </div>

        <div className="content-layout">
          <div>
            <div className="lot-preview">
              <div className="lot-thumb-mini">
                <svg
                  viewBox="0 0 80 64"
                  xmlns="http://www.w3.org/2000/svg"
                  width="80"
                  height="64"
                  aria-hidden="true"
                >
                  <rect width="80" height="64" fill="rgba(4,6,14,0.8)" />
                  <rect
                    x="10"
                    y="10"
                    width="25"
                    height="18"
                    rx="2"
                    fill="rgba(0,229,196,0.15)"
                    stroke="rgba(0,229,196,0.5)"
                    strokeWidth="1"
                  />
                  <rect
                    x="38"
                    y="10"
                    width="25"
                    height="18"
                    rx="2"
                    fill="rgba(201,168,76,0.25)"
                    stroke="rgba(201,168,76,0.8)"
                    strokeWidth="1.5"
                  />
                  <text
                    x="50"
                    y="21"
                    textAnchor="middle"
                    fontSize="7"
                    fill="rgba(201,168,76,0.9)"
                    fontFamily="sans-serif"
                  >
                    A-12
                  </text>
                  <rect
                    x="10"
                    y="32"
                    width="25"
                    height="18"
                    rx="2"
                    fill="rgba(0,229,196,0.08)"
                    stroke="rgba(0,229,196,0.2)"
                    strokeWidth="0.5"
                  />
                  <rect
                    x="38"
                    y="32"
                    width="25"
                    height="18"
                    rx="2"
                    fill="rgba(0,229,196,0.08)"
                    stroke="rgba(0,229,196,0.2)"
                    strokeWidth="0.5"
                  />
                </svg>
              </div>

              <div>
                <div className="lot-id-big">Lô A-12 · Khu Vĩnh Phúc</div>
                <div className="lot-sub-info">
                  Diện tích: 4m² · Tầng 2 · Hướng Đông Nam · Còn 42 năm sử dụng
                </div>
              </div>

              <div className="lot-price-right">
                <div className="lot-price-label">Giá trị lô hiện tại</div>
                <div className="lot-price-val">28.500.000 ₫</div>
              </div>
            </div>

            <div className="form-block">
              <div className="section-label">
                <span className="snum">1</span>
                Bên chuyển nhượng (Bên A)
              </div>

              <div className="party-card">
                <div className="party-card-title">
                  <span className="dot teal" />
                  Thông tin chủ sở hữu hiện tại
                </div>

                <div className="party-verified">✓ Đã xác minh</div>

                <div className="field-row">
                  <div className="field">
                    <label>Họ và tên</label>
                    <input
                      type="text"
                      value="Nguyễn Văn Thành"
                      readOnly
                    />
                  </div>
                  <div className="field">
                    <label>CCCD / Hộ chiếu</label>
                    <input
                      type="text"
                      value="079 123 456 789"
                      readOnly
                    />
                  </div>
                </div>

                <div className="field-row">
                  <div className="field">
                    <label>Số điện thoại</label>
                    <input
                      type="text"
                      value="0901 234 567"
                      readOnly
                    />
                  </div>
                  <div className="field">
                    <label>Email</label>
                    <input
                      type="text"
                      value="thanh.nv@email.com"
                      readOnly
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="form-block">
              <div className="section-label">
                <span className="snum">2</span>
                Bên nhận (Bên B)
              </div>

              <div className="party-card receiver">
                <div className="party-card-title">
                  <span className="dot gold" />
                  Thông tin người nhận quyền sở hữu
                </div>

                <div className="field-row">
                  <div className="field">
                    <label>
                      Họ và tên <span className="req">*</span>
                    </label>
                    <input type="text" placeholder="Nhập đầy đủ họ tên" />
                  </div>

                  <div className="field">
                    <label>
                      CCCD / Hộ chiếu <span className="req">*</span>
                    </label>
                    <input type="text" placeholder="Số CCCD / hộ chiếu" />
                  </div>
                </div>

                <div className="field-row">
                  <div className="field">
                    <label>Ngày sinh</label>
                    <input type="date" />
                  </div>

                  <div className="field">
                    <label>Mối quan hệ</label>
                    <select defaultValue="">
                      <option value="">Chọn mối quan hệ</option>
                      <option>Vợ / Chồng</option>
                      <option>Con ruột</option>
                      <option>Anh / Chị / Em</option>
                      <option>Cha / Mẹ</option>
                      <option>Người thân khác</option>
                      <option>Không có quan hệ</option>
                    </select>
                  </div>
                </div>

                <div className="field-row">
                  <div className="field">
                    <label>
                      Số điện thoại <span className="req">*</span>
                    </label>
                    <input type="tel" placeholder="Số liên lạc bên B" />
                  </div>

                  <div className="field">
                    <label>Email</label>
                    <input
                      type="email"
                      placeholder="Email để nhận thông báo"
                    />
                  </div>
                </div>

                <div className="field">
                  <label>Địa chỉ thường trú</label>
                  <input
                    type="text"
                    placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
                  />
                </div>
              </div>

              <div className="transaction-info">
                <div className="section-label section-label-small">
                  Thông tin giao dịch
                </div>

                <div className="field-row">
                  <div className="field">
                    <label>Giá trị chuyển nhượng (₫)</label>
                    <input
                      type="text"
                      placeholder="0 — nếu là tặng/thừa kế"
                      defaultValue="28.500.000"
                    />
                  </div>

                  <div className="field">
                    <label>Hình thức thanh toán</label>
                    <select defaultValue="Chuyển khoản ngân hàng">
                      <option>Chuyển khoản ngân hàng</option>
                      <option>Tiền mặt tại quầy</option>
                      <option>Không có giao dịch</option>
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label>Ghi chú thỏa thuận</label>
                  <textarea placeholder="Các điều khoản bổ sung giữa hai bên (nếu có)..." />
                </div>
              </div>
            </div>

            <div className="form-block">
              <div className="section-label">
                <span className="snum">3</span>
                Hồ sơ giấy tờ cần nộp
              </div>

              <div className="doc-list">
                <div className="doc-item">
                  <div className="doc-icon">📄</div>
                  <div className="doc-name">CCCD bên chuyển nhượng (2 mặt)</div>
                  <div className="doc-size">Bắt buộc</div>
                  <div className="doc-ok">✓</div>
                </div>

                <div className="doc-item">
                  <div className="doc-icon">📄</div>
                  <div className="doc-name">CCCD bên nhận (2 mặt)</div>
                  <div className="doc-size">Bắt buộc</div>
                  <div className="doc-ok muted">—</div>
                </div>

                <div className="doc-item">
                  <div className="doc-icon">📋</div>
                  <div className="doc-name">
                    Giấy tờ chứng minh quan hệ (nếu có)
                  </div>
                  <div className="doc-size">Tùy chọn</div>
                  <div className="doc-ok muted">—</div>
                </div>

                <div className="doc-item">
                  <div className="doc-icon">📃</div>
                  <div className="doc-name">Hợp đồng mua bán lô gốc</div>
                  <div className="doc-size">Bắt buộc</div>
                  <div className="doc-ok">✓</div>
                </div>
              </div>

              <button
                type="button"
                className={`upload-zone ${uploading ? "uploading" : ""}`}
                onClick={handleUpload}
              >
                {uploading ? (
                  <>
                    <div className="upload-icon">⏳</div>
                    <div className="upload-label">Đang tải lên...</div>
                  </>
                ) : (
                  <>
                    <div className="upload-icon">📎</div>
                    <div className="upload-label">
                      Nhấn để tải lên giấy tờ còn thiếu
                    </div>
                    <div className="upload-sub">
                      PDF, JPG, PNG — tối đa 10MB mỗi file
                    </div>
                  </>
                )}
              </button>
            </div>
          </div>

          <div>
            <div className="summary-panel">
              <div className="summary-title">Tóm tắt yêu cầu</div>

              <div className="summary-row">
                <span className="k">Loại giao dịch</span>
                <span className="v">
                  {transferType === "chuyen"
                    ? "Chuyển nhượng"
                    : transferType === "thua"
                      ? "Thừa kế"
                      : "Tặng / Cho tặng"}
                </span>
              </div>

              <div className="summary-row">
                <span className="k">Lô phần mộ</span>
                <span className="v">A-12 · Khu Vĩnh Phúc</span>
              </div>

              <div className="summary-row">
                <span className="k">Bên chuyển</span>
                <span className="v">Nguyễn Văn Thành</span>
              </div>

              <div className="summary-row">
                <span className="k">Bên nhận</span>
                <span className="v muted-text">Chưa điền</span>
              </div>

              <div className="summary-row">
                <span className="k">Giá trị</span>
                <span className="v">28.500.000 ₫</span>
              </div>

              <div className="summary-row">
                <span className="k">Phí thủ tục</span>
                <span className="v">500.000 ₫</span>
              </div>

              <div className="summary-total">
                <span className="k">Tổng phí phải nộp</span>
                <span className="v">500.000 ₫</span>
              </div>

              <div className="legal-note">
                ⚖️ Hồ sơ sẽ được ban quản lý xem xét trong vòng{" "}
                <strong>5–7 ngày làm việc</strong>. Sau khi duyệt, hai bên sẽ
                nhận thông báo để ký số xác nhận.
              </div>

              <button type="button" className="btn-main">
                Nộp hồ sơ chuyển nhượng →
              </button>

              <button type="button" className="btn-ghost">
                Lưu nháp
              </button>

              <div className="process-steps">
                <div className="process-heading">Quy trình xử lý</div>

                <div className="process-step">
                  <div className="ps-num">1</div>
                  <div className="ps-body">
                    <div className="ps-title">Nộp hồ sơ</div>
                    <div className="ps-sub">Điền thông tin & tải hồ sơ</div>
                  </div>
                </div>

                <div className="process-step">
                  <div className="ps-num">2</div>
                  <div className="ps-body">
                    <div className="ps-title">Xét duyệt</div>
                    <div className="ps-sub">
                      Ban quản lý xem xét 5–7 ngày
                    </div>
                  </div>
                </div>

                <div className="process-step">
                  <div className="ps-num">3</div>
                  <div className="ps-body">
                    <div className="ps-title">Ký số</div>
                    <div className="ps-sub">Hai bên xác nhận điện tử</div>
                  </div>
                </div>

                <div className="process-step last">
                  <div className="ps-num teal-num">4</div>
                  <div className="ps-body">
                    <div className="ps-title">Hoàn tất</div>
                    <div className="ps-sub">Hợp đồng mới được cấp</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LotDetailPage;
