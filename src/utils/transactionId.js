import prisma from "./prisma.js";

/**
 * Generate next custom transaction ID in format TXMP-XXX
 * Uses PostgreSQL sequence to ensure unique incremental IDs
 * @returns {Promise<string>} Custom transaction ID (e.g., "TXMP-101")
 */
const generateTransactionId = async () => {
  try {
    // Use raw SQL to call the PostgreSQL function
    const result =
      await prisma.$queryRaw`SELECT generate_transaction_id() as id`;
    return result[0].id;
  } catch (error) {
    // Fallback: if sequence doesn't exist, create it and try again
    try {
      await prisma.$executeRaw`CREATE SEQUENCE IF NOT EXISTS transaction_sequence START 101`;
      await prisma.$executeRaw`
        CREATE OR REPLACE FUNCTION generate_transaction_id() RETURNS VARCHAR(20) AS $$
        DECLARE
            next_val INTEGER;
        BEGIN
            SELECT nextval('transaction_sequence') INTO next_val;
            RETURN 'TXMP-' || next_val;
        END;
        $$ LANGUAGE plpgsql;
      `;

      // Try again after creating sequence and function
      const result =
        await prisma.$queryRaw`SELECT generate_transaction_id() as id`;
      return result[0].id;
    } catch (fallbackError) {
      // Ultimate fallback: generate manually
      const lastTransaction = await prisma.transaction.findFirst({
        where: {
          customId: {
            startsWith: "TXMP-",
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          customId: true,
        },
      });

      let nextNumber = 101;
      if (lastTransaction && lastTransaction.customId) {
        const currentNumber = parseInt(
          lastTransaction.customId.replace("TXMP-", "")
        );
        nextNumber = currentNumber + 1;
      }

      return `TXMP-${nextNumber}`;
    }
  }
};

/**
 * Validate transaction ID format
 * @param {string} transactionId - Transaction ID to validate
 * @returns {boolean} True if valid format
 */
const validateTransactionId = (transactionId) => {
  const pattern = /^TXMP-\d+$/;
  return pattern.test(transactionId);
};

/**
 * Extract number from transaction ID
 * @param {string} transactionId - Transaction ID (e.g., "TXMP-101")
 * @returns {number} Extracted number (e.g., 101)
 */
const extractTransactionNumber = (transactionId) => {
  if (!validateTransactionId(transactionId)) {
    throw new Error("Invalid transaction ID format");
  }
  return parseInt(transactionId.replace("TXMP-", ""));
};

export default {
  generateTransactionId,
  validateTransactionId,
  extractTransactionNumber,
};
