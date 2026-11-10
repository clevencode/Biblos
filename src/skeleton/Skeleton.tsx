import {
  useMemo,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";
import { useSkeletonTheme } from "./SkeletonTheme";

export type SkeletonProps = {
  /** Largura CSS (px, %, rem…). */
  width?: string | number;
  height?: string | number;
  circle?: boolean;
  pill?: boolean;
  /** Várias linhas empilhadas (como react-loading-skeleton `count`). */
  count?: number;
  borderRadius?: string | number;
  inline?: boolean;
  block?: boolean;
  className?: string;
  containerClassName?: string;
  style?: CSSProperties;
  enableAnimation?: boolean;
  /** Texto real visível — sem shimmer (ex. nº de versículo no picker). */
  opaque?: boolean;
  as?: ElementType;
  children?: ReactNode;
};

function toCss(value: string | number | undefined): string | undefined {
  if (value == null) return undefined;
  return typeof value === "number" ? `${value}px` : value;
}

export function Skeleton({
  width,
  height,
  circle = false,
  pill = false,
  count,
  borderRadius,
  inline = false,
  block = false,
  className = "",
  containerClassName,
  style,
  enableAnimation = true,
  opaque = false,
  as: Tag = "span",
  children,
}: SkeletonProps) {
  const theme = useSkeletonTheme();

  const mergedStyle = useMemo((): CSSProperties => {
    const radius =
      borderRadius ?? (circle ? "50%" : pill ? "999px" : theme.borderRadius);
    return {
      width: toCss(width),
      height: toCss(height),
      borderRadius: toCss(radius),
      ...style,
    };
  }, [borderRadius, circle, height, pill, style, theme.borderRadius, width]);

  const classes = [
    "skeleton",
    inline ? "skeleton--inline" : "",
    block ? "skeleton--block" : "",
    circle ? "skeleton--circle" : "",
    pill ? "skeleton--pill" : "",
    opaque ? "skeleton--opaque" : "",
    enableAnimation && !opaque ? "skeleton--animate" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const single = (
    <Tag className={classes} style={mergedStyle} aria-hidden={opaque ? undefined : true}>
      {children}
    </Tag>
  );

  if (!count || count <= 1) return single;

  return (
    <span className={containerClassName ?? "skeleton-stack skeleton-stack--gap-sm"}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton
          key={`skeleton-line-${i + 1}`}
          width={width}
          height={height}
          circle={circle}
          pill={pill}
          borderRadius={borderRadius}
          inline={inline}
          block
          className={className}
          style={style}
          enableAnimation={enableAnimation}
          opaque={opaque}
          as={Tag}
        >
          {children}
        </Skeleton>
      ))}
    </span>
  );
}
