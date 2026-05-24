'use client';

import React from 'react';
import { Card } from '@/components/ui';

export interface CartItem {
  id: string;
  procedureName: string;
  procedureId: string;
  countryName: string;
  countryId: string;
  serviceCategory:
    | 'Trademark'
    | 'Patent'
    | 'Copyright'
    | 'Design'
    | 'Litigation';
  numberOfClasses: number;
  officialFee: number;
  attorneyFee: number;
  classFee: number;
  requirementIds: string[];
  total: number;
}

interface QuotationCartTableProps {
  items: CartItem[];
  onRemoveItem: (itemId: string) => void;
  onEditItem?: (itemId: string) => void;
  currency: string;
}

const formatCurrency = (amount: number, currency: string): string => {
  return `${currency} ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const QuotationCartTable: React.FC<QuotationCartTableProps> = ({
  items,
  onRemoveItem,
  onEditItem,
  currency,
}) => {
  const calculateTotal = (item: CartItem): number => {
    const classFeesTotal = item.serviceCategory === 'Trademark'
      ? item.classFee * Math.max(1, item.numberOfClasses)
      : 0;
    return item.officialFee + item.attorneyFee + classFeesTotal;
  };

  const grandTotal = items.reduce((sum, item) => sum + calculateTotal(item), 0);

  if (items.length === 0) {
    return (
      <Card>
        <div className="text-center py-8">
          <p className="text-gray-500">No items added to cart yet.</p>
          <p className="text-sm text-gray-400 mt-1">
            Add services from the Service Details section above.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900 mb-4">
        Quotation Items
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                Procedure Name
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">
                Official Fees
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">
                Attorney Fees
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">
                Total
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">
                Actions
              </th>
            </tr>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-500">&nbsp;</th>
              <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-500">per mark per class</th>
              <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-500">per mark per class</th>
              <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-500">per mark per class</th>
              <th className="px-4 py-2 text-center text-[11px] font-medium text-gray-500">&nbsp;</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item, index) => {
              const classFeesTotal = item.serviceCategory === 'Trademark'
                ? item.classFee * Math.max(1, item.numberOfClasses)
                : 0;
              const itemTotal = calculateTotal(item);

              return (
                <tr key={item.id || index} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium text-gray-900">{item.procedureName}</div>
                    <div className="text-xs text-gray-500">
                      {item.countryName} | {item.serviceCategory}
                      {item.serviceCategory === 'Trademark' ? ` | ${item.numberOfClasses} class(es)` : ''}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-sm text-right text-gray-900">
                    <div>{formatCurrency(item.officialFee, currency)}</div>
                    {item.serviceCategory === 'Trademark' && (
                      <div className="text-xs text-gray-500">+ class fees: {formatCurrency(classFeesTotal, currency)}</div>
                    )}
                    <div className="text-xs text-gray-500">government fees</div>
                  </td>

                  <td className="px-4 py-3 text-sm text-right text-gray-900">
                    <div>{formatCurrency(item.attorneyFee, currency)}</div>
                    <div className="text-xs text-gray-500">atty fees</div>
                  </td>

                  <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                    <div>{formatCurrency(itemTotal, currency)}</div>
                    <div className="text-xs font-normal text-gray-500">total</div>
                  </td>

                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      {onEditItem && (
                        <button
                          type="button"
                          onClick={() => onEditItem(item.id)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.id)}
                        className="text-red-600 hover:text-red-800 text-xs font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>

          <tfoot>
            <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
              <td colSpan={3} className="px-4 py-3 text-right">
                Grand Total:
              </td>
              <td className="px-4 py-3 text-right text-gray-900">
                {formatCurrency(grandTotal, currency)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
};

export default QuotationCartTable;
