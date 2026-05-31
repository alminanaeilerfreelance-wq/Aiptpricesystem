# Quotation Service Details Enhancement TODO

- [x] Analyze current quotation Service Details implementation and related models
- [ ] Read and confirm supporting services/APIs for requirements + pricing-rule based procedure filtering
- [ ] Implement in `app/(dashboard)/quotations/new/page.tsx`:
  - [ ] service + country => auto-filtered procedures (from pricing rules)
  - [ ] procedure auto-selection when only one match exists
  - [ ] select2-like searchable requirements selector (requirements page data source)
  - [ ] add-to-cart behavior for filled service details
  - [ ] save flow integration
- [ ] Mirror critical parity in `app/(dashboard)/quotations/[id]/edit/page.tsx`
- [ ] Run type/lint checks
- [ ] Update TODO progress

✓ Compiled successfully in 36.6s
  Running TypeScript  ...Failed to type check.

./components/quotations/ServiceDetailsCard.tsx:83:16
Type error: Expected 0-1 arguments, but got 4.

  81 |     setLoadingReqs(true);
  82 |     requirementsService
> 83 |       .list(1, 100, '', countryId)
     |                ^
  84 |       .then((res) => {
  85 |         setRequirements(res.data.data || []);
  86 |       })
Next.js build worker exited with code: 1 and signal: null