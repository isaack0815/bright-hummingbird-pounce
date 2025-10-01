import { PlusCircle } from "lucide-react"
import { Button } from "react-bootstrap"
import Select, { components, NoticeProps } from 'react-select';
import type { Customer } from "@/pages/CustomerManagement"

type CustomerComboboxProps = {
  customers: Customer[];
  value: number | undefined;
  onChange: (value: number) => void;
  onAddNew: () => void;
};

type OptionType = {
  value: number;
  label: string;
};

export function CustomerCombobox({ customers, value, onChange, onAddNew }: CustomerComboboxProps) {
  const options: OptionType[] = customers.map(customer => ({
    value: customer.id,
    label: customer.company_name,
  }));

  const selectedOption = options.find(option => option.value === value);

  const NoOptionsMessage = (props: NoticeProps<OptionType>) => {
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
    <Select<OptionType>
      options={options}
      value={selectedOption}
      onChange={(option: OptionType | null) => option && onChange(option.value)}
      placeholder="Kunde auswählen..."
      components={{ NoOptionsMessage }}
      isClearable
    />
  );
}