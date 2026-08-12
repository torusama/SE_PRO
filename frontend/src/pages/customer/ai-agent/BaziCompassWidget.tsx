import React, { useId } from "react";

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
              <stop offset="0%" stopColor="#20344a" />
              <stop offset="56%" stopColor="#101f31" />
              <stop offset="100%" stopColor="#07101d" />
            </radialGradient>
            <filter id={`${gradientId}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="12" stdDeviation="14" floodColor="#000000" floodOpacity="0.42" />
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

            {DIRECTIONS.map((direction) => {
              const info = getDirection(direction.key);
              return (
                <path
                  key={`sector-${direction.key}`}
                  d={annularSectorPath(direction.angle, 86, 194)}
                  className={`bazi-svg-sector ${info.type}`}
                />
              );
            })}

            {[86, 194, 232, 252, 258].map((radius, index) => (
              <circle
                key={`ring-${radius}`}
                cx="300"
                cy="300"
                r={radius}
                className={`bazi-svg-ring ${index === 4 ? "strong" : ""}`}
              />
            ))}

            {DIRECTIONS.map((direction) => {
              const boundaryAngle = direction.angle - 22.5;
              const start = polar(boundaryAngle, 86);
              const end = polar(boundaryAngle, 232);
              return (
                <line
                  key={`spoke-${direction.key}`}
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  className="bazi-svg-spoke"
                />
              );
            })}

            {SON_NAMES.map((name, index) => {
              const angle = index * 15;
              const point = polar(angle, 213);
              const sectorIndex = Math.round(angle / 45) % 8;
              const info = getDirection(DIRECTIONS[sectorIndex].key);
              const tickStart = polar(angle - 7.5, 195);
              const tickEnd = polar(angle - 7.5, 232);
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
                const tickStart = polar(angle, 235);
                const tickEnd = polar(angle, major ? 252 : 243);
                const labelPoint = polar(angle, 244);
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

            {DIRECTIONS.map((direction) => {
              const info = getDirection(direction.key);
              const labelPoint = polar(direction.angle, 143);
              const stampPoint = polar(direction.angle, 181);
              return (
                <React.Fragment key={`label-${direction.key}`}>
                  <text
                    x={labelPoint.x}
                    y={labelPoint.y - 12}
                    className="bazi-svg-trigram"
                  >
                    {direction.trigram}
                  </text>
                  <text
                    x={labelPoint.x}
                    y={labelPoint.y + 5}
                    className="bazi-svg-star"
                  >
                    {info.item?.star || "—"}
                  </text>
                  <text
                    x={labelPoint.x}
                    y={labelPoint.y + 21}
                    className="bazi-svg-direction"
                  >
                    {direction.short}
                  </text>
                  {info.type !== "neutral" && (
                    <g
                      className={`bazi-svg-stamp ${info.type}`}
                      transform={`translate(${stampPoint.x} ${stampPoint.y}) rotate(-4)`}
                    >
                      <rect x="-11" y="-11" width="22" height="22" rx="3" />
                      <text x="0" y="4">
                        {info.type === "good" ? "吉" : "凶"}
                      </text>
                    </g>
                  )}
                </React.Fragment>
              );
            })}

            <circle cx="300" cy="300" r="70" className="bazi-svg-pool" />
            <line x1="254" y1="300" x2="346" y2="300" className="bazi-svg-crosshair" />
            <line x1="300" y1="254" x2="300" y2="346" className="bazi-svg-crosshair" />
            <circle cx="300" cy="300" r="7" className="bazi-svg-center-dot" />
            <circle cx="300" cy="300" r="3" className="bazi-svg-center-gold" />

            <text x="300" y="282" className="bazi-svg-center-kicker">
              {cungMenh ? `CUNG ${cungMenh.toLocaleUpperCase("vi-VN")}` : "BÁT TRẠCH"}
            </text>
            <text x="300" y="323" className="bazi-svg-center-group">
              {tuMenh || "ÂM TRẠCH"}
            </text>
            {(element || napAmName) && (
              <text x="300" y="341" className="bazi-svg-center-element">
                {[element ? `Mệnh ${element}` : "", napAmName || ""]
                  .filter(Boolean)
                  .join(" · ")}
              </text>
            )}
          </g>
        </svg>
      </div>

      <div className="bazi-compass-legend">
        <div className="legend-item good">
          <span className="legend-swatch" />
          <span>Hướng Cát · nên ưu tiên</span>
        </div>
        <div className="legend-item bad">
          <span className="legend-swatch" />
          <span>Hướng Hung · nên hạn chế</span>
        </div>
      </div>
    </section>
  );
};

export default BaziCompassWidget;
