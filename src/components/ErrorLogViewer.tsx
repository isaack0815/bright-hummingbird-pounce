import { useError } from '@/contexts/ErrorContext';
import { Button, Offcanvas, Badge } from 'react-bootstrap';
import { Terminal, Trash2 } from 'lucide-react';
import { useState } from 'react';

export function ErrorLogViewer() {
  const { errors, clearErrors } = useError();
  const [show, setShow] = useState(false);

  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  return (
    <>
      <Button variant="ghost" className="w-100 d-flex justify-content-start gap-2" onClick={handleShow}>
        <Terminal size={16} />
        Logs
      </Button>

      <Offcanvas show={show} onHide={handleClose} placement="end">
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Fehler-Logs</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className="d-flex flex-column">
          <div className="flex-grow-1" style={{ overflowY: 'auto' }}>
            {errors.length === 0 ? (
              <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                <p>Bisher keine Fehler aufgetreten.</p>
              </div>
            ) : (
              <div className="d-flex flex-column gap-3">
                {errors.map((error) => (
                  <div key={error.id} className="p-3 rounded border bg-light">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <p className="fw-semibold text-danger small" style={{ wordBreak: 'break-all' }}>{error.message}</p>
                      <Badge bg={error.source === 'UI' ? 'danger' : 'secondary'}>{error.source}</Badge>
                    </div>
                    <p className="small text-muted mb-2">
                      {error.timestamp.toLocaleTimeString()}
                    </p>
                    <pre className="small bg-white p-2 rounded" style={{ overflowX: 'auto' }}>
                      <code>{typeof error.details === 'string' ? error.details : JSON.stringify(error.details, null, 2)}</code>
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-auto pt-3 border-top">
            <Button variant="outline-secondary" onClick={clearErrors} disabled={errors.length === 0}>
              <Trash2 className="me-2" size={16} />
              Logs löschen
            </Button>
          </div>
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}