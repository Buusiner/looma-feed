import React from "react";
import {
  AbsoluteFill,
  CanvasImage,
  interpolate,
  staticFile,
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
import { ProductFrame, Cursor } from "../components/ProductFrame";

export const ThemeScene: React.FC = () => {
  const f = useCurrentFrame();
  const { height, width } = useVideoConfig();
  const vertical = height > width;
  const dark = interpolate(f, [100, 135], [0, 1], { ...clamp, easing });
  return (
    <AbsoluteFill style={{ fontFamily: "Inter", color: INK }}>
      <Backdrop />
      <BrandHeader />
      <div
        style={{
          position: "absolute",
          left: vertical ? 84 : 104,
          top: vertical ? 260 : 325,
          width: vertical ? 912 : 650,
          opacity: interpolate(f, [4, 30], [0, 1], clamp),
        }}
      >
        <div
          style={{
            fontSize: vertical ? 24 : 18,
            letterSpacing: 4,
            color: "#756D61",
            marginBottom: 32,
          }}
        >
          04 / DO SEU JEITO
        </div>
        <div
          style={{
            fontSize: vertical ? 88 : 94,
            fontWeight: 600,
            lineHeight: 1.06,
            letterSpacing: -5,
          }}
        >
          Claro.
          <br />
          Ou escuro.
        </div>
        <div
          style={{ background: LIME, width: 100, height: 8, marginTop: 38 }}
        />
      </div>
      {vertical ? (
        <>
          <ProductFrame
            src="assets/captures/wide-light-explore-detail.png"
            image
            left={84}
            top={650}
            width={912}
            height={792}
            zoom={1.02}
          >
            <CanvasImage
              src={staticFile("assets/captures/wide-dark-explore-detail.png")}
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                opacity: dark,
              }}
            />
          </ProductFrame>
          <div
            style={{
              position: "absolute",
              left: 84,
              top: 1510,
              fontSize: 38,
              fontWeight: 400,
            }}
          >
            Sua Looma. Seu ritmo.
          </div>
        </>
      ) : (
        <ProductFrame
          src="assets/captures/wide-theme.mp4"
          left={940}
          top={190}
          width={864}
          height={755}
          zoom={1.015}
        >
          <Cursor
            points={[
              { frame: 48, x: 470, y: 515 },
              { frame: 92, x: 107, y: 716 },
              { frame: 112, x: 107, y: 716 },
              { frame: 145, x: 450, y: 500 },
              { frame: 185, x: 450, y: 500 },
            ]}
            clicks={[100]}
          />
        </ProductFrame>
      )}
      <Footer label="Sua Looma. Seu ritmo." />
    </AbsoluteFill>
  );
};
