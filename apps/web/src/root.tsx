// Routes (studio-experience 2.3, 10.5): the Story at `#/`, the Studio at `#/studio/<step>`. Both
// pages are their own chunks, so the first screen loads only what it shows.
import { Suspense, lazy, useEffect } from "react";
import { useRoute } from "./lib/route";
import { useTheme } from "./lib/theme";

const Studio = lazy(() => import("./app").then((module) => ({ default: module.App })));
const Story = lazy(() => import("./components/story/story").then((module) => ({ default: module.Story })));

function PageLoading() {
  return (
    <div className="page-loading" role="status">
      <span className="page-loading-holes" aria-hidden="true" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function Root() {
  const route = useRoute();
  // Applies the Theme to <html> and follows the system until the user chooses.
  useTheme();
  useEffect(() => {
    window.scrollTo?.(0, 0);
  }, [route.page]);
  return <Suspense fallback={<PageLoading />}>{route.page === "story" ? <Story /> : <Studio />}</Suspense>;
}
