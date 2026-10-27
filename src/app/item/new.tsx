import { router } from 'expo-router';
import { createItem } from '@/lib/api';
import { ItemForm } from '@/components/ItemForm';

export default function NewItem() {
  return (
    <ItemForm
      submitLabel="Add to inventory"
      onSubmit={async (input) => {
        const item = await createItem(input);
        router.replace({ pathname: '/item/[id]', params: { id: item.id } });
      }}
    />
  );
}
