import { useState } from "react";
import { Bot, Send } from "lucide-react";


type TabMode = "all" | "single" | "family";

const ZONE_DETAILS: Record<
  string,
  {
    name: string;
    type: string;
    price: string;
    plots: string;
    status: string;
    desc: string;
  }
> = {
  A: {
    name: "Khu A - Cao cấp",
    type: "Mộ đơn cao cấp",
    price: "Từ 65 triệu đ",
    plots: "42 lô quy hoạch",
    status: "28 còn trống • 14 đã bán/giữ",
    desc: "Vị trí trang trọng sát đại lộ trung tâm, mật độ thoáng.",
  },
  B: {
    name: "Khu B - Tiêu chuẩn",
    type: "Mộ đơn tiêu chuẩn",
    price: "Từ 45 triệu đ",
    plots: "42 lô quy hoạch",
    status: "22 còn trống • 20 đã bán/giữ",
    desc: "Cân bằng chi phí và vị trí đẹp, lối đi rộng rãi.",
  },
  D: {
    name: "Khu D - Bình dân",
    type: "Mộ đơn bình dân",
    price: "Từ 32 triệu đ",
    plots: "48 lô quy hoạch",
    status: "30 còn trống • 18 đã bán/giữ",
    desc: "Giá thành tối ưu, tiếp cận trực tiếp từ đường N1.",
  },
  E: {
    name: "Khu E - Cải táng",
    type: "Mộ đơn cải táng",
    price: "Từ 28 triệu đ",
    plots: "49 lô quy hoạch",
    status: "31 còn trống • 18 đã bán/giữ",
    desc: "Thiết kế chuẩn nghi thức di dời và cải táng.",
  },
  F: {
    name: "Khu F - Mật độ cao",
    type: "Mộ đơn nhỏ gọn",
    price: "Từ 24 triệu đ",
    plots: "48 lô quy hoạch",
    status: "25 còn trống • 23 đã bán/giữ",
    desc: "Tối ưu diện tích, phù hợp ngân sách tiết kiệm.",
  },
  G: {
    name: "Khu G - Mở rộng",
    type: "Mộ đơn mở rộng",
    price: "Từ 36 triệu đ",
    plots: "42 lô quy hoạch",
    status: "35 còn trống • 7 đã bán/giữ",
    desc: "Khu vực phát triển mới, không gian thoáng đãng.",
  },
  H: {
    name: "Khu H - Mộ đơn cá nhân",
    type: "Mộ đơn cá nhân",
    price: "Từ 30 triệu đ",
    plots: "42 lô quy hoạch",
    status: "26 còn trống • 16 đã bán/giữ",
    desc: "Liền kề Cổng Chính, di chuyển thăm viếng rất tiện.",
  },
  C1: {
    name: "Cụm C1 - Gia tộc 1",
    type: "Lô gia tộc cao cấp",
    price: "Từ 120 triệu đ",
    plots: "50 lô cụm",
    status: "15 còn trống • 35 đã bán/giữ",
    desc: "Khuôn viên quây quần riêng biệt dành cho gia tộc.",
  },
  C2: {
    name: "Cụm C2 - Gia tộc 2",
    type: "Lô gia tộc",
    price: "Từ 120 triệu đ",
    plots: "50 lô cụm",
    status: "18 còn trống • 32 đã bán/giữ",
    desc: "Lối đi nội bộ riêng, phong thủy yên tĩnh.",
  },
  C3: {
    name: "Cụm C3 - Gia tộc 3",
    type: "Lô gia tộc",
    price: "Từ 120 triệu đ",
    plots: "50 lô cụm",
    status: "20 còn trống • 30 đã bán/giữ",
    desc: "Khu vực phân lập độc lập, cảnh quan xanh mát.",
  },
  C4: {
    name: "Cụm C4 - Gia tộc 4",
    type: "Lô gia tộc",
    price: "Từ 120 triệu đ",
    plots: "50 lô cụm",
    status: "24 còn trống • 26 đã bán/giữ",
    desc: "Kế cận Cổng Phụ phía Nam, nối liền đại lộ.",
  },
  SPIRIT: {
    name: "Khu Tâm Linh",
    type: "Công viên trung tâm",
    price: "Tiện ích chung",
    plots: "Cảnh quan",
    status: "Hồ điều hòa & Đài tưởng niệm",
    desc: "Trái tim tâm linh tĩnh lặng của Vĩnh Phúc Viên.",
  },
};

