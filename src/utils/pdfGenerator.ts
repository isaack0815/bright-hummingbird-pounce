import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { FreightOrder } from '@/types/freight';

const hinweisText = `
KEIN PALETTENTAUSCH / NO PALLETS CHANGE
1. IMMER im CMR oder Lieferschein festhalten

Klarheit der Dokumentation
1. Wir verpflichten den Fahrer, das CMR-Dokument sehr deutlich und leserlich in GROSSBUCHSTABEN auszufüllen.
2. Alle Kopien des CMR-Dokuments müssen:
   1. Gut lesbar,
   2. Sauber geschrieben,
   3. Vollständig ausgefüllt sein.
Erforderliche Angaben
1. Die Dokumente müssen folgende Informationen enthalten:
   1. Be- und Entladedatum,
   2. Warenmenge und Gewicht,
   3. Bestätigung der Beladung und Entladung.
Bei fehlerhafter Dokumentation wird eine Bearbeitungsgebühr von 50€ erhoben.
`;

export const generateExternalOrderPDF = (order: FreightOrder, settings: any): Blob => {
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.height;
  const margin = 14;
  const agbText = settings.agb_text || 'Keine AGB konfiguriert.';

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`Transportauftrag #${order.order_number}`, margin, 22);
  doc.setFont('helvetica', 'normal');

  // Auftraggeber / Auftragnehmer
  autoTable(doc, {
    startY: 30,
    body: [
      [
        { content: 'Auftraggeber:', styles: { fontStyle: 'bold' } },
        { content: 'Auftragnehmer:', styles: { fontStyle: 'bold' } },
      ],
      [
        `${settings.company_name || ''}\n${settings.company_address || ''}\n${settings.company_city_zip || ''}\n${settings.company_country || ''}\nUstID: ${settings.company_tax_id || ''}`,
        `${order.external_company_address || ''}`
      ],
    ],
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 1 },
  });

  let lastY = (doc as any).lastAutoTable.finalY + 5;

  // Details
  const details = [
    ['Abholdatum/Abholzeit:', `${order.pickup_date ? new Date(order.pickup_date).toLocaleDateString() : '-'} ${order.pickup_time_start || ''}`],
    ['Absenderadresse:', order.origin_address || ''],
    ['Lieferdatum/Lieferzeit:', `${order.delivery_date ? new Date(order.delivery_date).toLocaleDateString() : '-'} ${order.delivery_time_start || ''}`],
    ['Lieferadresse:', order.destination_address || ''],
    ['Ladung:', order.cargo_items.map(i => i.description).join(', ')],
    ['Gewicht:', `${order.cargo_items.reduce((sum, i) => sum + (i.weight || 0), 0)} kg`],
    ['Lademeter:', `${order.cargo_items.reduce((sum, i) => sum + (i.loading_meters || 0), 0)} m`],
    ['Frachtpreis:', `${order.price?.toFixed(2) || '0.00'} €`],
    ['Zahlungsbedingungen:', `${order.payment_term_days || settings.payment_term_default || '45'} Tage nach Erhalt der Rechnung`],
    ['Fahrername:', order.external_driver_name || ''],
    ['Telefonnummer Fahrer:', order.external_driver_phone || ''],
    ['Fahrzeugkennzeichen:', order.external_license_plate || ''],
    ['Transporter Maße (LxBxH):', order.external_transporter_dimensions || ''],
    ['Beschreibung:', order.description || ''],
  ];

  autoTable(doc, {
    startY: lastY,
    body: details,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 1 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
  });

  lastY = (doc as any).lastAutoTable.finalY + 10;

  // AGB & Hinweise
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('AGB:', margin, lastY);
  doc.setFont('helvetica', 'normal');
  const splitAgb = doc.splitTextToSize(agbText, 180);
  doc.text(splitAgb, margin, lastY + 5);
  lastY = doc.getTextDimensions(splitAgb).h + lastY + 10;

  if (lastY > pageHeight - 60) {
    doc.addPage();
    lastY = margin;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Hinweis:', margin, lastY);
  doc.setFont('helvetica', 'normal');
  const splitHinweis = doc.splitTextToSize(hinweisText, 180);
  doc.text(splitHinweis, margin, lastY + 5);
  lastY = doc.getTextDimensions(splitHinweis).h + lastY + 15;

  if (lastY > pageHeight - 40) {
    doc.addPage();
    lastY = margin;
  }

  doc.text('Unterschrift Auftragnehmer:', margin, lastY);
  doc.line(margin, lastY + 2, margin + 80, lastY + 2);

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Seite ${i} von ${pageCount}`, doc.internal.pageSize.width - 30, pageHeight - 10);
  }

  return doc.output('blob');
};