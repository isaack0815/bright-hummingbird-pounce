import { Card, Spinner, Placeholder, Row, Col } from "react-bootstrap";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { PasswordChangeForm } from "@/components/profile/PasswordChangeForm";

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

  return (
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
        </Col>
        <Col lg={6}>
          <PasswordChangeForm />
        </Col>
      </Row>
    </div>
  );
};

export default DriverProfile;