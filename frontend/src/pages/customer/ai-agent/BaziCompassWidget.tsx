import React, { useId } from "react";
import type { CSSProperties } from "react";

export interface DirectionItem {
  direction: string;
  star: string;
  meaning: string;
}

interface BaziCompassWidgetProps {
  cungMenh?: string;
  tuMenh?: string;
  element?: string;
  napAmName?: string;
  goodDirections?: DirectionItem[];
  badDirections?: DirectionItem[];
  preferredDirections?: string[];
}

type DirectionType = "good" | "bad" | "neutral";
type IndexedStyle = CSSProperties & { "--bazi-index"?: number };

const DIRECTIONS = [
  { key: "Bắc", short: "BẮC", trigram: "☵", angle: 0 },
  { key: "Đông Bắc", short: "ĐÔNG BẮC", trigram: "☶", angle: 45 },
  { key: "Đông", short: "ĐÔNG", trigram: "☳", angle: 90 },
  { key: "Đông Nam", short: "ĐÔNG NAM", trigram: "☴", angle: 135 },
  { key: "Nam", short: "NAM", trigram: "☲", angle: 180 },
  { key: "Tây Nam", short: "TÂY NAM", trigram: "☷", angle: 225 },
  { key: "Tây", short: "TÂY", trigram: "☱", angle: 270 },
  { key: "Tây Bắc", short: "TÂY BẮC", trigram: "☰", angle: 315 },
] as const;

const SON_NAMES = [
  "Tý",
  "Quý",
  "Sửu",
  "Cấn",
  "Dần",
  "Giáp",
  "Mão",
  "Ất",
  "Thìn",
  "Tốn",
  "Tỵ",
  "Bính",
  "Ngọ",
  "Đinh",
  "Mùi",
  "Khôn",
  "Thân",
  "Canh",
  "Dậu",
  "Tân",
  "Tuất",
  "Càn",
  "Hợi",
  "Nhâm",
];

const normalize = (value?: string) =>
  (value || "")
    .trim()
    .toLocaleLowerCase("vi-VN")
    .replace(/\s+/g, " ");

const polar = (angleDeg: number, radius: number) => {
  const angle = (angleDeg * Math.PI) / 180;
  return {
    x: 300 + radius * Math.sin(angle),
    y: 300 - radius * Math.cos(angle),
  };
};

const annularSectorPath = (
  centerAngle: number,
  innerRadius: number,
  outerRadius: number,
) => {
  const startAngle = centerAngle - 22.5;
  const endAngle = centerAngle + 22.5;
  const p1 = polar(startAngle, outerRadius);
  const p2 = polar(endAngle, outerRadius);
  const p3 = polar(endAngle, innerRadius);
  const p4 = polar(startAngle, innerRadius);

  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${outerRadius} ${outerRadius} 0 0 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${innerRadius} ${innerRadius} 0 0 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    "Z",
  ].join(" ");
};

