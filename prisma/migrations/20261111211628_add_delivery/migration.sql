-- AlterEnum
ALTER TYPE "ServiceType" ADD VALUE 'DELIVERY';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customerPhone" TEXT,
ADD COLUMN     "deliveryAddress" TEXT,
ADD COLUMN     "deliveryComplement" TEXT,
ADD COLUMN     "deliveryFee" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deliveryNeighborhood" TEXT,
ADD COLUMN     "deliveryNumber" TEXT,
ADD COLUMN     "deliveryReference" TEXT;
