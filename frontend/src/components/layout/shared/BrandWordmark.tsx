import { Link } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import "./shared-navigation.css";

type BrandWordmarkProps = {
  className?: string;
};

export default function BrandWordmark({ className = "" }: BrandWordmarkProps) {
  return (
    <Link
      to={ROUTES.HOME}
      className={`brand-wordmark${className ? ` ${className}` : ""}`}
      aria-label="Vĩnh Phúc Viên - Trang chủ"
    >
      Vĩnh Phúc Viên
    </Link>
  );
}
