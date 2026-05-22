export interface FeeInput {
  governmentFee: number;
  serviceFee: number;
  classFee: number;
  procedureFee: number;
  numberOfClasses: number;
  multiplier: number;
}

export interface FeeResult {
  subtotal: number;
  total: number;
}

export function calculateQuotation(input: FeeInput): FeeResult {
  const subtotal =
    input.governmentFee +
    input.serviceFee +
    input.classFee * input.numberOfClasses +
    input.procedureFee;
  const total = subtotal * input.multiplier;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}
