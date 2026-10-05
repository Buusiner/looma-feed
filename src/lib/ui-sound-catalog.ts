export const UI_SOUND_CATEGORIES = {
  interaction: "Cliques e controles",
  movement: "Navegação e janelas",
  social: "Reações e conexões",
  message: "Mensagens",
  feedback: "Confirmações e avisos",
  notification: "Notificações",
  premium: "Recursos Pro",
} as const;

export type UISoundCategory = keyof typeof UI_SOUND_CATEGORIES;

// Nine core recordings; other cues reuse them with restrained rate/gain changes.
// The closing whoosh is a short reversed edit of navigation-swoosh, not a new voice.
export const UI_SOUND_FILES = {
  click: "/audio/ui/click.mp3",
  primary: "/audio/ui/primary-click.mp3",
  pop: "/audio/ui/pop.mp3",
  navigation: "/audio/ui/navigation-swoosh.mp3",
  sent: "/audio/ui/message-sent.mp3",
  notification: "/audio/ui/notification.mp3",
  success: "/audio/ui/success.mp3",
  error: "/audio/ui/error.mp3",
  premium: "/audio/ui/premium-pro-chime.mp3",
  close: "/audio/ui/modal-close.mp3",
} as const;

type Cue = {
  file: keyof typeof UI_SOUND_FILES;
  category: UISoundCategory;
  gain: number;
  rate: number;
  cooldown: number;
  priority: number;
  variation?: number;
  followup?: { file: keyof typeof UI_SOUND_FILES; delay: number; gain: number; rate: number };
};

export const UI_SOUND_CUES = {
  click: {
    file: "click",
    category: "interaction",
    gain: 0.5,
    rate: 1,
    cooldown: 100,
    priority: 0,
    variation: 0.025,
  },
  primary: {
    file: "primary",
    category: "interaction",
    gain: 0.7,
    rate: 1,
    cooldown: 180,
    priority: 1,
    variation: 0.02,
  },
  navigation: {
    file: "navigation",
    category: "movement",
    gain: 0.45,
    rate: 1,
    cooldown: 180,
    priority: 1,
  },
  like: {
    file: "pop",
    category: "social",
    gain: 0.55,
    rate: 1.12,
    cooldown: 150,
    priority: 1,
    variation: 0.025,
  },
  save: { file: "click", category: "social", gain: 0.5, rate: 1.22, cooldown: 180, priority: 1 },
  follow: {
    file: "pop",
    category: "social",
    gain: 0.6,
    rate: 0.88,
    cooldown: 500,
    priority: 2,
    followup: { file: "notification", delay: 115, gain: 0.2, rate: 0.9 },
  },
  messageSent: {
    file: "sent",
    category: "message",
    gain: 0.5,
    rate: 1,
    cooldown: 250,
    priority: 2,
  },
  messageReceived: {
    file: "pop",
    category: "message",
    gain: 0.45,
    rate: 0.85,
    cooldown: 1000,
    priority: 2,
  },
  success: {
    file: "success",
    category: "feedback",
    gain: 0.6,
    rate: 1,
    cooldown: 600,
    priority: 2,
  },
  error: { file: "error", category: "feedback", gain: 0.5, rate: 1, cooldown: 700, priority: 3 },
  warning: {
    file: "error",
    category: "feedback",
    gain: 0.35,
    rate: 1.05,
    cooldown: 800,
    priority: 2,
    followup: { file: "error", delay: 100, gain: 0.3, rate: 0.95 },
  },
  remove: {
    file: "primary",
    category: "feedback",
    gain: 0.55,
    rate: 0.78,
    cooldown: 300,
    priority: 2,
  },
  menu: {
    file: "click",
    category: "interaction",
    gain: 0.25,
    rate: 0.95,
    cooldown: 150,
    priority: 1,
  },
  modalOpen: {
    file: "navigation",
    category: "movement",
    gain: 0.35,
    rate: 0.9,
    cooldown: 250,
    priority: 1,
  },
  modalClose: {
    file: "close",
    category: "movement",
    gain: 0.3,
    rate: 1.1,
    cooldown: 200,
    priority: 1,
  },
  notification: {
    file: "notification",
    category: "notification",
    gain: 0.5,
    rate: 1,
    cooldown: 2000,
    priority: 2,
  },
  toggleOn: {
    file: "pop",
    category: "interaction",
    gain: 0.35,
    rate: 1.1,
    cooldown: 120,
    priority: 1,
  },
  toggleOff: {
    file: "click",
    category: "interaction",
    gain: 0.35,
    rate: 0.88,
    cooldown: 120,
    priority: 1,
  },
  themeDark: {
    file: "navigation",
    category: "movement",
    gain: 0.3,
    rate: 0.82,
    cooldown: 400,
    priority: 1,
  },
  themeLight: {
    file: "navigation",
    category: "movement",
    gain: 0.3,
    rate: 1.12,
    cooldown: 400,
    priority: 1,
  },
  premium: {
    file: "premium",
    category: "premium",
    gain: 0.5,
    rate: 1,
    cooldown: 1200,
    priority: 2,
  },
} satisfies Record<string, Cue>;

export type UISound = keyof typeof UI_SOUND_CUES;
export function isUISound(value: string): value is UISound {
  return Object.hasOwn(UI_SOUND_CUES, value);
}
