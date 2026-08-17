// src/pages/customer/map/Map3DPage.tsx
//
// Trang xem "Bản đồ 3D". Cảnh 3D (Three.js) được đóng gói sẵn dưới dạng 1
// trang tĩnh (public/3d-map/index.html) — nhúng qua <iframe> để KHÔNG xung
// đột với bundle React (khác hệ thống build, khác phiên bản three.js so với
// phần còn lại của web). Vì cảnh 3D khá nặng (WebGL, nhiều model/texture),
// <iframe> chỉ được mount khi người dùng thực sự vào trang này (component
// này chỉ render khi route /ban-do/xem-3d đang active), và bị GỠ HẲN khỏi
// DOM ngay khi rời trang — trình duyệt sẽ huỷ toàn bộ context WebGL + vòng
// lặp requestAnimationFrame bên trong iframe, nên không tốn tài nguyên/làm
// giật các trang khác của web.
//
// Đồng bộ với minimap 2D: trang tĩnh 3D postMessage 2 sự kiện ra ngoài:
//   - { type: "vpv3d:ready" }  → cảnh đã dựng xong, ẩn overlay loading
//   - { type: "vpv3d:orbit", headingDeg, zoomRatio } → mỗi khi người dùng
//     xoay/zoom góc nhìn 3D (chỉ phần xoay quanh trục dọc — hướng la bàn —
//     ảnh hưởng minimap; góc nghiêng camera lên/xuống KHÔNG ảnh hưởng).
// Xem chi tiết cơ chế gửi trong public/3d-map/index.html (hàm sendOrbitState).
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { MAP_BG_RECT } from "@/lib/cemeteryMapVisuals";
import {
  CemeteryMapBackground,
  CemeteryMapPlotsMini,
} from "./CemeteryMapVector";
import "./Map3DPage.css";

const MAP3D_SRC = "/3d-map/index.html";

type OrbitMsg = { type: "vpv3d:orbit"; headingDeg: number; zoomRatio: number };
type ReadyMsg = { type: "vpv3d:ready" };
type BackMsg = { type: "vpv3d:back" };

function isVpv3dMessage(data: unknown): data is OrbitMsg | ReadyMsg | BackMsg {
  return (
    !!data &&
    typeof data === "object" &&
    typeof (data as { type?: unknown }).type === "string" &&
    (data as { type: string }).type.startsWith("vpv3d:")
  );
}

export default function Map3DPage() {
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [heading, setHeading] = useState(0); // độ, cùng quy ước với "rotation" ở bản đồ 2D
  const [zoomRatio, setZoomRatio] = useState(1);

  const handleBack = useCallback(() => {
    // FIX GOC: nut back nay (ve boi React, z-index cao hon, nam CHONG LEN
    // dung nut back ben trong iframe) moi la nut nguoi dung thuc su bam -
    // truoc day chi goi navigate() thang, khien iframe WebGL (rat nang, dang
    // render lien tuc) van con "dinh" tren man hinh mot khung hinh cuoi du
    // URL/route da doi xong that su, chi duoc trinh duyet ve lai khi tab bi
    // an/hien lai. Gan src = "about:blank" TRUOC de ep trinh duyet huy ngay
    // document/WebGL context cua iframe (dong bo) roi moi navigate, dam bao
    // khong con dinh hinh cu nua - khong con phu thuoc doi tab.
    try {
      if (iframeRef.current) iframeRef.current.src = "about:blank";
    } catch {
      // bo qua - navigate() ben duoi van chay binh thuong
    }
    navigate(ROUTES.MAP);
  }, [navigate]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      // chỉ nhận message từ đúng iframe bản đồ 3D của trang này, tránh
      // postMessage giả mạo từ nguồn khác
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) {
        return;
      }
      const data = e.data;
      if (!isVpv3dMessage(data)) return;
      if (data.type === "vpv3d:ready") {
        setReady(true);
      } else if (data.type === "vpv3d:orbit") {
        setHeading(data.headingDeg);
        setZoomRatio(data.zoomRatio);
      } else if (data.type === "vpv3d:back") {
        // FIX GOC cua bug "bam back xong URL da doi nhung man hinh van con
        // ket hinh 3D cu, phai doi tab roi quay lai moi thay": trinh duyet
        // doi khi khong invalidate ngay lop hinh anh WebGL da composite cua
        // iframe khi no bi go khoi DOM (React se go o handleBack() ben
        // duoi, nhung buoc go DOM + repaint co the khong xay ra kip trong
        // 1 frame neu may dang ban render). Gan src = "about:blank" TRUOC
        // buoc ep trinh duyet huy ngay lap tuc document/WebGL context cua
        // iframe (dong bo, ngay trong lenh nay) - trinh duyet se composite
        // lai NGAY, khong con phu thuoc vao viec doi tab nua.
        try {
          if (iframeRef.current) iframeRef.current.src = "about:blank";
        } catch {
          // bo qua - handleBack() ben duoi van dieu huong binh thuong
        }
        handleBack();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [handleBack]);

  return (
    <div className="map3d-page">
      <iframe
        ref={iframeRef}
        className="map3d-frame"
        src={MAP3D_SRC}
        title="Bản đồ 3D nghĩa trang"
        allow="fullscreen"
      />

      {!ready && (
        <div className="map3d-loading">
          <div className="map3d-loading-spinner" />
          <p>Đang tải bản đồ 3D…</p>
        </div>
      )}

      <button
        type="button"
        className="map3d-back-btn"
        title="Quay lại bản đồ"
        aria-label="Quay lại bản đồ"
        onClick={handleBack}
      >
        ←
      </button>

      {/* Minimap 2D kiểu Google Maps — góc trái trên, dùng ĐÚNG bản đồ 2D
          thật (cùng dữ liệu/hình học với trang "Bản đồ"), tự xoay/zoom
          theo hướng nhìn + khoảng cách camera của cảnh 3D bên dưới. */}
      <div className="map3d-minimap" aria-hidden="true">
        <svg
          className="map3d-minimap-content"
          viewBox={`${MAP_BG_RECT.x} ${MAP_BG_RECT.y} ${MAP_BG_RECT.width} ${MAP_BG_RECT.height}`}
          style={{
            transform: `scale(${zoomRatio}) rotate(${heading}deg)`,
          }}
        >
          <CemeteryMapBackground />
          <CemeteryMapPlotsMini />
        </svg>
      </div>
    </div>
  );
}
