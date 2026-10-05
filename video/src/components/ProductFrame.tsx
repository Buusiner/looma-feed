import React from "react";
import {
  AbsoluteFill,
  CanvasImage,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Video } from "@remotion/media";
import { clamp, easing, INK } from "./Brand";

export type Point = { frame: number; x: number; y: number };
export const Cursor: React.FC<{ points: Point[]; clicks?: number[] }> = ({
  points,
  clicks = [],
}) => {
  const f = useCurrentFrame();
  const frames = points.map((p) => p.frame);
  const click = clicks.find((c) => f >= c && f < c + 24);
  return (
    <div
      style={{
        position: "absolute",
        left: interpolate(
          f,
          frames,
          points.map((p) => p.x),
          { ...clamp, easing },
        ),
        top: interpolate(
          f,
          frames,
          points.map((p) => p.y),
          { ...clamp, easing },
        ),
        opacity: interpolate(
          f,
          [
            frames[0],
            frames[0] + 12,
            frames[frames.length - 1] - 20,
            frames[frames.length - 1],
          ],
          [0, 1, 1, 0],
          clamp,
        ),
        pointerEvents: "none",
      }}
    >
      {click !== undefined ? (
        <div
          style={{
            position: "absolute",
            width: 36,
            height: 36,
            left: -10,
            top: -9,
            border: "1.5px solid #777",
            borderRadius: "50%",
            scale: interpolate(f, [click, click + 24], [0.5, 1.5], clamp),
            opacity: interpolate(f, [click, click + 24], [0.5, 0], clamp),
          }}
        />
      ) : null}
      <svg
        width="26"
        height="34"
        viewBox="0 0 26 34"
        style={{ filter: "drop-shadow(0 2px 2px #0003)" }}
      >
        <path
          d="M2 2L2 27L9 21L14 31L19 28L14 18L24 18Z"
          fill={INK}
          stroke="white"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
export const ProductFrame: React.FC<{
  src: string;
  image?: boolean;
  width: number;
  height: number;
  left: number;
  top: number;
  zoom?: number;
  children?: React.ReactNode;
  mediaStyle?: React.CSSProperties;
}> = ({
  src,
  image = false,
  width,
  height,
  left,
  top,
  zoom = 1.035,
  children,
  mediaStyle,
}) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width,
        height,
        borderRadius: 26,
        boxShadow: "0 28px 75px -25px #66503e4d, 0 3px 10px #66503e12",
        border: "1px solid #CBBDAE",
        background: "#FAE9D8",
        overflow: "hidden",
        scale: interpolate(
          f,
          [0, durationInFrames],
          [1, Math.min(zoom, 1.025)],
          { ...clamp, easing },
        ),
        translate: interpolate(f, [0, 42], ["0px 30px", "0px 0px"], {
          ...clamp,
          easing,
        }),
        opacity: interpolate(f, [0, 24], [0, 1], clamp),
      }}
    >
      <AbsoluteFill>
        {image ? (
          <CanvasImage
            src={staticFile(src)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              ...mediaStyle,
            }}
          />
        ) : (
          <Video
            src={staticFile(src)}
            muted
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              ...mediaStyle,
            }}
          />
        )}
        {children}
      </AbsoluteFill>
    </div>
  );
};
