import { Bot, Send } from "lucide-react";

const PLOT_COLORS = ["#00b89e", "#c9a84c", "#7b6bcc", "#148d8b"];

type ZonePreviewProps = {
  label: string;
  x: number;
  y: number;
  columns: number;
  rows: number;
  tint: string;
};

function ZonePreview({ label, x, y, columns, rows, tint }: ZonePreviewProps) {
  return (
    <g>
      <rect
        x={x - 10}
        y={y - 18}
        width={columns * 14 + 20}
        height={rows * 12 + 31}
        rx="5"
        fill={tint}
        fillOpacity="0.06"
        stroke={tint}
        strokeOpacity="0.32"
      />
      <text x={x} y={y - 7} className="home-map-preview__zone-label">
        {label}
      </text>
      {Array.from({ length: columns * rows }, (_, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const isSelected = label === "KHU B" && index === 7;
        return (
          <rect
            key={`${label}-${index}`}
            x={x + column * 14}
            y={y + row * 12}
            width="9"
            height="7"
            rx="1"
            fill={
              PLOT_COLORS[(index + label.charCodeAt(4)) % PLOT_COLORS.length]
            }
            fillOpacity={isSelected ? 0.96 : 0.76}
            stroke={isSelected ? "#e7c75d" : "none"}
            strokeWidth={isSelected ? 1.4 : 0}
          />
        );
      })}
    </g>
  );
}

function FamilyCluster({
  x,
  y,
  label,
}: {
  x: number;
  y: number;
  label: string;
}) {
  return (
    <g>
      <rect
        x={x - 8}
        y={y - 17}
        width="78"
        height="44"
        rx="5"
        className="home-map-preview__cluster"
      />
      <text x={x} y={y - 7} className="home-map-preview__zone-label">
        {label}
      </text>
      {Array.from({ length: 12 }, (_, index) => (
        <rect
          key={`${label}-${index}`}
          x={x + (index % 4) * 15}
          y={y + Math.floor(index / 4) * 10}
          width="10"
          height="6"
          rx="1"
          fill={PLOT_COLORS[(index + 2) % PLOT_COLORS.length]}
          fillOpacity="0.8"
        />
      ))}
    </g>
  );
}

export function HomeMapPreview() {
  return (
    <div className="home-map-preview" aria-hidden="true">
      <div className="home-map-preview__toolbar">
        <span className="is-active">Mộ đơn</span>
        <span>Lô gia tộc</span>
        <span className="home-map-preview__status">Đang xem tổng thể</span>
      </div>
      <svg viewBox="0 0 640 356" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id="home-map-preview-grid"
            width="16"
            height="16"
            patternUnits="userSpaceOnUse"
          >
            <path d="M16 0H0V16" fill="none" stroke="rgba(0,229,196,.08)" />
          </pattern>
        </defs>
        <rect width="640" height="356" fill="url(#home-map-preview-grid)" />
        <polygon
          className="home-map-preview__land"
          points="34,44 384,24 456,56 452,322 62,334 28,286"
        />
        <path
          className="home-map-preview__road"
          d="M50 178H434 M262 42V313 M434 116H594 M434 242H594"
        />
        <path
          className="home-map-preview__road home-map-preview__road--thin"
          d="M55 110H248 M55 258H248"
        />

        <ZonePreview
          label="KHU A"
          x={76}
          y={67}
          columns={6}
          rows={4}
          tint="#00b89e"
        />
        <ZonePreview
          label="KHU B"
          x={294}
          y={67}
          columns={6}
          rows={4}
          tint="#c9a84c"
        />
        <ZonePreview
          label="KHU D"
          x={76}
          y={204}
          columns={6}
          rows={4}
          tint="#4da6ff"
        />
        <ZonePreview
          label="KHU E"
          x={294}
          y={204}
          columns={6}
          rows={4}
          tint="#00b4d8"
        />

        <g className="home-map-preview__park">
          <rect x="152" y="140" width="90" height="43" rx="12" />
          <circle cx="197" cy="161" r="12" />
          <text x="197" y="164" textAnchor="middle">
            TÂM LINH
          </text>
        </g>

        <FamilyCluster x={490} y={78} label="C1" />
        <FamilyCluster x={490} y={139} label="C2" />
        <FamilyCluster x={490} y={200} label="C3" />
        <FamilyCluster x={490} y={261} label="C4" />

        <g className="home-map-preview__gate">
          <path d="M78 310l10-11 10 11-10 11z" />
          <text x="88" y="337" textAnchor="middle">
            CỔNG CHÍNH
          </text>
        </g>
        <g className="home-map-preview__compass">
          <circle cx="602" cy="310" r="17" />
          <path d="M602 295v30M587 310h30" />
          <text x="602" y="287" textAnchor="middle">
            B
          </text>
        </g>
      </svg>
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
