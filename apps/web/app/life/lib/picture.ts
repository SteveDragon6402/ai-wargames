export type PictureFrame = "figure" | "place";

export const PICTURE_STYLE = `Create an image of this scene as oil on oak panel in the manner of Early Netherlandish painting and Pieter Bruegel the Elder: thin glazes, visible bristle, craquelure, bone black, yellow ochre, terre verte, madder, and lead white. One light, either a high grey sky or a cold window. Cloth and weather move. Faces are specific, not beautiful. This is a painted page from a princely chronicle, not concept art, not a film still, not a photograph, not digital illustration. The painted surface is the whole frame.`;

export function composeImagePrompt(scene: string, frame: PictureFrame): string {
  const trimmed = scene.replace(/\s+/g, " ").trim().slice(0, 1200);
  const crop =
    frame === "figure"
      ? "Frame it as a 4:5 portrait. Close crop: the person fills most of the panel, edges cut, low three-quarter view, caught mid-stride or mid-gesture."
      : "Frame it as a 3:2 landscape. Wide place: a road, hall, yard, or shore holding the panel, people small in the weather, one strong diagonal.";
  return `${PICTURE_STYLE}

${crop}

The scene: ${trimmed}`;
}

export function pictureFrameAt(index: number): PictureFrame {
  return index === 0 ? "figure" : "place";
}
