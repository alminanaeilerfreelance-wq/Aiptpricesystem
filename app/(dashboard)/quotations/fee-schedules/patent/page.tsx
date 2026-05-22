'use client';

import React, { useEffect, useState } from 'react';
import Topbar from '@/components/layout/Topbar';
import { Card } from '@/components/ui';
import { proceduresService, Procedure } from '@/services/procedures.service';
import { countriesService, Country } from '@/services/countries.service';
import { pricingRulesService, PricingRule } from '@/services/pricing-rules.service';

const CATEGORY = 'Patent';

function getFlagCode(country: Country): string {
  return country.flagCode;
}

function fmtFee(val: number): string {
  if (val === 0) return '—';
  return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface RuleMap {
  [key: string]: PricingRule;
}

export default function PatentFeeSchedulePage() {
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [ruleMap, setRuleMap] = useState<RuleMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [procData, countryData, rulesData] = await Promise.all([
          proceduresService.list({ category: CATEGORY }),
          countriesService.list(),
          pricingRulesService.list({ category: CATEGORY }),
        ]);

        const rules = rulesData.pricingRules;
        const map: RuleMap = {};
        rules.forEach((rule) => {
          const procKey = (rule.procedureName ?? '').toLowerCase();
          const countryKey = (rule.countryName ?? '').toLowerCase();
          map[`${procKey}|${countryKey}`] = rule;
        });

        setProcedures(procData.procedures);
        setCountries(countryData.countries);
        setRuleMap(map);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load fee schedule');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const getRule = (procedure: Procedure, country: Country): PricingRule | undefined => {
    const key = `${procedure.name.toLowerCase()}|${country.name.toLowerCase()}`;
    return ruleMap[key];
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <Topbar
          title="Patent Fee Schedule"
          breadcrumbs={[{ label: 'Fee Schedules' }, { label: 'Patent' }]}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Patent Fee Schedule"
        breadcrumbs={[{ label: 'Fee Schedules' }, { label: 'Patent' }]}
      />

      <div className="flex-1 p-6 overflow-auto">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {procedures.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-500 text-center py-6">
              No Patent procedures found. Add procedures first.
            </p>
          </Card>
        ) : (
          <Card padding="p-0">
            <div className="overflow-x-auto">
              <table className="border-collapse text-sm" style={{ minWidth: `${procedures.length * 220 + 200}px` }}>
                <thead className="bg-surface">
                  {/* Header Row 1 */}
                  <tr>
                    <th
                      className="table-header text-left sticky left-0 bg-surface z-10 border-r border-border"
                      rowSpan={2}
                      style={{ minWidth: '40px' }}
                    >
                      Flag
                    </th>
                    <th
                      className="table-header text-left sticky left-10 bg-surface z-10 border-r border-border"
                      rowSpan={2}
                      style={{ minWidth: '160px' }}
                    >
                      Country
                    </th>
                    {procedures.map((proc) => (
                      <th
                        key={proc._id}
                        colSpan={3}
                        className="table-header text-center border-l border-border bg-purple-50 text-purple-800"
                      >
                        {proc.name}
                      </th>
                    ))}
                  </tr>

                  {/* Header Row 2 */}
                  <tr>
                    {procedures.map((proc) => (
                      <React.Fragment key={proc._id}>
                        <th className="table-header text-right border-l border-border">
                          Official Fee
                        </th>
                        <th className="table-header text-right">Attorney Fee</th>
                        <th className="table-header text-right border-r border-border font-bold">
                          Total
                        </th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-border bg-white">
                  {countries.length === 0 ? (
                    <tr>
                      <td
                        colSpan={2 + procedures.length * 3}
                        className="table-cell text-center text-gray-400 py-8"
                      >
                        No countries found.
                      </td>
                    </tr>
                  ) : (
                    countries.map((country) => {
                      const flagCode = getFlagCode(country);
                      return (
                        <tr key={country._id} className="hover:bg-surface/60 transition-colors">
                          <td className="table-cell sticky left-0 bg-white z-10 border-r border-border">
                            <img
                              src={`https://flagcdn.com/24x18/${flagCode}.png`}
                              alt={country.name}
                              width={24}
                              height={18}
                              className="rounded-sm"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </td>
                          <td className="table-cell font-medium text-gray-900 sticky left-10 bg-white z-10 border-r border-border whitespace-nowrap">
                            {country.name}
                          </td>
                          {procedures.map((proc) => {
                            const rule = getRule(proc, country);
                            const officialFee = rule?.officialFee ?? 0;
                            const attorneyFee = rule?.attorneyFee ?? 0;
                            const total = officialFee + attorneyFee;
                            return (
                              <React.Fragment key={proc._id}>
                                <td className="table-cell text-right font-mono border-l border-border text-gray-600">
                                  {fmtFee(officialFee)}
                                </td>
                                <td className="table-cell text-right font-mono text-gray-600">
                                  {fmtFee(attorneyFee)}
                                </td>
                                <td className="table-cell text-right font-mono font-bold text-gray-900 border-r border-border">
                                  {fmtFee(total)}
                                </td>
                              </React.Fragment>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
