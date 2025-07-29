import * as React from "react"
import { Check, ChevronsUpDown, PlusCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { Customer } from "@/pages/CustomerManagement"

type CustomerComboboxProps = {
  customers: Customer[];
  value: number | undefined;
  onChange: (value: number) => void;
  onAddNew: () => void;
};

export function CustomerCombobox({ customers, value, onChange, onAddNew }: CustomerComboboxProps) {
  const [open, setOpen] = React.useState(false)

  const selectedCustomer = customers.find(
    (customer) => customer.id === value
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedCustomer
            ? selectedCustomer.company_name
            : "Kunde auswählen..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Kunde suchen..." />
          <CommandList>
            <CommandEmpty>
                <Button variant="ghost" className="w-full" onClick={() => {
                    setOpen(false);
                    onAddNew();
                }}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Neuen Kunden anlegen
                </Button>
            </CommandEmpty>
            <CommandGroup>
              {customers.map((customer) => (
                <CommandItem
                  key={customer.id}
                  value={customer.company_name}
                  onSelect={() => {
                    onChange(customer.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === customer.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {customer.company_name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}