export const BaziCompassWidget: React.FC<BaziCompassWidgetProps> = ({
  cungMenh,
  tuMenh,
  element,
  napAmName,
  goodDirections = [],
  badDirections = [],
}) => {
  const gradientId = useId().replace(/:/g, "");

  const getDirection = (direction: string) => {
    const target = normalize(direction);
    const goodItem = goodDirections.find(
      (item) => normalize(item.direction) === target,
    );
    if (goodItem) return { type: "good" as DirectionType, item: goodItem };

    const badItem = badDirections.find(
      (item) => normalize(item.direction) === target,
    );
    if (badItem) return { type: "bad" as DirectionType, item: badItem };

    return { type: "neutral" as DirectionType, item: undefined };
  };

  return (
    <section className="bazi-compass-container" aria-label="La bàn Bát Trạch">
      <div className="bazi-compass-frame">
        <svg
          className="bazi-compass-svg"
          viewBox="0 0 600 600"
          role="img"
          aria-label={`La bàn Bát Trạch${cungMenh ? ` cung ${cungMenh}` : ""}`}
        >
          <defs>
            <radialGradient id={gradientId} cx="42%" cy="32%" r="72%">
              <stop offset="0%" stopColor="#f6e6ab" />
              <stop offset="55%" stopColor="#e8cd7c" />
              <stop offset="100%" stopColor="#c8a749" />
            </radialGradient>
            <filter
              id={`${gradientId}-shadow`}
              x="-25%"
              y="-25%"
              width="150%"
              height="150%"
            >
              <feDropShadow
                dx="0"
                dy="18"
                stdDeviation="18"
                floodColor="#000000"
                floodOpacity="0.52"
              />
            </filter>
          </defs>

          <g filter={`url(#${gradientId}-shadow)`}>
            <circle cx="300" cy="300" r="266" className="bazi-svg-outer-shadow" />
            <circle
              cx="300"
              cy="300"
              r="258"
              fill={`url(#${gradientId})`}
              className="bazi-svg-disc"
            />

            <g className="bazi-svg-fan">
              {DIRECTIONS.map((direction, index) => {
                const info = getDirection(direction.key);
                return (
                  <path
                    key={`sector-${direction.key}`}
                    d={annularSectorPath(direction.angle, 84, 195)}
                    className={`bazi-svg-sector ${info.type}`}
                    style={{ "--bazi-index": index } as IndexedStyle}
                  />
                );
              })}
            </g>

            {[84, 195, 233, 253, 258].map((radius, index) => (
              <circle
                key={`ring-${radius}`}
                cx="300"
                cy="300"
                r={radius}
                className={`bazi-svg-ring ${index === 4 ? "strong" : ""}`}
                style={{ "--bazi-index": index } as IndexedStyle}
              />
            ))}

            {DIRECTIONS.map((direction, index) => {
              const boundaryAngle = direction.angle - 22.5;
              const start = polar(boundaryAngle, 84);
              const end = polar(boundaryAngle, 233);
              return (
                <line
                  key={`spoke-${direction.key}`}
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  className="bazi-svg-spoke"
                  style={{ "--bazi-index": index } as IndexedStyle}
                />
              );
            })}

            {SON_NAMES.map((name, index) => {
              const angle = index * 15;
              const point = polar(angle, 214);
              const sectorIndex = Math.round(angle / 45) % 8;
              const info = getDirection(DIRECTIONS[sectorIndex].key);
              const tickStart = polar(angle - 7.5, 197);
              const tickEnd = polar(angle - 7.5, 233);
              return (
                <React.Fragment key={`son-${name}-${index}`}>
                  <line
                    x1={tickStart.x}
                    y1={tickStart.y}
                    x2={tickEnd.x}
                    y2={tickEnd.y}
                    className="bazi-svg-son-tick"
                  />
                  <text
                    x={point.x}
                    y={point.y + 3}
                    className={`bazi-svg-son ${info.type}`}
                  >
                    {name}
                  </text>
                </React.Fragment>
              );
            })}

            {Array.from({ length: 36 }, (_, index) => index * 10).map(
              (angle) => {
                const major = angle % 30 === 0;
                const tickStart = polar(angle, 236);
                const tickEnd = polar(angle, major ? 253 : 244);
                const labelPoint = polar(angle, 245);
                return (
                  <React.Fragment key={`degree-${angle}`}>
                    <line
                      x1={tickStart.x}
                      y1={tickStart.y}
                      x2={tickEnd.x}
                      y2={tickEnd.y}
                      className={`bazi-svg-degree-tick ${major ? "major" : ""}`}
                    />
                    {major && (
                      <text
                        x={labelPoint.x}
                        y={labelPoint.y + 2.5}
                        className="bazi-svg-degree"
                      >
                        {angle}
                      </text>
                    )}
                  </React.Fragment>
                );
              },
            )}

            {DIRECTIONS.map((direction, index) => {
              const info = getDirection(direction.key);
              const labelPoint = polar(direction.angle, 143);
              const stampPoint = polar(direction.angle, 181);
              return (
                <g
                  key={`label-${direction.key}`}
                  className="bazi-svg-label-group"
                  style={{ "--bazi-index": index } as IndexedStyle}
                >
                  <text
                    x={labelPoint.x}
                    y={labelPoint.y - 23}
                    className="bazi-svg-trigram"
                  >
                    {direction.trigram}
                  </text>
                  <text
                    x={labelPoint.x}
                    y={labelPoint.y + 1}
                    className="bazi-svg-star"
                  >
                    {info.item?.star || "—"}
                  </text>
                  <text
                    x={labelPoint.x}
                    y={labelPoint.y + 23}
                    className="bazi-svg-direction"
                  >
                    {direction.short}
                  </text>
                  {info.type !== "neutral" && (
                    <g
                      className={`bazi-svg-stamp ${info.type}`}
                      transform={`translate(${stampPoint.x} ${stampPoint.y}) rotate(-4)`}
                    >
                      <rect x="-10" y="-10" width="20" height="20" rx="3" />
                      <text x="0" y="1">
                        {info.type === "good" ? "吉" : "凶"}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            <g className="bazi-svg-center-layer">
              <circle cx="300" cy="300" r="70" className="bazi-svg-pool" />
              <line
                x1="254"
                y1="300"
                x2="346"
                y2="300"
                className="bazi-svg-crosshair"
              />
              <line
                x1="300"
                y1="254"
                x2="300"
                y2="346"
                className="bazi-svg-crosshair"
              />
              <circle cx="294" cy="320" r="3.5" className="bazi-svg-needle-dot" />
              <circle cx="302" cy="324" r="2.5" className="bazi-svg-needle-dot" />
              <circle cx="309" cy="318" r="2" className="bazi-svg-needle-dot" />
              <circle cx="300" cy="300" r="6" className="bazi-svg-center-dot" />
              <circle cx="300" cy="300" r="2.5" className="bazi-svg-center-gold" />

              <text x="300" y="278" className="bazi-svg-center-kicker">
                {cungMenh
                  ? `CUNG ${cungMenh.toLocaleUpperCase("vi-VN")}`
                  : "BÁT TRẠCH"}
              </text>
              <text x="300" y="322" className="bazi-svg-center-group">
                {tuMenh || "ÂM TRẠCH"}
              </text>
              {(element || napAmName) && (
                <text x="300" y="340" className="bazi-svg-center-element">
                  {[element ? `Mệnh ${element}` : "", napAmName || ""]
                    .filter(Boolean)
                    .join(" · ")}
                </text>
              )}
            </g>
          </g>
        </svg>
      </div>

      <div className="bazi-compass-legend">
        <div className="legend-item good">
          <span className="legend-swatch" />
          <span>Hướng Cát (nên ưu tiên)</span>
        </div>
        <div className="legend-item bad">
          <span className="legend-swatch" />
          <span>Hướng Hung (nên tránh)</span>
        </div>
      </div>
    </section>
  );
};

export default BaziCompassWidget;
