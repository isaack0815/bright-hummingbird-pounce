import { Table } from 'react-bootstrap';

export const SampleDataPreview = () => (
  <>
    <p className="small text-muted">
      Stellen Sie sicher, dass Ihre XLSX-Datei wie eine Tabelle aufgebaut ist. Die erste Zeile muss die Spaltenüberschriften enthalten. Jede weitere Zeile ist ein Auftrag.
    </p>
    <Table bordered size="sm" responsive>
      <thead>
        <tr className="table-light">
          <th>Auftrags-Nr.</th>
          <th>Straße</th>
          <th>PLZ</th>
          <th>Stadt</th>
          <th>Ladetag</th>
          <th>Preis</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>EXT-123</td>
          <td>Musterstraße 1</td>
          <td>12345</td>
          <td>Musterstadt</td>
          <td>2024-10-26</td>
          <td>450.50</td>
        </tr>
        <tr>
          <td>EXT-124</td>
          <td>Beispielweg 22</td>
          <td>54321</td>
          <td>Beispielhausen</td>
          <td>2024-10-27</td>
          <td>320.00</td>
        </tr>
      </tbody>
    </Table>
    <p className="small text-muted mt-2">
      Für eine Adresse, die über die Spalten "Straße", "PLZ" und "Stadt" verteilt ist, können Sie im Mapping-Schritt alle drei Spalten für das Feld "Abholadresse" auswählen.
    </p>
  </>
);