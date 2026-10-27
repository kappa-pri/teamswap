import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { deleteWishlistEntry, fetchWishlistEntry, updateWishlistEntry } from '@/lib/api';
import type { WishlistEntry } from '@/lib/types';
import { WishlistForm } from '@/components/WishlistForm';
import { Button, Empty, Loading } from '@/components/ui';

export default function EditWishlistEntry() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [entry, setEntry] = useState<WishlistEntry | null | undefined>(undefined);

  useEffect(() => {
    fetchWishlistEntry(id).then(setEntry, () => setEntry(null));
  }, [id]);

  if (entry === undefined) return <Loading />;
  if (entry === null) {
    return <Empty icon="star-off-outline" title="Entry not found" body="It may have passed its need-by date." />;
  }

  const confirmDelete = () =>
    Alert.alert('Delete from wishlist?', `“${entry.name}” will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWishlistEntry(entry.id);
            router.dismissTo('/wishlist');
          } catch (e) {
            Alert.alert('Could not delete', (e as Error).message);
          }
        },
      },
    ]);

  return (
    <WishlistForm
      initial={entry}
      submitLabel="Save changes"
      onSubmit={async (input) => {
        await updateWishlistEntry(entry.id, input);
        router.back();
      }}
      footer={
        <Button
          title="Delete from wishlist"
          variant="danger"
          icon="trash-can-outline"
          onPress={confirmDelete}
          style={{ marginTop: 12 }}
        />
      }
    />
  );
}
