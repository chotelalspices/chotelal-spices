'use client';
import { useParams } from 'next/navigation';
import ExtendedInventoryForm from '../../ExtendedInventoryForm';

export default function EditExtendedInventoryPage() {
  const params = useParams();
  const id = params?.id as string;
  return <ExtendedInventoryForm mode="edit" itemId={id} />;
}