export type Shot = {
  id: number;
  label: string;
  camera: string;
  action: string;
  time: "Night" | "Morning";
  status: "canon" | "draft" | "planned";
  continuity: string[];
};

export const project = {
  title: "The Message From Tomorrow",
  subtitle: "Continuity test project",
  format: "Vertical 9:16",
  style: "Cinematic photorealism",
};

export const characters = [
  {
    name: "Woman A",
    role: "Lead",
    locked: true,
    details: "~30, shoulder-length dark hair, light collared button-up shirt, dark pants",
  },
];

export const locations = [
  {
    name: "Apartment A",
    locked: true,
    details: "Small modern apartment, sofa by window, round wooden table, lamp on frame-right",
  },
];

export const props = [
  { name: "Phone A", locked: true },
  { name: "Photo Frame A", locked: true },
  { name: "Keys A", locked: false },
  { name: "Hospital Wristband", locked: false },
];

export const rules = [
  "Woman A keeps the same face, hair, shirt and pants across all shots.",
  "Mother appears only inside Photo Frame A.",
  "Photo Frame A crack pattern never changes.",
  "Hospital wristband appears only in shots 10–12, on the left wrist.",
  "Shots 1–9 are night; shots 10–12 are morning.",
];

export const shots: Shot[] = [
  { id: 1, label: "Voice message", camera: "Extreme close-up", action: "Phone shows a new voice message", time: "Night", status: "canon", continuity: ["Phone A"] },
  { id: 2, label: "Reaction", camera: "Close-up", action: "She listens, worried and disbelieving", time: "Night", status: "canon", continuity: ["Woman A", "Outfit A"] },
  { id: 3, label: "Apartment master", camera: "Medium", action: "Seated on sofa, looking at phone", time: "Night", status: "canon", continuity: ["Woman A", "Apartment A", "Phone A", "Photo Frame A"] },
  { id: 4, label: "Photo frame", camera: "Close-up", action: "Cracked photo of daughter and mother", time: "Night", status: "canon", continuity: ["Photo Frame A"] },
  { id: 5, label: "Incoming call", camera: "Extreme close-up", action: "Incoming call interface", time: "Night", status: "draft", continuity: ["Phone A"] },
  { id: 6, label: "Hesitation", camera: "Close-up", action: "Finger pauses over decline", time: "Night", status: "draft", continuity: ["Phone A"] },
  { id: 7, label: "Answers", camera: "Close-up", action: "Phone at ear, listening silently", time: "Night", status: "draft", continuity: ["Woman A", "Outfit A"] },
  { id: 8, label: "Decision", camera: "Medium", action: "Rises and reaches for keys", time: "Night", status: "draft", continuity: ["Woman A", "Apartment A", "Keys A"] },
  { id: 9, label: "Leaving", camera: "Medium", action: "At open door with phone and keys", time: "Night", status: "planned", continuity: ["Woman A", "Outfit A", "Phone A", "Keys A"] },
  { id: 10, label: "Morning", camera: "Wide", action: "Back on sofa, exhausted", time: "Morning", status: "planned", continuity: ["Woman A", "Apartment A", "Hospital Wristband"] },
  { id: 11, label: "Relief", camera: "Close-up", action: "Listens to a new message", time: "Morning", status: "planned", continuity: ["Woman A", "Phone A", "Hospital Wristband"] },
  { id: 12, label: "Photo settles", camera: "Close-up", action: "Straightens the photo frame", time: "Morning", status: "planned", continuity: ["Photo Frame A", "Hospital Wristband"] },
];
