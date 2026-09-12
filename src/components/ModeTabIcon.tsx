import {
  BookOpenIcon as BookOutline,
  RectangleStackIcon as StackOutline,
  Squares2X2Icon as SquaresOutline,
  UserCircleIcon as UserOutline,
} from "@heroicons/react/24/outline";
import {
  BookOpenIcon as BookSolid,
  RectangleStackIcon as StackSolid,
  Squares2X2Icon as SquaresSolid,
  UserCircleIcon as UserSolid,
} from "@heroicons/react/24/solid";

type ModeTabName = "today" | "bible" | "cards" | "profile";

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
  profile: { Outline: UserOutline, Solid: UserSolid },
};

export function ModeTabIcon({ name, active = false }: ModeTabIconProps) {
  const { Outline, Solid } = ICONS[name];
  const Icon = active ? Solid : Outline;
  return (
    <Icon
      className={`mode-tab-icon${active ? " is-filled" : ""}`}
      width={20}
      height={20}
      strokeWidth={active ? 2 : 1.75}
      aria-hidden
    />
  );
}
