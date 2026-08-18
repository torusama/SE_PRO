import { useMemo } from "react";

/**
 * Full-viewport animated cosmic backdrop shared by Login & Register.
 * - starry night sky (twinkling), spread across the full width
 * - the Lyra constellation (chòm sao Thiên Cầm), drawn like a real star
 *   chart: a small hook of stars beside Vega, the brightest point, feeding
 *   down into the four-star parallelogram — same line-glow / star-node
 *   technique as before, just a different shape and a touch smaller
 * - shooting stars
 * - a one-line, no-fill grave scene: headstones scattered over flat
 *   ground, a couple of them cresting a small hill, a Vietnamese-style
 *   tomb (mound + small roofed headstone) and a coffin silhouette,
 *   each drawn as a single continuous outline — with fireflies drifting
 *   just above them
 * - a slowly shifting teal / blue / violet nebula glow for continuous motion
 */
export default function AuthCosmicBackground() {
  const fireflies = useMemo(() => {
    // Cluster fireflies around the three grave groups (flat headstones,
    // the hill + Vietnamese tomb, the coffin + small hill) so they read
    // as "fireflies near the graves" instead of floating randomly.
    const clusterCenters = [15, 47, 85]; // % across the full width
    return clusterCenters.flatMap((cx, ci) =>
      Array.from({ length: 9 }, (_, i) => {
        const id = ci * 9 + i;
        return {
          id,
          left: Math.min(97, Math.max(2, cx + (Math.random() - 0.5) * 20)),
          top: 58 + Math.random() * 20,
          size: 2.6 + Math.random() * 2.8,
          duration: 5.5 + Math.random() * 6,
          delay: -Math.random() * 10,
          drift: 10 + Math.random() * 20,
          // sprinkle a few teal fireflies in among the yellow swarm
          teal: id % 6 === 0,
        };
      }),
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
             Lyra constellation (chòm sao Thiên Cầm) — traced directly
             from the reference star-chart: a standing parallelogram
             (β·γ·δ·ζ Lyrae) leaning right, sharing its top-right star
             with a triangle (Vega + ε Lyrae) whose angle there sits
             vertically opposite the parallelogram's corner — same
             glowing-line / glowing-node technique as the rest of the sky.
             Shifted further right and tilted a touch more to the right
             so it sits fully inside the open sky area, with a slightly
             brighter glow overall.
        ===================================================== */}
        <g
          className="auth-constellation"
          transform="translate(462,168) translate(90,160) rotate(40) scale(1.1) translate(-90,-160)"
        >
          <g
            stroke="#8fe9ff"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.72"
            filter="url(#authLineGlow)"
          >
            {/* triangle: joint star — top star — Vega — back to joint */}
            <polyline
              points="132.5,96.1 135.4,0 208.9,44 132.5,96.1"
              fill="none"
            />
            {/* standing parallelogram, leaning right, sharing the joint star */}
            <polyline
              points="132.5,96.1 42.2,129 0,320 88.5,296.8 132.5,96.1"
              fill="none"
            />
          </g>
          <g fill="#f2fbff">
            {[
              [135.4, 0, 2.7, 0.4],
              [208.9, 44, 4.0, 0.2],
              [132.5, 96.1, 2.9, 1.6],
              [42.2, 129, 2.7, 0.7],
              [0, 320, 2.9, 1.3],
              [88.5, 296.8, 2.7, 0.5],
            ].map(([cx, cy, r, d], i) => (
              <circle
                key={`lyra-${i}`}
                className="auth-twinkle auth-star-node"
                cx={cx}
                cy={cy}
                r={r}
                filter="url(#authNodeGlow)"
                style={{ animationDelay: `${d}s` }}
              />
            ))}
          </g>

          {/* a few loose, unconnected stars around Lyra so it blends
              into the surrounding sky naturally */}
          <g fill="#e8fbff">
            {[
              [-125, 16.8, 1.3, 0.55, 1.2],
              [-144, 64.2, 1.2, 0.45, 0.4],
              [316, 6.4, 1.2, 0.45, 1.9],
              [-11, 360.4, 1, 0.4, 0.9],
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

        {/* Shooting stars — a small scattered swarm around the
            constellation's new spot, reusing the same two animated
            streak styles at different positions/delays */}
        <g
          className="auth-shooting-star auth-shooting-star--1"
          transform="translate(360,120)"
        >
          <line
            x1="0"
            y1="0"
            x2="70"
            y2="34"
            stroke="#e8fbff"
            strokeWidth="1.4"
          />
        </g>
        <g
          className="auth-shooting-star auth-shooting-star--2"
          transform="translate(700,90)"
        >
          <line
            x1="0"
            y1="0"
            x2="56"
            y2="26"
            stroke="#c8f241"
            strokeWidth="1.2"
          />
        </g>
        <g
          className="auth-shooting-star auth-shooting-star--1"
          style={{ animationDelay: "1.6s" }}
          transform="translate(620,260)"
        >
          <line
            x1="0"
            y1="0"
            x2="60"
            y2="30"
            stroke="#e8fbff"
            strokeWidth="1.2"
          />
        </g>
        <g
          className="auth-shooting-star auth-shooting-star--2"
          style={{ animationDelay: "2.4s" }}
          transform="translate(420,430)"
        >
          <line
            x1="0"
            y1="0"
            x2="48"
            y2="22"
            stroke="#8fe9ff"
            strokeWidth="1.1"
          />
        </g>
        <g
          className="auth-shooting-star auth-shooting-star--1"
          style={{ animationDelay: "3.2s" }}
          transform="translate(780,340)"
        >
          <line
            x1="0"
            y1="0"
            x2="52"
            y2="24"
            stroke="#c8f241"
            strokeWidth="1.1"
          />
        </g>

        {/* =====================================================
             Depth layers behind the grave line — same technique as
             the reference mountain art: the same ground silhouette,
             closed down to the bottom edge and filled, repeated 3x
             at increasing offsets and fading opacity, sitting behind
             the crisp foreground line drawn further below.
        ===================================================== */}
        <g className="auth-graves-shadow">
          <path
            transform="translate(6,-14)"
            fill="#0d1a4a"
            opacity="0.22"
            d="M-60,712
               C20,706 60,709 95,708
               L95,708 L95,655 Q95,645 105,645 Q115,645 115,655 L115,708
               C130,703 150,708 165,707
               L180,706 L180,660 L192,650 L204,660 L204,706
               C215,702 225,699 235,698 L235,698 L235,670 Q235,662 243,662 Q251,662 251,670 L251,698 C265,699 285,702 310,705
               L330,705 L330,668 Q330,659 339,659 Q348,659 348,668 L348,705
               C365,703 375,706 390,704
               C420,700 460,694 500,689
               C515,687 530,686 545,686
               L545,686 L545,668 Q545,661 552,661 Q559,661 559,668 L559,686
               C575,687 600,691 620,694
               C640,697 660,699 680,700
               C690,692 705,689 725,688
               L725,688 L725,678 L741,666 L757,678 L757,688
               C775,689 790,692 800,700
               C820,704 850,706 880,705
               L880,705 L883,665 L895,653 L907,665 L910,705
               C920,704 930,705 940,704
               C970,703 1000,700 1030,690
               C1060,676 1090,650 1120,626
               C1128,620 1132,616 1135,612
               L1135,612 L1135,572 Q1135,563 1144,563 Q1153,563 1153,572 L1153,612
               C1165,618 1178,632 1190,650
               C1200,664 1206,676 1210,686
               L1210,686 L1210,674 Q1212,664 1224,664 L1270,664 Q1282,664 1284,674 L1284,690
               C1300,696 1320,700 1340,702
               L1340,702 L1343,662 L1355,650 L1367,662 L1370,702
               C1390,701 1405,699 1415,698 L1415,698 L1415,674 Q1415,667 1422,667 Q1429,667 1429,674 L1429,698 C1440,700 1460,703 1500,706
               L1500,900 L-60,900 Z"
          />
          <path
            transform="translate(13,-30)"
            fill="#0a1436"
            opacity="0.32"
            d="M-60,712
               C20,706 60,709 95,708
               L95,708 L95,655 Q95,645 105,645 Q115,645 115,655 L115,708
               C130,703 150,708 165,707
               L180,706 L180,660 L192,650 L204,660 L204,706
               C215,702 225,699 235,698 L235,698 L235,670 Q235,662 243,662 Q251,662 251,670 L251,698 C265,699 285,702 310,705
               L330,705 L330,668 Q330,659 339,659 Q348,659 348,668 L348,705
               C365,703 375,706 390,704
               C420,700 460,694 500,689
               C515,687 530,686 545,686
               L545,686 L545,668 Q545,661 552,661 Q559,661 559,668 L559,686
               C575,687 600,691 620,694
               C640,697 660,699 680,700
               C690,692 705,689 725,688
               L725,688 L725,678 L741,666 L757,678 L757,688
               C775,689 790,692 800,700
               C820,704 850,706 880,705
               L880,705 L883,665 L895,653 L907,665 L910,705
               C920,704 930,705 940,704
               C970,703 1000,700 1030,690
               C1060,676 1090,650 1120,626
               C1128,620 1132,616 1135,612
               L1135,612 L1135,572 Q1135,563 1144,563 Q1153,563 1153,572 L1153,612
               C1165,618 1178,632 1190,650
               C1200,664 1206,676 1210,686
               L1210,686 L1210,674 Q1212,664 1224,664 L1270,664 Q1282,664 1284,674 L1284,690
               C1300,696 1320,700 1340,702
               L1340,702 L1343,662 L1355,650 L1367,662 L1370,702
               C1390,701 1405,699 1415,698 L1415,698 L1415,674 Q1415,667 1422,667 Q1429,667 1429,674 L1429,698 C1440,700 1460,703 1500,706
               L1500,900 L-60,900 Z"
          />
          <path
            transform="translate(20,-48)"
            fill="#060c26"
            opacity="0.45"
            d="M-60,712
               C20,706 60,709 95,708
               L95,708 L95,655 Q95,645 105,645 Q115,645 115,655 L115,708
               C130,703 150,708 165,707
               L180,706 L180,660 L192,650 L204,660 L204,706
               C215,702 225,699 235,698 L235,698 L235,670 Q235,662 243,662 Q251,662 251,670 L251,698 C265,699 285,702 310,705
               L330,705 L330,668 Q330,659 339,659 Q348,659 348,668 L348,705
               C365,703 375,706 390,704
               C420,700 460,694 500,689
               C515,687 530,686 545,686
               L545,686 L545,668 Q545,661 552,661 Q559,661 559,668 L559,686
               C575,687 600,691 620,694
               C640,697 660,699 680,700
               C690,692 705,689 725,688
               L725,688 L725,678 L741,666 L757,678 L757,688
               C775,689 790,692 800,700
               C820,704 850,706 880,705
               L880,705 L883,665 L895,653 L907,665 L910,705
               C920,704 930,705 940,704
               C970,703 1000,700 1030,690
               C1060,676 1090,650 1120,626
               C1128,620 1132,616 1135,612
               L1135,612 L1135,572 Q1135,563 1144,563 Q1153,563 1153,572 L1153,612
               C1165,618 1178,632 1190,650
               C1200,664 1206,676 1210,686
               L1210,686 L1210,674 Q1212,664 1224,664 L1270,664 Q1282,664 1284,674 L1284,690
               C1300,696 1320,700 1340,702
               L1340,702 L1343,662 L1355,650 L1367,662 L1370,702
               C1390,701 1405,699 1415,698 L1415,698 L1415,674 Q1415,667 1422,667 Q1429,667 1429,674 L1429,698 C1440,700 1460,703 1500,706
               L1500,900 L-60,900 Z"
          />
        </g>

        {/* =====================================================
             Grave scene — genuinely one-line style: the ground and
             every headstone / hill / tomb / coffin sitting on it are
             fused into a single unbroken stroke per zone (the pen
             never lifts), the same way each figure in a continuous
             line drawing is one uninterrupted contour. Three zones,
             each its own single path, sit across the width — and are
             kept well clear of the very top/bottom edges so they never
             get cropped by the background's cover-scaling on wide
             screens. No fill anywhere.
        ===================================================== */}
        <g
          className="auth-graves"
          fill="none"
          stroke="#dff4ff"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.75"
          filter="url(#authLineGlow)"
        >
          {/* Zone 1 — flat ground, three headstones scattered along it */}
          <path
            d="M-60,712
               C20,706 60,709 95,708
               L95,708 L95,655 Q95,645 105,645 Q115,645 115,655 L115,708
               C130,703 150,708 165,707
               L180,706 L180,660 L192,650 L204,660 L204,706
               C215,702 225,699 235,698 L235,698 L235,670 Q235,662 243,662 Q251,662 251,670 L251,698 C265,699 285,702 310,705
               L330,705 L330,668 Q330,659 339,659 Q348,659 348,668 L348,705
               C365,703 375,706 390,704"
          />

          {/* Zone 2 — ground rising into the main hill (headstone on top),
              easing into a Vietnamese-style tomb (low mound with a small
              roofed headstone rising from its centre — kept short and
              close to the ground so it doesn't climb into the quote
              text above), then one more leaning headstone before the
              ground flattens out again */}
          <path
            d="M390,704
               C420,700 460,694 500,689
               C515,687 530,686 545,686
               L545,686 L545,668 Q545,661 552,661 Q559,661 559,668 L559,686
               C575,687 600,691 620,694
               C640,697 660,699 680,700
               C690,692 705,689 725,688
               L725,688 L725,678 L741,666 L757,678 L757,688
               C775,689 790,692 800,700
               C820,704 850,706 880,705
               L880,705 L883,665 L895,653 L907,665 L910,705
               C920,704 930,705 940,704"
          />

          {/* Zone 3 — flat ground rising into a small hill (headstone on
              top), a coffin resting low on the ground, and a final
              leaning headstone */}
          <path
            d="M940,704
               C970,703 1000,700 1030,690
               C1060,676 1090,650 1120,626
               C1128,620 1132,616 1135,612
               L1135,612 L1135,572 Q1135,563 1144,563 Q1153,563 1153,572 L1153,612
               C1165,618 1178,632 1190,650
               C1200,664 1206,676 1210,686
               L1210,686 L1210,674 Q1212,664 1224,664 L1270,664 Q1282,664 1284,674 L1284,690
               C1300,696 1320,700 1340,702
               L1340,702 L1343,662 L1355,650 L1367,662 L1370,702
               C1390,701 1405,699 1415,698 L1415,698 L1415,674 Q1415,667 1422,667 Q1429,667 1429,674 L1429,698 C1440,700 1460,703 1500,706"
          />
        </g>
      </svg>

      {/* Fireflies — drifting above the grave clusters */}
      <div className="auth-fireflies">
        {fireflies.map((f) => (
          <span
            key={f.id}
            className={`auth-firefly${f.teal ? " auth-firefly--teal" : ""}`}
            style={
              {
                left: `${f.left}%`,
                top: `${f.top}%`,
                width: `${f.size}px`,
                height: `${f.size}px`,
                animationDuration: `${f.duration}s`,
                animationDelay: `${f.delay}s`,
                "--drift": `${f.drift}px`,
                ...(f.teal
                  ? {
                      backgroundColor: "#0affd4",
                      boxShadow: "0 0 6px 2px rgba(10,255,212,0.85)",
                    }
                  : {}),
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
