// src/types/lot.ts
export type LotStatus = 'available' | 'reserved' | 'sold' | 'locked'

export interface LotCell {
  id: string          // "C-02", "A-24"
  zone: string        // "Khu Phúc Lâm"
  status: LotStatus
  price: number       // VND
  area: number        // m²
  floor: number
  row: number
  direction: string   // "Đông Nam"
  type: string        // "Tiêu chuẩn"
}

export interface LotDetail extends LotCell {
  size: string        // "4×6 m"
  material: string    // "Granite Đen Hoa Cương"
  fengshui: string
  neighbors: string[]
  amenities: Amenity[]
  priceBreakdown: {
    base: number
    notaryFee: number
    serviceYear1: number
    total: number
  }
  depositOptions: DepositOption[]
}

export interface DepositOption {
  label: string       // "Đặt cọc tối thiểu"
  amount: number
  percent: number
  holdDays: number
}

export interface Amenity {
  name: string
  distance: string   // "-45m"
  icon: string
}