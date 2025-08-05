import { useState, useMemo } from 'react';
import { Card, Button, Form, Table } from 'react-bootstrap';
import { PlusCircle, Trash2, Edit } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import { AddCustomerDialog } from '@/components/AddCustomerDialog';
import { EditCustomerDialog } from '@/components/EditCustomerDialog';
import { useError } from '@/contexts/ErrorContext';
import TablePlaceholder from '@/components/TablePlaceholder';
import { NavLink } from 'react-router-dom';
import type { Customer } from "@/types/customer";

export type Customer = {
  id: number;
  lex_id: string | null;
  company_name: string;
  contact_first_name: string | null;
  contact_last_name: string | null;
  email: string | null;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  tax_number: string | null;
  created_at: string;
};

const fetchCustomers = async (): Promise<Customer[]> => {
  const { data, error } = await supabase.functions.invoke('get-customers');
  if (error) throw new Error(error.message);
  return data.customers;
};

const CustomerManagement = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();
  const { addError } = useError();

  const { data: customers, isLoading, error } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: fetchCustomers,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.functions.invoke('delete-customer', { body: { id } });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Kunde erfolgreich gelöscht.");
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: any) => {
      addError(err, 'API');
      showError(err.message || "Fehler beim Löschen des Kunden.");
    },
  });

  const handleEditClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (id: number) => {
    if (window.confirm("Sind Sie sicher, dass Sie diesen Kunden löschen möchten?")) {
      deleteMutation.mutate(id);
    }
  };

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    return customers.filter(customer =>
      customer.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.contact_first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.contact_last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.city?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [customers, searchTerm]);

  if (error) {
    addError(error, 'API');
    showError(`Fehler beim Laden der Kunden: ${error.message}`);
  }

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h1 className="h2">Kundenverwaltung</h1>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <PlusCircle className="me-2" size={16} />
          Kunde hinzufügen
        </Button>
      </div>
      <Card>
        <Card.Header>
          <Card.Title>Kundenliste</Card.Title>
          <Card.Text className="text-muted">Suchen, bearbeiten und verwalten Sie Ihre Kunden.</Card.Text>
        </Card.Header>
        <Card.Body>
          <div className="mb-4">
            <Form.Control
              placeholder="Kunden suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ maxWidth: '24rem' }}
            />
          </div>
          {isLoading ? (
            <TablePlaceholder cols={4} />
          ) : filteredCustomers.length > 0 ? (
            <Table responsive hover>
              <thead>
                <tr>
                  <th>Firma</th>
                  <th>Ansprechpartner</th>
                  <th>Standort</th>
                  <th className="text-end">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="fw-medium">
                      <NavLink to={`/customers/${customer.id}`}>{customer.company_name}</NavLink>
                    </td>
                    <td>{`${customer.contact_first_name || ''} ${customer.contact_last_name || ''}`.trim()}</td>
                    <td>{`${customer.postal_code || ''} ${customer.city || ''}`.trim()}</td>
                    <td className="text-end">
                      <div className="d-flex justify-content-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEditClick(customer)}>
                          <Edit size={16} />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-danger" onClick={() => handleDeleteClick(customer.id)}>
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="text-muted text-center py-4">Keine Kunden gefunden.</p>
          )}
        </Card.Body>
      </Card>
      <AddCustomerDialog show={isAddDialogOpen} onHide={() => setIsAddDialogOpen(false)} />
      <EditCustomerDialog customer={selectedCustomer} show={isEditDialogOpen} onHide={() => setIsEditDialogOpen(false)} />
    </div>
  );
};

export default CustomerManagement;