import { Card, Placeholder } from 'react-bootstrap';

type StatCardProps = {
  title: string;
  value: string;
  icon: React.ReactNode;
  isLoading: boolean;
};

export const StatCard = ({ title, value, icon, isLoading }: StatCardProps) => (
  <Card className="shadow-sm h-100">
    <Card.Body>
      <div className="d-flex justify-content-between align-items-start">
        <div>
          <h6 className="card-subtitle mb-2 text-muted">{title}</h6>
          {isLoading ? (
            <Placeholder as="p" animation="glow" className="mt-2">
              <Placeholder xs={6} size="lg" />
            </Placeholder>
          ) : (
            <div className="h3 fw-bold">{value}</div>
          )}
        </div>
        {icon}
      </div>
    </Card.Body>
  </Card>
);