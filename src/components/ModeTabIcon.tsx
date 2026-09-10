import {
  BookOpenIcon as BookOutline,
  QueueListIcon as TimelineOutline,
  RectangleStackIcon as StackOutline,
  Squares2X2Icon as SquaresOutline,
} from "@heroicons/react/24/outline";
import {
  BookOpenIcon as BookSolid,
  QueueListIcon as TimelineSolid,
  RectangleStackIcon as StackSolid,
  Squares2X2Icon as SquaresSolid,
} from "@heroicons/react/24/solid";

type ModeTabName = "today" | "bible" | "cards" | "inbox";

type ModeTabIconProps = {
  name: ModeTabName;
  active?: boolean;
};

/** Galerie de plans. */
const ICONS: Record<
  ModeTabName,
  {
    Outline: typeof SquaresOutline;
    Solid: typeof SquaresSolid;
  }
> = {
  today: { Outline: SquaresOutline, Solid: SquaresSolid },
  bible: { Outline: BookOutline, Solid: BookSolid },
  cards: { Outline: StackOutline, Solid: StackSolid },
  inbox: { Outline: TimelineOutline, Solid: TimelineSolid },
};

export function ModeTabIcon({ name, active = false }: ModeTabIconProps) {
  const { Outline, Solid } = ICONS[name];
  const Icon = active ? Solid : Outline;
  return (
    <Icon
      className={`mode-tab-icon${active ? " is-filled" : ""}`}
      width={18}
      height={18}
      aria-hidden
    />
  );
}
