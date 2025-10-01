import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { FreightOrder } from '@/types/freight';
import type { Customer } from '@/pages/CustomerManagement';

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
   1. Be- und Entladatum,
   2. Warenmenge und Gewicht,
   3. Bestätigung der Beladung und Entladung.
Bei fehlerhafter Dokumentation wird eine Bearbeitungsgebühr von 50€ erhoben.
`;

export const generateExternalOrderPDF = (order: FreightOrder, settings: any, version?: number): Blob => {
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const agbText = settings.agb_text || 'Keine AGB konfiguriert.';

  // Header
  const title = version ? `Transportauftrag #${order.order_number} (Version ${version})` : `Transportauftrag #${order.order_number}`;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, 22);
  doc.setFont('helvetica', 'normal');

  // Auftragnehmer-Adresse mit Steuernummer zusammenbauen
  const auftragnehmerAddress = [
    order.external_company_address || '',
    order.external_tax_number ? `Ust-IdNr.: ${order.external_tax_number}` : ''
  ].filter(Boolean).join('\n');

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
        auftragnehmerAddress
      ],
    ],
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 1 },
  });

  let lastY = (doc as any).lastAutoTable.finalY + 5;

  // Dynamically create stop details
  const stopDetails: string[][] = [];
  if (order.freight_order_stops && order.freight_order_stops.length > 0) {
    const sortedStops = [...order.freight_order_stops].sort((a, b) => a.position - b.position);
    sortedStops.forEach(stop => {
      const dateStr = stop.stop_date ? new Date(stop.stop_date).toLocaleDateString('de-DE') : '-';
      const timeStr = stop.time_start || '';
      stopDetails.push([`${stop.stop_type} Datum/Zeit:`, `${dateStr} ${timeStr}`.trim()]);
      stopDetails.push([`${stop.stop_type} Adresse:`, stop.address || '']);
    });
  }

  // Details
  const details = [
    ...stopDetails,
    ['Ladung:', order.cargo_items.map(i => i.description).join(', ')],
    ['Gewicht:', `${order.cargo_items.reduce((sum, i) => sum + (i.weight || 0), 0)} kg`],
    ['Lademeter:', `${order.cargo_items.reduce((sum, i) => sum + (i.loading_meters || 0), 0)} m`],
    ['Frachtpreis:', `${order.external_price?.toFixed(2) || '0.00'} €`],
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

  // AGB & Hinweise with proper page break handling
  doc.setFontSize(10);

  // AGB
  const agbTitleHeight = 5;
  const splitAgb = doc.splitTextToSize(agbText, contentWidth);
  const agbHeight = doc.getTextDimensions(splitAgb).h;
  if (lastY + agbTitleHeight + agbHeight > pageHeight - margin) {
    doc.addPage();
    lastY = margin;
  }
  doc.setFont('helvetica', 'bold');
  doc.text('AGB:', margin, lastY);
  lastY += agbTitleHeight;
  doc.setFont('helvetica', 'normal');
  doc.text(splitAgb, margin, lastY);
  lastY += agbHeight + 10;

  // Hinweise
  const hinweisTitleHeight = 5;
  const splitHinweis = doc.splitTextToSize(hinweisText.trim(), contentWidth);
  const hinweisHeight = doc.getTextDimensions(splitHinweis).h;
  if (lastY + hinweisTitleHeight + hinweisHeight > pageHeight - margin) {
    doc.addPage();
    lastY = margin;
  }
  doc.setFont('helvetica', 'bold');
  doc.text('Hinweis:', margin, lastY);
  lastY += hinweisTitleHeight;
  doc.setFont('helvetica', 'normal');
  doc.text(splitHinweis, margin, lastY);
  lastY += hinweisHeight + 15;

  // Unterschrift
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
    doc.text(`Seite ${i} von ${pageCount}`, pageWidth - 30, pageHeight - 10);
  }

  return doc.output('blob');
};

export const generateCollectiveInvoicePDF = (orders: FreightOrder[], customer: Customer, settings: any): Blob => {
  const doc = new jsPDF();
  const margin = 14;
  const today = new Date();
  const invoiceNumber = `SR-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${customer.id}`;
  const paymentTermDays = settings.payment_term_default || 45;

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Sammelrechnung', margin, 22);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${settings.company_name || ''} • ${settings.company_address || ''} • ${settings.company_city_zip || ''}`, margin, 30);

  // Customer Address & Invoice Details
  const customerAddress = `${customer.company_name}\n${customer.street || ''} ${customer.house_number || ''}\n${customer.postal_code || ''} ${customer.city || ''}`;
  autoTable(doc, {
    startY: 40,
    body: [
      [
        { content: customerAddress, styles: { halign: 'left' } },
        { content: `Rechnungsnummer: ${invoiceNumber}\nDatum: ${today.toLocaleDateString('de-DE')}\nKundennummer: ${customer.id}`, styles: { halign: 'right' } },
      ],
    ],
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 1 },
  });

  let lastY = (doc as any).lastAutoTable.finalY + 10;

  // Invoice Items Table
  const tableBody = orders.map(order => [
    order.order_number,
    order.pickup_date ? new Date(order.pickup_date).toLocaleDateString('de-DE') : '-',
    order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('de-DE') : '-',
    `${order.origin_address || ''} -> ${order.destination_address || ''}`,
    `${order.price?.toFixed(2) || '0.00'} €`,
  ]);

  autoTable(doc, {
    startY: lastY,
    head: [['Auftragsnr.', 'Abholdatum', 'Lieferdatum', 'Strecke', 'Preis (Netto)']],
    body: tableBody,
    theme: 'striped',
    headStyles: { fillColor: [41, 128, 185] },
  });

  lastY = (doc as any).lastAutoTable.finalY;

  // Totals
  const netTotal = orders.reduce((sum, order) => sum + (order.price || 0), 0);
  const vatAmount = netTotal * 0.19;
  const grossTotal = netTotal + vatAmount;

  autoTable(doc, {
    startY: lastY + 5,
    body: [
      ['Summe (Netto)', `${netTotal.toFixed(2)} €`],
      ['MwSt. (19%)', `${vatAmount.toFixed(2)} €`],
      [{ content: 'Gesamtbetrag (Brutto)', styles: { fontStyle: 'bold' } }, { content: `${grossTotal.toFixed(2)} €`, styles: { fontStyle: 'bold' } }],
    ],
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: { 0: { halign: 'right' }, 1: { halign: 'right' } },
    tableWidth: 'wrap',
    margin: { left: doc.internal.pageSize.width - 80 },
  });

  lastY = (doc as any).lastAutoTable.finalY + 15;

  // Payment Terms
  doc.setFontSize(10);
  doc.text(`Zahlungsbedingungen: ${paymentTermDays} Tage netto.`, margin, lastY);
  doc.text(`Bitte überweisen Sie den Gesamtbetrag auf das unten angegebene Konto.`, margin, lastY + 5);

  // Bank Details
  doc.setFontSize(8);
  doc.text(`Bankverbindung: ${settings.bank_name || ''} | IBAN: ${settings.bank_iban || ''} | BIC: ${settings.bank_bic || ''}`, margin, doc.internal.pageSize.height - 20);
  doc.text(`Steuernummer: ${settings.company_tax_id || ''} | USt-IdNr.: ${settings.company_vat_id || ''}`, margin, doc.internal.pageSize.height - 15);

  return doc.output('blob');
};