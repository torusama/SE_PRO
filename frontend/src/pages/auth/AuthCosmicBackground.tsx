import { useMemo } from "react";

/**
 * Full-viewport animated cosmic backdrop shared by Login & Register.
 * - starry night sky (twinkling), spread across the full width
 * - a "V · P · Y" constellation (Vĩnh Phúc Viên) drawn like a star chart
 * - shooting stars
 * - three small grave-hill silhouettes (upright + leaning headstones)
 *   scattered across the full width, with fireflies drifting above them
 * - a slowly shifting teal / blue / violet nebula glow for continuous motion
 */
export default function AuthCosmicBackground() {
  const fireflies = useMemo(() => {
    // Cluster fireflies around the three grave-hill silhouettes so they
    // actually read as "fireflies near the graves" instead of floating
    // randomly in the middle of the sky.
    const clusterCenters = [20, 58, 89]; // % across the full width
    return clusterCenters.flatMap((cx, ci) =>
      Array.from({ length: 9 }, (_, i) => ({
        id: ci * 9 + i,
        left: Math.min(97, Math.max(2, cx + (Math.random() - 0.5) * 22)),
        top: 78 + Math.random() * 17,
        size: 2.6 + Math.random() * 2.8,
        duration: 5.5 + Math.random() * 6,
        delay: -Math.random() * 10,
        drift: 10 + Math.random() * 20,
      })),
    );
  }, []);

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
            <stop offset="0%" stopColor="#7b3fe4" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#7b3fe4" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="authGlowBlue" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3f6fe8" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#3f6fe8" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="authGlowTeal" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0affd4" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#0affd4" stopOpacity="0" />
          </radialGradient>
          <filter id="authStarGlow">
            <feGaussianBlur stdDeviation="1.1" result="b" />
            <feComposite in="SourceGraphic" in2="b" operator="over" />
          </filter>
          <filter id="authSoftGlow">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feComposite in="SourceGraphic" in2="b" operator="over" />
          </filter>
          <filter
            id="authLineGlow"
            x="-60%"
            y="-60%"
            width="220%"
            height="220%"
          >
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter
            id="authNodeGlow"
            x="-200%"
            y="-200%"
            width="500%"
            height="500%"
          >
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Sky */}
        <rect width="1440" height="900" fill="url(#authSky)" />

        {/* Slowly shifting multi-color nebula — continuous, non-static bg */}
        <ellipse
          className="auth-breathe auth-breathe--purple"
          cx="620"
          cy="220"
          rx="420"
          ry="320"
          fill="url(#authGlowPurple)"
        />
        <ellipse
          className="auth-breathe auth-breathe--blue"
          cx="1080"
          cy="480"
          rx="460"
          ry="360"
          fill="url(#authGlowBlue)"
        />
        <ellipse
          className="auth-breathe auth-breathe--teal"
          cx="340"
          cy="640"
          rx="420"
          ry="320"
          fill="url(#authGlowTeal)"
        />

        {/* Crescent moon */}
        <g opacity="0.85" transform="translate(1250,90)">
          <path
            d="M0 -34 A34 34 0 1 0 0 34 A26 26 0 1 1 0 -34Z"
            fill="#e8f4f0"
            opacity="0.9"
          />
        </g>

        {/* ===== Generic twinkling stars — spread across the full width ===== */}
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
            [720, 90, 1.1, 0.45, 1.5],
            [810, 320, 1, 0.4, 0.5],
            [960, 500, 1.2, 0.45, 1.1],
            [1400, 120, 1, 0.4, 2.0],
            [1140, 470, 1.1, 0.4, 0.8],
            [50, 550, 1, 0.35, 1.4],
            [280, 500, 1.1, 0.4, 0.6],
            [560, 470, 1, 0.35, 1.9],
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
            [1300, 480, 1.1, 0.7],
            [880, 470, 1, 1.3],
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
             — big, drawn like a real star chart: each edge is 3
               stars that aren't quite collinear, each letter leans
               a little. Shifted right + down from the original spot.
        ===================================================== */}
        <g className="auth-constellation" transform="translate(170,46)">
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
          <line
            x1="0"
            y1="0"
            x2="70"
            y2="34"
            stroke="#e8fbff"
            strokeWidth="1.4"
          />
        </g>
        <g className="auth-shooting-star auth-shooting-star--2">
          <line
            x1="0"
            y1="0"
            x2="56"
            y2="26"
            stroke="#c8f241"
            strokeWidth="1.2"
          />
        </g>

        {/* =====================================================
             Grave-hill silhouettes — minimalist one-line style.
             No fill: a single flowing contour rises out of the
             gently rolling ground into each headstone (upright,
             rounded, leaning) and settles back down, echoing the
             single-continuous-line illustration style.
        ===================================================== */}
        {[0, 560, 1080].map((offset, gi) => (
          <path
            key={`grave-${gi}`}
            transform={`translate(${offset},0)`}
            d="M-20 882
               C 30 866 70 856 112 862
               L 118 862 L 118 820
               Q 118 802 136 802
               Q 154 802 154 820
               L 154 862
               C 170 858 184 866 200 862
               L 206 862 L 206 828
               Q 206 812 223 812
               Q 240 812 240 828
               L 240 862
               C 254 858 268 868 282 860
               L 286 858 L 295 818
               Q 299 802 315 806
               Q 322 810 318 820
               L 318 858
               C 340 850 375 864 410 854
               C 450 843 495 858 540 850
               C 585 843 630 856 675 848
               C 700 844 715 850 700 862"
            fill="none"
            stroke="#8fe9ff"
            strokeWidth="1.1"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.45"
          />
        ))}
      </svg>

      {/* Fireflies — drifting above the grave clusters */}
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
