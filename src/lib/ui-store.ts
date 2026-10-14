import { create } from "zustand";
export const useUiStore = create<{
  onboardingStep: number;
  setStep: (step: number) => void;
}>((set) => ({
  onboardingStep: 0,
  setStep: (step) => set({ onboardingStep: step }),
}));
