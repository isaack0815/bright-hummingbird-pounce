import { useState } from 'react';
import { Card, Spinner, Placeholder, Row, Col, Button } from "react-bootstrap";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PasswordChangeForm } from "@/components/profile/PasswordChangeForm";
import { HeartPulse } from 'lucide-react';
import { ReportSickDialog } from '@/components/driver/ReportSickDialog';
import { showSuccess, showError } from '@/utils/toast';

const fetchMyProfileDetails = async () => {
  const { data, error } = await supabase.functions.invoke('get-my-profile-details');
  if (error) throw error;
  return data.profile;
};

const DriverProfile = () => {
  const { data: userProfile, isLoading } = useQuery({
    queryKey: ['myProfileDetails'],
    queryFn: fetchMyProfileDetails,
  });
  const [showSickReportDialog, setShowSickReportDialog] = useState(false);

  const reportSickMutation = useMutation({
    mutationFn: async (values: { start_date: string; end_date: string }) => {
      const { data, error } = await supabase.functions.invoke('report-sick', {
        body: values,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      showSuccess(data.message);
      setShowSickReportDialog(false);
    },
    onError: (err: any) => {
      showError(err.data?.error || err.message || "Fehler beim Senden der Krankmeldung.");
    },
  });

  return (
    <>
      <div>
        <h1 className="h2 mb-4">Mein Profil</h1>
        <Row className="g-4">
          <Col lg={6}>
            <Card>
              <Card.Header>
                <Card.Title>Profilinformationen</Card.Title>
              </Card.Header>
              <Card.Body>
                {isLoading ? (
                  <Placeholder as="div" animation="glow">
                    <Placeholder xs={6} /> <Placeholder xs={12} />
                    <Placeholder xs={4} /> <Placeholder xs={8} />
                  </Placeholder>
                ) : (
                  <dl className="row">
                    <dt className="col-sm-4">Name</dt>
                    <dd className="col-sm-8">{userProfile?.first_name} {userProfile?.last_name}</dd>

                    <dt className="col-sm-4">E-Mail</dt>
                    <dd className="col-sm-8">{userProfile?.email}</dd>

                    <dt className="col-sm-4">Wochenstunden</dt>
                    <dd className="col-sm-8">{userProfile?.hours_per_week ? `${userProfile.hours_per_week} Stunden` : 'Nicht hinterlegt'}</dd>
                  </dl>
                )}
              </Card.Body>
            </Card>
            <Card className="mt-4">
              <Card.Header><Card.Title>Aktionen</Card.Title></Card.Header>
              <Card.Body>
                <Button variant="outline-danger" onClick={() => setShowSickReportDialog(true)}>
                  <HeartPulse className="me-2" /> Krankmeldung
                </Button>
              </Card.Body>
            </Card>
          </Col>
          <Col lg={6}>
            <PasswordChangeForm />
          </Col>
        </Row>
      </div>
      <ReportSickDialog
        show={showSickReportDialog}
        onHide={() => setShowSickReportDialog(false)}
        onSubmit={(values) => reportSickMutation.mutate(values)}
        isMutating={reportSickMutation.isPending}
      />
    </>
  );
};

export default DriverProfile;