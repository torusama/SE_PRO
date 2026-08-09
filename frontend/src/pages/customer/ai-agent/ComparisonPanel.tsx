import { X } from "lucide-react";
import type { AgentRecommendation } from "./agent.types";
import {
  cleanAgentDisplayText,
  formatSuitabilityScore,
  formatVnd,
  getRecommendationZoneName,
} from "./agentDisplay";

interface ComparisonPanelProps {
  options: AgentRecommendation[];
  onClose: () => void;
}

export default function ComparisonPanel({
  options,
  onClose,
}: ComparisonPanelProps) {
  if (options.length < 2) return null;
  const plotLabel = (option: AgentRecommendation) =>
    option.plotCodes.length > 1
      ? `Nhóm lô ${option.plotCodes.join(" + ")}`
      : `Lô ${option.plotCodes[0] ?? "chưa xác định"}`;
  const rows = [
    {
      label: "Mã lô",
      render: (option: AgentRecommendation) => option.plotCodes.join(", "),
    },
    {
      label: "Tổng giá",
      render: (option: AgentRecommendation) => formatVnd(option.estimatedTotal),
    },
    {
      label: "Khu vực",
      render: (option: AgentRecommendation) =>
        getRecommendationZoneName(option),
    },
    {
      label: "Hướng",
      render: (option: AgentRecommendation) =>
        option.directions
          .map(cleanAgentDisplayText)
          .filter(Boolean)
          .join(", ") || "—",
    },
    {
      label: "Diện tích",
      render: (option: AgentRecommendation) => `${option.totalAreaSqm || 0} m²`,
    },
    {
      label: "Liền kề",
      render: (option: AgentRecommendation) =>
        option.isAdjacent ? "Có" : "Không",
    },
    {
      label: "Điểm phù hợp",
      render: (option: AgentRecommendation) =>
        formatSuitabilityScore(option.score),
    },
  ];

  return (
    <section className="agent-comparison">
      <div className="agent-comparison-head">
        <div>
          <span>So sánh phương án</span>
          <strong>{options.length} lựa chọn</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng so sánh">
          <X size={17} />
        </button>
      </div>
      <div className="agent-comparison-scroll">
        <table>
          <colgroup>
            <col className="agent-comparison-criteria-col" />
            {options.map((option) => (
              <col key={`${option.optionId}-${option.plotCodes.join("-")}`} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th>Tiêu chí</th>
              {options.map((option) => (
                <th key={`${option.optionId}-${option.plotCodes.join("-")}`}>
                  <strong>{plotLabel(option)}</strong>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                {options.map((option) => (
                  <td key={`${option.optionId}-${option.plotCodes.join("-")}`}>
                    {row.render(option)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
