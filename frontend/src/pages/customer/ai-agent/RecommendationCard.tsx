import { Check, GitCompareArrows, MapPinned, Sparkles } from "lucide-react";
import type { AgentRecommendation } from "./agent.types";
import {
  cleanAgentDisplayText,
  formatSuitabilityScore,
  formatVnd,
  getRecommendationZoneName,
} from "./agentDisplay";

interface RecommendationCardProps {
  option: AgentRecommendation;
  index: number;
  selectedForCompare: boolean;
  onToggleCompare: (option: AgentRecommendation) => void;
  onViewMap: (option: AgentRecommendation) => void;
  onStartRequest: (option: AgentRecommendation) => void;
}

const plotTypeLabel = (value: string) =>
  ({
    single: "Lô đơn",
    double: "Lô đôi",
    family: "Lô gia đình",
  })[value] ?? cleanAgentDisplayText(value);

const plotStatusLabel = (value: string) =>
  ({
    available: "Đang trống",
    pending: "Đang xử lý yêu cầu",
    reserved: "Đang hoàn tất mua",
    sold: "Đã bán",
    locked: "Đang khóa",
    maintenance: "Đang bảo trì",
  })[value] ?? cleanAgentDisplayText(value);

export default function RecommendationCard({
  option,
  index,
  selectedForCompare,
  onToggleCompare,
  onViewMap,
  onStartRequest,
}: RecommendationCardProps) {
  const zoneName = getRecommendationZoneName(option);
  const directions =
    option.directions.map(cleanAgentDisplayText).filter(Boolean).join(", ") ||
    "Chưa xác định";

  return (
    <article className="agent-option-card">
      <div className="agent-option-head">
        <div>
          <span className="agent-option-kicker">Phương án {index + 1}</span>
          <h4>{option.plotCodes.join(" · ")}</h4>
        </div>
        <div className="agent-score">
          <Sparkles size={13} />
          {formatSuitabilityScore(option.score)}
        </div>
      </div>

      <div className="agent-option-stats">
        <div>
          <span>Tổng giá</span>
          <strong>{formatVnd(option.estimatedTotal)}</strong>
        </div>
        <div>
          <span>Khu vực</span>
          <strong>{zoneName}</strong>
        </div>
        <div>
          <span>Hướng</span>
          <strong>{directions}</strong>
        </div>
        <div>
          <span>Diện tích</span>
          <strong>{option.totalAreaSqm || 0} m²</strong>
        </div>
      </div>

      {option.analysisSummary && (
        <div className="agent-option-analysis">
          <strong>Tóm tắt đối chiếu dữ liệu</strong>
          <p>{cleanAgentDisplayText(option.analysisSummary)}</p>
        </div>
      )}

      <p className="agent-option-section-label">Điểm phù hợp</p>
      <ul className="agent-reasons">
        {option.reasons.map((reason) => (
          <li key={reason}>
            <Check size={13} />
            {cleanAgentDisplayText(reason)}
          </li>
        ))}
      </ul>

      {option.tradeOffs.length > 0 && (
        <p className="agent-tradeoff">
          <strong>Điểm cần cân nhắc:</strong>{" "}
          {option.tradeOffs.map(cleanAgentDisplayText).join(" · ")}
        </p>
      )}

      {option.plots && option.plots.length > 0 && (
        <details className="agent-option-details">
          <summary>Chi tiết dữ liệu lô</summary>
          <div className="agent-option-details-list">
            {option.plots.map((plot) => (
              <article key={plot.id}>
                <div className="agent-option-details-head">
                  <strong>{plot.plotCode}</strong>
                  <span>{plotStatusLabel(plot.status)}</span>
                </div>
                <dl>
                  <div>
                    <dt>Khu vực</dt>
                    <dd>
                      {cleanAgentDisplayText(plot.zoneName)}
                      {plot.zoneCode ? ` (${plot.zoneCode})` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt>Loại lô</dt>
                    <dd>{plotTypeLabel(plot.plotType)}</dd>
                  </div>
                  <div>
                    <dt>Diện tích</dt>
                    <dd>
                      {typeof plot.areaSqm === "number"
                        ? `${plot.areaSqm} m²`
                        : "Chưa cập nhật"}
                    </dd>
                  </div>
                  <div>
                    <dt>Hướng</dt>
                    <dd>
                      {plot.direction
                        ? cleanAgentDisplayText(plot.direction)
                        : "Chưa cập nhật"}
                    </dd>
                  </div>
                  <div>
                    <dt>Vị trí nội khu</dt>
                    <dd>
                      {[
                        plot.rowNumber && `Hàng ${plot.rowNumber}`,
                        plot.columnNumber && `Cột ${plot.columnNumber}`,
                      ]
                        .filter(Boolean)
                        .join(", ") || "Chưa cập nhật"}
                    </dd>
                  </div>
                  <div>
                    <dt>Giá niêm yết</dt>
                    <dd>{formatVnd(plot.price)}</dd>
                  </div>
                </dl>
                {plot.description && (
                  <p>{cleanAgentDisplayText(plot.description)}</p>
                )}
                {plot.imageUrl && (
                  <span className="agent-option-image-note">
                    Lô này có ảnh minh họa trong hồ sơ.
                  </span>
                )}
              </article>
            ))}
          </div>
        </details>
      )}

      <div className="agent-option-actions">
        <button type="button" onClick={() => onViewMap(option)}>
          <MapPinned size={15} />
          Xem bản đồ
        </button>
        <button
          type="button"
          className={selectedForCompare ? "is-selected" : ""}
          onClick={() => onToggleCompare(option)}
        >
          <GitCompareArrows size={15} />
          {selectedForCompare ? "Đã chọn" : "So sánh"}
        </button>
        <button
          type="button"
          className="agent-primary-action"
          onClick={() => onStartRequest(option)}
        >
          Đặt yêu cầu
        </button>
      </div>
    </article>
  );
}
