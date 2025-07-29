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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { showError, showSuccess } from "@/utils/toast"
import type { VehicleNoteCategory } from "@/types/vehicle"

const fetchCategories = async (): Promise<VehicleNoteCategory[]> => {
  const { data, error } = await supabase.functions.invoke('get-vehicle-note-categories');
  if (error) throw new Error(error.message);
  return data.categories;
};

type CategoryComboboxProps = {
  value: number | undefined;
  onChange: (value: number) => void;
};

export function CategoryCombobox({ value, onChange }: CategoryComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const queryClient = useQueryClient();

  const { data: categories, isLoading } = useQuery<VehicleNoteCategory[]>({
    queryKey: ['vehicleNoteCategories'],
    queryFn: fetchCategories,
  });

  const createMutation = useMutation({
    mutationFn: async (name: string): Promise<VehicleNoteCategory> => {
      const { data, error } = await supabase.functions.invoke('create-vehicle-note-category', { body: { name } });
      if (error) throw error;
      return data.category;
    },
    onSuccess: (newCategory) => {
      queryClient.invalidateQueries({ queryKey: ['vehicleNoteCategories'] });
      showSuccess("Kategorie erstellt!");
      onChange(newCategory.id);
      setOpen(false);
    },
    onError: (err: any) => showError(err.message || "Fehler beim Erstellen der Kategorie."),
  });

  const selectedCategory = categories?.find((cat) => cat.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={isLoading}
        >
          {selectedCategory ? selectedCategory.name : "Kategorie auswählen..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput 
            placeholder="Kategorie suchen..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              <Button 
                variant="ghost" 
                className="w-full" 
                onClick={() => createMutation.mutate(search)}
                disabled={createMutation.isPending}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Kategorie "{search}" erstellen
              </Button>
            </CommandEmpty>
            <CommandGroup>
              {categories?.map((category) => (
                <CommandItem
                  key={category.id}
                  value={category.name}
                  onSelect={() => {
                    onChange(category.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === category.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {category.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}