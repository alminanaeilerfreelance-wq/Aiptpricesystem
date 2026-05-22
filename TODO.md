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
