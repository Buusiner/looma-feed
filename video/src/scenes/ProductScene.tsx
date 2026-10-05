import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  Backdrop,
  BrandHeader,
  clamp,
  easing,
  Footer,
  INK,
  LIME,
} from "../components/Brand";
import { Cursor, ProductFrame } from "../components/ProductFrame";

export type ProductSceneProps = {
  kind: "discover" | "opportunities" | "search" | "people" | "composer";
  title: string;
  label: string;
};
export const ProductScene: React.FC<ProductSceneProps> = ({
  kind,
  title,
  label,
}) => {
  const f = useCurrentFrame();
  const { height, width } = useVideoConfig();
  const vertical = height > width;
  const format = vertical ? "vertical" : "wide";
  const simple = kind === "opportunities" || kind === "search";
  const isPeople = kind === "people";
  const isComposer = kind === "composer";
  const mediaFormat = isComposer || kind === "discover" ? "wide" : format;
  const panelLeft = vertical ? 84 : simple ? 782 : 930;
  const panelTop = vertical ? 590 : isComposer ? 455 : 205;
  const panelWidth = vertical ? 912 : simple ? 1036 : 890;
  const panelHeight = vertical
    ? isComposer
      ? 190
      : isPeople
        ? 245
        : kind === "discover"
          ? 792
          : 1020
    : isComposer
      ? 193
      : isPeople
        ? 165
        : simple
          ? 696
          : 740;
  const sourceHeight = isPeople ? (vertical ? 750 : 1020) : 1;
  return (
    <AbsoluteFill style={{ fontFamily: "Inter", color: INK }}>
      <Backdrop />
      <BrandHeader />
      <div
        style={{
          position: "absolute",
          left: vertical ? 84 : 104,
          top: vertical ? 260 : 308,
          width: vertical ? 912 : simple ? 620 : 715,
          translate: interpolate(f, [0, 42], ["0px 26px", "0px 0px"], {
            ...clamp,
            easing,
          }),
          opacity: interpolate(f, [5, 28], [0, 1], clamp),
        }}
      >
        <div
          style={{
            fontSize: vertical ? 24 : 18,
            letterSpacing: 4,
            fontWeight: 600,
            color: "#756D61",
            marginBottom: vertical ? 30 : 36,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: vertical ? 88 : 94,
            fontWeight: 600,
            letterSpacing: vertical ? -5 : -5.8,
            lineHeight: 1.06,
            whiteSpace: "pre-line",
          }}
        >
          {title}
        </div>
        <div
          style={{
            width: vertical ? 115 : 92,
            height: 8,
            background: LIME,
            marginTop: vertical ? 32 : 40,
            scale: interpolate(f, [18, 60], [0, 1], { ...clamp, easing }),
            transformOrigin: "left",
          }}
        />
      </div>
      <ProductFrame
        src={"assets/captures/" + mediaFormat + "-" + kind + ".mp4"}
        width={panelWidth}
        height={panelHeight}
        left={panelLeft}
        top={panelTop}
        zoom={isPeople ? 1.015 : 1.035}
        mediaStyle={
          isPeople
            ? {
                height: sourceHeight * (panelWidth / (vertical ? 720 : 680)),
                position: "absolute",
                top: 0,
                left: 0,
                objectFit: "fill",
              }
            : undefined
        }
      >
        {kind === "opportunities" && !vertical ? (
          <Cursor
            points={[
              { frame: 60, x: 180, y: 400 },
              { frame: 92, x: 40, y: 237 },
              { frame: 115, x: 40, y: 237 },
              { frame: 170, x: 160, y: 310 },
              { frame: 212, x: 40, y: 237 },
              { frame: 245, x: 40, y: 237 },
              { frame: 270, x: 160, y: 310 },
            ]}
            clicks={[100, 220]}
          />
        ) : null}
      </ProductFrame>
      {isPeople ? (
        <ProductFrame
          src={"assets/captures/" + format + "-account-detail.png"}
          image
          left={panelLeft}
          top={vertical ? 965 : 505}
          width={panelWidth}
          height={vertical ? 190 : 138}
          zoom={1.035}
          mediaStyle={{ objectFit: "contain", padding: 20 }}
        />
      ) : null}
      {isPeople ? (
        <div
          style={{
            position: "absolute",
            left: panelLeft,
            top: vertical ? 1240 : 711,
            fontSize: vertical ? 48 : 33,
            fontWeight: 400,
            letterSpacing: -1.5,
            opacity: interpolate(f, [105, 160], [0, 1], clamp),
          }}
        >
          Encontre pessoas que somam.
        </div>
      ) : null}
      {isComposer ? (
        <div
          style={{
            position: "absolute",
            left: panelLeft,
            top: vertical ? 960 : 705,
            width: panelWidth,
            fontSize: vertical ? 47 : 32,
            lineHeight: 1.3,
            letterSpacing: -1.3,
            opacity: interpolate(f, [180, 225], [0, 1], clamp),
          }}
        >
          Uma publicação.
          <br />
          Novas possibilidades.
        </div>
      ) : null}
      <Footer label={vertical ? "" : label.split(" / ")[1]} />
    </AbsoluteFill>
  );
};