// Pure geometric SVG zone for single plots (No text inside)
function SingleZoneSVG({
  code,
  x,
  y,
  width,
  height,
  cols = 7,
  rows = 4,
  color,
  isDimmed,
  isHovered,
  onHover,
  onLeave,
}: {
  code: string;
  x: number;
  y: number;
  width: number;
  height: number;
  cols?: number;
  rows?: number;
  color: string;
  isDimmed: boolean;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
}) {
  const padX = 7;
  const padY = 7;
  const cellW = (width - padX * 2) / cols;
  const cellH = (height - padY * 2) / rows;

  return (
    <g
      opacity={isDimmed ? 0.22 : 1}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{ cursor: "pointer", transition: "all 0.25s ease" }}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx="6"
        fill={color}
        fillOpacity={isHovered ? 0.22 : 0.07}
        stroke={color}
        strokeOpacity={isHovered ? 1 : 0.45}
        strokeWidth={isHovered ? 1.8 : 1}
      />
      {Array.from({ length: cols * rows }, (_, idx) => {
        const c = idx % cols;
        const r = Math.floor(idx / cols);
        const statusIdx = (idx + code.charCodeAt(0)) % 3;
        const pColor =
          statusIdx === 0
            ? "#00b89e"
            : statusIdx === 1
              ? "#c9a84c"
              : "#7b6bcc";

        return (
          <rect
            key={`${code}-${idx}`}
            x={x + padX + c * cellW}
            y={y + padY + r * cellH}
            width={Math.max(cellW - 2.5, 3)}
            height={Math.max(cellH - 2.5, 3)}
            rx="1.2"
            fill={pColor}
            fillOpacity={0.85}
          />
        );
      })}
    </g>
  );
}

