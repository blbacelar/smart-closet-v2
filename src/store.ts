import { create } from 'zustand';
import { Garment, garments as seedGarments } from './data';

type FitlyState = {
  garments: Garment[];
  selectedGarmentId: string;
  tryOnsUsed: number;
  isPro: boolean;
  bodyPhotoReady: boolean;
  addGarment: (garment: Garment) => void;
  selectGarment: (id: string) => void;
  useTryOn: () => void;
  setBodyPhotoReady: (ready: boolean) => void;
  upgrade: () => void;
};

export const useFitlyStore = create<FitlyState>((set) => ({
  garments: seedGarments,
  selectedGarmentId: '4',
  tryOnsUsed: 1,
  isPro: false,
  bodyPhotoReady: true,
  addGarment: (garment) => set((state) => ({ garments: [garment, ...state.garments] })),
  selectGarment: (id) => set({ selectedGarmentId: id }),
  useTryOn: () => set((state) => ({ tryOnsUsed: Math.min(state.tryOnsUsed + 1, 3) })),
  setBodyPhotoReady: (ready) => set({ bodyPhotoReady: ready }),
  upgrade: () => set({ isPro: true }),
}));

