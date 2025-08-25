-- Custom Transaction ID Implementation
-- Change transaction ID from CUID to custom format TXMP-XXX

-- Create a sequence for transaction numbering starting from 101
CREATE SEQUENCE IF NOT EXISTS transaction_sequence START 101;

-- Add a new column for the custom transaction ID
ALTER TABLE "transactions" ADD COLUMN "customId" VARCHAR(20);

-- Create a function to generate custom transaction IDs
CREATE OR REPLACE FUNCTION generate_transaction_id() RETURNS VARCHAR(20) AS $$
DECLARE
    next_val INTEGER;
BEGIN
    SELECT nextval('transaction_sequence') INTO next_val;
    RETURN 'TXMP-' || next_val;
END;
$$ LANGUAGE plpgsql;

-- Update existing transactions with custom IDs (if any exist)
UPDATE "transactions" SET "customId" = generate_transaction_id() WHERE "customId" IS NULL;

-- Make the customId column NOT NULL
ALTER TABLE "transactions" ALTER COLUMN "customId" SET NOT NULL;

-- Create unique index on customId
CREATE UNIQUE INDEX "transactions_customId_key" ON "transactions"("customId");

-- Note: We keep the original 'id' column as CUID for internal references
-- The 'customId' will be used for user-facing transaction IDs