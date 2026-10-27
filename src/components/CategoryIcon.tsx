import { categoryColor } from "../theme/tokens";
import { IconTile } from "./IconTile";

/** Category icon in a tinted rounded tile, using the category's (display-mapped) colour everywhere. */
export function CategoryIcon({ icon, color, size = 40 }: { icon: string; color: string; size?: number }) {
  return <IconTile icon={icon} color={categoryColor(color)} size={size} />;
}
