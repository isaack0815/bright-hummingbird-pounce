import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { showError, showSuccess } from "@/utils/toast"
import type { VehicleNoteCategory } from "@/types/vehicle"
import CreatableSelect from 'react-select/creatable';

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
    },
    onError: (err: any) => showError(err.message || "Fehler beim Erstellen der Kategorie."),
  });

  const options = categories?.map(cat => ({ value: cat.id, label: cat.name })) || [];
  const selectedOption = options.find(opt => opt.value === value);

  const handleCreate = (inputValue: string) => {
    createMutation.mutate(inputValue);
  };

  return (
    <CreatableSelect
      isClearable
      isDisabled={isLoading || createMutation.isPending}
      isLoading={isLoading}
      onChange={(newValue: any) => newValue && onChange(newValue.value)}
      onCreateOption={handleCreate}
      options={options}
      value={selectedOption}
      placeholder="Kategorie auswählen oder erstellen..."
    />
  )
}