import { Table, Placeholder } from 'react-bootstrap';

const TablePlaceholder = ({ rows = 5, cols = 5 }: { rows?: number, cols?: number }) => (
  <Table responsive>
    <thead>
      <tr>
        {Array.from({ length: cols }).map((_, i) => (
          <th key={i}><Placeholder animation="glow"><Placeholder xs={Math.floor(Math.random() * 4) + 4} /></Placeholder></th>
        ))}
      </tr>
    </thead>
    <tbody>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j}><Placeholder animation="glow"><Placeholder xs={Math.floor(Math.random() * 6) + 6} /></Placeholder></td>
          ))}
        </tr>
      ))}
    </tbody>
  </Table>
);

export default TablePlaceholder;