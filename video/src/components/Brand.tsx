import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/fonts";

loadFont({
  family: "Inter",
  url: staticFile("assets/branding/Inter.ttf"),
  weight: "400",
});
loadFont({
  family: "Inter",
  url: staticFile("assets/branding/Inter-600.ttf"),
  weight: "600",
});
loadFont({
  family: "Inter",
  url: staticFile("assets/branding/Inter-700.ttf"),
  weight: "700",
});
export const CREAM = "#FAE9D8";
export const INK = "#171715";
export const LIME = "#EDF500";
export const easing = Easing.bezier(0.16, 1, 0.3, 1);
export const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};
export const Mark: React.FC<{ size?: number; color?: string }> = ({
  size = 48,
  color = INK,
}) => (
  <div
    style={{
      width: size,
      height: size,
      background: color,
      maskImage: `url(${staticFile("assets/branding/looma-logo-mark.svg")})`,
      maskSize: "contain",
      maskRepeat: "no-repeat",
      maskPosition: "center",
    }}
  />
);
export const Backdrop: React.FC<{ dark?: boolean }> = ({ dark = false }) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        background: dark ? "#101010" : CREAM,
        color: dark ? "#FFF" : INK,
        fontFamily: "Inter",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: width * 0.58,
          height: width * 0.58,
          left: width * 0.7,
          top: -width * 0.25,
          borderRadius: "50%",
          background: dark ? "#222" : "#FFF5EB",
          opacity: 0.9,
          translate: interpolate(
            f,
            [0, 1200],
            ["0px 0px", "-30px 45px"],
            clamp,
          ),
        }}
      />
      <div
        style={{
          position: "absolute",
          width: width * 0.75,
          height: width * 0.75,
          left: -width * 0.35,
          top: height * 0.73,
          borderRadius: "50%",
          border: `1px solid ${dark ? "#333" : "#DACDBE"}`,
          opacity: 0.8,
        }}
      />
      <div
        style={{
          position: "absolute",
          height: 1,
          left: 0,
          right: 0,
          bottom: height * 0.065,
          background: dark ? "#2C2C2C" : "#DECFBE",
        }}
      />
    </AbsoluteFill>
  );
};
export const BrandHeader: React.FC = () => {
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  return (
    <div
      style={{
        position: "absolute",
        left: vertical ? 84 : 104,
        top: vertical ? 105 : 63,
        display: "flex",
        gap: 14,
        alignItems: "center",
      }}
    >
      <Mark size={vertical ? 46 : 38} />
      <span
        style={{
          fontSize: vertical ? 39 : 31,
          fontWeight: 700,
          letterSpacing: -1.6,
        }}
      >
        Looma
      </span>
    </div>
  );
};
export const Footer: React.FC<{ label?: string }> = ({ label }) => {
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  return (
    <div
      style={{
        position: "absolute",
        bottom: vertical ? 74 : 35,
        left: vertical ? 84 : 104,
        right: vertical ? 84 : 104,
        fontSize: vertical ? 24 : 19,
        color: "#777065",
        display: "flex",
        justifyContent: "space-between",
        letterSpacing: -0.2,
      }}
    >
      <span>looma-feed.vercel.app</span>
      <span>{label ?? "Conexões. Possibilidades."}</span>
    </div>
  );
};
