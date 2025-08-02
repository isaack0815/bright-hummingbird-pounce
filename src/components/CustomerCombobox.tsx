import * as React from "react"
import { PlusCircle } from "lucide-react"
import { Button } from "react-bootstrap"
import Select, { components, NoOptionsMessageProps } from 'react-select';
import type { Customer } from "@/pages/CustomerManagement"

type CustomerComboboxProps = {
  customers: Customer[];
  value: number | undefined;
  onChange: (value: number) => void;
  onAddNew: () => void;
};

export function CustomerCombobox({ customers, value, onChange, onAddNew }: CustomerComboboxProps) {
  const options = customers.map(customer => ({
    value: customer.id,
    label: customer.company_name,
  }));

  const selectedOption = options.find(option => option.value === value);

  const NoOptionsMessage = (props: NoOptionsMessageProps) => {
    return (
      <components.NoOptionsMessage {...props}>
        <Button variant="link" className="w-100" onClick={onAddNew}>
            <PlusCircle className="me-2" size={16} />
            Neuen Kunden anlegen
        </Button>
      </components.NoOptionsMessage>
    );
  };

  return (
    <Select
      options={options}
      value={selectedOption}
      onChange={(option) => option && onChange(option.value)}
      placeholder="Kunde auswählen..."
      components={{ NoOptionsMessage }}
      isClearable
    />
  );
}