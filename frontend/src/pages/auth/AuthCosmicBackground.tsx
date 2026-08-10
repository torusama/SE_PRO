import { useMemo } from "react";

/**
 * Full-viewport animated cosmic backdrop shared by Login & Register.
 * - starry night sky (twinkling)
 * - a "V · P · Y" constellation (Vĩnh Phúc Viên) drawn like a star chart
 * - shooting stars
 * - a small grave-hill silhouette with fireflies drifting above it
 */
export default function AuthCosmicBackground() {
  const fireflies = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        id: i,
        left: 3 + Math.random() * 46, // keep within the left storytelling half
        top: 55 + Math.random() * 38,
        size: 2 + Math.random() * 2.4,
        duration: 6 + Math.random() * 7,
        delay: -Math.random() * 10,
        drift: 12 + Math.random() * 22,
      })),
    [],
  );

  return (
    <div className="auth-cosmic-bg" aria-hidden="true">
      <svg
        className="auth-cosmic-svg"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="authSky" cx="42%" cy="22%" r="75%">
            <stop offset="0%" stopColor="#131a4a" />
            <stop offset="45%" stopColor="#0a1030" />
            <stop offset="100%" stopColor="#05071a" />
          </radialGradient>
          <radialGradient id="authGlowPurple" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#7b3fe4" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#7b3fe4" stopOpacity="0" />
          </radialGradient>
          <filter id="authStarGlow">
            <feGaussianBlur stdDeviation="1.1" result="b" />
            <feComposite in="SourceGraphic" in2="b" operator="over" />
          </filter>
          <filter id="authSoftGlow">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feComposite in="SourceGraphic" in2="b" operator="over" />
          </filter>
          <filter id="authLineGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="authNodeGlow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Sky */}
        <rect width="1440" height="900" fill="url(#authSky)" />
        <ellipse
          className="auth-breathe"
          cx="640"
          cy="230"
          rx="420"
          ry="320"
          fill="url(#authGlowPurple)"
        />

        {/* Crescent moon */}
        <g opacity="0.85" transform="translate(1250,90)">
          <path
            d="M0 -34 A34 34 0 1 0 0 34 A26 26 0 1 1 0 -34Z"
            fill="#e8f4f0"
            opacity="0.9"
          />
        </g>

        {/* ===== Generic twinkling stars ===== */}
        <g fill="#ffffff">
          {[
            [90, 70, 1.2, 0.5, 0],
            [180, 140, 1, 0.35, 0.6],
            [260, 60, 1.4, 0.55, 1.1],
            [340, 190, 1, 0.4, 1.7],
            [420, 100, 1.2, 0.5, 0.3],
            [70, 250, 1, 0.4, 2.1],
            [520, 60, 1, 0.35, 1.4],
            [610, 170, 1.3, 0.5, 0.8],
            [150, 340, 1, 0.4, 2.6],
            [30, 430, 1.2, 0.45, 1.9],
            [980, 120, 1.2, 0.5, 0.4],
            [1080, 200, 1, 0.4, 1.2],
            [1180, 150, 1.4, 0.55, 1.9],
            [1320, 220, 1, 0.4, 0.7],
            [1380, 300, 1.2, 0.45, 1.3],
            [850, 60, 1, 0.4, 2.3],
            [750, 250, 1.2, 0.5, 0.9],
            [1050, 340, 1, 0.35, 1.6],
            [900, 400, 1.2, 0.5, 2.4],
            [1250, 380, 1, 0.4, 0.2],
          ].map(([cx, cy, r, o, d], i) => (
            <circle
              key={i}
              className="auth-twinkle"
              cx={cx}
              cy={cy}
              r={r}
              opacity={o}
              style={{ animationDelay: `${d}s` }}
            />
          ))}
        </g>
        <g fill="#0affd4">
          {[
            [230, 110, 1.3, 0.9],
            [470, 220, 1.1, 1.6],
            [40, 160, 1.2, 0.4],
            [1150, 90, 1.2, 1.1],
            [700, 130, 1, 2],
          ].map(([cx, cy, r, d], i) => (
            <circle
              key={i}
              className="auth-twinkle"
              cx={cx}
              cy={cy}
              r={r}
              opacity="0.75"
              style={{ animationDelay: `${d}s` }}
            />
          ))}
        </g>

        {/* =====================================================
             "V · P · Y" constellation (Vĩnh Phúc Viên)
             — big, centered in the left half, drawn like a real
               star chart: each edge is 3 stars that aren't quite
               collinear, and each letter leans a little.
        ===================================================== */}
        <g className="auth-constellation">
          {/* ---- V (tilts slightly left) ---- */}
          <g transform="rotate(-7 194 270)">
            <g
              stroke="#8fe9ff"
              strokeWidth="1"
              strokeLinecap="round"
              opacity="0.6"
              filter="url(#authLineGlow)"
            >
              <polyline points="110,180 140,290 195,410" fill="none" />
              <polyline points="195,410 245,295 280,175" fill="none" />
            </g>
            <g fill="#f2fbff">
              {[
                [110, 180, 2.6, 0],
                [140, 290, 2.2, 0.5],
                [195, 410, 3, 1.1],
                [245, 295, 2.2, 1.6],
                [280, 175, 2.6, 0.3],
              ].map(([cx, cy, r, d], i) => (
                <circle
                  key={`v-${i}`}
                  className="auth-twinkle auth-star-node"
                  cx={cx}
                  cy={cy}
                  r={r}
                  filter="url(#authNodeGlow)"
                  style={{ animationDelay: `${d}s` }}
                />
              ))}
            </g>
          </g>

          {/* ---- P (tilts slightly right) ---- */}
          <g transform="rotate(6 354 261)">
            <g
              stroke="#8fe9ff"
              strokeWidth="1"
              strokeLinecap="round"
              opacity="0.6"
              filter="url(#authLineGlow)"
            >
              <polyline points="310,420 306,300 314,178" fill="none" />
              <polyline
                points="314,178 390,170 420,222 385,275 306,300"
                fill="none"
              />
            </g>
            <g fill="#f2fbff">
              {[
                [310, 420, 3, 0.8],
                [306, 300, 2.2, 1.4],
                [314, 178, 2.6, 0.2],
                [390, 170, 2.2, 1.9],
                [420, 222, 2.4, 0.6],
                [385, 275, 2.2, 1.1],
              ].map(([cx, cy, r, d], i) => (
                <circle
                  key={`p-${i}`}
                  className="auth-twinkle auth-star-node"
                  cx={cx}
                  cy={cy}
                  r={r}
                  filter="url(#authNodeGlow)"
                  style={{ animationDelay: `${d}s` }}
                />
              ))}
            </g>
          </g>

          {/* ---- Y (tilts slightly right) ---- */}
          <g transform="rotate(4 574 281)">
            <g
              stroke="#8fe9ff"
              strokeWidth="1"
              strokeLinecap="round"
              opacity="0.6"
              filter="url(#authLineGlow)"
            >
              <polyline points="500,175 535,245 575,315" fill="none" />
              <polyline points="640,168 618,240 575,315" fill="none" />
              <polyline points="575,315 570,385 578,438" fill="none" />
            </g>
            <g fill="#f2fbff">
              {[
                [500, 175, 2.6, 0.4],
                [535, 245, 2.2, 1.7],
                [575, 315, 3, 0.9],
                [618, 240, 2.2, 0.1],
                [640, 168, 2.6, 1.3],
                [570, 385, 2.2, 1.8],
                [578, 438, 2.6, 0.6],
              ].map(([cx, cy, r, d], i) => (
                <circle
                  key={`y-${i}`}
                  className="auth-twinkle auth-star-node"
                  cx={cx}
                  cy={cy}
                  r={r}
                  filter="url(#authNodeGlow)"
                  style={{ animationDelay: `${d}s` }}
                />
              ))}
            </g>
          </g>

          {/* a few loose, unconnected stars around the letters so the
              constellation blends into the surrounding sky naturally */}
          <g fill="#e8fbff">
            {[
              [60, 230, 1.1, 0.55, 1.2],
              [155, 130, 1, 0.4, 0.4],
              [255, 400, 1.2, 0.45, 1.9],
              [340, 130, 1, 0.4, 0.9],
              [460, 400, 1.1, 0.45, 1.5],
              [660, 300, 1, 0.4, 0.2],
              [220, 350, 1, 0.35, 1.6],
            ].map(([cx, cy, r, o, d], i) => (
              <circle
                key={`amb-${i}`}
                className="auth-twinkle"
                cx={cx}
                cy={cy}
                r={r}
                opacity={o}
                style={{ animationDelay: `${d}s` }}
              />
            ))}
          </g>
        </g>

        {/* Shooting stars */}
        <g className="auth-shooting-star auth-shooting-star--1">
          <line x1="0" y1="0" x2="70" y2="34" stroke="#e8fbff" strokeWidth="1.4" />
        </g>
        <g className="auth-shooting-star auth-shooting-star--2">
          <line x1="0" y1="0" x2="56" y2="26" stroke="#c8f241" strokeWidth="1.2" />
        </g>

        {/* ===== Grave hill silhouette (lower-left) ===== */}
        <g>
          <path
            d="M-20 900 C 60 760 180 730 300 780 C 420 820 520 800 640 860 L 700 900 Z"
            fill="#070b22"
          />
          <path
            d="M-20 900 C 40 810 140 790 240 820 C 340 850 420 840 520 900 Z"
            fill="#0a0f2c"
          />
          {/* upright headstone */}
          <g fill="#0d1330" stroke="#1c2a5e" strokeWidth="1">
            <path d="M120 840 Q120 812 138 812 Q156 812 156 840 L156 862 L120 862 Z" />
          </g>
          {/* rounded headstone */}
          <g fill="#0d1330" stroke="#1c2a5e" strokeWidth="1">
            <path d="M210 850 Q210 826 226 826 Q242 826 242 850 L242 868 L210 868 Z" />
          </g>
          {/* leaning cross-topped headstone */}
          <g
            fill="#0d1330"
            stroke="#1c2a5e"
            strokeWidth="1"
            transform="rotate(-9 300 855)"
          >
            <rect x="286" y="812" width="30" height="46" rx="3" />
            <line
              x1="301"
              y1="812"
              x2="301"
              y2="796"
              stroke="#1c2a5e"
              strokeWidth="2"
            />
            <line
              x1="292"
              y1="802"
              x2="310"
              y2="802"
              stroke="#1c2a5e"
              strokeWidth="2"
            />
          </g>
          {/* small distant headstone */}
          <g fill="#0d1330" stroke="#1c2a5e" strokeWidth="0.8" opacity="0.8">
            <path d="M60 858 Q60 842 70 842 Q80 842 80 858 L80 872 L60 872 Z" />
          </g>
          {/* grass line glow */}
          <path
            d="M-20 900 C 60 760 180 730 300 780 C 420 820 520 800 640 860"
            fill="none"
            stroke="#0affd4"
            strokeWidth="1"
            opacity="0.18"
            filter="url(#authSoftGlow)"
          />
        </g>
      </svg>

      {/* Fireflies */}
      <div className="auth-fireflies">
        {fireflies.map((f) => (
          <span
            key={f.id}
            className="auth-firefly"
            style={
              {
                left: `${f.left}%`,
                top: `${f.top}%`,
                width: `${f.size}px`,
                height: `${f.size}px`,
                animationDuration: `${f.duration}s`,
                animationDelay: `${f.delay}s`,
                "--drift": `${f.drift}px`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
