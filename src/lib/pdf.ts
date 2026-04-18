import { jsPDF } from "jspdf";
import QRCode from "qrcode";

export async function generateCoverSheetPDF(opts: {
  projectName: string;
  siteAddress?: string | null;
  description?: string | null;
  qrUrl: string;
  drawingName: string;
}): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Header bar
  doc.setFillColor(20, 36, 64); // primary navy
  doc.rect(0, 0, pageW, 90, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("SITE SYNC", 40, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Project Drawing Cover Sheet", 40, 70);

  // Project info
  doc.setTextColor(20, 36, 64);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text(opts.projectName, 40, 150, { maxWidth: pageW - 80 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(80, 80, 80);
  let y = 190;
  if (opts.siteAddress) {
    doc.text("Site: " + opts.siteAddress, 40, y, { maxWidth: pageW - 80 });
    y += 22;
  }
  doc.text("Drawing: " + opts.drawingName, 40, y, { maxWidth: pageW - 80 });
  y += 22;
  if (opts.description) {
    doc.text(opts.description, 40, y, { maxWidth: pageW - 80 });
  }

  // QR Code
  const qrDataUrl = await QRCode.toDataURL(opts.qrUrl, { width: 600, margin: 1, errorCorrectionLevel: "H" });
  const qrSize = 240;
  const qrX = (pageW - qrSize) / 2;
  const qrY = pageH / 2 - qrSize / 2 + 30;
  doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

  // Caption under QR
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20, 36, 64);
  doc.text("Scan to access this project", pageW / 2, qrY + qrSize + 30, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text("Updates · Notes · Voice transcriptions · Drawings", pageW / 2, qrY + qrSize + 48, {
    align: "center",
  });

  // Footer
  doc.setFillColor(245, 178, 36); // accent
  doc.rect(0, pageH - 24, pageW, 24, "F");
  doc.setFontSize(9);
  doc.setTextColor(20, 36, 64);
  doc.text(opts.qrUrl, 40, pageH - 8);

  return doc.output("blob");
}
