// src/store/bookingStore.ts
import { create } from 'zustand'
import type { LotCell, DepositOption } from '../types/lots'

interface BookingState {
  selectedLot: LotCell | null
  depositOption: DepositOption | null
  holdDays: 7 | 14 | 30 | 60
  paymentMethod: 'bank_transfer' | 'card' | 'ewallet' | 'cash'
  setLot: (lot: LotCell) => void
  setDeposit: (opt: DepositOption) => void
  setHoldDays: (days: 7 | 14 | 30 | 60) => void
  setPaymentMethod: (m: BookingState['paymentMethod']) => void
  reset: () => void
}

export const useBookingStore = create<BookingState>((set) => ({
  selectedLot: null,
  depositOption: null,
  holdDays: 7,
  paymentMethod: 'bank_transfer',
  setLot: (lot) => set({ selectedLot: lot }),
  setDeposit: (opt) => set({ depositOption: opt }),
  setHoldDays: (days) => set({ holdDays: days }),
  setPaymentMethod: (m) => set({ paymentMethod: m }),
  reset: () => set({ selectedLot: null, depositOption: null }),
}))