// Pure geometric SVG zone for family clusters (No text inside)
function FamilyClusterSVG({
  code,
  x,
  y,
  width,
  height,
  isDimmed,
  isHovered,
  onHover,
  onLeave,
}: {
  code: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isDimmed: boolean;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
}) {
  const color = "#7b6bcc";
  return (
    <g
      opacity={isDimmed ? 0.22 : 1}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{ cursor: "pointer", transition: "all 0.25s ease" }}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx="8"
        fill="rgba(123, 63, 228, 0.08)"
        fillOpacity={isHovered ? 0.24 : 0.08}
        stroke={color}
        strokeOpacity={isHovered ? 1 : 0.45}
        strokeWidth={isHovered ? 1.8 : 1}
      />
      {[0, 1].map((sub) => {
        const subX = x + 8 + sub * (width / 2 - 4);
        const subY = y + 8;
        const subW = width / 2 - 12;
        const subH = height - 16;

        return (
          <g key={`${code}-sub-${sub}`}>
            <rect
              x={subX}
              y={subY}
              width={subW}
              height={subH}
              rx="5"
              fill="rgba(123, 63, 228, 0.12)"
              stroke="rgba(123, 63, 228, 0.35)"
              strokeDasharray="4 3"
            />
            {Array.from({ length: 8 }, (_, pIdx) => {
              const pc = pIdx % 4;
              const pr = Math.floor(pIdx / 4);
              const pColor =
                pIdx % 3 === 0
                  ? "#00b89e"
                  : pIdx % 3 === 1
                    ? "#c9a84c"
                    : "#7b6bcc";

              return (
                <rect
                  key={`${code}-${sub}-${pIdx}`}
                  x={subX + 6 + pc * (subW / 4 - 2)}
                  y={subY + 6 + pr * (subH / 2 - 3)}
                  width={subW / 4 - 4}
                  height={subH / 2 - 5}
                  rx="1.5"
                  fill={pColor}
                  fillOpacity={0.85}
                />
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

export function HomeMapPreview() {
  const [activeTab, setActiveTab] = useState<TabMode>("all");
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);

  const hoverData = hoveredZone ? ZONE_DETAILS[hoveredZone] : null;

  return (
    <div className="home-map-preview" aria-label="Bản đồ nghĩa trang 2D">
      {/* CLEAN TAB TOOLBAR */}
      <div className="home-map-preview__toolbar">
        <span
          className={activeTab === "all" ? "is-active" : ""}
          onClick={() => setActiveTab("all")}
          style={{ cursor: "pointer", fontSize: "11px", fontWeight: 700 }}
        >
          Tất cả
        </span>
        <span
          className={activeTab === "single" ? "is-active" : ""}
          onClick={() => setActiveTab("single")}
          style={{ cursor: "pointer", fontSize: "11px", fontWeight: 700 }}
        >
          Mộ đơn
        </span>
        <span
          className={activeTab === "family" ? "is-active" : ""}
          onClick={() => setActiveTab("family")}
          style={{ cursor: "pointer", fontSize: "11px", fontWeight: 700 }}
        >
          Lô gia tộc
        </span>
        <span className="home-map-preview__status">
          {activeTab === "all"
            ? "Rê chuột vào sơ đồ để xem tên khu"
            : activeTab === "single"
              ? "Khối 7 Khu Mộ Đơn"
              : "Khối 4 Cụm Lô Gia Tộc"}
        </span>
      </div>

      {/* SVG INTERACTIVE SCHEMATIC GRAPHIC (TEXT-FREE MAP) */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
        }}
      >
        <svg viewBox="0 0 720 420" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="home-map-preview-grid"
              width="16"
              height="16"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M16 0H0V16"
                fill="none"
                stroke="rgba(0,229,196,.06)"
                strokeWidth="0.8"
              />
            </pattern>
            <linearGradient id="mainRoadGlow" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(10,255,212,0.1)" />
              <stop offset="50%" stopColor="rgba(10,255,212,0.28)" />
              <stop offset="100%" stopColor="rgba(10,255,212,0.1)" />
            </linearGradient>
          </defs>

          {/* GRID BACKGROUND */}
          <rect width="720" height="420" fill="url(#home-map-preview-grid)" />

          {/* OUTSIDE BOUNDARY POLYGON */}
          <polygon
            points="15,15 705,15 715,45 715,395 690,412 370,412 25,412 10,380 10,45"
            fill="rgba(10, 255, 212, 0.015)"
            stroke="rgba(10, 255, 212, 0.3)"
            strokeDasharray="6 4"
            strokeWidth="1.2"
          />

          {/* ROAD NETWORK */}
          <rect
            x="30"
            y="15"
            width="12"
            height="397"
            fill="rgba(196, 207, 220, 0.08)"
          />
          <rect
            x="225"
            y="15"
            width="16"
            height="397"
            fill="rgba(10, 255, 212, 0.1)"
          />
          <rect
            x="440"
            y="15"
            width="20"
            height="397"
            fill="url(#mainRoadGlow)"
            stroke="rgba(10, 255, 212, 0.22)"
            strokeWidth="0.5"
          />
          <rect
            x="600"
            y="15"
            width="12"
            height="397"
            fill="rgba(196, 207, 220, 0.08)"
          />
          <rect
            x="703"
            y="15"
            width="12"
            height="397"
            fill="rgba(196, 207, 220, 0.08)"
          />

          {/* Cross roads */}
          <rect
            x="30"
            y="103"
            width="426"
            height="10"
            fill="rgba(196, 207, 220, 0.08)"
          />
          <rect
            x="30"
            y="178"
            width="426"
            height="9"
            fill="rgba(196, 207, 220, 0.08)"
          />
          <rect
            x="30"
            y="241"
            width="426"
            height="9"
            fill="rgba(196, 207, 220, 0.08)"
          />
          <rect
            x="30"
            y="320"
            width="426"
            height="10"
            fill="rgba(196, 207, 220, 0.08)"
          />

          <rect
            x="440"
            y="110"
            width="275"
            height="11"
            fill="rgba(123, 63, 228, 0.09)"
          />
          <rect
            x="440"
            y="203"
            width="275"
            height="11"
            fill="rgba(123, 63, 228, 0.09)"
          />
          <rect
            x="440"
            y="296"
            width="275"
            height="11"
            fill="rgba(123, 63, 228, 0.09)"
          />

          {/* LEFT BLOCK: SINGLE PLOT ZONES (A, B, D, E, F, G, H) */}
          <SingleZoneSVG
            code="A"
            x={45}
            y={28}
            width={172}
            height={68}
            color="#00b89e"
            isDimmed={activeTab === "family"}
            isHovered={hoveredZone === "A"}
            onHover={() => setHoveredZone("A")}
            onLeave={() => setHoveredZone(null)}
          />
          <SingleZoneSVG
            code="B"
            x={249}
            y={28}
            width={183}
            height={68}
            color="#c9a84c"
            isDimmed={activeTab === "family"}
            isHovered={hoveredZone === "B"}
            onHover={() => setHoveredZone("B")}
            onLeave={() => setHoveredZone(null)}
          />

          <SingleZoneSVG
            code="D"
            x={45}
            y={117}
            width={172}
            height={57}
            color="#4da6ff"
            isDimmed={activeTab === "family"}
            isHovered={hoveredZone === "D"}
            onHover={() => setHoveredZone("D")}
            onLeave={() => setHoveredZone(null)}
          />
          <SingleZoneSVG
            code="E"
            x={249}
            y={117}
            width={183}
            height={57}
            color="#00b4d8"
            isDimmed={activeTab === "family"}
            isHovered={hoveredZone === "E"}
            onHover={() => setHoveredZone("E")}
            onLeave={() => setHoveredZone(null)}
          />

          {/* SPIRIT PARK (KHU TÂM LINH TRUNG TÂM) */}
          <g
            opacity={activeTab === "family" ? 0.22 : 1}
            onMouseEnter={() => setHoveredZone("SPIRIT")}
            onMouseLeave={() => setHoveredZone(null)}
            style={{ cursor: "pointer", transition: "all 0.25s ease" }}
          >
            <rect
              x={115}
              y={190}
              width={240}
              height={46}
              rx="10"
              fill="rgba(212, 168, 71, 0.08)"
              stroke="rgba(212, 168, 71, 0.55)"
              strokeWidth={hoveredZone === "SPIRIT" ? 1.8 : 1}
            />
            <circle
              cx={235}
              cy={213}
              r={16}
              fill="rgba(212, 168, 71, 0.22)"
              stroke="#d4a847"
              strokeWidth="1.2"
            />
            <circle
              cx={235}
              cy={213}
              r={8}
              fill="none"
              stroke="rgba(255, 255, 255, 0.8)"
              strokeWidth="0.8"
            />
          </g>

          <SingleZoneSVG
            code="F"
            x={45}
            y={254}
            width={172}
            height={62}
            color="#52b788"
            isDimmed={activeTab === "family"}
            isHovered={hoveredZone === "F"}
            onHover={() => setHoveredZone("F")}
            onLeave={() => setHoveredZone(null)}
          />
          <SingleZoneSVG
            code="G"
            x={249}
            y={254}
            width={183}
            height={62}
            color="#2d9d6f"
            isDimmed={activeTab === "family"}
            isHovered={hoveredZone === "G"}
            onHover={() => setHoveredZone("G")}
            onLeave={() => setHoveredZone(null)}
          />

          <SingleZoneSVG
            code="H"
            x={45}
            y={334}
            width={387}
            height={64}
            cols={14}
            rows={4}
            color="#f4a340"
            isDimmed={activeTab === "family"}
            isHovered={hoveredZone === "H"}
            onHover={() => setHoveredZone("H")}
            onLeave={() => setHoveredZone(null)}
          />

          {/* RIGHT BLOCK: FAMILY PLOT CLUSTERS (C1, C2, C3, C4) */}
          <FamilyClusterSVG
            code="C1"
            x={468}
            y={28}
            width={232}
            height={78}
            isDimmed={activeTab === "single"}
            isHovered={hoveredZone === "C1"}
            onHover={() => setHoveredZone("C1")}
            onLeave={() => setHoveredZone(null)}
          />
          <FamilyClusterSVG
            code="C2"
            x={468}
            y={123}
            width={232}
            height={76}
            isDimmed={activeTab === "single"}
            isHovered={hoveredZone === "C2"}
            onHover={() => setHoveredZone("C2")}
            onLeave={() => setHoveredZone(null)}
          />
          <FamilyClusterSVG
            code="C3"
            x={468}
            y={216}
            width={232}
            height={76}
            isDimmed={activeTab === "single"}
            isHovered={hoveredZone === "C3"}
            onHover={() => setHoveredZone("C3")}
            onLeave={() => setHoveredZone(null)}
          />
          <FamilyClusterSVG
            code="C4"
            x={468}
            y={309}
            width={232}
            height={89}
            isDimmed={activeTab === "single"}
            isHovered={hoveredZone === "C4"}
            onHover={() => setHoveredZone("C4")}
            onLeave={() => setHoveredZone(null)}
          />

        </svg>

        {/* FLOATING COMPASS AT TOP-RIGHT (SLEEK & MATCHING MAP2D PAGE) */}
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="La bàn hướng Bắc"
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            width: "36px",
            height: "36px",
            pointerEvents: "none",
            zIndex: 5,
            filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.5))",
          }}
        >
          {/* Single sleek background circle */}
          <circle
            cx="20"
            cy="20"
            r="18"
            fill="rgba(6, 12, 28, 0.88)"
            stroke="rgba(10, 255, 212, 0.45)"
            strokeWidth="1.2"
          />
          {/* North Arrow Pointer (Red) */}
          <polygon points="20,4 24,18 20,20 16,18" fill="#ff4d4d" />
          {/* South Arrow Pointer (Teal) */}
          <polygon points="20,36 24,22 20,20 16,22" fill="rgba(10, 255, 212, 0.6)" />
          {/* Bold North B Label */}
          <text
            x="20"
            y="9.5"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="6.5"
            fontWeight="900"
            fontFamily="Be Vietnam Pro, sans-serif"
          >
            B
          </text>
        </svg>

        {/* FLOATING HOVER CARD FOR ZONE INFORMATION */}
        {hoverData && (
          <div
            style={{
              position: "absolute",
              bottom: "10px",
              left: "12px",
              right: "12px",
              zIndex: 10,
              padding: "10px 14px",
              borderRadius: "10px",
              background: "rgba(6, 11, 29, 0.94)",
              border: "1px solid rgba(10, 255, 212, 0.35)",
              backdropFilter: "blur(10px)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              animation: "fadeUp 200ms ease forwards",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "2px",
                }}
              >
                <strong
                  style={{
                    color: "#e8f4f0",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  {hoverData.name}
                </strong>
                <span
                  style={{
                    fontSize: "9px",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: "rgba(10, 255, 212, 0.15)",
                    color: "#0affd4",
                    fontWeight: 600,
                  }}
                >
                  {hoverData.type}
                </span>
              </div>
              <p
                style={{
                  color: "rgba(232, 244, 240, 0.7)",
                  fontSize: "10.5px",
                  margin: 0,
                }}
              >
                {hoverData.desc}
              </p>
            </div>
            <div
              style={{
                textAlign: "right",
                flexShrink: 0,
                borderLeft: "1px solid rgba(232,244,240,0.12)",
                paddingLeft: "12px",
              }}
            >
              <div
                style={{
                  color: "#c8f241",
                  fontSize: "11px",
                  fontWeight: 700,
                }}
              >
                {hoverData.price}
              </div>
              <div
                style={{
                  color: "rgba(232, 244, 240, 0.5)",
                  fontSize: "9.5px",
                }}
              >
                {hoverData.status}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* LEGEND BAR */}
      <div className="home-map-preview__legend">
        <span>
          <i className="is-open" />
          Còn trống
        </span>
        <span>
          <i className="is-held" />
          Đang giữ chỗ
        </span>
        <span>
          <i className="is-sold" />
          Đã bán
        </span>
      </div>
    </div>
  );
}




export function HomeAgentPreview() {
  return (
    <div className="home-agent-preview" aria-hidden="true">
      <header className="home-agent-preview__header">
        <div className="home-agent-preview__bot">
          <Bot size={17} strokeWidth={1.8} />
        </div>
        <div>
          <strong>Trợ lý Vĩnh Phúc Viên</strong>
          <span>Sẵn sàng hỗ trợ</span>
        </div>
        <i className="home-agent-preview__online" />
      </header>

      <div className="home-agent-preview__conversation">
        <div className="home-agent-preview__message is-agent is-message-one">
          <div className="home-agent-preview__avatar is-bot">
            <Bot size={13} strokeWidth={1.8} />
          </div>
          <p>Gia đình mình đang cần tư vấn về lô đất hay dịch vụ?</p>
        </div>

        <div className="home-agent-preview__message is-customer is-message-two">
          <p>Cần 3 lô liền kề, ngân sách khoảng 300 triệu.</p>
          <div className="home-agent-preview__avatar is-customer">KH</div>
        </div>

        <div className="home-agent-preview__message is-agent is-message-three">
          <div className="home-agent-preview__avatar is-bot">
            <Bot size={13} strokeWidth={1.8} />
          </div>
          <p>
            Tôi đã tìm thấy <strong>4 cụm lô phù hợp</strong> tại Khu B, gần hồ
            phản chiếu.
          </p>
        </div>

        <div className="home-agent-preview__typing">
          <div className="home-agent-preview__avatar is-bot">
            <Bot size={13} strokeWidth={1.8} />
          </div>
          <div className="home-agent-preview__typing-bubble">
            <i />
            <i />
            <i />
          </div>
          <span>Đang đối chiếu vị trí...</span>
        </div>
      </div>

      <footer className="home-agent-preview__composer">
        <span>
          Nhắn tin cho trợ lý
          <span className="home-agent-preview__cursor" />
        </span>
        <Send size={15} strokeWidth={1.8} />
      </footer>
    </div>
  );
}
