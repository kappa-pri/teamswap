import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { deleteItem, fetchItem, updateItem } from '@/lib/api';
import type { Item } from '@/lib/types';
import { ItemForm } from '@/components/ItemForm';
import { Button, Empty, Loading } from '@/components/ui';

export default function EditItem() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<Item | null | undefined>(undefined);

  useEffect(() => {
    fetchItem(id).then(setItem, () => setItem(null));
  }, [id]);

  if (item === undefined) return <Loading />;
  if (item === null) return <Empty icon="alert-circle-outline" title="Item not found" />;

  const confirmDelete = () =>
    Alert.alert('Delete item?', `“${item.name}” will be removed from your inventory.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteItem(item.id);
            router.dismissTo('/inventory');
          } catch (e) {
            Alert.alert('Could not delete', (e as Error).message);
          }
        },
      },
    ]);

  return (
    <ItemForm
      initial={item}
      submitLabel="Save changes"
      onSubmit={async (input) => {
        await updateItem(item.id, input);
        router.back();
      }}
      footer={
        <Button
          title="Delete item"
          variant="danger"
          icon="trash-can-outline"
          onPress={confirmDelete}
          disabled={item.qty_pending > 0}
          style={{ marginTop: 14 }}
        />
      }
    />
  );
}
