'use client';

import React, { useState, useEffect } from 'react';
import { CartItem } from './QuotationCartTable';

interface EditCartItemModalProps {
  isOpen: boolean;
  item: CartItem | null;
  onClose: () => void;
  onSave: (updatedItem: CartItem) => void;
  currency: string;
}

export const EditCartItemModal: React.FC<EditCartItemModalProps> = ({
  isOpen,
  item,
  onClose,
  onSave,
  currency,
}) => {
  const [formData, setFormData] = useState<CartItem | null>(null);

  useEffect(() => {
    if (item) {
      setFormData({ ...item });
    }
  }, [item]);

  if (!isOpen || !formData) {
    return null;
  }

  const handleInputChange = (field: keyof CartItem, value: any) => {
    setFormData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        [field]: value,
      };
    });
  };

  const handleSave = () => {
    if (formData) {
      onSave(formData);
      onClose();
    }
  };

  const isClassApplicable =
    formData.serviceCategory === 'Trademark';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Edit Cart Item
        </h2>

        <div className="space-y-4 mb-6">
          {/* Item Info - Read Only */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Procedure Name
            </label>
            <input
              type="text"
              value={formData.procedureName}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-600 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Country
            </label>
            <input
              type="text"
              value={formData.countryName}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-600 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Service Category
            </label>
            <input
              type="text"
              value={formData.serviceCategory}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-600 text-sm"
            />
          </div>

          {/* Editable Fields */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Official Fees ({currency})
            </label>
            <input
              type="number"
              value={formData.officialFee}
              onChange={(e) =>
                handleInputChange('officialFee', parseFloat(e.target.value) || 0)
              }
              onFocus={(e) => e.target.select()}
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Government fee</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Attorney Fees ({currency})
            </label>
            <input
              type="number"
              value={formData.attorneyFee}
              onChange={(e) =>
                handleInputChange('attorneyFee', parseFloat(e.target.value) || 0)
              }
              onFocus={(e) => e.target.select()}
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Per mark per class</p>
          </div>

          {isClassApplicable && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Classes
                </label>
                <input
                  type="number"
                  value={formData.numberOfClasses}
                  onChange={(e) =>
                    handleInputChange('numberOfClasses', parseInt(e.target.value) || 0)
                  }
                  onFocus={(e) => e.target.select()}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Class Fees ({currency})
                </label>
                <input
                  type="number"
                  value={formData.classFee}
                  onChange={(e) =>
                    handleInputChange('classFee', parseFloat(e.target.value) || 0)
                  }
                  onFocus={(e) => e.target.select()}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Per class</p>
              </div>
            </>
          )}

          {/* Total Display */}
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-xs text-gray-600 mb-1">Calculated Total:</p>
            <p className="text-lg font-semibold text-gray-900">
              {currency}{' '}
              {(
                formData.officialFee +
                formData.attorneyFee +
                (isClassApplicable && formData.numberOfClasses > 0
                  ? formData.classFee * formData.numberOfClasses
                  : 0)
              ).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
