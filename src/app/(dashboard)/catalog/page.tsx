import { CatalogBrowser } from "@/components/catalog/catalog-browser";

export default function CatalogPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Data Catalog</h1>
        <p className="text-sm text-muted-foreground">
          Browse databases, schemas, tables, and columns
        </p>
      </div>
      <CatalogBrowser />
    </div>
  );
}
