import React from "react";
import { AbsoluteFill, Composition, Folder, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { BrandScene } from "./scenes/BrandScene";
import { ProductScene } from "./scenes/ProductScene";
import { ThemeScene } from "./scenes/ThemeScene";
import "./index.css";

export const Meet: React.FC = () => (
  <AbsoluteFill>
    <Audio src={staticFile("assets/audio/meet.wav")} />
    <TransitionSeries>
      <TransitionSeries.Sequence name="Looma identity" durationInFrames={138}>
        <BrandScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 18 })}
      />
      <TransitionSeries.Sequence
        name="Discover the community"
        durationInFrames={258}
      >
        <ProductScene
          kind="discover"
          title={"Descubra novas\npossibilidades."}
          label="01 / DESCUBRA"
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 18 })}
      />
      <TransitionSeries.Sequence
        name="Real opportunities"
        durationInFrames={258}
      >
        <ProductScene
          kind="opportunities"
          title={"Encontre seu\npróximo projeto."}
          label="02 / ENCONTRE"
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 18 })}
      />
      <TransitionSeries.Sequence name="Share an idea" durationInFrames={258}>
        <ProductScene
          kind="composer"
          title={"Ideias viram\npossibilidades."}
          label="03 / CONSTRUA"
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 18 })}
      />
      <TransitionSeries.Sequence
        name="Actual theme switch"
        durationInFrames={258}
      >
        <ThemeScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 18 })}
      />
      <TransitionSeries.Sequence name="Looma end card" durationInFrames={120}>
        <BrandScene end />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);

export const Opportunities: React.FC = () => (
  <AbsoluteFill>
    <Audio src={staticFile("assets/audio/opportunities.wav")} />
    <TransitionSeries>
      <TransitionSeries.Sequence name="Opportunity hook" durationInFrames={138}>
        <BrandScene headline="Seu próximo projeto começa aqui." />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 18 })}
      />
      <TransitionSeries.Sequence name="Discover topics" durationInFrames={258}>
        <ProductScene
          kind="discover"
          title={"Acompanhe o\nque move ideias."}
          label="01 / EXPLORE"
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 18 })}
      />
      <TransitionSeries.Sequence
        name="Filter actual opportunities"
        durationInFrames={378}
      >
        <ProductScene
          kind="opportunities"
          title={"Um projeto\npara o seu talento."}
          label="02 / FILTRE"
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 18 })}
      />
      <TransitionSeries.Sequence name="Search and find" durationInFrames={258}>
        <ProductScene
          kind="search"
          title={"Encontre novas\npossibilidades."}
          label="03 / ENCONTRE"
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 18 })}
      />
      <TransitionSeries.Sequence name="Looma end card" durationInFrames={120}>
        <BrandScene end />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);

export const Presence: React.FC = () => (
  <AbsoluteFill>
    <Audio src={staticFile("assets/audio/presence.wav")} />
    <TransitionSeries>
      <TransitionSeries.Sequence name="Presence hook" durationInFrames={138}>
        <BrandScene headline="Boas ideias merecem conexões." />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 18 })}
      />
      <TransitionSeries.Sequence
        name="Find a real professional"
        durationInFrames={318}
      >
        <ProductScene
          kind="people"
          title={"Ideias encontram\npessoas."}
          label="01 / CONHEÇA"
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 18 })}
      />
      <TransitionSeries.Sequence
        name="Compose and select publication type"
        durationInFrames={378}
      >
        <ProductScene
          kind="composer"
          title={"Compartilhe sua\npróxima ideia."}
          label="02 / CONSTRUA"
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 18 })}
      />
      <TransitionSeries.Sequence name="Find a project" durationInFrames={138}>
        <ProductScene
          kind="search"
          title={"Transforme ideias\nem possibilidades."}
          label="03 / DESCUBRA"
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 18 })}
      />
      <TransitionSeries.Sequence name="Looma end card" durationInFrames={180}>
        <BrandScene end />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);

export const RemotionRoot: React.FC = () => (
  <>
    <Folder name="Landscape">
      <Composition
        id="Looma-Meet"
        component={Meet}
        width={1920}
        height={1080}
        fps={60}
        durationInFrames={1200}
      />
      <Composition
        id="Looma-Opportunities"
        component={Opportunities}
        width={1920}
        height={1080}
        fps={60}
        durationInFrames={1080}
      />
      <Composition
        id="Looma-Presence"
        component={Presence}
        width={1920}
        height={1080}
        fps={60}
        durationInFrames={1080}
      />
    </Folder>
    <Folder name="Vertical">
      <Composition
        id="Looma-Meet-Vertical"
        component={Meet}
        width={1080}
        height={1920}
        fps={60}
        durationInFrames={1200}
      />
      <Composition
        id="Looma-Opportunities-Vertical"
        component={Opportunities}
        width={1080}
        height={1920}
        fps={60}
        durationInFrames={1080}
      />
      <Composition
        id="Looma-Presence-Vertical"
        component={Presence}
        width={1080}
        height={1920}
        fps={60}
        durationInFrames={1080}
      />
    </Folder>
    <Folder name="Editable-Scenes">
      <Composition
        id="Brand-Opening"
        component={BrandScene}
        width={1920}
        height={1080}
        fps={60}
        durationInFrames={138}
        defaultProps={{
          end: false,
          headline: "Conexões que viram oportunidades.",
        }}
      />
      <Composition
        id="Brand-End"
        component={BrandScene}
        width={1920}
        height={1080}
        fps={60}
        durationInFrames={120}
        defaultProps={{
          end: true,
          headline: "Conexões que viram oportunidades.",
        }}
      />
      <Composition
        id="Discover"
        component={ProductScene}
        width={1920}
        height={1080}
        fps={60}
        durationInFrames={258}
        defaultProps={{
          kind: "discover" as const,
          title: "Descubra novas\npossibilidades.",
          label: "01 / DESCUBRA",
        }}
      />
      <Composition
        id="Opportunity-Filter"
        component={ProductScene}
        width={1920}
        height={1080}
        fps={60}
        durationInFrames={378}
        defaultProps={{
          kind: "opportunities" as const,
          title: "Um projeto\npara o seu talento.",
          label: "02 / FILTRE",
        }}
      />
      <Composition
        id="Opportunity-Search"
        component={ProductScene}
        width={1920}
        height={1080}
        fps={60}
        durationInFrames={258}
        defaultProps={{
          kind: "search" as const,
          title: "Encontre novas\npossibilidades.",
          label: "03 / ENCONTRE",
        }}
      />
      <Composition
        id="People-Search"
        component={ProductScene}
        width={1920}
        height={1080}
        fps={60}
        durationInFrames={318}
        defaultProps={{
          kind: "people" as const,
          title: "Ideias encontram\npessoas.",
          label: "01 / CONHEÇA",
        }}
      />
      <Composition
        id="Composer"
        component={ProductScene}
        width={1920}
        height={1080}
        fps={60}
        durationInFrames={378}
        defaultProps={{
          kind: "composer" as const,
          title: "Compartilhe sua\npróxima ideia.",
          label: "02 / CONSTRUA",
        }}
      />
      <Composition
        id="Theme-Switch"
        component={ThemeScene}
        width={1920}
        height={1080}
        fps={60}
        durationInFrames={258}
      />
    </Folder>
  </>
);
