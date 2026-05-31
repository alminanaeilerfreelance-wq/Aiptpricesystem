import { connectDB } from '@/lib/mongodb';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import Role from '@/models/Role';
import User from '@/models/User';
import Service from '@/models/Service';
import Country from '@/models/Country';
import Procedure from '@/models/Procedure';
import ClientType from '@/models/ClientType';
import PricingRule from '@/models/PricingRule';
import Client from '@/models/Client';
import Quotation from '@/models/Quotation';

// Protect this endpoint with a secret token
const SEED_SECRET = process.env.SEED_SECRET || 'your-seed-secret-key-change-in-production';

export async function POST(req: NextRequest) {
  try {
    // Verify secret token for security
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (token !== SEED_SECRET) {
      return NextResponse.json(
        { error: '❌ Unauthorized - Invalid seed secret' },
        { status: 401 }
      );
    }

    // Connect to database
    await connectDB();

    console.log('🌱 IP Law Firm — API Database Seed');

    // ─── Create Roles ─────────────────────────────────────────────────────
    const adminRole = await Role.findOneAndUpdate(
      { name: 'admin' },
      {
        name: 'admin',
        description: 'Administrator with full access',
        permissions: [
          'view_dashboard',
          'manage_users',
          'manage_roles',
          'create_quotation',
          'view_quotation',
          'edit_quotation',
          'approve_quotation',
          'delete_quotation',
          'view_reports',
          'manage_clients',
          'manage_services',
          'manage_settings',
          'manage_departments',
          'manage_countries',
          'manage_pricing',
          'export_data',
        ],
      },
      { upsert: true, new: true }
    );

    const managerRole = await Role.findOneAndUpdate(
      { name: 'manager' },
      {
        name: 'manager',
        description: 'Manager with mid-level access',
        permissions: [
          'view_dashboard',
          'create_quotation',
          'view_quotation',
          'edit_quotation',
          'approve_quotation',
          'view_reports',
          'manage_clients',
          'manage_services',
        ],
      },
      { upsert: true, new: true }
    );

    const userRole = await Role.findOneAndUpdate(
      { name: 'user' },
      {
        name: 'user',
        description: 'Regular user with limited access',
        permissions: ['view_dashboard', 'create_quotation', 'view_quotation', 'view_reports'],
      },
      { upsert: true, new: true }
    );

    console.log('🔐 Roles created/updated');

    // ─── Create Users ──────────────────────────────────────────────────────
    const users = [
      {
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'Admin@123456',
        role: 'admin',
        approvalStatus: 'approved',
      },
      {
        name: 'Manager User',
        email: 'manager@example.com',
        password: 'Manager@123456',
        role: 'manager',
        approvalStatus: 'approved',
      },
      {
        name: 'Regular User',
        email: 'user@example.com',
        password: 'User@123456',
        role: 'user',
        approvalStatus: 'approved',
      },
      {
        name: 'Pending User',
        email: 'pending@example.com',
        password: 'Pending@123456',
        role: 'user',
        approvalStatus: 'pending',
      },
    ];

    for (const userData of users) {
      await User.findOneAndUpdate(
        { email: userData.email },
        {
          name: userData.name,
          email: userData.email,
          password: userData.password,
          role: userData.role as any,
          approvalStatus: userData.approvalStatus as any,
          isActive: true,
        },
        { upsert: true, new: true }
      );
    }

    console.log('👤 Users created/updated');

    // ─── Create Services ──────────────────────────────────────────────────
    const services = [
      {
        name: 'Trademark Registration',
        description: 'Register and protect your brand',
        category: 'Trademark',
        basePrice: 500,
      },
      {
        name: 'Trademark Renewal',
        description: 'Renew existing trademark registration',
        category: 'Trademark',
        basePrice: 350,
      },
      {
        name: 'Patent Filing',
        description: 'File patent application for your invention',
        category: 'Patent',
        basePrice: 1500,
      },
      {
        name: 'Patent Search',
        description: 'Search existing patents',
        category: 'Patent',
        basePrice: 800,
      },
      {
        name: 'Copyright Registration',
        description: 'Register copyright for your work',
        category: 'Copyright',
        basePrice: 300,
      },
      {
        name: 'Design Registration',
        description: 'Register industrial design',
        category: 'Design',
        basePrice: 400,
      },
      {
        name: 'Litigation Support',
        description: 'IP litigation support services',
        category: 'Litigation',
        basePrice: 2000,
      },
      {
        name: 'IP Consultation',
        description: 'General IP consultation',
        category: 'Trademark',
        basePrice: 250,
      },
    ];

    for (const service of services) {
      await Service.findOneAndUpdate(
        { name: service.name },
        {
          name: service.name,
          description: service.description,
          category: service.category as any,
          basePrice: service.basePrice,
          isActive: true,
        },
        { upsert: true, new: true }
      );
    }

    console.log('⚙️ Services created/updated');

    // ─── Create Countries ──────────────────────────────────────────────────
    const countries = [
      { name: 'United Arab Emirates', abbreviation: 'AE', flagCode: 'ae' },
      { name: 'Saudi Arabia', abbreviation: 'SA', flagCode: 'sa' },
      { name: 'Kuwait', abbreviation: 'KW', flagCode: 'kw' },
      { name: 'Qatar', abbreviation: 'QA', flagCode: 'qa' },
      { name: 'Bahrain', abbreviation: 'BH', flagCode: 'bh' },
      { name: 'Oman', abbreviation: 'OM', flagCode: 'om' },
      { name: 'United States', abbreviation: 'US', flagCode: 'us' },
      { name: 'United Kingdom', abbreviation: 'GB', flagCode: 'gb' },
      { name: 'Germany', abbreviation: 'DE', flagCode: 'de' },
      { name: 'France', abbreviation: 'FR', flagCode: 'fr' },
      { name: 'China', abbreviation: 'CN', flagCode: 'cn' },
      { name: 'Japan', abbreviation: 'JP', flagCode: 'jp' },
      { name: 'India', abbreviation: 'IN', flagCode: 'in' },
      { name: 'Singapore', abbreviation: 'SG', flagCode: 'sg' },
      { name: 'Hong Kong', abbreviation: 'HK', flagCode: 'hk' },
    ];

    for (const country of countries) {
      await Country.findOneAndUpdate(
        { name: country.name },
        {
          name: country.name,
          abbreviation: country.abbreviation,
          flagCode: country.flagCode,
          isActive: true,
        },
        { upsert: true, new: true }
      );
    }

    console.log('🌍 Countries created/updated');

    // ─── Create Procedures ──────────────────────────────────────────────────
    const procedures = [
      { name: 'Filing', serviceCategory: 'Trademark' },
      { name: 'Renewal', serviceCategory: 'Trademark' },
      { name: 'Amendment', serviceCategory: 'Trademark' },
      { name: 'Opposition', serviceCategory: 'Trademark' },
      { name: 'Application', serviceCategory: 'Patent' },
      { name: 'Examination', serviceCategory: 'Patent' },
      { name: 'Grant', serviceCategory: 'Patent' },
      { name: 'Maintenance', serviceCategory: 'Patent' },
      { name: 'Registration', serviceCategory: 'Copyright' },
      { name: 'Infringement', serviceCategory: 'Litigation' },
      { name: 'Settlement', serviceCategory: 'Litigation' },
      { name: 'Appeal', serviceCategory: 'Design' },
    ];

    for (const procedure of procedures) {
      await Procedure.findOneAndUpdate(
        { name: procedure.name, serviceCategory: procedure.serviceCategory },
        {
          name: procedure.name,
          description: `${procedure.name} process for ${procedure.serviceCategory}`,
          serviceCategory: procedure.serviceCategory,
          isActive: true,
        },
        { upsert: true, new: true }
      );
    }

    console.log('📋 Procedures created/updated');

    // ─── Create Client Types ──────────────────────────────────────────────
    const clientTypes = [
      { name: 'Standard', description: 'Standard client' },
      { name: 'Preferred', description: 'Preferred client with discounts' },
      { name: 'VIP', description: 'VIP client with special treatment' },
      { name: 'Government', description: 'Government agency' },
      { name: 'Startup', description: 'Startup company' },
      { name: 'Educational', description: 'Educational institution' },
    ];

    for (const type of clientTypes) {
      await ClientType.findOneAndUpdate(
        { name: type.name },
        {
          name: type.name,
          description: type.description,
          isActive: true,
        },
        { upsert: true, new: true }
      );
    }

    console.log('🏷️ Client Types created/updated');

    // ─── Create Pricing Rules ──────────────────────────────────────────────
    const pricingRules = [
      {
        service: 'Trademark Registration',
        country: 'United Arab Emirates',
        procedure: 'Filing',
        basePrice: 500,
        discount: 0,
      },
      {
        service: 'Trademark Registration',
        country: 'United States',
        procedure: 'Filing',
        basePrice: 800,
        discount: 5,
      },
      {
        service: 'Patent Filing',
        country: 'United Arab Emirates',
        procedure: 'Application',
        basePrice: 1500,
        discount: 0,
      },
      {
        service: 'Patent Filing',
        country: 'United States',
        procedure: 'Application',
        basePrice: 2500,
        discount: 10,
      },
      {
        service: 'Copyright Registration',
        country: 'United Arab Emirates',
        procedure: 'Registration',
        basePrice: 300,
        discount: 0,
      },
      {
        service: 'Copyright Registration',
        country: 'United Kingdom',
        procedure: 'Registration',
        basePrice: 400,
        discount: 5,
      },
    ];

    for (const rule of pricingRules) {
      await PricingRule.findOneAndUpdate(
        { service: rule.service, country: rule.country, procedure: rule.procedure },
        {
          service: rule.service,
          country: rule.country,
          procedure: rule.procedure,
          basePrice: rule.basePrice,
          discount: rule.discount,
          isActive: true,
        },
        { upsert: true, new: true }
      );
    }

    console.log('💰 Pricing Rules created/updated');

    // ─── Create Clients ──────────────────────────────────────────────────
    const clients = [
      {
        name: 'Tech Innovations LLC',
        email: 'contact@techinnovations.com',
        clientType: 'Standard',
        country: 'United Arab Emirates',
      },
      {
        name: 'Global Brands Inc',
        email: 'info@globalbrands.com',
        clientType: 'VIP',
        country: 'United States',
      },
      {
        name: 'StartUp Hub',
        email: 'hello@startuphub.com',
        clientType: 'Startup',
        country: 'United Kingdom',
      },
      {
        name: 'Government Affairs Dept',
        email: 'legal@gov.ae',
        clientType: 'Government',
        country: 'United Arab Emirates',
      },
    ];

    for (const client of clients) {
      await Client.findOneAndUpdate(
        { email: client.email },
        {
          name: client.name,
          email: client.email,
          clientType: client.clientType,
          country: client.country,
          isActive: true,
        },
        { upsert: true, new: true }
      );
    }

    console.log('🏢 Clients created/updated');

    // ─── Create Sample Quotations ──────────────────────────────────────────
    const quotationData = [
      {
        quotationNumber: 'Q-2024-001',
        client: 'Tech Innovations LLC',
        services: ['Trademark Registration'],
        status: 'Draft',
        totalAmount: 500,
      },
      {
        quotationNumber: 'Q-2024-002',
        client: 'Global Brands Inc',
        services: ['Patent Filing', 'Trademark Registration'],
        status: 'Pending',
        totalAmount: 2300,
      },
      {
        quotationNumber: 'Q-2024-003',
        client: 'StartUp Hub',
        services: ['Copyright Registration'],
        status: 'Approved',
        totalAmount: 300,
      },
    ];

    for (const qData of quotationData) {
      const client = await Client.findOne({ name: qData.client });
      if (client) {
        await Quotation.findOneAndUpdate(
          { quotationNumber: qData.quotationNumber },
          {
            quotationNumber: qData.quotationNumber,
            client: client._id,
            services: qData.services,
            status: qData.status as any,
            totalAmount: qData.totalAmount,
            isActive: true,
          },
          { upsert: true, new: true }
        );
      }
    }

    console.log('📄 Quotations created/updated');

    return NextResponse.json(
      {
        success: true,
        message: '✅ Database seed completed successfully!',
        data: {
          roles: 3,
          users: 4,
          services: 8,
          countries: 15,
          procedures: 12,
          clientTypes: 6,
          pricingRules: 6,
          clients: 4,
          quotations: 3,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('❌ Seed error:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Seed failed',
      },
      { status: 500 }
    );
  }
}
