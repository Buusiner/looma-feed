import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  Backdrop,
  clamp,
  easing,
  Footer,
  INK,
  LIME,
  Mark,
} from "../components/Brand";

export type BrandSceneProps = { end?: boolean; headline?: string };
export const BrandScene: React.FC<BrandSceneProps> = ({
  end = false,
  headline = "Conexões que viram oportunidades.",
}) => {
  const f = useCurrentFrame();
  const { height, width } = useVideoConfig();
  const vertical = height > width;
  return (
    <AbsoluteFill style={{ fontFamily: "Inter", color: INK }}>
      <Backdrop />
      <div
        style={{
          position: "absolute",
          left: vertical ? 84 : 160,
          right: vertical ? 84 : 160,
          top: vertical ? 560 : 340,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: vertical ? 22 : 30,
            translate: interpolate(f, [0, 45], ["0px 32px", "0px 0px"], {
              ...clamp,
              easing,
            }),
            opacity: interpolate(f, [0, 25], [0, 1], clamp),
          }}
        >
          <Mark size={vertical ? 112 : 146} />
          <span
            style={{
              fontWeight: 700,
              fontSize: vertical ? 174 : 232,
              letterSpacing: vertical ? -12 : -16,
              lineHeight: 1.1,
            }}
          >
            Looma
          </span>
        </div>
        <div
          style={{
            width: vertical ? 430 : 580,
            height: vertical ? 9 : 10,
            background: LIME,
            margin: vertical ? "30px auto 44px" : "20px auto 38px",
            scale: interpolate(f, [18, 58], [0, 1], { ...clamp, easing }),
            transformOrigin: "left center",
          }}
        />
        <div
          style={{
            textAlign: "center",
            fontSize: vertical ? 55 : 48,
            lineHeight: 1.25,
            fontWeight: 400,
            letterSpacing: -1.6,
            opacity: interpolate(f, [25, 60], [0, 1], clamp),
            translate: interpolate(f, [25, 65], ["0px 20px", "0px 0px"], {
              ...clamp,
              easing,
            }),
          }}
        >
          {headline}
        </div>
        {end ? (
          <div
            style={{
              textAlign: "center",
              marginTop: vertical ? 72 : 34,
              fontSize: vertical ? 29 : 23,
              color: "#777065",
              opacity: interpolate(f, [38, 70], [0, 1], clamp),
            }}
          >
            Descubra. Conecte-se. Construa.
          </div>
        ) : null}
      </div>
      <Footer label={end ? "Comece por uma conexão." : ""} />
    </AbsoluteFill>
  );
};
