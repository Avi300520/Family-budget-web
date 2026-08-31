// design-sync curated entry — re-exports only the portable, presentational
// components scoped for claude.ai/design. NOT imported by the app.
// ponytail: hand-curated so esbuild bundles only these, never the whole Next app.
export { Avatar } from "./src/components/Avatar";
export { InsightCard } from "./src/components/InsightCard";
export {
  Donut,
  ProgressRing,
  Thermometer,
  BarsChart,
  StackedBar,
  Sparkline,
  ActivityHeatmap,
} from "./src/components/charts";
