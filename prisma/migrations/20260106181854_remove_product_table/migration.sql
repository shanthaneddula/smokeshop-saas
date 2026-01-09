-- DropForeignKey
ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "order_items_product_id_fkey";
ALTER TABLE "pos_transaction_items" DROP CONSTRAINT IF EXISTS "pos_transaction_items_product_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "products_master_product_id_idx";
DROP INDEX IF EXISTS "products_barcode_idx";
DROP INDEX IF EXISTS "products_original_barcode_idx";
DROP INDEX IF EXISTS "products_custom_barcode_idx";
DROP INDEX IF EXISTS "products_sku_idx";
DROP INDEX IF EXISTS "products_slug_key";

-- DropTable
DROP TABLE IF EXISTS "products";

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");
CREATE INDEX "pos_transaction_items_product_id_idx" ON "pos_transaction_items"("product_id");

-- AddComment
COMMENT ON COLUMN "order_items"."product_id" IS 'MongoDB _id reference';
COMMENT ON COLUMN "pos_transaction_items"."product_id" IS 'MongoDB _id reference';
