// src/components/decor/NavyStarfield.tsx
//
// Nền trang trí DÙNG CHUNG: nền đen, dải gradient xanh navy mờ (giống phong
// cách bầu trời đêm ở trang Trang chủ / bản đồ 2D) và các ngôi sao nhỏ nhấp
// nháy rải rác. Dùng để thay cho các mảng nền "xanh rêu" phẳng trước đây.
//
// Cách dùng: đặt <NavyStarfield /> làm phần tử ĐẦU TIÊN trong trang, ngay
// sau div bọc ngoài cùng có class "<ten-trang>-page". Trang cần đảm bảo phần
// nội dung phía sau có `position: relative; z-index: 1;` để nổi lên trên nền.
import { useEffect, useRef } from "react";
import "./NavyStarfield.css";

interface NavyStarfieldProps {
  /** Số lượng sao hiển thị. Mặc định 70. */
  starCount?: number;
  /**
   * Chỉ vẽ lớp sao lấp lánh, KHÔNG vẽ nền gradient navy + 2 đốm sáng góc.
   * Dùng cho các trang đã có sẵn nền/đốm sáng riêng, chỉ cần thêm hiệu ứng
   * sao nhấp nháy (ví dụ trang Nhắc lịch ngày giỗ).
   */
  starsOnly?: boolean;
}

export default function NavyStarfield({
  starCount = 70,
  starsOnly = false,
}: NavyStarfieldProps) {
  const starsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = starsRef.current;
    if (!el) return;
    el.innerHTML = "";
    for (let i = 0; i < starCount; i += 1) {
      const star = document.createElement("div");
      star.className = "navy-starfield__star";
      const size = Math.random() * 1.8 + 0.5;
      // Đa số sao trắng, thỉnh thoảng điểm màu teal — đồng bộ màu accent của
      // trang Trang chủ (#0AFFD4) — để không bị ám một màu duy nhất.
      const isTeal = Math.random() < 0.12;
      star.style.cssText = `
        width:${size}px;height:${size}px;
        left:${Math.random() * 100}%;top:${Math.random() * 100}%;
        --d:${2.4 + Math.random() * 4.5}s;--delay:${-Math.random() * 6}s;
        background:${isTeal ? "#0affd4" : "#ffffff"};
      `;
      el.appendChild(star);
    }
  }, [starCount]);

  return (
    <div
      className={`navy-starfield${starsOnly ? " navy-starfield--stars-only" : ""}`}
      aria-hidden="true"
    >
      {!starsOnly && (
        <>
          <div className="navy-starfield__glow navy-starfield__glow--a" />
          <div className="navy-starfield__glow navy-starfield__glow--b" />
        </>
      )}
      <div className="navy-starfield__stars" ref={starsRef} />
    </div>
  );
}
