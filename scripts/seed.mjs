import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';

config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'aipt_db';

if (!MONGODB_URI) {
  console.error('❌  MONGODB_URI not set in .env.local');
  process.exit(1);
}

// ─── Schemas (matching actual models) ────────────────────────────────────────

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true },
    permissions: [
      {
        type: String,
        enum: [
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
    ],
  },
  { timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ['admin', 'manager', 'user'], default: 'user' },
    isActive: { type: Boolean, default: true },
    approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
  },
  { timestamps: true }
);
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String },
    category: {
      type: String,
      enum: ['Trademark', 'Patent', 'Copyright', 'Design', 'Litigation'],
      required: true,
    },
    basePrice: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const countrySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    abbreviation: { type: String, uppercase: true, trim: true },
    flagCode: { type: String, lowercase: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const procedureSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String },
    serviceCategory: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const clientTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String },
    multiplier: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const pricingRuleSchema = new mongoose.Schema(
  {
    serviceCategory: { type: String, required: true },
    procedureName: { type: String, required: true },
    countryName: { type: String, required: true },
    countryAbbreviation: { type: String },
    officialFee: { type: Number, default: 0 },
    attorneyFee: { type: Number, default: 0 },
    classFee: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const clientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    country: { type: String, trim: true },
    continent: { type: String, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    companyName: { type: String, trim: true },
    type: { type: String, enum: ['Individual', 'Company', 'Organization'], default: 'Company' },
    registrationNumber: { type: String, trim: true },
    taxId: { type: String, trim: true },
    notes: { type: String },
    status: { type: String, enum: ['Big', 'Small', 'New', 'Banned'] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const quotationSchema = new mongoose.Schema(
  {
    quotationNo: { type: String, unique: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    associteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Associte' },
    clientName: { type: String, required: true, trim: true },
    clientEmail: { type: String, trim: true },
    clientType: { type: String },
    inquiriesProject: { type: String, trim: true },
    service: {
      type: String,
      enum: ['Trademark', 'Patent', 'Copyright', 'Design', 'Litigation'],
      required: true,
    },
    procedure: { type: String, required: true },
    country: { type: String, required: true },
    numberOfClasses: { type: Number, default: 1 },
    requirementIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Requirement' }],
    fees: {
      governmentFee: { type: Number, default: 0 },
      serviceFee: { type: Number, default: 0 },
      classFee: { type: Number, default: 0 },
      procedureFee: { type: Number, default: 0 },
    },
    multiplier: { type: Number, default: 1 },
    subtotal: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    currency: { type: String, default: 'SAR' },
    status: { type: String, enum: ['Draft', 'Pending', 'Approved', 'Rejected'], default: 'Draft' },
    validDays: { type: Number, default: 30 },
    notes: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvalDate: { type: Date },
  },
  { timestamps: true }
);

const settingsSchema = new mongoose.Schema(
  {
    companyName: { type: String },
    companyEmail: { type: String },
    companyPhone: { type: String },
    companyAddress: { type: String },
    currency: { type: String, default: 'SAR' },
    defaultValidDays: { type: Number, default: 30 },
    termsAndConditions: { type: String },
  },
  { timestamps: true }
);

const Role = mongoose.models.Role || mongoose.model('Role', roleSchema);
const User = mongoose.models.User || mongoose.model('User', userSchema);
const Service = mongoose.models.Service || mongoose.model('Service', serviceSchema);
const Country = mongoose.models.Country || mongoose.model('Country', countrySchema);
const Procedure = mongoose.models.Procedure || mongoose.model('Procedure', procedureSchema);
const ClientType = mongoose.models.ClientType || mongoose.model('ClientType', clientTypeSchema);
const PricingRule = mongoose.models.PricingRule || mongoose.model('PricingRule', pricingRuleSchema);
const Client = mongoose.models.Client || mongoose.model('Client', clientSchema);
const Quotation = mongoose.models.Quotation || mongoose.model('Quotation', quotationSchema);
const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);

// ─── Seed Data ───────────────────────────────────────────────────────────────

// Default Roles with Permissions
const ROLES = [
  {
    name: 'admin',
    description: 'Full system access - manage all resources',
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
  {
    name: 'manager',
    description: 'Quotation and team management access',
    permissions: [
      'view_dashboard',
      'manage_users',
      'create_quotation',
      'view_quotation',
      'edit_quotation',
      'approve_quotation',
      'delete_quotation',
      'view_reports',
      'manage_clients',
      'manage_services',
      'manage_pricing',
      'export_data',
    ],
  },
  {
    name: 'user',
    description: 'Basic user access - create and view quotations',
    permissions: ['view_dashboard', 'create_quotation', 'view_quotation', 'edit_quotation'],
  },
];

const USERS = [
  { name: 'Admin User', email: 'admin@example.com', password: 'Admin@123456', role: 'admin', isActive: true, approvalStatus: 'approved' },
  { name: 'Manager User', email: 'manager@example.com', password: 'Manager@123456', role: 'manager', isActive: true, approvalStatus: 'approved' },
  { name: 'Regular User', email: 'user@example.com', password: 'User@123456', role: 'user', isActive: true, approvalStatus: 'approved' },
  { name: 'Pending User', email: 'pending@example.com', password: 'Pending@123456', role: 'user', isActive: false, approvalStatus: 'pending' },
  { name: 'Ahmed Al-Rashid', email: 'ahmed.rashid@example.com', password: 'Test@123456', role: 'user', isActive: true, approvalStatus: 'approved' },
  { name: 'Fatima Al-Dosari', email: 'fatima.dosari@example.com', password: 'Test@123456', role: 'user', isActive: true, approvalStatus: 'approved' },
];

const SERVICES = [
  { name: 'Trademark Registration', category: 'Trademark', basePrice: 2500, description: 'Register a new trademark in the target country' },
  { name: 'Trademark Renewal', category: 'Trademark', basePrice: 1800, description: 'Renew existing trademark registration' },
  { name: 'Trademark Opposition', category: 'Trademark', basePrice: 3500, description: 'File or respond to trademark opposition' },
  { name: 'Patent Filing', category: 'Patent', basePrice: 5000, description: 'File a new patent application' },
  { name: 'Patent Maintenance', category: 'Patent', basePrice: 2000, description: 'Annual maintenance fees for patent' },
  { name: 'Patent Prosecution', category: 'Patent', basePrice: 3500, description: 'Respond to patent examination reports' },
  { name: 'Design Registration', category: 'Design', basePrice: 1800, description: 'Register an industrial design' },
  { name: 'Design Renewal', category: 'Design', basePrice: 1200, description: 'Renew design registration' },
  { name: 'Copyright Registration', category: 'Copyright', basePrice: 1200, description: 'Register copyright for creative works' },
  { name: 'Copyright Licensing', category: 'Copyright', basePrice: 2000, description: 'Manage copyright licenses and agreements' },
  { name: 'IP Litigation', category: 'Litigation', basePrice: 8000, description: 'Legal representation in IP disputes' },
  { name: 'IP Consultation', category: 'Litigation', basePrice: 3000, description: 'Expert consultation on IP matters' },
];

const COUNTRIES = [
  { name: 'Saudi Arabia', abbreviation: 'SA', flagCode: 'sa' },
  { name: 'United Arab Emirates', abbreviation: 'AE', flagCode: 'ae' },
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

const PROCEDURES = [
  // Trademark procedures
  { name: 'Filing (New Application)', serviceCategory: 'Trademark', sortOrder: 1, description: 'Initial trademark filing' },
  { name: 'Prosecution', serviceCategory: 'Trademark', sortOrder: 2, description: 'Respond to office actions' },
  { name: 'Renewal', serviceCategory: 'Trademark', sortOrder: 3, description: 'Renew existing trademark registration' },
  { name: 'Opposition', serviceCategory: 'Trademark', sortOrder: 4, description: 'File or respond to trademark opposition' },
  { name: 'Cancellation', serviceCategory: 'Trademark', sortOrder: 5, description: 'Request cancellation of existing trademark' },
  // Patent procedures
  { name: 'Filing (New Application)', serviceCategory: 'Patent', sortOrder: 1, description: 'Initial patent application' },
  { name: 'Prosecution', serviceCategory: 'Patent', sortOrder: 2, description: 'Respond to examination reports' },
  { name: 'Renewal / Annuity', serviceCategory: 'Patent', sortOrder: 3, description: 'Annual maintenance fees' },
  { name: 'Amendment', serviceCategory: 'Patent', sortOrder: 4, description: 'Amend patent claims' },
  // Design procedures
  { name: 'Filing (New Application)', serviceCategory: 'Design', sortOrder: 1, description: 'Initial design registration' },
  { name: 'Renewal', serviceCategory: 'Design', sortOrder: 2, description: 'Renew design registration' },
  { name: 'Amendment', serviceCategory: 'Design', sortOrder: 3, description: 'Modify design registration' },
  // Copyright procedures
  { name: 'Registration', serviceCategory: 'Copyright', sortOrder: 1, description: 'Register copyright' },
  { name: 'Licensing', serviceCategory: 'Copyright', sortOrder: 2, description: 'Manage copyright licenses' },
  { name: 'Enforcement', serviceCategory: 'Copyright', sortOrder: 3, description: 'Enforce copyright rights' },
  // Litigation procedures
  { name: 'Filing Lawsuit', serviceCategory: 'Litigation', sortOrder: 1, description: 'Initiate legal proceedings' },
  { name: 'Defense', serviceCategory: 'Litigation', sortOrder: 2, description: 'Defend against IP claims' },
  { name: 'Settlement', serviceCategory: 'Litigation', sortOrder: 3, description: 'Negotiate and settle disputes' },
];

const CLIENT_TYPES = [
  { name: 'Standard', description: 'Standard client rate', multiplier: 1.0 },
  { name: 'Preferred', description: 'Preferred client — 10% discount', multiplier: 0.9 },
  { name: 'VIP', description: 'VIP client — 20% discount', multiplier: 0.8 },
  { name: 'Government', description: 'Government entity', multiplier: 1.1 },
  { name: 'Startup', description: 'Startup / SME rate', multiplier: 0.85 },
  { name: 'Educational', description: 'Educational institution', multiplier: 0.75 },
];

const PRICING_RULES = [
  // Trademark — Filing (Saudi Arabia)
  { serviceCategory: 'Trademark', procedureName: 'Filing (New Application)', countryName: 'Saudi Arabia', countryAbbreviation: 'SA', officialFee: 1500, attorneyFee: 2000, classFee: 300 },
  // Trademark — Filing (UAE)
  { serviceCategory: 'Trademark', procedureName: 'Filing (New Application)', countryName: 'United Arab Emirates', countryAbbreviation: 'AE', officialFee: 1800, attorneyFee: 2200, classFee: 350 },
  // Trademark — Filing (Kuwait)
  { serviceCategory: 'Trademark', procedureName: 'Filing (New Application)', countryName: 'Kuwait', countryAbbreviation: 'KW', officialFee: 1400, attorneyFee: 1900, classFee: 280 },
  // Trademark — Filing (Qatar)
  { serviceCategory: 'Trademark', procedureName: 'Filing (New Application)', countryName: 'Qatar', countryAbbreviation: 'QA', officialFee: 1600, attorneyFee: 2100, classFee: 320 },
  // Trademark — Filing (USA)
  { serviceCategory: 'Trademark', procedureName: 'Filing (New Application)', countryName: 'United States', countryAbbreviation: 'US', officialFee: 2500, attorneyFee: 3000, classFee: 400 },
  // Trademark — Filing (UK)
  { serviceCategory: 'Trademark', procedureName: 'Filing (New Application)', countryName: 'United Kingdom', countryAbbreviation: 'GB', officialFee: 2000, attorneyFee: 2500, classFee: 380 },
  // Trademark — Filing (Germany)
  { serviceCategory: 'Trademark', procedureName: 'Filing (New Application)', countryName: 'Germany', countryAbbreviation: 'DE', officialFee: 1900, attorneyFee: 2300, classFee: 360 },
  // Trademark — Filing (France)
  { serviceCategory: 'Trademark', procedureName: 'Filing (New Application)', countryName: 'France', countryAbbreviation: 'FR', officialFee: 1850, attorneyFee: 2250, classFee: 350 },
  // Trademark — Filing (China)
  { serviceCategory: 'Trademark', procedureName: 'Filing (New Application)', countryName: 'China', countryAbbreviation: 'CN', officialFee: 1200, attorneyFee: 1800, classFee: 250 },
  // Trademark — Renewal
  { serviceCategory: 'Trademark', procedureName: 'Renewal', countryName: 'Saudi Arabia', countryAbbreviation: 'SA', officialFee: 1200, attorneyFee: 1500, classFee: 250 },
  { serviceCategory: 'Trademark', procedureName: 'Renewal', countryName: 'United Arab Emirates', countryAbbreviation: 'AE', officialFee: 1400, attorneyFee: 1700, classFee: 280 },
  { serviceCategory: 'Trademark', procedureName: 'Renewal', countryName: 'United States', countryAbbreviation: 'US', officialFee: 1800, attorneyFee: 2200, classFee: 300 },
  // Patent — Filing
  { serviceCategory: 'Patent', procedureName: 'Filing (New Application)', countryName: 'Saudi Arabia', countryAbbreviation: 'SA', officialFee: 3000, attorneyFee: 4000, classFee: 0 },
  { serviceCategory: 'Patent', procedureName: 'Filing (New Application)', countryName: 'United Arab Emirates', countryAbbreviation: 'AE', officialFee: 3500, attorneyFee: 4500, classFee: 0 },
  { serviceCategory: 'Patent', procedureName: 'Filing (New Application)', countryName: 'United States', countryAbbreviation: 'US', officialFee: 5000, attorneyFee: 6000, classFee: 0 },
  { serviceCategory: 'Patent', procedureName: 'Filing (New Application)', countryName: 'Germany', countryAbbreviation: 'DE', officialFee: 4000, attorneyFee: 5000, classFee: 0 },
  { serviceCategory: 'Patent', procedureName: 'Filing (New Application)', countryName: 'China', countryAbbreviation: 'CN', officialFee: 2500, attorneyFee: 3500, classFee: 0 },
  // Patent — Maintenance
  { serviceCategory: 'Patent', procedureName: 'Renewal / Annuity', countryName: 'Saudi Arabia', countryAbbreviation: 'SA', officialFee: 800, attorneyFee: 1000, classFee: 0 },
  { serviceCategory: 'Patent', procedureName: 'Renewal / Annuity', countryName: 'United States', countryAbbreviation: 'US', officialFee: 1500, attorneyFee: 2000, classFee: 0 },
  // Design — Filing
  { serviceCategory: 'Design', procedureName: 'Filing (New Application)', countryName: 'Saudi Arabia', countryAbbreviation: 'SA', officialFee: 1000, attorneyFee: 1500, classFee: 0 },
  { serviceCategory: 'Design', procedureName: 'Filing (New Application)', countryName: 'United Arab Emirates', countryAbbreviation: 'AE', officialFee: 1200, attorneyFee: 1700, classFee: 0 },
  { serviceCategory: 'Design', procedureName: 'Filing (New Application)', countryName: 'United States', countryAbbreviation: 'US', officialFee: 2000, attorneyFee: 2800, classFee: 0 },
  // Copyright — Registration
  { serviceCategory: 'Copyright', procedureName: 'Registration', countryName: 'Saudi Arabia', countryAbbreviation: 'SA', officialFee: 500, attorneyFee: 800, classFee: 0 },
  { serviceCategory: 'Copyright', procedureName: 'Registration', countryName: 'United States', countryAbbreviation: 'US', officialFee: 750, attorneyFee: 1200, classFee: 0 },
];

const CLIENTS = [
  { name: 'Al Khaleej Trading Company', email: 'info@alkhaleej.com', phone: '+966 11 234 5678', country: 'Saudi Arabia', city: 'Riyadh', type: 'Company', status: 'Big', companyName: 'Al Khaleej Trading' },
  { name: 'TechVision LLC', email: 'legal@techvision.ae', phone: '+971 4 567 8901', country: 'United Arab Emirates', city: 'Dubai', type: 'Company', status: 'Big', companyName: 'TechVision LLC' },
  { name: 'Global Innovations Inc.', email: 'ip@globalinnovations.com', phone: '+1 212 555 0100', country: 'United States', city: 'New York', type: 'Company', status: 'Big', companyName: 'Global Innovations Inc' },
  { name: 'Saudi Industrial Corporation', email: 'trademarks@sic.sa', phone: '+966 13 444 5555', country: 'Saudi Arabia', city: 'Dammam', type: 'Company', status: 'Small', companyName: 'Saudi Industrial Corp' },
  { name: 'Dr. Ahmed Al-Rashid', email: 'ahmed.rashid@company.com', phone: '+966 55 123 4567', country: 'Saudi Arabia', city: 'Jeddah', type: 'Individual', status: 'New' },
  { name: 'Kuwait Finance House', email: 'legal@kfh.com.kw', phone: '+965 2224 0000', country: 'Kuwait', city: 'Kuwait City', type: 'Company', status: 'Big', companyName: 'Kuwait Finance House' },
  { name: 'Emirates Digital Solutions', email: 'contracts@edsc.ae', phone: '+971 2 333 4444', country: 'United Arab Emirates', city: 'Abu Dhabi', type: 'Company', status: 'Small', companyName: 'Emirates Digital' },
  { name: 'Qatar Energy Services', email: 'ip@qes.qa', phone: '+974 4444 5555', country: 'Qatar', city: 'Doha', type: 'Company', status: 'New', companyName: 'Qatar Energy' },
  { name: 'Fatima Al-Dosari', email: 'fatima.dosari@business.com', phone: '+966 56 789 0123', country: 'Saudi Arabia', city: 'Riyadh', type: 'Individual', status: 'Small' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(emoji, msg) {
  console.log(`  ${emoji}  ${msg}`);
}

async function upsertMany(Model, docs, keyField = 'name') {
  let created = 0, skipped = 0;
  for (const doc of docs) {
    const exists = await Model.findOne({ [keyField]: doc[keyField] });
    if (exists) { skipped++; continue; }
    await Model.create(doc);
    created++;
  }
  return { created, skipped };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('\n🌱  IP Law Firm — Database Seed\n');

  await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB });
  log('✅', `Connected to MongoDB  (db: ${MONGODB_DB})`);

  // Roles (FIRST - before users)
  let rc = 0, rs = 0;
  for (const r of ROLES) {
    const exists = await Role.findOne({ name: r.name });
    if (exists) { rs++; continue; }
    await Role.create(r);
    rc++;
  }
  log('🔐', `Roles        created: ${rc}  skipped: ${rs}`);

  // Users (with proper approval status)
  let uc = 0, us = 0;
  const adminUser = { email: 'admin@example.com' }; // will be fetched after creation
  for (const u of USERS) {
    const exists = await User.findOne({ email: u.email });
    if (exists) { us++; continue; }
    
    const userData = {
      name: u.name,
      email: u.email,
      password: u.password,
      role: u.role,
      isActive: u.isActive !== false,
      approvalStatus: u.approvalStatus || 'approved',
      approvedBy: u.approvalStatus === 'approved' ? null : undefined,
      approvedAt: u.approvalStatus === 'approved' ? new Date() : undefined,
    };
    
    const user = new User(userData);
    await user.save();
    uc++;
  }
  log('👤', `Users        created: ${uc}  skipped: ${us}`);

  // Services
  let r = await upsertMany(Service, SERVICES);
  log('⚙️ ', `Services     created: ${r.created}  skipped: ${r.skipped}`);

  // Countries
  r = await upsertMany(Country, COUNTRIES);
  log('🌍', `Countries    created: ${r.created}  skipped: ${r.skipped}`);

  // Procedures (key = name + serviceCategory)
  let pc = 0, ps = 0;
  for (const p of PROCEDURES) {
    const exists = await Procedure.findOne({ name: p.name, serviceCategory: p.serviceCategory });
    if (exists) { ps++; continue; }
    await Procedure.create(p);
    pc++;
  }
  log('📋', `Procedures   created: ${pc}  skipped: ${ps}`);

  // Client Types
  r = await upsertMany(ClientType, CLIENT_TYPES);
  log('🏷️ ', `Client Types created: ${r.created}  skipped: ${r.skipped}`);

  // Pricing Rules (key = serviceCategory + procedureName + countryName)
  let prc = 0, prs = 0;
  for (const rule of PRICING_RULES) {
    const exists = await PricingRule.findOne({
      serviceCategory: rule.serviceCategory,
      procedureName: rule.procedureName,
      countryName: rule.countryName,
    });
    if (exists) { prs++; continue; }
    await PricingRule.create(rule);
    prc++;
  }
  log('💰', `Pricing Rules created: ${prc}  skipped: ${prs}`);

  // Clients
  r = await upsertMany(Client, CLIENTS, 'email');
  log('🏢', `Clients      created: ${r.created}  skipped: ${r.skipped}`);

  // Settings
  const settingsExists = await Settings.findOne({});
  if (!settingsExists) {
    await Settings.create({
      companyName: 'IP Law Firm',
      companyEmail: 'info@iplawfirm.com',
      companyPhone: '+966 11 000 0000',
      companyAddress: 'King Fahd Road, Riyadh, Saudi Arabia',
      currency: 'SAR',
      defaultValidDays: 30,
      termsAndConditions: 'This quotation is valid for the specified number of days from the issue date. All fees are subject to applicable taxes.',
    });
    log('⚙️ ', `Settings     created: 1  skipped: 0`);
  } else {
    log('⚙️ ', `Settings     created: 0  skipped: 1`);
  }

  // Sample Quotations
  const admin = await User.findOne({ role: 'admin' });
  const allClients = await Client.find({ isActive: true });

  const sampleQuotations = [
    {
      clientName: 'Al Khaleej Trading Company',
      clientEmail: 'info@alkhaleej.com',
      clientType: 'Standard',
      service: 'Trademark',
      procedure: 'Filing (New Application)',
      country: 'Saudi Arabia',
      numberOfClasses: 3,
      fees: { governmentFee: 1500, serviceFee: 2000, classFee: 300, procedureFee: 0 },
      multiplier: 1.0,
      currency: 'SAR',
      status: 'Approved',
      validDays: 30,
      approvalDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
    {
      clientName: 'TechVision LLC',
      clientEmail: 'legal@techvision.ae',
      clientType: 'Preferred',
      service: 'Patent',
      procedure: 'Filing (New Application)',
      country: 'United Arab Emirates',
      numberOfClasses: 1,
      fees: { governmentFee: 3500, serviceFee: 4500, classFee: 0, procedureFee: 0 },
      multiplier: 0.9,
      currency: 'SAR',
      status: 'Pending',
      validDays: 30,
    },
    {
      clientName: 'Global Innovations Inc.',
      clientEmail: 'ip@globalinnovations.com',
      clientType: 'VIP',
      service: 'Trademark',
      procedure: 'Renewal',
      country: 'United States',
      numberOfClasses: 2,
      fees: { governmentFee: 1800, serviceFee: 2200, classFee: 300, procedureFee: 0 },
      multiplier: 0.8,
      currency: 'SAR',
      status: 'Approved',
      validDays: 30,
      approvalDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    },
    {
      clientName: 'Saudi Industrial Corporation',
      clientEmail: 'trademarks@sic.sa',
      clientType: 'Standard',
      service: 'Design',
      procedure: 'Filing (New Application)',
      country: 'Saudi Arabia',
      numberOfClasses: 1,
      fees: { governmentFee: 1000, serviceFee: 1500, classFee: 0, procedureFee: 0 },
      multiplier: 1.0,
      currency: 'SAR',
      status: 'Draft',
      validDays: 30,
    },
    {
      clientName: 'Dr. Ahmed Al-Rashid',
      clientEmail: 'ahmed.rashid@company.com',
      clientType: 'Standard',
      service: 'Trademark',
      procedure: 'Filing (New Application)',
      country: 'Germany',
      numberOfClasses: 1,
      fees: { governmentFee: 1900, serviceFee: 2300, classFee: 360, procedureFee: 0 },
      multiplier: 1.0,
      currency: 'SAR',
      status: 'Pending',
      validDays: 30,
    },
    {
      clientName: 'Kuwait Finance House',
      clientEmail: 'legal@kfh.com.kw',
      clientType: 'Government',
      service: 'Trademark',
      procedure: 'Filing (New Application)',
      country: 'Kuwait',
      numberOfClasses: 5,
      fees: { governmentFee: 1400, serviceFee: 1900, classFee: 280, procedureFee: 0 },
      multiplier: 1.1,
      currency: 'SAR',
      status: 'Approved',
      validDays: 30,
      approvalDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      clientName: 'Emirates Digital Solutions',
      clientEmail: 'contracts@edsc.ae',
      clientType: 'Preferred',
      service: 'Copyright',
      procedure: 'Registration',
      country: 'United Arab Emirates',
      numberOfClasses: 1,
      fees: { governmentFee: 500, serviceFee: 800, classFee: 0, procedureFee: 0 },
      multiplier: 0.9,
      currency: 'SAR',
      status: 'Draft',
      validDays: 30,
    },
  ];

  let qc = 0, qs = 0;
  for (let i = 0; i < sampleQuotations.length; i++) {
    const q = sampleQuotations[i];
    const year = new Date().getFullYear();
    const quotationNo = `QT-${year}-${String(i + 1).padStart(4, '0')}`;
    const exists = await Quotation.findOne({ quotationNo });
    if (exists) { qs++; continue; }

    const subtotal = q.fees.governmentFee + q.fees.serviceFee + (q.fees.classFee * q.numberOfClasses) + q.fees.procedureFee;
    const total = subtotal * q.multiplier;

    const client = allClients.find(c => c.email === q.clientEmail);
    await Quotation.create({
      ...q,
      quotationNo,
      clientId: client?._id,
      subtotal,
      total,
      createdBy: admin?._id,
      approvedBy: q.status === 'Approved' ? admin?._id : undefined,
    });
    qc++;
  }
  log('📄', `Quotations   created: ${qc}  skipped: ${qs}`);

  console.log('\n✅  Seed complete!\n');
  console.log('  Demo accounts:\n');
  console.log('  ┌────────────────────────────────┬──────────────────────┬──────────────────┐');
  console.log('  │ Name                           │ Email                │ Password         │');
  console.log('  ├────────────────────────────────┼──────────────────────┼──────────────────┤');
  console.log('  │ Admin User                     │ admin@example.com    │ Admin@123456     │');
  console.log('  │ Manager User                   │ manager@example.com  │ Manager@123456   │');
  console.log('  │ Regular User                   │ user@example.com     │ User@123456      │');
  console.log('  │ Pending User (Not Approved)    │ pending@example.com  │ Pending@123456   │');
  console.log('  └────────────────────────────────┴──────────────────────┴──────────────────┘\n');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌  Seed failed:', err.message);
  process.exit(1);
});
