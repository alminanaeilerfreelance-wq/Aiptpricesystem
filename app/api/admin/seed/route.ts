import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/mongodb';
import Role from '@/models/Role';
import User from '@/models/User';
import Service from '@/models/Service';
import Country from '@/models/Country';
import Procedure from '@/models/Procedure';
import ClientType from '@/models/ClientType';
import PricingRule from '@/models/PricingRule';
import Client from '@/models/Client';
import Quotation from '@/models/Quotation';
import Settings from '@/models/Settings';
import {
  DEFAULT_MODULE_PERMISSIONS,
  flattenModulePermissions,
  type UserRole,
} from '@/lib/permissions';

const SEED_SECRET = process.env.SEED_SECRET || 'your-seed-secret-key-change-in-production';

const USERS = [
  { name: 'Demo Admin', email: 'admin@demo.com', password: 'demo1234', role: 'admin' as UserRole },
  { name: 'Demo User', email: 'user@demo.com', password: 'demo1234', role: 'user' as UserRole },
  { name: 'Admin User', email: 'admin@example.com', password: 'Admin@123456', role: 'admin' as UserRole },
  { name: 'Manager User', email: 'manager@example.com', password: 'Manager@123456', role: 'manager' as UserRole },
  { name: 'Regular User', email: 'user@example.com', password: 'User@123456', role: 'user' as UserRole },
];

const SERVICES = [
  { name: 'Trademark Registration', category: 'Trademark', basePrice: 2500 },
  { name: 'Trademark Renewal', category: 'Trademark', basePrice: 1800 },
  { name: 'Patent Filing', category: 'Patent', basePrice: 5000 },
  { name: 'Design Registration', category: 'Design', basePrice: 1800 },
  { name: 'Copyright Registration', category: 'Copyright', basePrice: 1200 },
  { name: 'IP Litigation', category: 'Litigation', basePrice: 8000 },
];

const COUNTRIES = [
  { name: 'Saudi Arabia', abbreviation: 'SA', flagCode: 'sa' },
  { name: 'United Arab Emirates', abbreviation: 'AE', flagCode: 'ae' },
  { name: 'Kuwait', abbreviation: 'KW', flagCode: 'kw' },
  { name: 'Qatar', abbreviation: 'QA', flagCode: 'qa' },
  { name: 'United States', abbreviation: 'US', flagCode: 'us' },
  { name: 'United Kingdom', abbreviation: 'GB', flagCode: 'gb' },
  { name: 'Germany', abbreviation: 'DE', flagCode: 'de' },
];

const CLIENT_TYPES = [
  { name: 'Standard', description: 'Standard client rate', multiplier: 1 },
  { name: 'Preferred', description: 'Preferred client rate', multiplier: 0.9 },
  { name: 'VIP', description: 'VIP client rate', multiplier: 0.8 },
  { name: 'Government', description: 'Government entity', multiplier: 1.1 },
];

const CLIENTS = [
  { name: 'Al Khaleej Trading Company', email: 'info@alkhaleej.com', country: 'Saudi Arabia', type: 'Direct', status: 'Big' },
  { name: 'TechVision LLC', email: 'legal@techvision.ae', country: 'United Arab Emirates', type: 'Direct', status: 'Big' },
  { name: 'Global Innovations Inc.', email: 'ip@globalinnovations.com', country: 'United States', type: 'Direct', status: 'Big' },
  { name: 'Kuwait Finance House', email: 'legal@kfh.com.kw', country: 'Kuwait', type: 'Direct', status: 'Big' },
];

const PRICING_RULES = [
  { serviceCategory: 'Trademark', procedureName: 'Filing (New Application)', countryName: 'Saudi Arabia', countryAbbreviation: 'SA', officialFee: 1500, attorneyFee: 2000, classFee: 300 },
  { serviceCategory: 'Trademark', procedureName: 'Filing (New Application)', countryName: 'United Arab Emirates', countryAbbreviation: 'AE', officialFee: 1800, attorneyFee: 2200, classFee: 350 },
  { serviceCategory: 'Trademark', procedureName: 'Renewal', countryName: 'United States', countryAbbreviation: 'US', officialFee: 1800, attorneyFee: 2200, classFee: 300 },
  { serviceCategory: 'Patent', procedureName: 'Filing (New Application)', countryName: 'United States', countryAbbreviation: 'US', officialFee: 5000, attorneyFee: 6000, classFee: 0 },
  { serviceCategory: 'Design', procedureName: 'Filing (New Application)', countryName: 'Saudi Arabia', countryAbbreviation: 'SA', officialFee: 1000, attorneyFee: 1500, classFee: 0 },
  { serviceCategory: 'Copyright', procedureName: 'Registration', countryName: 'Saudi Arabia', countryAbbreviation: 'SA', officialFee: 500, attorneyFee: 800, classFee: 0 },
];

