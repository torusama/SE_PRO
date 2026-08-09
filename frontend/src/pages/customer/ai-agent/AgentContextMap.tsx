import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MapPinned,
  Navigation,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildCemeteryDirection } from "@/lib/cemeteryMapRoute";
import type { AgentRecommendation } from "./agent.types";
import {
  cleanAgentDisplayText,
  formatVnd,
  getRecommendationZoneName,
} from "./agentDisplay";
import type { GuidedTourStep } from "./guidedTour";
import { getRecommendationPlotIds } from "./guidedTour";
import GuidedTourMap from "./GuidedTourMap";
import type { GuidedTourPlot } from "./guidedTourMapModel";
import "./GuidedPlotTour.css";
import "./AgentContextMap.css";

interface AgentContextMapProps {
  recommendations: AgentRecommendation[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
  onStartRequest: (option: AgentRecommendation) => void;
  onOpenFullMap: (option: AgentRecommendation) => void;
}

const ignore = () => {};

export default function AgentContextMap({
  recommendations,
  activeIndex,
  onSelect,
  onClose,
  onStartRequest,
  onOpenFullMap,
}: AgentContextMapProps) {
  const safeIndex = Math.min(
    Math.max(activeIndex, 0),
    Math.max(recommendations.length - 1, 0),
  );
  const active = recommendations[safeIndex];
  const [selectedPlot, setSelectedPlot] = useState<GuidedTourPlot | null>(null);
  const [routeOptionId, setRouteOptionId] = useState<string | null>(null);
  const routeMode = !!active && routeOptionId === active.optionId;
  const [revealedDetailKey, setRevealedDetailKey] = useState<string | null>(
    null,
  );
  const activeStep = useMemo<GuidedTourStep | null>(() => {
    if (!active) return null;
    const plotIds = getRecommendationPlotIds(active);
    return {
      id: `context-${active.optionId}`,
      type: "plot-focus",
      recommendationIndex: safeIndex,
      plotIds,
      narration: "",
      cameraMode: plotIds.length > 1 ? "plot-group" : "single-plot",
      durationMs: 900,
    };
  }, [active, safeIndex]);
  const reducedMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const handleFocusedPlots = useCallback((plots: GuidedTourPlot[]) => {
    setSelectedPlot((current) =>
      current && plots.some((plot) => plot.id === current.id)
        ? current
        : (plots[0] ?? null),
    );
  }, []);
  const detailKey = active
    ? `${active.optionId}:${selectedPlot?.id ?? active.plotCodes[0] ?? "plot"}`
    : "";
  const detailsRevealed = !!detailKey && revealedDetailKey === detailKey;

  useEffect(() => {
    if (!detailKey) return;
    const timer = window.setTimeout(
      () => setRevealedDetailKey(detailKey),
      reducedMotion ? 0 : 720,
    );
    return () => window.clearTimeout(timer);
  }, [detailKey, reducedMotion]);

  if (!active || !activeStep) return null;

  function selectOption(index: number) {
    setRouteOptionId(null);
    onSelect(index);
  }

  const zoneName = getRecommendationZoneName(active);
  const direction =
    cleanAgentDisplayText(selectedPlot?.direction) ||
    active.directions.map(cleanAgentDisplayText).filter(Boolean).join(", ") ||
    "Chưa xác định";
  const selectedCode = selectedPlot?.plotCode ?? active.plotCodes[0];
  const plotType =
    selectedPlot?.plotType === "family"
      ? "Lô gia đình / dòng tộc"
      : selectedPlot?.plotType === "double"
        ? "Lô đôi"
        : "Lô đơn";
  const status =
    selectedPlot?.status === "available"
      ? "Đang trống"
      : selectedPlot?.status === "pending"
        ? "Đang chờ xử lý"
        : selectedPlot?.status === "reserved"
          ? "Đã giữ chỗ"
          : selectedPlot?.status === "sold"
            ? "Đã bán"
            : "Tạm khóa";
  const rowLocation = selectedPlot?.rowCode
    ? `Hàng ${selectedPlot.rowCode}${
        selectedPlot.plotNumber ? ` · ô ${selectedPlot.plotNumber}` : ""
      }`
    : "Xem trên bản đồ";
  const description =
    cleanAgentDisplayText(selectedPlot?.description) ||
    `${plotType} tại ${zoneName}, hướng ${direction}, giá niêm yết được cập nhật từ quỹ lô hiện tại.`;

  return (
    <aside
      className={`agent-context-map ${routeMode ? "is-route-mode" : ""}`}
      aria-label="Bản đồ lô đang tư vấn"
    >
      <button
        type="button"
        className="agent-context-map-close"
        onClick={onClose}
        aria-label="Đóng bản đồ tư vấn"
        title="Đóng bản đồ"
      >
        <X size={19} />
      </button>
      <header className="agent-context-map-header">
        <div>
          <span>
            <MapPinned size={15} />
            BẢN ĐỒ TƯ VẤN
          </span>
          <strong>
            {routeMode ? `Đường đi đến ${selectedCode}` : "Phương án đang xem"}
          </strong>
          <small>
            {safeIndex + 1}/{recommendations.length} · {zoneName}
            {active.plotIds.length > 1
              ? ` · ${active.plotIds.length} lô liền kề`
              : ""}
          </small>
        </div>
      </header>

      <div className="agent-context-map-canvas">
        <GuidedTourMap
          activeStep={activeStep}
          reducedMotion={reducedMotion}
          onUserInteraction={ignore}
          onCameraAnimatingChange={ignore}
          onPlotSelect={(plot) => setSelectedPlot(plot)}
          onFocusedPlotsChange={handleFocusedPlots}
          routePlot={routeMode ? selectedPlot : null}
        />
        {routeMode && selectedPlot && (
          <div className="agent-context-route-panel" aria-live="polite">
            <div>
              <span>
                <Navigation size={14} />
                CHỈ ĐƯỜNG NỘI KHU
              </span>
              <strong>{selectedPlot.plotCode}</strong>
              <p>{buildCemeteryDirection(selectedPlot)}</p>
            </div>
            <button
              type="button"
              onClick={() => setRouteOptionId(null)}
              aria-label="Quay lại thông tin lô"
              title="Quay lại thông tin lô"
            >
              <X size={15} />
            </button>
          </div>
        )}
      </div>

      {!routeMode && (
        <section className="agent-context-map-details">
          {recommendations.length > 1 && (
            <div className="agent-context-map-switcher">
              <button
                type="button"
                onClick={() => selectOption(safeIndex - 1)}
                disabled={safeIndex === 0}
                aria-label="Phương án trước"
              >
                <ChevronLeft size={17} />
              </button>
              <div>
                {recommendations.map((option, index) => (
                  <button
                    type="button"
                    key={option.optionId}
                    className={index === safeIndex ? "is-active" : ""}
                    aria-label={`Xem phương án ${index + 1}`}
                    aria-pressed={index === safeIndex}
                    onClick={() => selectOption(index)}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => selectOption(safeIndex + 1)}
                disabled={safeIndex === recommendations.length - 1}
                aria-label="Phương án tiếp theo"
              >
                <ChevronRight size={17} />
              </button>
            </div>
          )}

          <div className="agent-context-plot-stage">
            {!detailsRevealed && (
              <div className="agent-context-plot-loading" aria-live="polite">
                <span aria-hidden="true" />
                Đang mở thông tin lô…
              </div>
            )}
            <article
              className={`agent-context-plot-card ${detailsRevealed ? "is-revealed" : ""}`}
              aria-hidden={!detailsRevealed}
            >
              <div>
                <span>LÔ ĐANG CHỌN</span>
                <h3>{selectedCode}</h3>
                <p>
                  {active.plotIds.length > 1
                    ? `Thuộc phương án ${active.plotIds.length} lô liền kề · tổng ${formatVnd(active.plotCost)}`
                    : "Thông tin đang được đồng bộ từ bản đồ"}
                </p>
              </div>
              <dl>
                <div>
                  <dt>Khu vực</dt>
                  <dd>{zoneName}</dd>
                </div>
                <div>
                  <dt>Hướng</dt>
                  <dd>{direction}</dd>
                </div>
                <div>
                  <dt>Diện tích</dt>
                  <dd>{selectedPlot?.area || active.totalAreaSqm || 0} m²</dd>
                </div>
                <div>
                  <dt>Giá niêm yết</dt>
                  <dd>{formatVnd(selectedPlot?.price || active.plotCost)}</dd>
                </div>
                <div>
                  <dt>Loại lô</dt>
                  <dd>{plotType}</dd>
                </div>
                <div>
                  <dt>Vị trí trong khu</dt>
                  <dd>{rowLocation}</dd>
                </div>
                <div>
                  <dt>Quy cách</dt>
                  <dd>{selectedPlot?.size || "Chưa xác định"}</dd>
                </div>
                <div>
                  <dt>Trạng thái</dt>
                  <dd className="is-status">{status}</dd>
                </div>
              </dl>
              <p className="agent-context-plot-description">{description}</p>
            </article>
          </div>

          <div
            className={`agent-context-map-actions ${detailsRevealed ? "is-revealed" : ""}`}
          >
            <button type="button" onClick={() => onOpenFullMap(active)}>
              <ExternalLink size={14} />
              Bản đồ đầy đủ
            </button>
            <button
              type="button"
              onClick={() => setRouteOptionId(active.optionId)}
              disabled={!selectedPlot}
            >
              <Navigation size={14} />
              Tìm đường
            </button>
            <button
              type="button"
              className="is-primary"
              onClick={() => onStartRequest(active)}
            >
              Đặt yêu cầu
            </button>
          </div>
        </section>
      )}
    </aside>
  );
}
