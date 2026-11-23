import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/auth";
import { createItem } from "@/lib/admin/item-actions";
import { ItemForm } from "@/components/admin/ItemForm";
import { card } from "@/components/admin/styles";

export default async function NewItemPage() {
  await requireAdminPage();
  return (
    <div>
      <Link href="/admin" className="text-sm text-fg-muted hover:text-fg">← All items</Link>
      <h1 className="mt-3 font-display text-4xl">New item</h1>
      <p className="mt-2 text-sm text-fg-muted">Saved as a private draft. Add a cover and files after saving, then publish.</p>
      <div className={`${card} mt-8 p-6`}>
        <ItemForm action={createItem} submitLabel="Create draft" />
      </div>
    </div>
  );
}
