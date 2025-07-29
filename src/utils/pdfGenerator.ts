import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { FreightOrder } from '@/types/freight';

// Erweitert jsPDF um das autoTable-Plugin
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

export const generateOrderPDF = (order: FreightOrder) => {
  const doc = new jsPDF() as jsPDFWithAutoTable;

  // Titel
  doc.setFontSize(20);
  doc.text(`Frachtauftrag: ${order.order_number}`, 14, 22);

  // Auftragsdetails
  doc.setFontSize(12);
  doc.text(`Status: ${order.status}`, 14, 32);
  doc.text(`Kunde: ${order.customers?.company_name || 'N/A'}`, 14, 38);
  if (order.external_order_number) {
    doc.text(`Externe Ref.: ${order.external_order_number}`, 14, 44);
  }
  if (order.price) {
    doc.text(`Preis: ${order.price.toFixed(2)} €`, 14, 50);
  }

  // Stopps-Tabelle
  const stopData = order.freight_order_stops.map(stop => [
    stop.position + 1,
    stop.stop_type,
    stop.address,
    stop.stop_date ? new Date(stop.stop_date).toLocaleDateString() : '-',
    `${stop.time_start || ''} - ${stop.time_end || ''}`
  ]);

  doc.autoTable({
    startY: 60,
    head: [['#', 'Art', 'Adresse', 'Datum', 'Zeitfenster']],
    body: stopData,
    headStyles: { fillColor: [38, 43, 51] },
  });

  // Ladungs-Tabelle
  const cargoData = order.cargo_items.map(item => [
    item.quantity,
    item.cargo_type,
    item.description,
    item.weight ? `${item.weight} kg` : '-',
    item.loading_meters ? `${item.loading_meters} m` : '-'
  ]);

  if (cargoData.length > 0) {
    doc.autoTable({
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [['Anzahl', 'Art', 'Bezeichnung', 'Gewicht', 'Lademeter']],
        body: cargoData,
        headStyles: { fillColor: [38, 43, 51] },
    });
  }
  
  // Beschreibung/Notizen
  if (order.description) {
    const startY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 15 : 80;
    doc.setFontSize(12);
    doc.text('Beschreibung / Notizen:', 14, startY);
    const splitDescription = doc.splitTextToSize(order.description, 180);
    doc.text(splitDescription, 14, startY + 7);
  }

  // Fußzeile
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.text(`Seite ${i} von ${pageCount}`, doc.internal.pageSize.width - 35, doc.internal.pageSize.height - 10);
    doc.text(`Erstellt am: ${new Date().toLocaleString()}`, 14, doc.internal.pageSize.height - 10);
  }

  // PDF speichern
  doc.save(`Frachtauftrag_${order.order_number}.pdf`);
};