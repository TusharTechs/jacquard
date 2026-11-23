// One LazyMotion boundary for the app's few Moments. `m` components inside it animate once the
// features chunk has loaded; before that they render their end state.
import { LazyMotion } from "motion/react";
import type { ReactNode } from "react";

const loadFeatures = () => import("../../lib/motion-features").then((module) => module.default);

export function MotionBoundary({ children }: { readonly children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      {children}
    </LazyMotion>
  );
}
