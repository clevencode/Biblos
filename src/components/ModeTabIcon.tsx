import {
  BookOpenIcon as BookOutline,
  HomeIcon as HomeOutline,
  RectangleStackIcon as StackOutline,
  Squares2X2Icon as SquaresOutline,
  UserCircleIcon as UserOutline,
} from "@heroicons/react/24/outline";
import {
  BookOpenIcon as BookSolid,
  HomeIcon as HomeSolid,
  RectangleStackIcon as StackSolid,
  Squares2X2Icon as SquaresSolid,
  UserCircleIcon as UserSolid,
} from "@heroicons/react/24/solid";
import type { CenterMode } from "../types";

type ModeTabIconProps = {
  name: CenterMode;
  active?: boolean;
};

const ICONS: Record<
  CenterMode,
  {
    Outline: typeof HomeOutline;
    Solid: typeof HomeSolid;
  }
> = {
  home: { Outline: HomeOutline, Solid: HomeSolid },
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
