"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { logError } from "@/lib/log";
import {
  EMPTY_ONBOARDING,
  parseOnboarding,
  type OnboardingState,
  type TourId,
} from "./types";

const storageKey = (userId: string) => `bh:onboarding:${userId}`;

function readLocal(userId: string): OnboardingState | null {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    return raw ? parseOnboarding(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeLocal(userId: string, state: OnboardingState) {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    /* modo privado / cuota llena: el servidor sigue siendo la fuente */
  }
}

interface OnboardingStore {
  userId: string | null;
  /** true cuando ya se leyó el estado (local o remoto) y se puede decidir qué mostrar. */
  hydrated: boolean;
  state: OnboardingState;
  /** Recorrido en curso (null si ninguno). */
  activeTour: TourId | null;

  load: (userId: string) => Promise<void>;
  startTour: (tour: TourId) => void;
  endTour: (tour: TourId) => void;
  markWelcomeSeen: () => void;
  dismissChecklist: () => void;
  /** Vuelve a mostrar bienvenida y recorridos (menú "Ver guía de inicio"). */
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingStore>((set, get) => {
  /** Aplica un cambio, lo espeja en localStorage y lo persiste en el perfil. */
  function commit(patch: Partial<OnboardingState>) {
    const { userId, state } = get();
    const next: OnboardingState = { ...state, ...patch };
    set({ state: next });
    if (!userId) return;
    writeLocal(userId, next);
    const supabase = createClient();
    supabase
      .from("profiles")
      .update({ onboarding: next })
      .eq("id", userId)
      .then(({ error }) => {
        // Si la migración 035 no está aplicada la columna no existe: el
        // progreso queda solo en este navegador, que es aceptable.
        if (error && !/onboarding/.test(error.message)) {
          logError("No se pudo guardar el progreso del onboarding:", error);
        }
      });
  }

  return {
    userId: null,
    hydrated: false,
    state: EMPTY_ONBOARDING,
    activeTour: null,

    async load(userId) {
      if (get().userId === userId && get().hydrated) return;
      const local = readLocal(userId);
      set({ userId, state: local ?? { ...EMPTY_ONBOARDING, tours: {} } });

      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("onboarding")
        .eq("id", userId)
        .maybeSingle();

      if (!error && data && data.onboarding && typeof data.onboarding === "object") {
        const remote = parseOnboarding(data.onboarding);
        // El servidor manda; si está vacío (usuario nuevo) el local es igual de vacío.
        const merged: OnboardingState = {
          ...remote,
          welcomeSeen: remote.welcomeSeen || local?.welcomeSeen === true,
          tours: { ...(local?.tours ?? {}), ...remote.tours },
          checklistDismissedAt: remote.checklistDismissedAt ?? local?.checklistDismissedAt ?? null,
        };
        writeLocal(userId, merged);
        set({ state: merged, hydrated: true });
        return;
      }
      set({ hydrated: true });
    },

    startTour(tour) {
      set({ activeTour: tour });
    },

    endTour(tour) {
      set({ activeTour: null });
      commit({ tours: { ...get().state.tours, [tour]: new Date().toISOString() } });
    },

    markWelcomeSeen() {
      commit({ welcomeSeen: true });
    },

    dismissChecklist() {
      commit({ checklistDismissedAt: new Date().toISOString() });
    },

    reset() {
      set({ activeTour: null });
      commit({ welcomeSeen: false, tours: {}, checklistDismissedAt: null });
    },
  };
});
