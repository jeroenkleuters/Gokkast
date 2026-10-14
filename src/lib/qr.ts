// QR-code van een betaallink als plaatje (data-URL met SVG), gemaakt op de server
import QRCode from "qrcode";

export async function qrDataUrl(text: string): Promise<string> {
  const svg = await QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
