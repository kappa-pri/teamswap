import { router } from 'expo-router';
import { createWishlistEntry } from '@/lib/api';
import { WishlistForm } from '@/components/WishlistForm';

export default function AddToWishlist() {
  return (
    <WishlistForm
      submitLabel="Add to wishlist"
      onSubmit={async (input) => {
        await createWishlistEntry(input);
        router.back();
      }}
    />
  );
}
