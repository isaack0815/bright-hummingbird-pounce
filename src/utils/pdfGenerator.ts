import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { FreightOrder } from '@/types/freight';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const agbText = `
1. Vertragsabschluss: Der Vertrag kommt durch die schriftliche Bestätigung des Transportauftrags durch den Transportdienstleister zustande.
2. Haftung: Der Transportdienstleister haftet für Schäden am Transportgut gemäß den gesetzlichen Bestimmungen. Eine Haftung für Folgeschäden wird ausgeschlossen.
3. Lieferzeit: Die angegebenen Lieferzeiten sind bindend. Höhere Gewalt oder unvorhersehbare Ereignisse können zu Verzögerungen führen.
4. Zahlung: Der Auftraggeber verpflichtet sich, den vereinbarten Betrag innerhalb von 60 Tagen nach postalischen erhalt der Originalpapiere (Rechnung, Lieferscheine) zu zahlen.
5. Stornierung: Stornierungen müssen schriftlich erfolgen. Bei Stornierung weniger als 48 Stunden vor der Abholung wird eine Gebühr von 50 % des Auftragswertes fällig. Ebenso ist der Auftraggeber berechtigt den Auftrag bei einem unangekündigten Zeitverzug von mehr als 1 Stunde den Auftrag zu stornieren. Eine Erstattung der bisher angefallen kosten des Auftragnehmers ist nicht möglich.
6. Der Subunternhemer ist nicht berechtigt, die Ladung an Dritte weiterzugeben oder zu verkaufen.
7. Der Subunternehmer ist nicht berechtigt, die Ladung in ein anderes Land zu transportieren, als im Auftrag angegeben. Hier kann eine Sondergenehmigung des Auftraggebers eingeholt werden.
8. Der Subunternhmer ist verpflichtet, die Ladung ordnungsgemäß zu sichern und zu transportieren.
9. Der Subunternehmer ist verpflichtet, die Ladung eigenständig zu prüfen.
10. Wartezeiten: Wartezeiten am Abhol- oder Lieferort werden mit 50 € pro Stunde berechnet ab einer Wartezeit von 5 Stunden, sofern sie nicht im Vorfeld anders vereinbart wurden.
11. Datenschutz: Die Daten des Auftraggebers werden nur zum Zwecke der Auftragsabwicklung gespeichert und nicht an Dritte weitergegeben.
12. Dokumentation: Der Transportdienstleister ist verpflichtet, alle relevanten Dokumente (Lieferscheine, CMR, Rechnungen) ordnungsgemäß zu archivieren.
13. Gerichtsstand: Gerichtsstand ist der Sitz des Transportdienstleisters.
`;

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
  const doc = new jsPDF() as jsPDFWithAutoTable;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 14;

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`Transportauftrag #${order.order_number}`, margin, 22);
  doc.setFont('helvetica', 'normal');

  // Auftraggeber / Auftragnehmer
  doc.autoTable({
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

  doc.autoTable({
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
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Seite ${i} von ${pageCount}`, doc.internal.pageSize.width - 30, pageHeight - 10);
  }

  return doc.output('blob');
};