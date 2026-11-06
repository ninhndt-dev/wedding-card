export interface Asset {
  id: string;
  filename: string;
  original_name: string;
  mime: string;
  bytes: number;
  url?: string;
}
export interface Guest {
  id: number;
  name: string;
  phone: string;
  attending: "yes" | "no" | "maybe";
  count: number;
  wish: string;
  approved: 0 | 1;
  kind: string;
  side: string;
  event: string;
  message: string;
  created: string;
}
export interface ApiError {
  error: string;
}
export interface RsvpRequest {
  guestName: string;
  willAttend: boolean;
  numberOfGuests: number;
  eventType: "nhatrai" | "nhagai";
  eventName: string;
  message: string;
  submissionId: string;
}
export interface CanvasNode {
  id: string;
  type: string;
  text?: string;
  src?: string;
  href?: string;
  hidden?: boolean;
  style: Record<string, string>;
  props?: Record<string, any>;
  label?: string;
  index?: number;
  parentId?: string | null;
}
export interface WeddingDocument {
  schema: 1;
  site: {
    slug: string;
    guestName: string;
    autoPlay: boolean;
    desktop: boolean;
  };
  opening: {
    enabled: boolean;
    title: string;
    invite: string;
    button: string;
    background: string;
    images: Record<string, string>;
  };
  settings: Record<string, string>;
  nodes: Record<string, Partial<CanvasNode>>;
  additions: CanvasNode[];
  album: { src: string; caption: string }[];
  events: Record<"groom" | "bride", Record<string, string>>;
  forms: Record<
    "rsvp" | "wishes",
    {
      title: string;
      subtitle: string;
      button: string;
      namePlaceholder: string;
      messagePlaceholder: string;
      events?: string[];
    }
  >;
  music: { src: string; enabled: boolean };
  gifts: Record<
    "groom" | "bride",
    {
      enabled: boolean;
      qr: string;
      bank: string;
      account: string;
      holder: string;
    }
  >;
  theme: {
    primary: string;
    background: string;
    fontFamily: string;
    fontUrl: string;
    canvasHeight: number;
    backgroundImage: string;
    effects: boolean;
    effectSymbols: string;
  };
}
export interface EditorState {
  document: WeddingDocument;
  published: WeddingDocument | null;
  revision: number;
  updated: string | null;
  manifest: {
    canvasWidth: number;
    nodes: CanvasNode[];
    album: { src: string; caption: string }[];
  };
  versions: { id: number; created: string }[];
  assets: Asset[];
  presets: { id: number; name: string; created: string }[];
}
export interface AdminState {
  guests: Guest[];
  settings: Record<string, string>;
  eventNames: string[];
}