const QUOTATIONS = [
  { quotationNo: 'QT-2026-SEED-001', clientName: 'Al Khaleej Trading Company', clientEmail: 'info@alkhaleej.com', clientType: 'Standard', service: 'Trademark', procedure: 'Filing (New Application)', country: 'Saudi Arabia', numberOfClasses: 3, fees: { governmentFee: 1500, serviceFee: 2000, classFee: 300, procedureFee: 0 }, multiplier: 1, status: 'Approved' },
  { quotationNo: 'QT-2026-SEED-002', clientName: 'TechVision LLC', clientEmail: 'legal@techvision.ae', clientType: 'Preferred', service: 'Patent', procedure: 'Filing (New Application)', country: 'United Arab Emirates', numberOfClasses: 1, fees: { governmentFee: 3500, serviceFee: 4500, classFee: 0, procedureFee: 0 }, multiplier: 0.9, status: 'Pending' },
  { quotationNo: 'QT-2026-SEED-003', clientName: 'Global Innovations Inc.', clientEmail: 'ip@globalinnovations.com', clientType: 'VIP', service: 'Trademark', procedure: 'Renewal', country: 'United States', numberOfClasses: 2, fees: { governmentFee: 1800, serviceFee: 2200, classFee: 300, procedureFee: 0 }, multiplier: 0.8, status: 'Approved' },
  { quotationNo: 'QT-2026-SEED-004', clientName: 'Kuwait Finance House', clientEmail: 'legal@kfh.com.kw', clientType: 'Government', service: 'Trademark', procedure: 'Filing (New Application)', country: 'Kuwait', numberOfClasses: 5, fees: { governmentFee: 1400, serviceFee: 1900, classFee: 280, procedureFee: 0 }, multiplier: 1.1, status: 'Draft' },
];

async function upsertRole(role: UserRole, description: string) {
  const modulePermissions = DEFAULT_MODULE_PERMISSIONS[role];
  await Role.findOneAndUpdate(
    { name: role },
    {
      name: role,
      description,
      modulePermissions,
      permissions: flattenModulePermissions(modulePermissions),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (token !== SEED_SECRET) {
      return NextResponse.json({ error: 'Unauthorized - invalid seed secret' }, { status: 401 });
    }

    await connectDB();

    await Promise.all([
      upsertRole('admin', 'Full system access'),
      upsertRole('manager', 'Operational management access'),
      upsertRole('user', 'Basic quotation access'),
    ]);

    for (const seedUser of USERS) {
      await User.findOneAndUpdate(
        { email: seedUser.email },
        {
          name: seedUser.name,
          email: seedUser.email,
          password: await bcrypt.hash(seedUser.password, 12),
          role: seedUser.role,
          isActive: true,
          approvalStatus: 'approved',
        },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
    }

    for (const service of SERVICES) {
      await Service.findOneAndUpdate(
        { name: service.name },
        { ...service, description: service.name, isActive: true },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
    }

    for (const country of COUNTRIES) {
      await Country.findOneAndUpdate(
        { name: country.name },
        { ...country, isActive: true },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
    }

    for (const clientType of CLIENT_TYPES) {
      await ClientType.findOneAndUpdate(
        { name: clientType.name },
        { ...clientType, isActive: true },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
    }

    for (const rule of PRICING_RULES) {
      await PricingRule.findOneAndUpdate(
        {
          serviceCategory: rule.serviceCategory,
          procedureName: rule.procedureName,
          countryName: rule.countryName,
        },
        { ...rule, isActive: true },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
    }

    const trademarkService = await Service.findOne({ category: 'Trademark' });
    const patentService = await Service.findOne({ category: 'Patent' });
    const saudiArabia = await Country.findOne({ name: 'Saudi Arabia' });
    const unitedStates = await Country.findOne({ name: 'United States' });

    const procedureSeeds = [
      { name: 'Filing (New Application)', service: trademarkService, country: saudiArabia },
      { name: 'Renewal', service: trademarkService, country: unitedStates },
      { name: 'Filing (New Application)', service: patentService, country: unitedStates },
    ];

    for (const item of procedureSeeds) {
      if (!item.service || !item.country) continue;
      await Procedure.findOneAndUpdate(
        { name: item.name, serviceId: item.service._id, countryId: item.country._id },
        {
          name: item.name,
          serviceId: item.service._id,
          serviceName: item.service.name,
          serviceCategory: item.service.category,
          countryId: item.country._id,
          countryName: item.country.name,
          isActive: true,
        },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
    }

    for (const client of CLIENTS) {
      await Client.findOneAndUpdate(
        { email: client.email },
        { ...client, isActive: true },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
    }

    await Settings.findOneAndUpdate(
      {},
      {
        companyName: 'AIP&T Law Firm',
        companyEmail: 'info@aiptlaw.com',
        companyPhone: '+966 11 000 0000',
        companyAddress: 'Riyadh, Saudi Arabia',
        currency: 'SAR',
        defaultValidDays: 30,
        termsAndConditions: 'This quotation is valid for the specified number of days from the issue date.',
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    const admin = await User.findOne({ role: 'admin' });
    for (const quotation of QUOTATIONS) {
      const subtotal =
        quotation.fees.governmentFee +
        quotation.fees.serviceFee +
        quotation.fees.classFee * quotation.numberOfClasses +
        quotation.fees.procedureFee;
      const total = subtotal * quotation.multiplier;
      const client = await Client.findOne({ email: quotation.clientEmail });

      await Quotation.findOneAndUpdate(
        { quotationNo: quotation.quotationNo },
        {
          ...quotation,
          clientId: client?._id,
          subtotal,
          total,
          currency: 'SAR',
          validDays: 30,
          createdBy: admin?._id,
          approvedBy: quotation.status === 'Approved' ? admin?._id : undefined,
          approvalDate: quotation.status === 'Approved' ? new Date() : undefined,
        },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Database seed completed successfully',
      data: {
        roles: 3,
        users: USERS.length,
        services: SERVICES.length,
        countries: COUNTRIES.length,
        clientTypes: CLIENT_TYPES.length,
        pricingRules: PRICING_RULES.length,
        clients: CLIENTS.length,
        quotations: QUOTATIONS.length,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Seed failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
