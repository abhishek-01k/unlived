import { extractText, getDocumentProxy } from "unpdf";

export async function pdfToText(data: ArrayBuffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const { text } = await extractText(pdf, { mergePages: true });
  return text.trim();
}
